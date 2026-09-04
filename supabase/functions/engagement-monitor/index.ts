import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  isAuthorized,
  mapCandidateRow,
  evaluateForSweep,
  shouldDeliverPush,
  shouldTriggerWeeklyReport,
  summarizeSweep,
} from "./logic.js";

/**
 * engagement-monitor
 *
 * The single I/O boundary for the adherence/engagement-detection agent
 * (Agent 2): pages coach-supervised athletes past warm-up via
 * `get_engagement_candidates`, evaluates each through the pure
 * `engagementCore` rulebook, and persists at most one open
 * `engagement_silence` alert per athlete via `upsert_engagement_alert`
 * (ON CONFLICT dedup) — delivering in-app + best-effort push to the
 * athlete's active coach only.
 *
 * NEVER writes `training_sessions`, never creates/regenerates any training
 * plan, and never contacts the athlete directly
 * (engagement-agent-runtime: Agent Scope Boundary).
 *
 * Invoked from two directions:
 *   - scheduled: the `engagement-daily-sweep` pg_cron job (migration 5)
 *   - manual: `{mode:'athlete', athlete_id}` or `{mode:'sweep', dryRun:true}`
 *     for the mandatory pre-enable dry run (Dry-Run Mode requirement)
 *
 * Reactive resolve (the OTHER half of this capability) does NOT live here —
 * it is enforced by AFTER triggers at the data layer plus a direct
 * `.rpc('resolve_engagement_alerts', ...)` call from `strava-webhook`'s
 * `processNewActivity` (see that file's wiring).
 *
 * See: openspec/changes/adherence-detection-agent/design.md
 */

const DEFAULT_SWEEP_LIMIT = 200;
const WARMUP_DAYS = 21;
const WINDOW_DAYS = 10; // = SILENCE_WARNING_DAYS / SUPPRESSION_WINDOW_DAYS in engagementCore.js

// Kill switch — DEFAULTS TO FALSE, unlike training-load-monitor's
// TRAINING_LOAD_ALERTS_ENABLED (defaults true). This agent must be silent
// by construction on a bare deploy: until the mandatory dry run has been
// reviewed and the flag is explicitly flipped, no alert is ever written,
// regardless of the `dryRun` request body param (see `effectiveDryRun`
// below — the kill switch and the explicit dryRun param share one code
// path, so "disabled" IS "always dry-run", not a separate disabled state).
const ALERTS_ENABLED = (Deno.env.get("ENGAGEMENT_ALERTS_ENABLED") ?? "false").toLowerCase() === "true";

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

// Structured log helper — JSON single-line for observability (mirrors
// training-load-monitor and strava-webhook).
function logEvent(event: string, payload: Record<string, unknown> = {}) {
  try {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ event, ts: new Date().toISOString(), ...payload }));
  } catch {
    // no-op
  }
}

// Local calendar date in Europe/Madrid. NEVER `toISOString().split('T')[0]`
// (the project's documented `timezone_date_bug` pattern) — that reads the
// UTC calendar date, which is wrong for anyone silent-checked after ~22:00
// local in summer.
function todayLocalStr(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
}

// Pure UTC-anchored date math on an already-resolved 'YYYY-MM-DD' string —
// not the ambient-clock anti-pattern (mirrors training-load-monitor's
// addDaysISO / engagementCore's daysBetween).
function addDaysISO(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Single-athlete candidate lookup for `{mode:'athlete'}` (manual/debug
// invocation) — deliberately NOT routed through get_engagement_candidates,
// which is sweep-paginated and pre-filters on warm-up; evaluateEngagement's
// own gate 1 already handles "not past warm-up" -> null, so this path lets
// that gate (not a second, redundant filter) decide. Reads the same four
// signal-of-life columns + planned-session count the RPC computes, for one
// athlete_id only. Returns null when there is no active coach relationship
// at all (no recipient to alert).
async function fetchSingleCandidate(supabase: SupabaseAdmin, athleteId: string, today: string) {
  const { data: relationship, error: relErr } = await supabase
    .from("coach_athlete_relationship")
    .select("coach_id, start_date")
    .eq("athlete_id", athleteId)
    .eq("status", "active")
    .maybeSingle();
  if (relErr || !relationship) return null;

  const [sessionRes, wellnessRes, stravaRes, chatRes, plannedRes] = await Promise.all([
    supabase
      .from("training_sessions")
      .select("completed_at")
      .eq("athlete_id", athleteId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("wellness_log")
      .select("date")
      .eq("athlete_id", athleteId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("strava_activities")
      .select("start_date_local")
      .eq("athlete_id", athleteId)
      .eq("deleted", false)
      .order("start_date_local", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("chat_messages")
      .select("created_at")
      .eq("sender_id", athleteId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("training_sessions")
      .select("id", { count: "exact", head: true })
      .eq("athlete_id", athleteId)
      .gte("scheduled_date", addDaysISO(today, -WINDOW_DAYS))
      .lte("scheduled_date", today),
  ]);

  return {
    athlete_id: athleteId,
    coach_id: relationship.coach_id as string,
    start_date: relationship.start_date as string | null,
    last_session_completed_at: (sessionRes.data?.completed_at as string | undefined) ?? null,
    last_wellness_date: (wellnessRes.data?.date as string | undefined) ?? null,
    last_strava_at: (stravaRes.data?.start_date_local as string | undefined) ?? null,
    last_athlete_message_at: (chatRes.data?.created_at as string | undefined) ?? null,
    planned_in_window: plannedRes.count ?? 0,
  };
}

async function fetchCandidates(supabase: SupabaseAdmin, today: string, limit: number, offset: number) {
  const { data, error } = await supabase.rpc("get_engagement_candidates", {
    p_today: today,
    p_warmup_days: WARMUP_DAYS,
    p_window_days: WINDOW_DAYS,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) {
    logEvent("engagement_monitor.candidates_query_failed", { error: error.message });
    return { rows: [], error: error.message };
  }
  return { rows: (data || []) as Array<Record<string, unknown>>, error: null };
}

type OpenAlert = { severity: string };

// Read-only. Batches the "does an open alert already exist" lookup for a
// whole page of candidates in one round trip, instead of N queries.
async function fetchOpenAlertsByAthlete(
  supabase: SupabaseAdmin,
  athleteIds: string[]
): Promise<Record<string, OpenAlert>> {
  if (athleteIds.length === 0) return {};
  const { data, error } = await supabase
    .from("athlete_engagement_alerts")
    .select("athlete_id, severity")
    .in("athlete_id", athleteIds)
    .eq("status", "open");
  if (error) {
    logEvent("engagement_monitor.open_alerts_fetch_failed", { error: error.message });
    return {};
  }
  const map: Record<string, OpenAlert> = {};
  for (const row of data || []) {
    map[row.athlete_id as string] = { severity: row.severity as string };
  }
  return map;
}

async function upsertAlert(
  supabase: SupabaseAdmin,
  params: {
    athleteId: string;
    recipientId: string;
    alertType: string;
    severity: string;
    metricDate: string;
    silenceDays: number;
    metrics: Record<string, unknown>;
    messageEs: string;
  }
) {
  const { data, error } = await supabase.rpc("upsert_engagement_alert", {
    p_athlete_id: params.athleteId,
    p_recipient_id: params.recipientId,
    p_alert_type: params.alertType,
    p_severity: params.severity,
    p_metric_date: params.metricDate,
    p_silence_days: params.silenceDays,
    p_metrics: params.metrics,
    p_message_es: params.messageEs,
  });
  if (error) {
    logEvent("engagement_monitor.alert_upsert_failed", {
      athlete_id: params.athleteId,
      alert_type: params.alertType,
      error: error.message,
    });
    return null;
  }
  return Array.isArray(data) ? data[0] : data;
}

// Best-effort push delivery — reused from Agent 1, NOT recreated. Failure
// MUST NOT block the in-app alert row, which is already committed by the
// time this is called (Alert Delivery Routing: "Push failure does not
// block alert creation").
async function deliverPush(supabase: SupabaseAdmin, recipientId: string, messageEs: string) {
  try {
    const { error } = await supabase.rpc("send_push_notification", {
      p_user_ids: [recipientId],
      p_title: "Alerta de seguimiento",
      p_body: messageEs,
      p_url: "/team-health",
      p_tag: "tt-engagement",
    });
    if (error) {
      logEvent("engagement_monitor.push_failed", { recipient_id: recipientId, error: error.message });
    }
  } catch (err) {
    logEvent("engagement_monitor.push_failed", { recipient_id: recipientId, error: String(err) });
  }
}

type ProcessResult = {
  evaluated: boolean;
  finding: Record<string, unknown> | null;
  decision: string;
  reason: string | null;
  alerted: boolean;
};

// Process ONE candidate: classify, and — unless this is an (explicit or
// kill-switch-forced) dry run — persist the finding and best-effort
// deliver. `openAlert` is read once per page in fetchOpenAlertsByAthlete,
// used only to compute the dry-run-facing `decision`; the ACTUAL delivery
// decision for a real write always comes from the RPC's own atomic
// is_new/escalated result (shouldDeliverPush), never from this
// pre-write `decision` — see logic.js's doc comments for the race-safety
// rationale (mirrors training-load-monitor/index.ts exactly).
async function processCandidate(
  supabase: SupabaseAdmin,
  row: Record<string, unknown>,
  today: string,
  openAlert: OpenAlert | null,
  effectiveDryRun: boolean
): Promise<ProcessResult> {
  const candidate = mapCandidateRow(row);
  const result = evaluateForSweep(candidate, openAlert, today);

  if (!result.finding || effectiveDryRun) {
    return { evaluated: true, finding: result.finding, decision: result.decision, reason: result.reason, alerted: false };
  }

  const upserted = await upsertAlert(supabase, {
    athleteId: candidate.athleteId!,
    recipientId: candidate.coachId!,
    alertType: result.finding.alertType,
    severity: result.finding.severity,
    metricDate: today,
    silenceDays: result.finding.silenceDays,
    metrics: result.finding.metrics,
    messageEs: result.finding.messageEs,
  });

  if (upserted && shouldDeliverPush(upserted)) {
    await deliverPush(supabase, candidate.coachId!, result.finding.messageEs);
  }

  // Reactive handoff to weekly-ai-reports: danger tier only, on creation or
  // warning->danger escalation. Fire-and-forget — zero awaits on the
  // alerting path; its failure must not affect alert creation or delivery
  // (engagement-agent-runtime delta: "Reactive Report Trigger").
  if (shouldTriggerWeeklyReport(result.finding, upserted)) {
    triggerWeeklyReport(candidate.athleteId!, candidate.coachId!, upserted?.alert_id ?? null);
  }

  return {
    evaluated: true,
    finding: result.finding,
    decision: result.decision,
    reason: result.reason,
    alerted: !!upserted,
  };
}

async function runSweep(
  supabase: SupabaseAdmin,
  today: string,
  limit: number,
  offset: number,
  dryRun: boolean
) {
  // Silent-by-construction: the kill switch and the explicit dryRun param
  // share one effective flag. When ENGAGEMENT_ALERTS_ENABLED is false (the
  // default), every sweep behaves as a dry run regardless of the request
  // body — a bare deploy cannot write an alert.
  const effectiveDryRun = dryRun === true || !ALERTS_ENABLED;

  const { rows, error } = await fetchCandidates(supabase, today, limit, offset);
  if (error) {
    return { processed: 0, error };
  }

  const athleteIds = rows.map((r) => r.athlete_id as string);
  const openAlertsByAthlete = await fetchOpenAlertsByAthlete(supabase, athleteIds);

  const results: ProcessResult[] = [];
  let alertCount = 0;
  for (const row of rows) {
    const athleteId = row.athlete_id as string;
    const openAlert = openAlertsByAthlete[athleteId] || null;
    // eslint-disable-next-line no-await-in-loop
    const result = await processCandidate(supabase, row, today, openAlert, effectiveDryRun);
    results.push(result);
    if (result.alerted) alertCount += 1;
  }

  const summary = summarizeSweep(results.map((r) => ({ finding: r.finding, decision: r.decision, reason: r.reason })));

  logEvent("engagement_monitor.sweep_page_summary", {
    today,
    limit,
    offset,
    dry_run: effectiveDryRun,
    kill_switch_enabled: ALERTS_ENABLED,
    ...summary,
  });

  return {
    processed: rows.length,
    fullPage: rows.length === limit,
    alertCount,
    dryRun: effectiveDryRun,
    summary,
  };
}

// Fire-and-forget reactive handoff to weekly-ai-reports: danger tier only,
// on creation or warning->danger escalation. Zero awaits on the alerting
// path; its failure must not affect alert creation or delivery
// (engagement-agent-runtime delta: "Reactive Report Trigger"). Mirrors
// chainNextSweepPage / training-load-monitor's triggerPlanningAgent shape
// verbatim: `.then/.catch` attached BEFORE the promise is handed to
// EdgeRuntime.waitUntil, inside a try/catch around the waitUntil call
// itself, so an unhandled rejection can never tear down the isolate.
function triggerWeeklyReport(athleteId: string, coachId: string, alertId: string | null) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  // CRITICAL — do NOT copy chainNextSweepPage's `Bearer ${cronSecret ||
  // serviceRoleKey}`. `weekly-ai-reports` does not accept CRON_SECRET at
  // all: its auth is the `x-supabase-cron-job: true` header, OR a
  // service-role Bearer, OR a valid user JWT. A Bearer CRON_SECRET falls
  // into the JWT branch, fails supabase.auth.getUser(), and 401s —
  // silently, in a fire-and-forget call nobody is awaiting. (Same failure
  // class as the documented CRON_SECRET rotation that left
  // cleanup-gym-files 401ing unnoticed.) Service-role only.
  const task = fetch(`${supabaseUrl}/functions/v1/weekly-ai-reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    // alert_id is passed for log correlation only; weekly-ai-reports
    // parses it and never branches on it.
    body: JSON.stringify({ mode: "athlete", athlete_id: athleteId, coach_id: coachId, alert_id: alertId }),
  })
    .then(() => {
      logEvent("engagement_monitor.weekly_report_triggered", { athlete_id: athleteId, alert_id: alertId });
    })
    .catch((err) => {
      logEvent("engagement_monitor.weekly_report_trigger_failed", {
        athlete_id: athleteId,
        alert_id: alertId,
        error: String(err),
      });
    });

  try {
    // @ts-ignore EdgeRuntime.waitUntil is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(task);
  } catch {
    // Fall-through: promise still runs in background
  }
}

// Self-chain the next sweep page in the background, fire-and-forget,
// mirroring training-load-monitor's chainNextSweepPage shape exactly.
function chainNextSweepPage(authHeader: string, limit: number, nextOffset: number, dryRun: boolean) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  const task = fetch(`${supabaseUrl}/functions/v1/engagement-monitor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({ mode: "sweep", limit, offset: nextOffset, dryRun }),
  })
    .then(() => {
      logEvent("engagement_monitor.sweep_chained", { offset: nextOffset });
    })
    .catch((err) => {
      logEvent("engagement_monitor.sweep_chain_failed", { offset: nextOffset, error: String(err) });
    });

  try {
    // @ts-ignore EdgeRuntime.waitUntil is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(task);
  } catch {
    // Fall-through: promise still runs in background
  }
}

Deno.serve(async (req: Request) => {
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authHeader = req.headers.get("Authorization");

  if (!isAuthorized(authHeader, { cronSecret, serviceRoleKey })) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const supabase = getSupabaseAdmin();
  const today = todayLocalStr();

  try {
    if (body.mode === "athlete") {
      const athleteId = body.athlete_id as string | undefined;
      if (!athleteId) {
        return new Response(JSON.stringify({ error: "athlete_id required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const row = await fetchSingleCandidate(supabase, athleteId, today);

      if (!row) {
        return new Response(
          JSON.stringify({ mode: "athlete", athlete_id: athleteId, evaluated: false, reason: "not_eligible" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      const effectiveDryRun = body.dryRun === true || !ALERTS_ENABLED;
      const openAlertsByAthlete = await fetchOpenAlertsByAthlete(supabase, [athleteId]);
      const result = await processCandidate(
        supabase,
        row,
        today,
        openAlertsByAthlete[athleteId] || null,
        effectiveDryRun
      );

      return new Response(JSON.stringify({ mode: "athlete", athlete_id: athleteId, dryRun: effectiveDryRun, ...result }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (body.mode === "sweep") {
      const limit = Number(body.limit) || DEFAULT_SWEEP_LIMIT;
      const offset = Number(body.offset) || 0;
      const dryRun = body.dryRun === true;

      const sweepResult = await runSweep(supabase, today, limit, offset, dryRun);

      if (sweepResult.error) {
        return new Response(JSON.stringify({ error: "sweep query failed" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (sweepResult.fullPage) {
        chainNextSweepPage(`Bearer ${cronSecret || serviceRoleKey}`, limit, offset + limit, dryRun);
      }

      return new Response(
        JSON.stringify({
          mode: "sweep",
          processed: sweepResult.processed,
          dryRun: sweepResult.dryRun,
          alertCount: sweepResult.alertCount,
          summary: sweepResult.summary,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "invalid mode" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    logEvent("engagement_monitor.unhandled_error", { error: String(err) });
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

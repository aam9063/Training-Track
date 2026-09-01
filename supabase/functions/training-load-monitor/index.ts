import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ALERT_TYPES,
  CALC_VERSION,
  buildDailySeries,
  computeLoadSeries,
  isoWeekStart,
  isoWeekEnd,
  summarizeWeekSessions,
  evaluateLoad,
} from "../_shared/trainingLoadCore.js";
import { isAuthorized, resolveRecipientId, planReconciliation } from "./logic.js";

/**
 * training-load-monitor
 *
 * The single I/O boundary for the training-load agent: recomputes
 * `daily_training_load` from `strava_activities` (+ `training_sessions` for
 * the two session-derived signals) via the canonical core module, persists
 * the batch, then reconciles the 4-signal alert rulebook into
 * `training_load_alerts`.
 *
 * NEVER writes `training_sessions` and NEVER creates/regenerates any
 * training plan (training-load-agent-runtime: Agent Scope Boundary).
 *
 * Invoked from two directions:
 *   - reactive: strava-webhook's `triggerLoadRecalc` (EdgeRuntime.waitUntil)
 *   - scheduled: the `training-load-daily-sweep` pg_cron job (migration 6)
 *
 * See: openspec/changes/training-load-monitoring-agent/design.md
 */

const RECOMPUTE_WINDOW_DAYS = 189; // reads [today-189d, today]
const PERSIST_LAST_N = 120; // batch-upsert the last 120 computed rows
const DEFAULT_SWEEP_LIMIT = 200;
const SWEEP_CANDIDATE_LOOKBACK_DAYS = 30; // p_since for get_athletes_needing_load_refresh

// Kill switch (task 3.3): recompute/persist always runs; alert
// evaluation/creation/delivery is skipped entirely when false.
const ALERTS_ENABLED = (Deno.env.get("TRAINING_LOAD_ALERTS_ENABLED") ?? "true").toLowerCase() !== "false";

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

// Structured log helper — JSON single-line for observability (mirrors strava-webhook).
function logEvent(event: string, payload: Record<string, unknown> = {}) {
  try {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ event, ts: new Date().toISOString(), ...payload }));
  } catch {
    // no-op
  }
}

// Local calendar date in Europe/Madrid. NEVER `toISOString().split('T')[0]`
// (see the project's documented `timezone_date_bug` pattern) — that reads
// the UTC calendar date, which is wrong for anyone training after ~22:00
// local in summer.
function todayLocalStr(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
}

// Pure UTC-anchored date math on an already-resolved 'YYYY-MM-DD' string —
// not the ambient-clock anti-pattern (mirrors trainingLoadCore.js's addDaysUTC).
function addDaysISO(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function fetchAthleteProfile(supabase: SupabaseAdmin, athleteId: string) {
  const { data, error } = await supabase
    .from("athletes")
    .select("lactate_threshold_pace, lactate_threshold_hr")
    .eq("id", athleteId)
    .maybeSingle();
  if (error) {
    logEvent("training_load_monitor.profile_fetch_failed", { athlete_id: athleteId, error: error.message });
    return {};
  }
  return data || {};
}

async function fetchActivities(supabase: SupabaseAdmin, athleteId: string, fromStr: string) {
  const { data, error } = await supabase
    .from("strava_activities")
    .select("type, start_date_local, distance, moving_time, elapsed_time, average_heartrate")
    .eq("athlete_id", athleteId)
    .eq("deleted", false)
    .gte("start_date_local", `${fromStr}T00:00:00Z`);
  if (error) {
    logEvent("training_load_monitor.activities_fetch_failed", { athlete_id: athleteId, error: error.message });
    return [];
  }
  return data || [];
}

// Read-only. Reads the WHOLE ISO week (Monday-Sunday), not truncated at
// today — design's "Denominator" decision, literal spec reading. No
// `coach_id` filter: independent athletes have no coach row and must still
// be evaluated.
async function fetchWeekSessions(supabase: SupabaseAdmin, athleteId: string, weekStart: string, weekEnd: string) {
  const { data, error } = await supabase
    .from("training_sessions")
    .select("scheduled_date, status, rpe_score")
    .eq("athlete_id", athleteId)
    .gte("scheduled_date", weekStart)
    .lte("scheduled_date", weekEnd);
  if (error) {
    logEvent("training_load_monitor.sessions_fetch_failed", { athlete_id: athleteId, error: error.message });
    return [];
  }
  return data || [];
}

type LoadSeriesRow = ReturnType<typeof computeLoadSeries>[number];

async function persistLoadRows(supabase: SupabaseAdmin, athleteId: string, rows: LoadSeriesRow[]) {
  if (rows.length === 0) return;
  const nowIso = new Date().toISOString();
  const payload = rows.map((r) => ({
    athlete_id: athleteId,
    date: r.date,
    tss: r.tss,
    ctl: r.ctl,
    atl: r.atl,
    tsb: r.tsb,
    chronic_load_28: r.chronicLoad28,
    ramp_rate: r.rampRate,
    calc_version: CALC_VERSION,
    computed_at: nowIso,
    low_confidence: r.lowConfidence,
    source: "strava",
  }));

  const { error } = await supabase.from("daily_training_load").upsert(payload, { onConflict: "athlete_id,date" });
  if (error) {
    logEvent("training_load_monitor.persist_failed", { athlete_id: athleteId, error: error.message });
  }
}

type OpenEpisode = { severity: string; lastSeenOn: string };

async function fetchOpenEpisodes(supabase: SupabaseAdmin, athleteId: string): Promise<Record<string, OpenEpisode>> {
  const { data, error } = await supabase
    .from("training_load_alerts")
    .select("alert_type, severity, last_seen_on")
    .eq("athlete_id", athleteId)
    .eq("status", "open");
  if (error) {
    logEvent("training_load_monitor.open_episodes_fetch_failed", { athlete_id: athleteId, error: error.message });
    return {};
  }
  const map: Record<string, OpenEpisode> = {};
  for (const row of data || []) {
    map[row.alert_type as string] = { severity: row.severity as string, lastSeenOn: row.last_seen_on as string };
  }
  return map;
}

async function resolveActiveCoachId(supabase: SupabaseAdmin, athleteId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("coach_athlete_relationship")
    .select("coach_id")
    .eq("athlete_id", athleteId)
    .eq("status", "active")
    .maybeSingle();
  if (error) {
    logEvent("training_load_monitor.coach_lookup_failed", { athlete_id: athleteId, error: error.message });
    return null;
  }
  return (data?.coach_id as string) || null;
}

async function upsertAlert(
  supabase: SupabaseAdmin,
  params: {
    athleteId: string;
    recipientId: string;
    alertType: string;
    severity: string;
    metricDate: string;
    metrics: Record<string, unknown>;
    messageEs: string;
  }
) {
  const { data, error } = await supabase.rpc("upsert_training_load_alert", {
    p_athlete_id: params.athleteId,
    p_recipient_id: params.recipientId,
    p_alert_type: params.alertType,
    p_severity: params.severity,
    p_metric_date: params.metricDate,
    p_metrics: params.metrics,
    p_message_es: params.messageEs,
  });
  if (error) {
    logEvent("training_load_monitor.alert_upsert_failed", {
      athlete_id: params.athleteId,
      alert_type: params.alertType,
      error: error.message,
    });
    return null;
  }
  return Array.isArray(data) ? data[0] : data;
}

// Conditional resolve: only clears the episode if it is STILL clear as of
// this write (last_seen_on < cutoff) — guards against a race with a
// concurrent invocation that just refreshed last_seen_on to today.
async function resolveEpisode(supabase: SupabaseAdmin, athleteId: string, alertType: string, cutoffDate: string) {
  const { error } = await supabase
    .from("training_load_alerts")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("athlete_id", athleteId)
    .eq("alert_type", alertType)
    .eq("status", "open")
    .lt("last_seen_on", cutoffDate);
  if (error) {
    logEvent("training_load_monitor.resolve_failed", { athlete_id: athleteId, alert_type: alertType, error: error.message });
  }
}

// Best-effort push delivery — failure MUST NOT block the in-app alert row,
// which is already committed by the time this is called.
async function deliverPush(supabase: SupabaseAdmin, recipientId: string, alertType: string, messageEs: string) {
  try {
    const { error } = await supabase.rpc("send_push_notification", {
      p_user_ids: [recipientId],
      p_title: "Alerta de carga de entrenamiento",
      p_body: messageEs,
      p_url: "/training-load",
      p_tag: `tt-load-${alertType}`,
    });
    if (error) {
      logEvent("training_load_monitor.push_failed", { recipient_id: recipientId, alert_type: alertType, error: error.message });
    }
  } catch (err) {
    logEvent("training_load_monitor.push_failed", { recipient_id: recipientId, alert_type: alertType, error: String(err) });
  }
}

async function processAthlete(supabase: SupabaseAdmin, athleteId: string, today: string) {
  const from = addDaysISO(today, -RECOMPUTE_WINDOW_DAYS);

  const [profile, activities] = await Promise.all([
    fetchAthleteProfile(supabase, athleteId),
    fetchActivities(supabase, athleteId, from),
  ]);

  const dailySeries = buildDailySeries(activities, profile, from, today);
  const loadSeries = computeLoadSeries(dailySeries);
  await persistLoadRows(supabase, athleteId, loadSeries.slice(-PERSIST_LAST_N));

  const todayRow = loadSeries[loadSeries.length - 1] || null;

  const weekStart = isoWeekStart(today);
  const weekEnd = isoWeekEnd(weekStart);
  const sessions = await fetchWeekSessions(supabase, athleteId, weekStart, weekEnd);
  const weekSummary = summarizeWeekSessions(sessions, weekStart, weekEnd);

  if (!ALERTS_ENABLED) {
    logEvent("training_load_monitor.alerts_disabled", { athlete_id: athleteId });
    return { recomputed: true, alerted: false, alertCount: 0 };
  }

  const findings = evaluateLoad(todayRow, weekSummary);
  const openEpisodes = await fetchOpenEpisodes(supabase, athleteId);
  const plan = planReconciliation(findings, openEpisodes, today);

  let activeCoachId: string | null = null;
  let coachFetched = false;
  let alertCount = 0;

  for (const alertType of ALERT_TYPES) {
    const decision = plan[alertType];
    if (decision.action === "noop") continue;

    if (decision.action === "resolve") {
      await resolveEpisode(supabase, athleteId, alertType, addDaysISO(today, -1));
      continue;
    }

    if (decision.action === "upsert" && decision.finding) {
      if (!coachFetched) {
        activeCoachId = await resolveActiveCoachId(supabase, athleteId);
        coachFetched = true;
      }
      const recipientId = resolveRecipientId(athleteId, activeCoachId);

      const result = await upsertAlert(supabase, {
        athleteId,
        recipientId,
        alertType,
        severity: decision.finding.severity,
        metricDate: today,
        metrics: decision.finding.metrics,
        messageEs: decision.finding.messageEs,
      });
      alertCount += 1;

      if (result && decision.deliver) {
        await deliverPush(supabase, recipientId, alertType, decision.finding.messageEs);
      }
    }
  }

  return { recomputed: true, alerted: alertCount > 0, alertCount };
}

async function runSweep(supabase: SupabaseAdmin, today: string, limit: number, offset: number) {
  const weekStart = isoWeekStart(today);
  const since = `${addDaysISO(today, -SWEEP_CANDIDATE_LOOKBACK_DAYS)}T00:00:00Z`;

  const { data: candidates, error } = await supabase.rpc("get_athletes_needing_load_refresh", {
    p_today: today,
    p_since: since,
    p_week_start: weekStart,
    p_calc_version: CALC_VERSION,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    logEvent("training_load_monitor.sweep_query_failed", { error: error.message });
    return { processed: 0, error: error.message };
  }

  const ids = ((candidates || []) as Array<{ athlete_id: string }>).map((c) => c.athlete_id);
  for (const athleteId of ids) {
    // eslint-disable-next-line no-await-in-loop
    await processAthlete(supabase, athleteId, today);
  }

  return { processed: ids.length, fullPage: ids.length === limit };
}

// Self-chain the next sweep page in the background, fire-and-forget,
// mirroring strava-webhook's triggerStreamsFetch shape exactly.
function chainNextSweepPage(authHeader: string, limit: number, nextOffset: number) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  const task = fetch(`${supabaseUrl}/functions/v1/training-load-monitor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({ mode: "sweep", limit, offset: nextOffset }),
  })
    .then(() => {
      logEvent("training_load_monitor.sweep_chained", { offset: nextOffset });
    })
    .catch((err) => {
      logEvent("training_load_monitor.sweep_chain_failed", { offset: nextOffset, error: String(err) });
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
      const result = await processAthlete(supabase, athleteId, today);
      return new Response(JSON.stringify({ mode: "athlete", athlete_id: athleteId, ...result }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (body.mode === "sweep") {
      const limit = Number(body.limit) || DEFAULT_SWEEP_LIMIT;
      const offset = Number(body.offset) || 0;

      const { processed, fullPage, error } = await runSweep(supabase, today, limit, offset);

      if (error) {
        return new Response(JSON.stringify({ error: "sweep query failed" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (fullPage) {
        chainNextSweepPage(`Bearer ${cronSecret || serviceRoleKey}`, limit, offset + limit);
      }

      return new Response(JSON.stringify({ mode: "sweep", processed }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "invalid mode" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    logEvent("training_load_monitor.unhandled_error", { error: String(err) });
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

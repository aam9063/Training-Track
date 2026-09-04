import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  isAuthorized,
  computeEffectiveDryRun,
  mapAlertRow,
  groupCandidatesByAthlete,
  buildFindingSourceMap,
  mapSessionRow,
  planSuggestion,
  summarizeSweep,
} from "./logic.js";

/**
 * planning-agent
 *
 * The single I/O boundary for the continuous-planning agent (Agent 3):
 * pages athletes with an open, actionable `training_load_alerts` row
 * (`acwr_zone`/`tsb_critical`/`low_completion`) and an active
 * `coach_athlete_relationship` via `get_planning_candidates`, evaluates each
 * through the pure `planAdjustmentCore` rulebook, and persists AT MOST one
 * pending `plan_adjustment_suggestions` row per athlete via
 * `upsert_plan_adjustment_suggestion` (supersede-then-insert) — delivering
 * best-effort push to the athlete's active coach only.
 *
 * NEVER writes `training_sessions`. The ONLY code path in the repo that
 * writes `training_sessions` for a plan adjustment is the
 * `apply_plan_adjustment` RPC, invoked exclusively by an explicit coach
 * approval action (planning-agent-runtime: "training_sessions Write
 * Boundary").
 *
 * Invoked from two directions:
 *   - scheduled: the `planning-daily-sweep` pg_cron job (migration 6)
 *   - reactive: `training-load-monitor`'s fire-and-forget call on a new/
 *     escalated `acwr_zone` alert at zone danger (Phase 4, not this file)
 *
 * See: openspec/changes/continuous-planning-agent/design.md
 */

const DEFAULT_SWEEP_LIMIT = 100; // matches get_planning_candidates's own p_limit default
const ACTIONABLE_ALERT_TYPES = ["acwr_zone", "tsb_critical", "low_completion"];

// Kill switch — DEFAULTS TO FALSE. Unlike training-load-monitor's
// TRAINING_LOAD_ALERTS_ENABLED (defaults true), any agent in this project
// whose output can mutate athlete data defaults DISABLED until a reviewed
// dry-run — the same rule Agent 2 established. `computeEffectiveDryRun`
// OR's this with the request's own `dryRun` param into one flag; the kill
// switch always wins (see logic.js's doc comment).
const SUGGESTIONS_ENABLED = (Deno.env.get("PLANNING_SUGGESTIONS_ENABLED") ?? "false").toLowerCase() === "true";

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

// Structured log helper — JSON single-line for observability (mirrors
// training-load-monitor and engagement-monitor).
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
// UTC calendar date, which is wrong for anyone evaluated after ~22:00 local
// in summer.
function todayLocalStr(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
}

// ============================================================
// Reads
// ============================================================

async function fetchFutureSessions(supabase: SupabaseAdmin, athleteId: string, today: string) {
  const { data, error } = await supabase
    .from("training_sessions")
    .select(
      "id, scheduled_date, status, training_type, estimated_duration_minutes, title, description, adjusted_by_agent, last_adjustment_id"
    )
    .eq("athlete_id", athleteId)
    .eq("status", "planned")
    .gt("scheduled_date", today);
  if (error) {
    logEvent("planning_agent.sessions_fetch_failed", { athlete_id: athleteId, error: error.message });
    return [];
  }
  return data || [];
}

// Batched — one query per candidate for every distinct last_adjustment_id
// among its future sessions, not one query per session (N+1 avoidance).
async function fetchFindingSourceMap(supabase: SupabaseAdmin, suggestionIds: Array<string | null | undefined>) {
  const ids = Array.from(new Set(suggestionIds.filter((id): id is string => !!id)));
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from("plan_adjustment_suggestions")
    .select("id, finding_source")
    .in("id", ids);
  if (error) {
    logEvent("planning_agent.finding_source_lookup_failed", { error: error.message });
    return {};
  }
  return buildFindingSourceMap(data || []);
}

async function fetchAthleteProfile(supabase: SupabaseAdmin, athleteId: string) {
  // athlete_profile is keyed on user_id, not athlete_id (athletes.id IS
  // users.id in this schema — design.md's "Second gotcha" note).
  const { data, error } = await supabase
    .from("athlete_profile")
    .select("dias_disponibles")
    .eq("user_id", athleteId)
    .maybeSingle();
  if (error) {
    logEvent("planning_agent.profile_fetch_failed", { athlete_id: athleteId, error: error.message });
    return { diasDisponibles: null };
  }
  return { diasDisponibles: (data && data.dias_disponibles) || null };
}

async function fetchActiveCoachId(supabase: SupabaseAdmin, athleteId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("coach_athlete_relationship")
    .select("coach_id")
    .eq("athlete_id", athleteId)
    .eq("status", "active")
    .maybeSingle();
  if (error) {
    logEvent("planning_agent.coach_lookup_failed", { athlete_id: athleteId, error: error.message });
    return null;
  }
  return (data?.coach_id as string) || null;
}

// Reactive mode's single-athlete re-read of every open actionable alert —
// so the priority rule still applies even when the trigger was one
// specific acwr_zone alert (design.md's `reactive` mode row: "a reactive
// acwr_zone danger must not bypass a co-firing evaluation").
async function fetchOpenAlerts(supabase: SupabaseAdmin, athleteId: string) {
  const { data, error } = await supabase
    .from("training_load_alerts")
    .select("id, alert_type, severity, metrics")
    .eq("athlete_id", athleteId)
    .eq("status", "open")
    .is("dismissed_at", null)
    .in("alert_type", ACTIONABLE_ALERT_TYPES);
  if (error) {
    logEvent("planning_agent.open_alerts_fetch_failed", { athlete_id: athleteId, error: error.message });
    return [];
  }
  return data || [];
}

// ============================================================
// Writes (never training_sessions — see module header)
// ============================================================

async function expireStale(supabase: SupabaseAdmin, today: string) {
  const { error } = await supabase.rpc("expire_stale_plan_adjustments", { p_today: today });
  if (error) {
    logEvent("planning_agent.expire_stale_failed", { error: error.message });
  }
}

async function persistSuggestion(
  supabase: SupabaseAdmin,
  params: {
    athleteId: string;
    coachId: string;
    triggeringAlertId: string;
    findingSource: string;
    patchType: string;
    patch: unknown;
    snapshot: unknown;
    metrics: unknown;
    messageEs: string;
    earliestTargetDate: string;
  }
) {
  const { data, error } = await supabase.rpc("upsert_plan_adjustment_suggestion", {
    p_athlete_id: params.athleteId,
    p_coach_id: params.coachId,
    p_triggering_alert_id: params.triggeringAlertId,
    p_finding_source: params.findingSource,
    p_patch_type: params.patchType,
    p_patch: params.patch,
    p_snapshot: params.snapshot,
    p_metrics: params.metrics,
    p_message_es: params.messageEs,
    p_earliest_target_date: params.earliestTargetDate,
  });
  if (error) {
    logEvent("planning_agent.suggestion_upsert_failed", { athlete_id: params.athleteId, error: error.message });
    return null;
  }
  return Array.isArray(data) ? data[0] : data;
}

// Best-effort push delivery — failure MUST NOT block the already-persisted
// suggestion row (mirrors training-load-monitor/engagement-monitor exactly).
async function deliverPush(supabase: SupabaseAdmin, recipientId: string, messageEs: string) {
  try {
    const { error } = await supabase.rpc("send_push_notification", {
      p_user_ids: [recipientId],
      p_title: "Ajuste de plan sugerido",
      p_body: messageEs,
      p_url: "/team-health",
      p_tag: "tt-plan-adjustment",
    });
    if (error) {
      logEvent("planning_agent.push_failed", { recipient_id: recipientId, error: error.message });
    }
  } catch (err) {
    logEvent("planning_agent.push_failed", { recipient_id: recipientId, error: String(err) });
  }
}

// ============================================================
// Per-candidate evaluation — the shared path for both sweep and reactive
// ============================================================

type EvalResult = { athleteId: string; patchType: string | null; persisted: boolean };

async function evaluateCandidate(
  supabase: SupabaseAdmin,
  candidate: { athleteId: string; coachId: string | null; openFindings: Array<Record<string, unknown>> },
  today: string,
  effectiveDryRun: boolean
): Promise<EvalResult> {
  const [sessionRows, profile] = await Promise.all([
    fetchFutureSessions(supabase, candidate.athleteId, today),
    fetchAthleteProfile(supabase, candidate.athleteId),
  ]);

  const suggestionIds = sessionRows.map((row: Record<string, unknown>) => row.last_adjustment_id as string | null);
  const findingSourceById = await fetchFindingSourceMap(supabase, suggestionIds);
  const sessions = sessionRows.map((row: Record<string, unknown>) => mapSessionRow(row, findingSourceById));

  const { suggestion } = planSuggestion(candidate, sessions, profile, today);

  if (!suggestion) {
    return { athleteId: candidate.athleteId, patchType: null, persisted: false };
  }

  if (effectiveDryRun) {
    return { athleteId: candidate.athleteId, patchType: suggestion.patchType, persisted: false };
  }

  if (!candidate.coachId || !suggestion.triggeringAlertId) {
    // Defensive only — get_planning_candidates always returns coach_id via
    // its active-relationship JOIN, and every open training_load_alerts row
    // always has an id. Should never happen; logged, never thrown, so one
    // malformed candidate cannot abort the rest of the page.
    logEvent("planning_agent.persist_skipped_missing_ids", {
      athlete_id: candidate.athleteId,
      coach_id: candidate.coachId,
      alert_id: suggestion.triggeringAlertId,
    });
    return { athleteId: candidate.athleteId, patchType: suggestion.patchType, persisted: false };
  }

  const upserted = await persistSuggestion(supabase, {
    athleteId: candidate.athleteId,
    coachId: candidate.coachId,
    triggeringAlertId: suggestion.triggeringAlertId,
    findingSource: suggestion.findingSource,
    patchType: suggestion.patchType,
    patch: suggestion.patch,
    snapshot: suggestion.snapshot,
    metrics: suggestion.metrics,
    messageEs: suggestion.messageEs,
    earliestTargetDate: suggestion.earliestTargetDate,
  });

  if (upserted) {
    await deliverPush(supabase, candidate.coachId, suggestion.messageEs);
  }

  return { athleteId: candidate.athleteId, patchType: suggestion.patchType, persisted: !!upserted };
}

// ============================================================
// Sweep
// ============================================================

async function runSweep(supabase: SupabaseAdmin, today: string, limit: number, offset: number, dryRun: boolean) {
  const effectiveDryRun = computeEffectiveDryRun(SUGGESTIONS_ENABLED, dryRun);

  // Date-based expiry cannot be a trigger (no row write happens when a date
  // passes) — runs once at the head of every sweep page (idempotent: WHERE
  // status='pending' AND earliest_target_date < today).
  await expireStale(supabase, today);

  const { data, error } = await supabase.rpc("get_planning_candidates", {
    p_today: today,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    logEvent("planning_agent.candidates_query_failed", { error: error.message });
    return { processed: 0, error: error.message, fullPage: false, dryRun: effectiveDryRun, summary: null };
  }

  const rows = (data || []) as Array<Record<string, unknown>>;
  const fullPage = rows.length === limit;
  // LIMIT/OFFSET paginate ALERT ROWS, not athlete groups — never split an
  // athlete's finding set across pages (design.md's get_planning_candidates
  // note). See groupCandidatesByAthlete's doc comment for the mechanism.
  const groups = groupCandidatesByAthlete(rows, { dropTrailingPartial: fullPage });

  const results: EvalResult[] = [];
  for (const group of groups) {
    // eslint-disable-next-line no-await-in-loop
    const result = await evaluateCandidate(supabase, group, today, effectiveDryRun);
    results.push(result);
  }

  const summary = summarizeSweep(results);

  logEvent("planning_agent.sweep_page_summary", {
    today,
    limit,
    offset,
    dry_run: effectiveDryRun,
    kill_switch_enabled: SUGGESTIONS_ENABLED,
    ...summary,
  });

  return { processed: rows.length, fullPage, dryRun: effectiveDryRun, summary, error: null };
}

// Self-chain the next sweep page in the background, fire-and-forget,
// mirroring training-load-monitor's / engagement-monitor's chainNextSweepPage
// shape verbatim.
function chainNextSweepPage(authHeader: string, limit: number, nextOffset: number, dryRun: boolean) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  const task = fetch(`${supabaseUrl}/functions/v1/planning-agent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({ mode: "sweep", limit, offset: nextOffset, dryRun }),
  })
    .then(() => {
      logEvent("planning_agent.sweep_chained", { offset: nextOffset });
    })
    .catch((err) => {
      logEvent("planning_agent.sweep_chain_failed", { offset: nextOffset, error: String(err) });
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
    if (body.mode === "reactive") {
      const athleteId = body.athlete_id as string | undefined;
      if (!athleteId) {
        return new Response(JSON.stringify({ error: "athlete_id required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const effectiveDryRun = computeEffectiveDryRun(SUGGESTIONS_ENABLED, body.dryRun === true);

      // Defense in depth (design.md: "enforced again independently in RLS
      // and in the apply RPC") — an independent athlete has no active
      // coach_athlete_relationship row, so no candidate here either, even
      // though Phase 4's reactive call site only ever fires from a
      // coach-supervised alert.
      const coachId = await fetchActiveCoachId(supabase, athleteId);
      if (!coachId) {
        return new Response(
          JSON.stringify({ mode: "reactive", athlete_id: athleteId, evaluated: false, reason: "not_supervised" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      const alertRows = await fetchOpenAlerts(supabase, athleteId);
      const candidate = {
        athleteId,
        coachId,
        openFindings: alertRows.map(mapAlertRow),
      };

      const result = await evaluateCandidate(supabase, candidate, today, effectiveDryRun);

      return new Response(
        JSON.stringify({ mode: "reactive", athlete_id: athleteId, dryRun: effectiveDryRun, ...result }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
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
    logEvent("planning_agent.unhandled_error", { error: String(err) });
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

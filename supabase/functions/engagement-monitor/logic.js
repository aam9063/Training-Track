/**
 * engagement-monitor — pure auth/mapping/reconciliation logic.
 *
 * Kept free of Deno/Supabase I/O (only imports the zero-dependency
 * engagementCore module) so this file runs unmodified under `node --test`,
 * exactly like training-load-monitor/logic.js. `index.ts` performs all
 * actual I/O (Supabase queries/RPCs, push delivery, sweep chaining) and
 * calls into these pure functions for every decision that has a testable
 * shape.
 *
 * See: openspec/changes/adherence-detection-agent/design.md
 *      ("Interfaces / Contracts" — engagementCore's gate order is the
 *      authoritative rulebook; this file only adds the sweep-level
 *      new/escalate/refresh reconciliation and I/O-shape mapping that
 *      engagementCore intentionally does not own).
 */

import { evaluateEngagement, isPastWarmUp } from '../_shared/engagementCore.js';

/**
 * True when the bearer token in `authHeader` matches CRON_SECRET or
 * SERVICE_ROLE_KEY. Matches training-load-monitor/logic.js's isAuthorized
 * exactly (same Bearer-secret pattern, same repo convention).
 *
 * @param {string|null|undefined} authHeader - raw `Authorization` header value
 * @param {{cronSecret?:string, serviceRoleKey?:string}} secrets
 * @returns {boolean}
 */
export function isAuthorized(authHeader, secrets) {
  const token = (authHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  const { cronSecret, serviceRoleKey } = secrets || {};
  return (!!cronSecret && token === cronSecret) || (!!serviceRoleKey && token === serviceRoleKey);
}

/**
 * Map a `get_engagement_candidates` RPC row (snake_case, as returned by
 * postgrest/rpc) to the camelCase candidate shape `evaluateEngagement`
 * expects. Pure — no I/O.
 *
 * @param {{athlete_id:string, coach_id:string, start_date:string|null,
 *          last_session_completed_at:string|null, last_wellness_date:string|null,
 *          last_strava_at:string|null, last_athlete_message_at:string|null,
 *          planned_in_window:number}} row
 * @returns {{athleteId:string, coachId:string, startDate:string|null,
 *          plannedInWindow:number, lastSessionCompletedAt:string|null,
 *          lastWellnessDate:string|null, lastStravaAt:string|null,
 *          lastAthleteMessageAt:string|null}}
 */
export function mapCandidateRow(row) {
  return {
    athleteId: row.athlete_id,
    coachId: row.coach_id,
    startDate: row.start_date,
    plannedInWindow: row.planned_in_window,
    lastSessionCompletedAt: row.last_session_completed_at,
    lastWellnessDate: row.last_wellness_date,
    lastStravaAt: row.last_strava_at,
    lastAthleteMessageAt: row.last_athlete_message_at,
  };
}

/**
 * Classify a candidate, recovering WHY `evaluateEngagement` returned null
 * (it collapses warm-up exclusion, zero-planned suppression, and
 * below-threshold silence to a single `null`) so the dry-run summary can
 * report a suppressed-reasons breakdown. Re-derives the reason using the
 * SAME exported gate primitives `evaluateEngagement` uses internally —
 * does not fork or duplicate the tiering/eligibility rules themselves.
 *
 * @param {object} candidate - engagementCore candidate shape
 * @param {string} todayLocal - 'YYYY-MM-DD'
 * @returns {{finding: object|null, reason: 'warmup'|'zero_planned'|'below_threshold'|null}}
 */
export function classifyCandidate(candidate, todayLocal) {
  const finding = evaluateEngagement(candidate, todayLocal);
  if (finding) return { finding, reason: null };

  const { startDate, plannedInWindow } = candidate || {};
  if (!isPastWarmUp(startDate, todayLocal)) {
    return { finding: null, reason: 'warmup' };
  }
  if (plannedInWindow === 0) {
    return { finding: null, reason: 'zero_planned' };
  }
  return { finding: null, reason: 'below_threshold' };
}

/**
 * Combine a candidate's classification with the dedup state (does an open
 * `athlete_engagement_alerts` row already exist for this athlete?) into a
 * single sweep-level decision: 'suppressed' | 'new' | 'escalate' | 'refresh'.
 *
 * This decision is used for the dry-run summary AND, in the real (non
 * dry-run) path, only to decide WHETHER to call `upsert_engagement_alert`
 * at all (any finding does). The actual is_new/escalated flags used for
 * push delivery MUST come from the RPC's own atomic result, not this
 * pre-write decision — see `shouldDeliverPush`'s doc comment.
 *
 * @param {object} candidate - engagementCore candidate shape
 * @param {{severity:'warning'|'danger'}|null} openAlert - current open
 *        alert row for this athlete, or null if none exists
 * @param {string} todayLocal - 'YYYY-MM-DD'
 * @returns {{finding: object|null, decision: 'suppressed'|'new'|'escalate'|'refresh', reason: string|null}}
 */
export function evaluateForSweep(candidate, openAlert, todayLocal) {
  const { finding, reason } = classifyCandidate(candidate, todayLocal);
  if (!finding) {
    return { finding: null, decision: 'suppressed', reason };
  }
  if (!openAlert) {
    return { finding, decision: 'new', reason: null };
  }
  if (openAlert.severity === 'warning' && finding.severity === 'danger') {
    return { finding, decision: 'escalate', reason: null };
  }
  return { finding, decision: 'refresh', reason: null };
}

/**
 * Race-safe delivery decision: true only when the `upsert_engagement_alert`
 * RPC's OWN result says this write was a fresh insert or an escalation.
 * Mirrors training-load-monitor/index.ts's documented rationale exactly:
 * a decision computed from a plain SELECT taken BEFORE the write (like
 * `evaluateForSweep`'s dry-run decision) can be stale under a concurrent
 * invocation (webhook resolve + cron sweep racing on the same athlete);
 * the RPC's `RETURNING`-derived is_new/escalated cannot be.
 *
 * @param {{is_new?:boolean, escalated?:boolean}|null|undefined} upsertResult
 * @returns {boolean}
 */
export function shouldDeliverPush(upsertResult) {
  return !!(upsertResult && (upsertResult.is_new || upsertResult.escalated));
}

/**
 * Reactive weekly-report handoff gate (engagement-agent-runtime delta:
 * "Reactive Report Trigger"). Pure decision only — `index.ts` performs the
 * actual fire-and-forget call when this returns true; a `false` here must
 * never delay or affect this function's own alert creation or delivery.
 *
 * Gates on `finding.severity === 'danger'`, which is CORRECT HERE and is
 * deliberately NOT the shape of training-load-monitor's
 * `shouldTriggerReactivePlanning`. That function must read
 * `finding.metrics.zone` because `training_load_alerts.severity` is
 * CHECK-constrained to ('warning','critical') with no 'danger' value.
 * `athlete_engagement_alerts.severity` IS CHECK-constrained to
 * ('warning','danger') (supabase/migrations/20260901100000_athlete_engagement_
 * alerts.sql), and this capability's `metrics` carries
 * {variant, lastSignalAt, lastSignalSource, plannedInWindow} — there is no
 * `zone` key at all. "Harmonising" this gate to metrics.zone would make it
 * dead code that never fires.
 *
 * danger-only by design (proposal D3): `warning` (10 days) already reaches
 * the coach through this agent's own in-app + push delivery. The narrative
 * is what Agent 4 adds, and a Gemini call is justified at escalation, not
 * at first observation.
 *
 * Reuses the exact `is_new || escalated` race-safe gate the push-delivery
 * decision already uses (the upsert RPC's own atomic result, computed under
 * FOR UPDATE at write time — never `evaluateForSweep`'s pre-write
 * `decision`, which can be stale under a concurrent invocation). A
 * same-severity refresh of an already-open danger episode must NOT re-fire.
 *
 * Dry runs need no check here: `processCandidate` returns before the
 * upsert when `effectiveDryRun`, so `upsertResult` is never produced and
 * this gate is never reached.
 *
 * @param {{alertType?:string, severity?:string}|null} finding
 * @param {{alert_id?:string, is_new?:boolean, escalated?:boolean}|null} upsertResult
 * @returns {boolean}
 */
export function shouldTriggerWeeklyReport(finding, upsertResult) {
  if (!finding || finding.alertType !== 'engagement_silence') return false;
  if (finding.severity !== 'danger') return false;
  if (!upsertResult) return false;
  return !!(upsertResult.is_new || upsertResult.escalated);
}

/**
 * Aggregate a page of `evaluateForSweep` results into the dry-run summary
 * shape: evaluated count, findings by new/escalate/refresh, and
 * suppressions by reason. Pure — no I/O, no writes.
 *
 * @param {Array<{finding: object|null, decision: string, reason: string|null}>} results
 * @returns {{evaluated:number, findings:{new:number, escalate:number, refresh:number},
 *          suppressed:{warmup:number, zero_planned:number, below_threshold:number}}}
 */
export function summarizeSweep(results) {
  const summary = {
    evaluated: results.length,
    findings: { new: 0, escalate: 0, refresh: 0 },
    suppressed: { warmup: 0, zero_planned: 0, below_threshold: 0 },
  };
  for (const result of results) {
    if (result.finding) {
      summary.findings[result.decision] += 1;
    } else {
      summary.suppressed[result.reason] += 1;
    }
  }
  return summary;
}

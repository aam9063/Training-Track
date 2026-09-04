/**
 * planning-agent — pure auth/grouping/mapping/summary logic.
 *
 * Kept free of Deno/Supabase I/O (imports only the zero-dependency
 * `planAdjustmentCore.js` module, per design.md's declared import list for
 * this file) so it runs unmodified under `node --test`, exactly like
 * training-load-monitor/logic.js and engagement-monitor/logic.js. `index.ts`
 * performs all actual I/O (Supabase queries/RPCs, push delivery, sweep
 * chaining) and calls into these pure functions for every decision that has
 * a testable shape.
 *
 * See: openspec/changes/continuous-planning-agent/design.md
 *      ("Interfaces / Contracts" -> `planning-agent` Edge Function section
 *      is the authoritative mode/behaviour contract; planAdjustmentCore.js's
 *      Interfaces block is the authoritative rulebook this file wraps).
 */

import { evaluateAdjustment } from '../_shared/planAdjustmentCore.js';

/**
 * True when the bearer token in `authHeader` matches CRON_SECRET or
 * SERVICE_ROLE_KEY. Matches training-load-monitor/logic.js and
 * engagement-monitor/logic.js exactly (same Bearer-secret pattern, same
 * repo convention).
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
 * Single effective-dry-run flag per planning-agent-runtime's "Kill Switch
 * Defaults False, OR'd with Dry Run" requirement:
 * `effectiveDryRun = !PLANNING_SUGGESTIONS_ENABLED OR dryRun`.
 * Mirrors engagement-monitor's `ALERTS_ENABLED`/`effectiveDryRun` shape —
 * the kill switch always wins, regardless of the caller's own `dryRun` value.
 *
 * @param {boolean} suggestionsEnabled - PLANNING_SUGGESTIONS_ENABLED, already resolved
 * @param {boolean|undefined} dryRun - the request body's `dryRun` param
 * @returns {boolean}
 */
export function computeEffectiveDryRun(suggestionsEnabled, dryRun) {
  return !suggestionsEnabled || dryRun === true;
}

/**
 * Normalizes one alert row to the `{alertId, alertType, severity, metrics}`
 * finding shape `resolveFinding`/`evaluateAdjustment` expect. Handles BOTH
 * row shapes this function ever sees:
 *   - `get_planning_candidates` sweep rows: `alert_id` field
 *   - raw `training_load_alerts` rows (reactive mode's re-read): `id` field
 *
 * @param {{alert_id?:string, id?:string, alert_type:string, severity:string, metrics?:object}} row
 * @returns {{alertId:string|null, alertType:string, severity:string, metrics:object}}
 */
export function mapAlertRow(row) {
  return {
    alertId: (row && (row.alert_id ?? row.id)) ?? null,
    alertType: row && row.alert_type,
    severity: row && row.severity,
    metrics: (row && row.metrics) || {},
  };
}

/**
 * Group `get_planning_candidates` rows by `athlete_id` into per-athlete
 * candidates carrying every co-firing open finding, preserving first-seen
 * athlete order. `LIMIT/OFFSET` in the RPC paginate ALERT ROWS, not athlete
 * groups (design.md's `get_planning_candidates` note), so a page boundary
 * can fall in the middle of one athlete's finding set. `dropTrailingPartial`
 * (pass `rows.length === limit`, i.e. a full page) drops the LAST group
 * entirely rather than risk evaluating a partial finding set — the next
 * sweep page continues from exactly where this page's raw rows left off
 * (the RPC's own ORDER BY athlete_id, alert_type is stable), so the dropped
 * athlete's remaining rows surface at the start of the next page.
 *
 * @param {Array<{athlete_id:string, coach_id?:string}>} rows
 * @param {{dropTrailingPartial?:boolean}} [opts]
 * @returns {Array<{athleteId:string, coachId:string|null, openFindings:Array<object>}>}
 */
export function groupCandidatesByAthlete(rows, opts) {
  const { dropTrailingPartial = false } = opts || {};
  const order = [];
  const map = new Map();

  for (const row of rows || []) {
    const athleteId = row && row.athlete_id;
    if (!athleteId) continue;
    if (!map.has(athleteId)) {
      map.set(athleteId, { athleteId, coachId: (row.coach_id ?? null), openFindings: [] });
      order.push(athleteId);
    }
    map.get(athleteId).openFindings.push(mapAlertRow(row));
  }

  let groups = order.map((id) => map.get(id));
  if (dropTrailingPartial && groups.length > 0) {
    groups = groups.slice(0, -1);
  }
  return groups;
}

/**
 * Builds an `id -> finding_source` lookup from a batched
 * `plan_adjustment_suggestions` query (`SELECT id, finding_source WHERE id
 * IN (...)`), used to resolve `mapSessionRow`'s `lastAdjustmentSource` from
 * `training_sessions.last_adjustment_id` — the FK only stores the
 * suggestion id, not which finding source produced it, so this one batched
 * lookup (not an N+1 per session) supplies the missing field the D4
 * anti-undo suppression (`eligibleSessions`) needs.
 *
 * @param {Array<{id:string, finding_source:string}>} suggestionRows
 * @returns {Record<string, string>}
 */
export function buildFindingSourceMap(suggestionRows) {
  const map = {};
  for (const row of suggestionRows || []) {
    if (row && row.id) map[row.id] = row.finding_source ?? null;
  }
  return map;
}

/**
 * Maps a snake_case `training_sessions` row (as returned by PostgREST) to
 * the camelCase session shape `planAdjustmentCore.js` expects, resolving
 * `lastAdjustmentSource` via the batched `findingSourceById` map built by
 * `buildFindingSourceMap`.
 *
 * @param {{id:string, scheduled_date:string, status:string, training_type?:string,
 *          estimated_duration_minutes?:number, title?:string, description?:string,
 *          adjusted_by_agent?:boolean, last_adjustment_id?:string|null}} row
 * @param {Record<string,string>} [findingSourceById]
 * @returns {{id:string, scheduled_date:string, status:string, training_type:string|undefined,
 *          estimated_duration_minutes:number|undefined, title:string|undefined,
 *          description:string|undefined, adjustedByAgent:boolean, lastAdjustmentSource:string|null}}
 */
export function mapSessionRow(row, findingSourceById) {
  const sourceById = findingSourceById || {};
  const lastAdjustmentId = (row && row.last_adjustment_id) ?? null;
  return {
    id: row && row.id,
    scheduled_date: row && row.scheduled_date,
    status: row && row.status,
    training_type: row && row.training_type,
    estimated_duration_minutes: row && row.estimated_duration_minutes,
    title: row && row.title,
    description: row && row.description,
    adjustedByAgent: !!(row && row.adjusted_by_agent === true),
    lastAdjustmentSource: lastAdjustmentId ? (sourceById[lastAdjustmentId] ?? null) : null,
  };
}

/**
 * Thin wrapper over `planAdjustmentCore.evaluateAdjustment` — this is the
 * single pure "decide a suggestion for one athlete" pipeline shared by both
 * the sweep path (called once per grouped candidate) and the reactive path
 * (called once for the single re-evaluated athlete), so priority resolution
 * (`resolveFinding`'s FINDING_PRIORITY order) is exercised identically by
 * both trigger directions — the reactive path re-reads ALL open actionable
 * alerts before calling this, precisely so a reactive acwr_zone danger
 * cannot bypass a co-firing evaluation (planning-agent-runtime's implicit
 * contract, design.md's `reactive` mode row).
 *
 * @param {{athleteId:string, coachId:string|null, openFindings:Array<object>}} candidate
 * @param {Array<object>} sessions - already `mapSessionRow`-shaped
 * @param {{diasDisponibles: object|null}} profile
 * @param {string} todayLocal - 'YYYY-MM-DD'
 * @returns {{athleteId:string|undefined, coachId:string|null|undefined, suggestion:object|null}}
 */
export function planSuggestion(candidate, sessions, profile, todayLocal) {
  const suggestion = evaluateAdjustment(candidate, sessions, profile, todayLocal);
  return {
    athleteId: candidate && candidate.athleteId,
    coachId: candidate && candidate.coachId,
    suggestion,
  };
}

/**
 * Aggregates a page's per-candidate evaluation results into the dry-run/
 * live summary shape: evaluated count, per-`patchType` suggested counts,
 * total persisted, and total skipped (no patch produced). This is the
 * mechanism behind design.md's mandatory pre-enable "Dry-run sweep counts
 * per rule reviewed before PLANNING_SUGGESTIONS_ENABLED=true" gate.
 *
 * @param {Array<{athleteId:string, patchType:string|null, persisted:boolean}>} results
 * @returns {{evaluated:number, suggested:{deload_volume:number, insert_recovery:number, reduce_frequency:number},
 *          persisted:number, skipped:number}}
 */
export function summarizeSweep(results) {
  const summary = {
    evaluated: (results || []).length,
    suggested: { deload_volume: 0, insert_recovery: 0, reduce_frequency: 0 },
    persisted: 0,
    skipped: 0,
  };
  for (const result of results || []) {
    if (result && result.patchType) {
      if (Object.prototype.hasOwnProperty.call(summary.suggested, result.patchType)) {
        summary.suggested[result.patchType] += 1;
      }
      if (result.persisted) summary.persisted += 1;
    } else {
      summary.skipped += 1;
    }
  }
  return summary;
}

/**
 * Plan Adjustment Core — the finding->patch rulebook for Agent 3 (continuous
 * planning). Maps ONE selected finding (acwr_zone danger, tsb_critical, or
 * low_completion) to ONE deterministic reduction patch over an athlete's
 * remaining future `planned` training_sessions.
 *
 * ZERO IMPORTS, plain ESM — this file is imported directly by:
 *   - Deno (`supabase/functions/planning-agent/**\/*.ts`) with an explicit
 *     `.js` extension
 *   - Node's built-in test runner (`planAdjustmentCore.test.js`, `npm run
 *     test:core`)
 *
 * Keeping this dependency-free is what makes the same file resolvable by
 * both runtimes with zero build-step divergence — do not add an import
 * here, and do not import Supabase, React, or any UI code.
 *
 * See: openspec/changes/continuous-planning-agent/design.md
 *      ("Interfaces / Contracts" -> `planAdjustmentCore.js` section has the
 *      authoritative signatures).
 *
 * IMPORTANT — `severity` vs `zone`: `training_load_alerts.severity` is a
 * DB CHECK-constrained column with only two values, `'warning'` / `'critical'`
 * (see supabase/migrations/20260819142000_training_load_alerts.sql). There
 * is NO literal `'danger'` severity value anywhere in the schema. The acwr
 * zone ('danger' | 'caution' | 'optimal' | 'undertraining') lives only in
 * `training_load_alerts.metrics.zone`, computed by trainingLoadCore.js's
 * `acwrZone()`. This module therefore gates `acwr_zone` eligibility on
 * `finding.metrics.zone === 'danger'`, never on `finding.severity`.
 */

// ============================================================
// Constants
// ============================================================

/** Alert types this rulebook can act on, evaluated in priority order below. */
export const FINDING_SOURCES = ['acwr_zone', 'tsb_critical', 'low_completion'];

/** D2 tie-break order when more than one actionable finding co-fires. */
export const FINDING_PRIORITY = ['acwr_zone', 'tsb_critical', 'low_completion'];

/** acwr_zone danger volume multiplier — never increases (< 1). */
export const DELOAD_FACTOR = 0.7;

/** deload_volume: next N days of planned sessions are scaled. */
export const DELOAD_WINDOW_DAYS = 7;

/** insert_recovery: search horizon for the single rest-day target. */
export const RECOVERY_WINDOW_DAYS = 3;

/** reduce_frequency: never drop the upcoming week's planned count below this. */
export const MIN_SESSIONS_PER_WEEK = 2;

/**
 * Sole pre-completion volume estimate `training_sessions` persists.
 * `estimated_distance_km` does NOT exist on `training_sessions` (confirmed
 * live 2026-09-01 via information_schema.columns) — do not reintroduce it.
 */
export const VOLUME_FIELDS = ['estimated_duration_minutes'];

/** Every field a patch is allowed to write. */
export const PATCHABLE_FIELDS = [...VOLUME_FIELDS, 'training_type', 'title', 'description'];

/** Every field captured in a suggestion's snapshot, for the apply RPC's drift check. */
export const SNAPSHOT_FIELDS = [
  'scheduled_date',
  'status',
  'training_type',
  'estimated_duration_minutes',
  'title',
];

/**
 * `training_type` value a "removed" session is converted to (never deleted).
 * MUST be 'rest', not 'descanso' — confirmed live (2026-09-01) that
 * `training_sessions.training_type` is a Postgres ENUM with exactly
 * {running, gym, rest, cross_training}. 'descanso' is only ever a
 * client-side/draft-plan-JSON label (AIPlanReviewModal.jsx pre-persistence
 * state) and a UI display string — it has never actually been written to
 * this column, and doing so would raise a Postgres enum error.
 */
export const REST_TYPE = 'rest';

// ============================================================
// Date helpers — pure string in/out, UTC-anchored (never
// `toISOString().split('T')[0]` on an ambient/local clock — the inputs
// here are already resolved calendar-date strings supplied by the caller).
// Shape copied from engagementCore.js — NOT imported, this file has zero
// imports by design.
// ============================================================

/**
 * Take the 'YYYY-MM-DD' date part off either a bare date string or a full
 * ISO timestamp, so mixed-format inputs compare correctly.
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
function toDateStr(value) {
  if (!value) return null;
  const str = String(value);
  return str.length >= 10 ? str.slice(0, 10) : str;
}

/**
 * Whole days between two 'YYYY-MM-DD' calendar-date strings
 * (`toDateStr - fromDateStr`). UTC-anchored so it is immune to DST
 * transitions — both inputs are treated as UTC midnight instants.
 * @param {string} fromDateStr
 * @param {string} toDateStr
 * @returns {number}
 */
export function daysBetween(fromDateStr, toDateStr) {
  const from = new Date(`${fromDateStr}T00:00:00Z`);
  const to = new Date(`${toDateStr}T00:00:00Z`);
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

// ============================================================
// countAvailableDays — jsonb day-flag map -> int | null
// ============================================================

/**
 * `athlete_profile.dias_disponibles` is a jsonb weekday-flag map
 * (`{"L":true,"M":false,...}`), not an integer. Returns the count of
 * truthy keys, or `null` when the map is absent/empty — a `null` result
 * degrades the `reduce_frequency` floor to `MIN_SESSIONS_PER_WEEK`
 * (never raises it), matching `OnboardingWizard.jsx`'s own step-4 count.
 * @param {Record<string, boolean>|null|undefined} diasDisponibles
 * @returns {number|null}
 */
export function countAvailableDays(diasDisponibles) {
  if (!diasDisponibles || typeof diasDisponibles !== 'object') return null;
  const keys = Object.keys(diasDisponibles);
  if (keys.length === 0) return null;
  return keys.reduce((count, key) => count + (diasDisponibles[key] ? 1 : 0), 0);
}

// ============================================================
// eligibleSessions
// ============================================================

/**
 * Keeps only sessions the rulebook is allowed to target: `status ===
 * 'planned'` AND `scheduled_date > todayLocal`. Drops sessions already
 * agent-adjusted for the SAME finding source (D4 anti-undo suppression) —
 * a session adjusted for a different finding source remains eligible.
 * @param {Array<object>} sessions
 * @param {string} todayLocal - 'YYYY-MM-DD'
 * @param {string} findingSource
 * @returns {Array<object>}
 */
export function eligibleSessions(sessions, todayLocal, findingSource) {
  if (!Array.isArray(sessions)) return [];
  return sessions.filter((session) => {
    if (!session) return false;
    if (session.status !== 'planned') return false;
    const scheduledDate = toDateStr(session.scheduled_date);
    if (!scheduledDate || daysBetween(todayLocal, scheduledDate) <= 0) return false;
    if (session.adjustedByAgent === true && session.lastAdjustmentSource === findingSource) return false;
    return true;
  });
}

// ============================================================
// buildPatch / toRestDay — the shared invariant-enforcing core every rule
// funnels through, per design.md: (a) restricts writes to PATCHABLE_FIELDS,
// (b) captures SNAPSHOT_FIELDS for every target, (c) asserts the
// reduction-only invariant structurally. A rule that would violate it
// returns null for the WHOLE patch rather than a partially-bad one — the
// invariant is a property of the module, not of each rule's diligence.
// ============================================================

/**
 * @param {Array<object>} targets - eligible sessions selected by a rule
 * @param {(session: object) => Record<string, unknown>} mutate - returns
 *        the proposed field changes for one session
 * @returns {{patch: {sessions: Record<string, object>}, snapshot: {sessions: Record<string, object>}}|null}
 */
function buildPatch(targets, mutate) {
  if (!Array.isArray(targets) || targets.length === 0) return null;

  const patchSessions = {};
  const snapshotSessions = {};

  for (const session of targets) {
    if (!session || !session.id) return null;

    const mutated = mutate(session) || {};
    const restricted = {};
    for (const [field, value] of Object.entries(mutated)) {
      if (PATCHABLE_FIELDS.includes(field)) restricted[field] = value;
    }

    // Reduction-only invariant: for every VOLUME_FIELDS entry, newValue
    // must never exceed oldValue. Any violation invalidates the whole
    // patch — never a silently-partial one.
    for (const field of VOLUME_FIELDS) {
      if (!(field in restricted)) continue;
      const oldValue = typeof session[field] === 'number' ? session[field] : 0;
      const newValue = typeof restricted[field] === 'number' ? restricted[field] : oldValue;
      if (newValue > oldValue) return null;
    }

    if (Object.keys(restricted).length === 0) continue;

    patchSessions[session.id] = restricted;

    const snapshot = {};
    for (const field of SNAPSHOT_FIELDS) {
      snapshot[field] = session[field] ?? null;
    }
    snapshotSessions[session.id] = snapshot;
  }

  if (Object.keys(patchSessions).length === 0) return null;

  return { patch: { sessions: patchSessions }, snapshot: { sessions: snapshotSessions } };
}

/**
 * The shared "remove a session" mutator — never a DELETE, always a visible
 * rest-day conversion, matching `AIPlanReviewModal.deleteSession`'s existing
 * interaction: `training_type` becomes `REST_TYPE`, every volume field
 * becomes 0, and title/description are replaced with rest-day copy.
 * @param {object} _session - unused, kept for a uniform mutate(session) shape
 * @returns {Record<string, unknown>}
 */
function toRestDay(_session) {
  const mutated = {
    training_type: REST_TYPE,
    title: 'Descanso',
    description: 'Día de recuperación completa',
  };
  for (const field of VOLUME_FIELDS) mutated[field] = 0;
  return mutated;
}

// ============================================================
// The three rules — each (finding, eligibleSessions, ctx) -> {patch,
// snapshot} | null. Callers MUST pre-filter `sessions` through
// `eligibleSessions()` for the matching finding source before calling.
// ============================================================

/**
 * acwr_zone danger -> scale estimated_duration_minutes of every eligible
 * session within the next DELOAD_WINDOW_DAYS (inclusive) by DELOAD_FACTOR.
 * @param {object} finding
 * @param {Array<object>} sessions - already eligibility-filtered
 * @param {{todayLocal: string}} ctx
 * @returns {{patch: object, snapshot: object}|null}
 */
export function ruleDeloadVolume(finding, sessions, ctx) {
  const todayLocal = ctx && ctx.todayLocal;
  const targets = (sessions || []).filter(
    (session) => daysBetween(todayLocal, toDateStr(session.scheduled_date)) <= DELOAD_WINDOW_DAYS,
  );
  if (targets.length === 0) return null;

  return buildPatch(targets, (session) => {
    const mutated = {};
    for (const field of VOLUME_FIELDS) {
      const oldValue = typeof session[field] === 'number' ? session[field] : 0;
      mutated[field] = Math.round(oldValue * DELOAD_FACTOR);
    }
    return mutated;
  });
}

/**
 * tsb_critical -> convert the single highest-volume eligible session
 * within the next RECOVERY_WINDOW_DAYS (inclusive) to a rest day. Ties
 * broken by earliest scheduled_date for determinism.
 * @param {object} finding
 * @param {Array<object>} sessions - already eligibility-filtered
 * @param {{todayLocal: string}} ctx
 * @returns {{patch: object, snapshot: object}|null}
 */
export function ruleInsertRecovery(finding, sessions, ctx) {
  const todayLocal = ctx && ctx.todayLocal;
  const candidates = (sessions || []).filter(
    (session) => daysBetween(todayLocal, toDateStr(session.scheduled_date)) <= RECOVERY_WINDOW_DAYS,
  );
  if (candidates.length === 0) return null;

  const volumeOf = (session) =>
    VOLUME_FIELDS.reduce((sum, field) => sum + (typeof session[field] === 'number' ? session[field] : 0), 0);

  let winner = candidates[0];
  for (const candidate of candidates.slice(1)) {
    if (volumeOf(candidate) > volumeOf(winner)) {
      winner = candidate;
    } else if (
      volumeOf(candidate) === volumeOf(winner) &&
      toDateStr(candidate.scheduled_date) < toDateStr(winner.scheduled_date)
    ) {
      winner = candidate;
    }
  }

  return buildPatch([winner], toRestDay);
}

/**
 * low_completion -> drop the trailing eligible sessions of the upcoming
 * week (next DELOAD_WINDOW_DAYS) until the remaining planned count equals
 * `completedThisWeek`, floored at `max(MIN_SESSIONS_PER_WEEK,
 * availableDays ?? 0)`.
 * @param {object} finding
 * @param {Array<object>} sessions - already eligibility-filtered
 * @param {{todayLocal: string, completedThisWeek: number, availableDays: number|null}} ctx
 * @returns {{patch: object, snapshot: object}|null}
 */
export function ruleReduceFrequency(finding, sessions, ctx) {
  const { todayLocal, completedThisWeek = 0, availableDays = null } = ctx || {};

  const candidates = (sessions || [])
    .filter((session) => daysBetween(todayLocal, toDateStr(session.scheduled_date)) <= DELOAD_WINDOW_DAYS)
    .slice()
    .sort((a, b) => {
      const dateA = toDateStr(a.scheduled_date);
      const dateB = toDateStr(b.scheduled_date);
      if (dateA < dateB) return -1;
      if (dateA > dateB) return 1;
      return 0;
    });

  const floor = Math.max(MIN_SESSIONS_PER_WEEK, availableDays ?? 0);
  const finalTarget = Math.max(completedThisWeek, floor);
  const dropCount = Math.max(0, candidates.length - finalTarget);
  if (dropCount === 0) return null;

  const targets = candidates.slice(candidates.length - dropCount);
  return buildPatch(targets, toRestDay);
}

// ============================================================
// resolveFinding — priority resolution across co-firing findings
// ============================================================

/**
 * @param {Array<{alertId?: string, alertType: string, severity: string, metrics: object}>} openFindings
 * @returns {object|null} the single winner by FINDING_PRIORITY, or null.
 *          acwr_zone qualifies ONLY when `metrics.zone === 'danger'` — see
 *          the module-header note on severity vs zone.
 */
export function resolveFinding(openFindings) {
  if (!Array.isArray(openFindings)) return null;

  for (const source of FINDING_PRIORITY) {
    const match = openFindings.find((finding) => {
      if (!finding || finding.alertType !== source) return false;
      if (source === 'acwr_zone') return finding.metrics && finding.metrics.zone === 'danger';
      return true;
    });
    if (match) return match;
  }
  return null;
}

// ============================================================
// Spanish copy — one message per patch type
// ============================================================

const MESSAGES_ES = {
  deload_volume:
    'Se ha reducido el volumen de las próximas sesiones para prevenir sobrecarga (ACWR elevado).',
  insert_recovery:
    'Se ha insertado un día de descanso adicional para favorecer la recuperación (forma muy baja).',
  reduce_frequency:
    'Se ha reducido la frecuencia de sesiones de la próxima semana para adaptarse al ritmo de completitud actual.',
};

function messageFor(patchType) {
  return MESSAGES_ES[patchType] || '';
}

// ============================================================
// evaluateAdjustment — the single entry point
// ============================================================

/**
 * @param {{athleteId?: string, coachId?: string, openFindings: Array<object>}} candidate
 * @param {Array<{id: string, scheduled_date: string, status: string, training_type?: string,
 *          estimated_duration_minutes?: number, title?: string, description?: string,
 *          adjustedByAgent?: boolean, lastAdjustmentSource?: string}>} sessions
 * @param {{diasDisponibles: Record<string, boolean>|null}} profile
 * @param {string} todayLocal - 'YYYY-MM-DD'
 * @returns {null | {findingSource: string, patchType: string, triggeringAlertId: string|null,
 *          earliestTargetDate: string, patch: object, snapshot: object, metrics: object,
 *          messageEs: string}}
 */
export function evaluateAdjustment(candidate, sessions, profile, todayLocal) {
  const openFindings = (candidate && candidate.openFindings) || [];
  const winner = resolveFinding(openFindings);
  if (!winner) return null;

  const findingSource = winner.alertType;
  const eligible = eligibleSessions(sessions, todayLocal, findingSource);
  const availableDays = countAvailableDays(profile && profile.diasDisponibles);

  let ruleResult = null;
  let patchType = null;

  if (findingSource === 'acwr_zone') {
    patchType = 'deload_volume';
    ruleResult = ruleDeloadVolume(winner, eligible, { todayLocal });
  } else if (findingSource === 'tsb_critical') {
    patchType = 'insert_recovery';
    ruleResult = ruleInsertRecovery(winner, eligible, { todayLocal });
  } else if (findingSource === 'low_completion') {
    patchType = 'reduce_frequency';
    const completedThisWeek = (winner.metrics && winner.metrics.completedToDate) || 0;
    ruleResult = ruleReduceFrequency(winner, eligible, { todayLocal, completedThisWeek, availableDays });
  }

  if (!ruleResult) return null;

  const targetIds = Object.keys(ruleResult.patch.sessions);
  const earliestTargetDate = targetIds
    .map((id) => ruleResult.snapshot.sessions[id].scheduled_date)
    .sort()[0];

  return {
    findingSource,
    patchType,
    triggeringAlertId: winner.alertId ?? null,
    earliestTargetDate,
    patch: ruleResult.patch,
    snapshot: ruleResult.snapshot,
    metrics: winner.metrics || {},
    messageEs: messageFor(patchType),
  };
}

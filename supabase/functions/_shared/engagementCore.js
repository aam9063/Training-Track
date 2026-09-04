/**
 * Engagement Core — signal-of-life resolution, silence tiering, and the
 * eligibility rulebook (warm-up, zero-planned-sessions suppression,
 * never-started edge case) for Agent 2 (adherence/engagement detection).
 *
 * ZERO IMPORTS, plain ESM — this file is imported directly by:
 *   - Deno (`supabase/functions/engagement-monitor/**\/*.ts`) with an
 *     explicit `.js` extension
 *   - Node's built-in test runner (`engagementCore.test.js`, `npm run
 *     test:core`)
 *
 * Keeping this dependency-free is what makes the same file resolvable by
 * both runtimes with zero build-step divergence — do not add an import
 * here, and do not import Supabase, React, or any UI code.
 *
 * See: openspec/changes/adherence-detection-agent/design.md
 *      ("Interfaces / Contracts" section has the authoritative signatures
 *      and gate order).
 */

// ============================================================
// Constants
// ============================================================

/** The single alert type this capability produces. Severity, not type, tiers it. */
export const ALERT_TYPES = ['engagement_silence'];

/** silence_days >= this => 'warning'. One microcycle (7d) + 3d grace. */
export const SILENCE_WARNING_DAYS = 10;

/** silence_days >= this => 'danger'. Three microcycles. */
export const SILENCE_DANGER_DAYS = 21;

/** An athlete must be supervised at least this many days before evaluation. */
export const WARMUP_DAYS = 21;

/** Observation window (days) for the zero-planned-sessions suppression check. */
export const SUPPRESSION_WINDOW_DAYS = SILENCE_WARNING_DAYS;

// ============================================================
// Date helpers — pure string in/out, UTC-anchored (never
// `toISOString().split('T')[0]` on an ambient/local clock — the inputs
// here are already resolved calendar-date strings supplied by the caller).
// ============================================================

/**
 * Take the 'YYYY-MM-DD' date part off either a bare date string or a full
 * ISO timestamp, so mixed-format signal sources compare correctly.
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
// Signal-of-life OR-blend
// ============================================================

/**
 * OR-blend the four signal-of-life sources into a single last-seen date.
 * Pure max: a source with no data is simply excluded from the comparison,
 * never substituted with a value that would increase (fabricate) silence —
 * a missing source can only fail to rescue a genuinely silent athlete
 * (false negative), never manufacture a false positive.
 *
 * @param {{lastSessionCompletedAt?: string|null, lastWellnessDate?: string|null,
 *          lastStravaAt?: string|null, lastAthleteMessageAt?: string|null}} signals
 *        each value is 'YYYY-MM-DD' | ISO timestamp | null
 * @returns {{at: string|null, source: 'session'|'wellness'|'strava'|'chat'|null}}
 */
export function resolveLastSignal(signals) {
  const sources = [
    ['session', signals?.lastSessionCompletedAt],
    ['wellness', signals?.lastWellnessDate],
    ['strava', signals?.lastStravaAt],
    ['chat', signals?.lastAthleteMessageAt],
  ];

  let best = null;
  for (const [source, rawValue] of sources) {
    const dateStr = toDateStr(rawValue);
    if (!dateStr) continue;
    if (!best || dateStr > best.dateStr) {
      best = { dateStr, source };
    }
  }

  if (!best) return { at: null, source: null };
  return { at: best.dateStr, source: best.source };
}

// ============================================================
// Eligibility rules
// ============================================================

/**
 * Whether an athlete's supervision has lasted at least WARMUP_DAYS.
 * A null start_date is never evaluable (returns false), matching D5's
 * "not evaluable" rule for relationships activated without a start_date.
 * @param {string|null|undefined} startDate - 'YYYY-MM-DD'
 * @param {string} todayLocal - 'YYYY-MM-DD'
 * @returns {boolean}
 */
export function isPastWarmUp(startDate, todayLocal) {
  if (!startDate) return false;
  return daysBetween(startDate, todayLocal) >= WARMUP_DAYS;
}

/**
 * Map a silence-day count to a severity tier, or null if below the
 * warning threshold (no alert-eligible condition).
 * @param {number} silenceDays
 * @returns {'danger'|'warning'|null}
 */
export function tierFor(silenceDays) {
  if (typeof silenceDays !== 'number' || silenceDays < SILENCE_WARNING_DAYS) return null;
  if (silenceDays >= SILENCE_DANGER_DAYS) return 'danger';
  return 'warning';
}

// ============================================================
// Spanish copy — distinct per variant/severity (D5: the coach action for
// "never started" is onboarding, not re-engagement, so the copy must say so)
// ============================================================

const MESSAGES_ES = {
  silence_warning: (days) =>
    `Inactividad: el atleta lleva ${days} días sin registrar sesiones, bienestar, actividad de Strava ni mensajes. Conviene contactarle para reactivar el seguimiento.`,
  silence_danger: (days) =>
    `Riesgo de abandono: el atleta lleva ${days} días sin registrar actividad en ninguna fuente. Contacta cuanto antes.`,
  never_started_warning: (days) =>
    `El atleta lleva ${days} días de seguimiento activo y nunca ha registrado actividad. Revisa el proceso de incorporación.`,
  never_started_danger: (days) =>
    `Riesgo de abandono: el atleta lleva ${days} días de seguimiento activo y nunca ha registrado actividad. Revisa el proceso de incorporación.`,
};

function messageFor(variant, severity, silenceDays) {
  const template = MESSAGES_ES[`${variant}_${severity}`] || MESSAGES_ES.silence_warning;
  return template(silenceDays);
}

// ============================================================
// evaluateEngagement — the single entry point, gate order per design.md:
//   1. !isPastWarmUp(startDate, today)  -> null   (D5)
//   2. plannedInWindow === 0            -> null   (coach went quiet, not the athlete)
//   3. lastSignal.at === null           -> variant 'never_started',
//                                          silenceDays = today - startDate
//   4. else                             -> variant 'silence',
//                                          silenceDays = today - lastSignal.at
//   5. tierFor(silenceDays) === null    -> null
// ============================================================

/**
 * @param {{athleteId?: string, coachId?: string, startDate: string|null,
 *          plannedInWindow: number, lastSessionCompletedAt?: string|null,
 *          lastWellnessDate?: string|null, lastStravaAt?: string|null,
 *          lastAthleteMessageAt?: string|null}} candidate
 * @param {string} todayLocal - 'YYYY-MM-DD'
 * @returns {null | {alertType: 'engagement_silence', severity: 'warning'|'danger',
 *          silenceDays: number, messageEs: string,
 *          metrics: {variant: 'silence'|'never_started', lastSignalAt: string|null,
 *          lastSignalSource: string|null, plannedInWindow: number}}}
 */
export function evaluateEngagement(candidate, todayLocal) {
  const { startDate, plannedInWindow } = candidate || {};

  // Gate 1: warm-up exclusion — excluded from evaluation entirely.
  if (!isPastWarmUp(startDate, todayLocal)) return null;

  // Gate 2: zero-planned-sessions suppression — the coach went quiet, not
  // the athlete.
  if (plannedInWindow === 0) return null;

  const lastSignal = resolveLastSignal(candidate);

  let variant;
  let silenceDays;
  if (lastSignal.at === null) {
    // Gate 3: never-started — past warm-up implies >= WARMUP_DAYS (21),
    // which is also the danger threshold, so this always lands 'danger'.
    variant = 'never_started';
    silenceDays = daysBetween(startDate, todayLocal);
  } else {
    variant = 'silence';
    silenceDays = daysBetween(lastSignal.at, todayLocal);
  }

  // Gate 5: tiering — no alert-eligible condition below the warning floor.
  const severity = tierFor(silenceDays);
  if (severity === null) return null;

  return {
    alertType: 'engagement_silence',
    severity,
    silenceDays,
    messageEs: messageFor(variant, severity, silenceDays),
    metrics: {
      variant,
      lastSignalAt: lastSignal.at,
      lastSignalSource: lastSignal.source,
      plannedInWindow,
    },
  };
}

/**
 * Training Load Core — canonical TSS/CTL/ATL/TSB/ACWR computation and the
 * single 4-signal alert rulebook (acwr_zone, tsb_critical, low_completion,
 * high_rpe).
 *
 * ZERO IMPORTS, plain ESM. This file is imported directly by:
 *   - Deno (`supabase/functions/**\/index.ts`) with an explicit `.js` extension
 *   - Vite, via `src/lib/trainingMetrics.js`'s re-export
 *     (`../../supabase/functions/_shared/trainingLoadCore.js`)
 *
 * Keeping this dependency-free is what makes the same file resolvable by
 * both runtimes with zero build-step divergence — do not add an import here.
 *
 * See: openspec/changes/training-load-monitoring-agent/design.md
 *      ("Interfaces / Contracts" section has the authoritative signatures).
 */

// ============================================================
// Constants
// ============================================================

/** Bump whenever the computation logic changes in a value-affecting way. */
export const CALC_VERSION = 2;

/** The four independent alert signals. Order is not meaningful. */
export const ALERT_TYPES = ['acwr_zone', 'tsb_critical', 'low_completion', 'high_rpe'];

/** Minimum days of EWMA warm-up before acwr_zone/tsb_critical become alert-eligible. */
const WARMUP_DAYS = 126;

// ============================================================
// TSS (Training Stress Score) — rTSS -> hrTSS -> duration fallback
// ============================================================

/**
 * Running TSS from pace (rTSS).
 * @param {number} durationS
 * @param {number} avgPaceSPerKm
 * @param {number} thresholdPaceSPerKm
 * @returns {number}
 */
export const calculateRtss = (durationS, avgPaceSPerKm, thresholdPaceSPerKm) => {
  if (!durationS || !avgPaceSPerKm || !thresholdPaceSPerKm) return 0;
  if (avgPaceSPerKm <= 0 || thresholdPaceSPerKm <= 0) return 0;
  const intensityFactor = thresholdPaceSPerKm / avgPaceSPerKm;
  return Math.round(((durationS * intensityFactor ** 2) / 3600) * 100);
};

/**
 * Heart-rate-based TSS (hrTSS) — fallback when pace-based TSS isn't available.
 * @param {number} durationS
 * @param {number} avgHR
 * @param {number} lthr
 * @returns {number}
 */
export const calculateHrTss = (durationS, avgHR, lthr) => {
  if (!durationS || !avgHR || !lthr) return 0;
  const intensityFactor = avgHR / lthr;
  return Math.round(((durationS * intensityFactor ** 2) / 3600) * 100);
};

/**
 * Intensity Factor (0-2 range typically).
 * @param {number} avgPaceSPerKm
 * @param {number} thresholdPaceSPerKm
 * @returns {number}
 */
export const calculateIntensityFactor = (avgPaceSPerKm, thresholdPaceSPerKm) => {
  if (!avgPaceSPerKm || !thresholdPaceSPerKm) return 0;
  return Math.round((thresholdPaceSPerKm / avgPaceSPerKm) * 100) / 100;
};

/**
 * TSS for a single raw activity, following the existing fallback chain:
 * rTSS (pace-based) -> hrTSS (heart-rate-based) -> duration-only estimate.
 *
 * @param {{moving_time?:number, elapsed_time?:number, distance?:number, average_heartrate?:number}} activity
 * @param {{lactate_threshold_pace?:number, lactate_threshold_hr?:number}} profile
 * @returns {number}
 */
export function tssForActivity(activity, profile) {
  const durationS = activity?.moving_time || activity?.elapsed_time || 0;
  const distanceM = activity?.distance || 0;
  if (distanceM <= 0 || durationS <= 0) return 0;

  const avgPaceSPerKm = (durationS / distanceM) * 1000;
  const thresholdPace = profile?.lactate_threshold_pace;
  const thresholdHR = profile?.lactate_threshold_hr;

  if (thresholdPace && thresholdPace > 0) {
    return calculateRtss(durationS, avgPaceSPerKm, thresholdPace);
  }
  if (thresholdHR && activity?.average_heartrate) {
    return calculateHrTss(durationS, activity.average_heartrate, thresholdHR);
  }
  // Fallback: estimate from duration (1 hour easy ~= 60 TSS)
  return Math.round((durationS / 3600) * 60);
}

// Activity types counted toward training load (mirrors the pre-existing
// client filter in src/services/trainingLoadService.js).
const LOAD_ACTIVITY_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);

/**
 * Add `n` days to a 'YYYY-MM-DD' date string using pure UTC-anchored date
 * math (no ambient/local clock is read — `from`/`to` are already resolved
 * calendar-date strings supplied by the caller, so this is safe and is NOT
 * the `toISOString().split('T')[0]` anti-pattern, which converts a `Date`
 * built from an ambient local clock).
 * @param {string} dateStr
 * @param {number} n
 * @returns {string}
 */
function addDaysUTC(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Build a calendar-filled daily series (no gaps) from raw activities.
 *
 * @param {Array<Object>} activities - raw strava_activities rows
 * @param {{lactate_threshold_pace?:number, lactate_threshold_hr?:number}} profile
 * @param {string} from - 'YYYY-MM-DD', inclusive
 * @param {string} to - 'YYYY-MM-DD', inclusive
 * @returns {Array<{date:string, tss:number, distanceM:number, durationS:number, count:number}>}
 */
export function buildDailySeries(activities, profile, from, to) {
  const dailyMap = new Map();

  for (const activity of activities || []) {
    if (!LOAD_ACTIVITY_TYPES.has(activity?.type)) continue;
    // start_date_local already represents the athlete's local wall-clock
    // time (verified live: timestamptz column, but the value is the local
    // moment) — taking the date part directly matches the pre-existing
    // client behaviour and introduces no change in this slice.
    const date = (activity.start_date_local || '').slice(0, 10);
    if (!date) continue;

    const tss = tssForActivity(activity, profile);
    const distanceM = activity.distance || 0;
    const durationS = activity.moving_time || activity.elapsed_time || 0;

    const existing = dailyMap.get(date) || { tss: 0, distanceM: 0, durationS: 0, count: 0 };
    existing.tss += tss;
    existing.distanceM += distanceM;
    existing.durationS += durationS;
    existing.count += 1;
    dailyMap.set(date, existing);
  }

  const series = [];
  let cursor = from;
  // Guard against a malformed/reversed range producing an infinite loop.
  let guard = 0;
  while (cursor <= to && guard < 100000) {
    const day = dailyMap.get(cursor);
    series.push({
      date: cursor,
      tss: day?.tss || 0,
      distanceM: day?.distanceM || 0,
      durationS: day?.durationS || 0,
      count: day?.count || 0,
    });
    cursor = addDaysUTC(cursor, 1);
    guard += 1;
  }

  return series;
}

// ============================================================
// CTL / ATL / TSB / chronic_load_28 / ACWR (Performance Management Chart)
// ============================================================

/** Update a time-constant EWMA by one day. */
export const updateEwma = (yesterday, tssToday, timeConstant) =>
  yesterday + (tssToday - yesterday) * (1 / timeConstant);

/** Update Chronic Training Load (42-day EWMA). */
export const updateCtl = (ctlYesterday, tssToday, timeConstant = 42) =>
  updateEwma(ctlYesterday, tssToday, timeConstant);

/** Update Acute Training Load (7-day EWMA). Also `ewma7(tss)` for ACWR. */
export const updateAtl = (atlYesterday, tssToday, timeConstant = 7) =>
  updateEwma(atlYesterday, tssToday, timeConstant);

/** Update the 28-day chronic EWMA used as ACWR's denominator (D1). */
export const updateChronicLoad28 = (chronicYesterday, tssToday, timeConstant = 28) =>
  updateEwma(chronicYesterday, tssToday, timeConstant);

/** Training Stress Balance (Form). */
export const calculateTsb = (ctl, atl) => ctl - atl;

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Compute the full CTL/ATL/TSB/chronic_load_28/ACWR/ramp-rate/warm-up
 * series from a calendar-filled daily TSS series, seeding CTL/ATL/chronic28
 * at 0 (per design's "Deterministic full-window recompute" decision).
 *
 * CTL/ATL/TSB/ramp-rate reproduce `calculatePMC()`'s exact recurrence and
 * rounding (byte-parity requirement) — only ACWR's formula differs
 * (ewma7(tss)/chronic_load_28 instead of atl/ctl).
 *
 * Warm-up: `lowConfidence` on a row is `true` when fewer than 126 daily
 * samples have been fed into the EWMA up to and including that row (i.e.
 * `dailySeries.length < 126` at that point). The caller is responsible for
 * supplying a `dailySeries` that reflects the athlete's actual available
 * history — a fixed [today-189d, today] window always has 190 entries, so
 * a caller who wants a true warm-up signal for an athlete who joined more
 * recently should not zero-pad before their first known activity date.
 *
 * @param {Array<{date:string, tss:number}>} dailySeries - sorted ASC
 * @returns {Array<{date:string, tss:number, ctl:number, atl:number, tsb:number, chronicLoad28:number, acwr:number, rampRate:number|null, lowConfidence:boolean}>}
 */
export function computeLoadSeries(dailySeries) {
  let ctl = 0;
  let atl = 0;
  let chronicLoad28 = 0;
  let prevCtl = 0;

  return (dailySeries || []).map((day, index) => {
    const tss = day.tss || 0;

    ctl = updateCtl(ctl, tss);
    atl = updateAtl(atl, tss);
    chronicLoad28 = updateChronicLoad28(chronicLoad28, tss);
    const tsb = calculateTsb(ctl, atl);

    let rampRate = null;
    if (index >= 7) {
      rampRate = round1(ctl - prevCtl);
    }
    if (index % 7 === 0) prevCtl = ctl;

    const acwr = chronicLoad28 > 0 ? round2(atl / chronicLoad28) : 0;
    const lowConfidence = index + 1 < WARMUP_DAYS;

    return {
      date: day.date,
      tss: round1(tss),
      ctl: round1(ctl),
      atl: round1(atl),
      tsb: round1(tsb),
      chronicLoad28: round1(chronicLoad28),
      acwr,
      rampRate,
      lowConfidence,
    };
  });
}

// ============================================================
// ISO week helpers (Monday-anchored, matching getWeekStartDate() convention)
// ============================================================

/**
 * Monday of the ISO week containing `todayLocalStr`. Pure string/UTC-anchored
 * date math — the input is already a resolved local calendar date, so this
 * is not the `toISOString().split('T')[0]` ambient-clock anti-pattern.
 * @param {string} todayLocalStr - 'YYYY-MM-DD'
 * @returns {string} 'YYYY-MM-DD' — the Monday of that week
 */
export function isoWeekStart(todayLocalStr) {
  const d = new Date(`${todayLocalStr}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // matches getWeekStartDate()'s (day===0?-6:1) convention
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Sunday of the ISO week starting on `weekStartStr`.
 * @param {string} weekStartStr - 'YYYY-MM-DD', a Monday
 * @returns {string} 'YYYY-MM-DD'
 */
export function isoWeekEnd(weekStartStr) {
  return addDaysUTC(weekStartStr, 6);
}

/**
 * Summarize a training week's planned/completed sessions.
 *
 * completionRate = completed / planned over the WHOLE week (Monday-Sunday),
 * never elapsed-to-date, and with NO suppression floor — literal spec
 * reading, explicit user decision (see design.md "Denominator" decision).
 * completionRate is null ONLY when planned === 0 (nothing scheduled that
 * week — an undefined ratio, not a low one).
 *
 * avgRpe is averaged over rated *completed* sessions only.
 *
 * @param {Array<{scheduled_date:string, status:string, rpe_score?:number}>} sessions
 * @param {string} weekStart - 'YYYY-MM-DD', Monday
 * @param {string} weekEnd - 'YYYY-MM-DD', Sunday
 * @returns {{planned:number, completed:number, completionRate:number|null, avgRpe:number|null, ratedCount:number}}
 */
export function summarizeWeekSessions(sessions, weekStart, weekEnd) {
  const inWeek = (sessions || []).filter(
    (s) => s.scheduled_date >= weekStart && s.scheduled_date <= weekEnd,
  );

  const planned = inWeek.length;
  const completed = inWeek.filter((s) => s.status === 'completed').length;
  const completionRate = planned === 0 ? null : completed / planned;

  const ratedCompleted = inWeek.filter(
    (s) => s.status === 'completed' && Number.isFinite(s.rpe_score) && s.rpe_score > 0,
  );
  const ratedCount = ratedCompleted.length;
  const avgRpe =
    ratedCount === 0
      ? null
      : ratedCompleted.reduce((sum, s) => sum + s.rpe_score, 0) / ratedCount;

  return { planned, completed, completionRate, avgRpe, ratedCount };
}

// ============================================================
// Alert rulebook — the single implementation for all four signals
// ============================================================

/**
 * Compute ACWR from its two stored components (D1's canonical formula:
 * ewma7(tss)/chronic_load_28, i.e. `atl / chronicLoad28`). Consumers that
 * only persist/read `daily_training_load` rows (no full `dailySeries` to
 * feed through `computeLoadSeries`) — e.g. `weekly-ai-reports` — use this
 * instead of duplicating the ratio inline, so the formula has exactly one
 * implementation regardless of which shape the caller has on hand.
 * @param {number|null|undefined} atl
 * @param {number|null|undefined} chronicLoad28
 * @returns {number|null} null when chronicLoad28 is missing/non-positive
 */
export function acwrFromComponents(atl, chronicLoad28) {
  if (typeof atl !== 'number' || typeof chronicLoad28 !== 'number' || chronicLoad28 <= 0) {
    return null;
  }
  return round2(atl / chronicLoad28);
}

/** ACWR zone breakpoints (0.8 / 1.3 / 1.5), matching the pre-existing getAcwrZone() boundaries. */
export function acwrZone(acwr) {
  if (acwr > 1.5) return 'danger';
  if (acwr > 1.3) return 'caution';
  if (acwr >= 0.8) return 'optimal';
  return 'undertraining';
}

const MESSAGES_ES = {
  acwr_zone_caution:
    'Cuidado: tu carga está aumentando rápidamente. Controla el volumen esta semana.',
  acwr_zone_danger:
    'Alerta: riesgo elevado de sobrecarga. Reduce la intensidad y descansa.',
  tsb_critical:
    'Tu forma (TSB) está muy baja. Riesgo de sobreentrenamiento — prioriza el descanso.',
  low_completion:
    'Baja completitud del plan esta semana. Revisa las sesiones pendientes.',
  high_rpe:
    'El esfuerzo percibido (RPE) medio esta semana es muy alto. Vigila señales de fatiga excesiva.',
};

/**
 * Evaluate the single 4-signal alert rulebook.
 *
 * Two independently-nullable arguments encode the spec's asymmetric warm-up
 * suppression in the signature itself:
 *   - `loadRow` (null | { acwr, tsb, lowConfidence, ... }) gates
 *     `acwr_zone` + `tsb_critical` ONLY. A null row, or a row with
 *     `lowConfidence === true`, suppresses both signals.
 *   - `weekSummary` (null | summarizeWeekSessions() output) gates
 *     `low_completion` + `high_rpe` ONLY. Never suppressed by warm-up.
 *
 * @param {{acwr?:number, tsb?:number, lowConfidence?:boolean}|null} loadRow
 * @param {{planned:number, completed:number, completionRate:number|null, avgRpe:number|null, ratedCount:number}|null} weekSummary
 * @returns {Array<{alertType:string, severity:'warning'|'critical', messageEs:string, metrics:Object}>}
 */
export function evaluateLoad(loadRow, weekSummary) {
  const findings = [];

  if (loadRow && loadRow.lowConfidence !== true) {
    const { acwr, tsb } = loadRow;

    if (typeof acwr === 'number') {
      const zone = acwrZone(acwr);
      if (zone === 'caution' || zone === 'danger') {
        findings.push({
          alertType: 'acwr_zone',
          severity: zone === 'danger' ? 'critical' : 'warning',
          messageEs: MESSAGES_ES[`acwr_zone_${zone}`],
          metrics: { acwr, zone },
        });
      }
    }

    if (typeof tsb === 'number' && tsb < -30) {
      findings.push({
        alertType: 'tsb_critical',
        severity: 'critical',
        messageEs: MESSAGES_ES.tsb_critical,
        metrics: { tsb },
      });
    }
  }

  if (weekSummary) {
    const { planned, completed, completionRate, avgRpe, ratedCount } = weekSummary;

    if (completionRate !== null && completionRate < 0.5) {
      findings.push({
        alertType: 'low_completion',
        severity: 'critical',
        messageEs: MESSAGES_ES.low_completion,
        metrics: { plannedToDate: planned, completedToDate: completed, completionRate },
      });
    }

    if (avgRpe !== null && avgRpe >= 8.5) {
      findings.push({
        alertType: 'high_rpe',
        severity: 'critical',
        messageEs: MESSAGES_ES.high_rpe,
        metrics: { avgRpe, ratedCount },
      });
    }
  }

  return findings;
}

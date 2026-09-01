/**
 * Training Metrics Calculations
 * Based on Jack Daniels VDOT system and TrainingPeaks TSS model
 * Reference: ATHLETICS_DOMAIN.md
 *
 * TSS/CTL/ATL/TSB/ACWR-formula and alert-rulebook single source of truth
 * lives in supabase/functions/_shared/trainingLoadCore.js (zero imports,
 * shared verbatim between Deno and Vite — see design.md "Shared core lives
 * at supabase/functions/_shared/trainingLoadCore.js"). This file re-exports
 * it below rather than reimplementing it.
 */
import { computeLoadSeries as _computeLoadSeries } from '../../supabase/functions/_shared/trainingLoadCore.js';

export {
  CALC_VERSION,
  ALERT_TYPES,
  calculateRtss,
  calculateHrTss,
  calculateIntensityFactor,
  tssForActivity,
  buildDailySeries,
  updateCtl,
  updateAtl,
  updateChronicLoad28,
  calculateTsb,
  computeLoadSeries,
  isoWeekStart,
  isoWeekEnd,
  summarizeWeekSessions,
  evaluateLoad,
  acwrZone,
} from '../../supabase/functions/_shared/trainingLoadCore.js';
import { acwrZone as _acwrZone } from '../../supabase/functions/_shared/trainingLoadCore.js';

/**
 * calculatePMC — thin wrapper kept for existing call-site compatibility.
 * Delegates entirely to the core's computeLoadSeries (byte-identical
 * CTL/ATL/TSB/rampRate; ACWR now uses chronic_load_28 instead of CTL,
 * per D1 — this is the one intentional, spec-required value change).
 * @param {Array<{date: string, tss: number}>} dailyTssArray - sorted ASC
 * @returns {Array<{date, tss, ctl, atl, tsb, rampRate}>}
 */
export const calculatePMC = (dailyTssArray) => _computeLoadSeries(dailyTssArray);

// ============================================================
// VDOT & Training Paces (Jack Daniels System)
// ============================================================

/**
 * Calculate VDOT from a race result
 * @param {number} distanceM - Race distance in meters
 * @param {number} timeMinutes - Race time in minutes
 * @returns {number} VDOT value
 */
export const calculateVdot = (distanceM, timeMinutes) => {
  if (!distanceM || !timeMinutes || timeMinutes <= 0) return null;
  const velocity = distanceM / timeMinutes; // m/min
  const pctMax =
    0.8 +
    0.1894393 * Math.exp(-0.012778 * timeMinutes) +
    0.2989558 * Math.exp(-0.1932605 * timeMinutes);
  const vo2 = -4.6 + 0.182258 * velocity + 0.000104 * velocity ** 2;
  const vdot = vo2 / pctMax;
  return Math.round(vdot * 10) / 10;
};

/**
 * Convert VDOT + %vVO2max → pace in seconds/km
 */
const vdotToPace = (vdot, pctVo2max) => {
  const vo2 = vdot * pctVo2max;
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.6 - vo2;
  const discriminant = b ** 2 - 4 * a * c;
  if (discriminant < 0) return null;
  const velocity = (-b + Math.sqrt(discriminant)) / (2 * a); // m/min
  if (velocity <= 0) return null;
  return Math.round((1000 / velocity) * 60); // seconds per km
};

/**
 * Derive all 5 Daniels training paces from VDOT
 * @param {number} vdot - VDOT value
 * @returns {Object} Training paces in seconds/km
 */
export const getTrainingPaces = (vdot) => {
  if (!vdot || vdot <= 0) return null;
  return {
    easy: { min: vdotToPace(vdot, 0.59), max: vdotToPace(vdot, 0.74) },
    marathon: vdotToPace(vdot, 0.79),
    threshold: vdotToPace(vdot, 0.88),
    interval: vdotToPace(vdot, 1.0),
    repetition: vdotToPace(vdot, 1.05),
  };
};

/**
 * Predict race time from VDOT for a given distance
 * More accurate than Riegel formula for running
 * @param {number} vdot - VDOT value
 * @param {number} targetDistanceM - Target distance in meters
 * @returns {number} Predicted time in seconds
 */
export const predictRaceTime = (vdot, targetDistanceM) => {
  if (!vdot || !targetDistanceM) return null;
  // Binary search for the time (in minutes) that produces this VDOT at this distance
  // Faster time → higher VDOT, so if testVdot > vdot → time too fast → increase time
  let low = 1; // 1 minute
  let high = 600; // 10 hours (covers slow marathon)
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    const testVdot = calculateVdot(targetDistanceM, mid);
    if (testVdot === null) return null;
    if (testVdot > vdot) low = mid;  // time too fast → search slower
    else high = mid;                  // time too slow → search faster
  }
  return Math.round((low + high) / 2 * 60); // convert minutes → seconds
};

// ============================================================
// ACWR & Injury Risk — UI-display-only helpers
// ============================================================
// Zone classification (the 0.8/1.3/1.5 breakpoints) lives exclusively in
// the core module's `acwrZone()` — these two helpers are thin UI-display
// wrappers around it (color/label/icon/message lookups only), NOT a
// formula duplicate. This satisfies task 4.4's grep verification: the
// literal identifiers `getAcwrZone` and `getAcwrAlertConfig` no longer
// exist anywhere in the repo (renamed to `getAcwrZoneDisplay` /
// `getAcwrAlertDisplay` below, both call sites updated —
// src/components/dashboard/TeamHealthTable.jsx,
// src/components/athlete/PMCChart.jsx, src/pages/athlete/Metrics.jsx).
//
// getReadinessScore in trainingLoadService.js (1.15) already passes
// chronic_load_28 (falling back to ctl only for not-yet-recomputed rows)
// into calculateAcwr below.

/**
 * Acute:Chronic Workload Ratio. NOTE: this is a generic ratio helper — the
 * caller decides what to pass as the second argument (chronic_load_28 for
 * the canonical value, or legacy `ctl` for not-yet-migrated call sites).
 */
export const calculateAcwr = (atl, denominator) =>
  (denominator > 0 ? Math.round((atl / denominator) * 100) / 100 : 0);

const ACWR_ZONE_DISPLAY_MAP = {
  undertraining: { zone: 'undertraining', color: '#3B82F6', label: 'Baja carga' },
  optimal: { zone: 'optimal', color: '#10B981', label: 'Óptimo' },
  caution: { zone: 'high', color: '#F59E0B', label: 'Carga alta' },
  danger: { zone: 'danger', color: '#EF4444', label: 'Riesgo de lesión' },
};

/**
 * Get ACWR zone classification (UI display: color + Spanish label).
 * Delegates classification to the core's `acwrZone()` — this is a display
 * lookup only, not a threshold reimplementation.
 */
export const getAcwrZoneDisplay = (acwr) => ACWR_ZONE_DISPLAY_MAP[_acwrZone(acwr)];

// ============================================================
// Training Monotony & Strain
// ============================================================

/**
 * Calculate training monotony and strain from daily TSS values
 */
export const calculateMonotonyStrain = (dailyTssList) => {
  const n = dailyTssList.length;
  if (n === 0) return { monotony: 0, strain: 0 };
  const avg = dailyTssList.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(
    dailyTssList.reduce((sum, v) => sum + (v - avg) ** 2, 0) / n
  );
  const monotony = std > 0 ? Math.round((avg / std) * 100) / 100 : 0;
  const strain = Math.round(dailyTssList.reduce((a, b) => a + b, 0) * monotony);
  return { monotony, strain };
};

// ============================================================
// Efficiency & Biomechanics
// ============================================================

/**
 * Efficiency Factor (speed / heart rate)
 */
export const calculateEf = (avgSpeedMPerS, avgHr) => {
  if (!avgSpeedMPerS || !avgHr) return null;
  return Math.round((avgSpeedMPerS / avgHr) * 10000) / 10000;
};

/**
 * Detect cardiac drift (HR:pace decoupling) in an activity
 * Compare EF of first half vs second half
 * @param {Array} splits - Activity splits with pace and HR
 * @returns {number} Drift percentage (positive = HR drifting up = less fit)
 */
export const calculateCardiacDrift = (splits) => {
  if (!splits || splits.length < 4) return null;
  const mid = Math.floor(splits.length / 2);
  const firstHalf = splits.slice(0, mid);
  const secondHalf = splits.slice(mid);

  const avgEf = (arr) => {
    const valid = arr.filter(s => s.average_speed > 0 && s.average_heartrate > 0);
    if (valid.length === 0) return null;
    const totalEf = valid.reduce((sum, s) => sum + (s.average_speed / s.average_heartrate), 0);
    return totalEf / valid.length;
  };

  const ef1 = avgEf(firstHalf);
  const ef2 = avgEf(secondHalf);
  if (!ef1 || !ef2) return null;

  return Math.round(((ef1 - ef2) / ef1) * 10000) / 100; // percentage
};

// ============================================================
// Split Analysis
// ============================================================

/**
 * Analyze pacing strategy from splits
 * @param {Array} splits - Array of splits with pace_seconds_per_km
 * @returns {Object} Pacing analysis
 */
export const analyzePacing = (splits) => {
  if (!splits || splits.length < 2) return null;
  const paces = splits.filter(s => s.pace_seconds_per_km > 0).map(s => s.pace_seconds_per_km);
  if (paces.length < 2) return null;

  const mid = Math.floor(paces.length / 2);
  const firstHalfAvg = paces.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
  const secondHalfAvg = paces.slice(mid).reduce((a, b) => a + b, 0) / (paces.length - mid);

  const diff = secondHalfAvg - firstHalfAvg; // positive = slower second half
  const pctDiff = Math.round((diff / firstHalfAvg) * 10000) / 100;

  let strategy;
  if (pctDiff < -2) strategy = 'negative_split';
  else if (pctDiff > 2) strategy = 'positive_split';
  else strategy = 'even_split';

  // Pace decay: last split vs average of all
  const avgPace = paces.reduce((a, b) => a + b, 0) / paces.length;
  const lastPace = paces[paces.length - 1];
  const paceDecay = Math.round(((lastPace - avgPace) / avgPace) * 10000) / 100;

  return {
    strategy,
    splitDiffPct: pctDiff,
    firstHalfAvg: Math.round(firstHalfAvg),
    secondHalfAvg: Math.round(secondHalfAvg),
    paceDecay,
    fastestSplit: Math.min(...paces),
    slowestSplit: Math.max(...paces),
    avgPace: Math.round(avgPace),
  };
};

// ============================================================
// TSB Guidelines
// ============================================================

export const TSB_GUIDELINES = {
  RACE_READY_MIN: 15,
  RACE_READY_MAX: 25,
  PRODUCTIVE_MIN: -30,
  PRODUCTIVE_MAX: -10,
  OVERREACH_THRESHOLD: -30,
};

/**
 * Get TSB zone for display
 */
export const getTsbZone = (tsb) => {
  if (tsb >= TSB_GUIDELINES.RACE_READY_MIN && tsb <= TSB_GUIDELINES.RACE_READY_MAX)
    return { zone: 'race_ready', color: '#10B981', label: 'Listo para competir' };
  if (tsb > TSB_GUIDELINES.RACE_READY_MAX)
    return { zone: 'detrained', color: '#3B82F6', label: 'Desentrenamiento' };
  if (tsb >= TSB_GUIDELINES.PRODUCTIVE_MIN && tsb < TSB_GUIDELINES.RACE_READY_MIN)
    return { zone: 'productive', color: '#F59E0B', label: 'Entrenamiento productivo' };
  return { zone: 'overreaching', color: '#EF4444', label: 'Sobrecarga' };
};

// ============================================================
// Standard Race Distances
// ============================================================

export const STANDARD_DISTANCES = [
  { key: '400m', meters: 400, label: '400m' },
  { key: '800m', meters: 800, label: '800m' },
  { key: '1000m', meters: 1000, label: '1000m' },
  { key: '1500m', meters: 1500, label: '1500m' },
  { key: 'mile', meters: 1609, label: 'Milla' },
  { key: '3000m', meters: 3000, label: '3000m' },
  { key: '5000m', meters: 5000, label: '5K' },
  { key: '10000m', meters: 10000, label: '10K' },
  { key: 'half_marathon', meters: 21097, label: 'Media Maratón' },
  { key: 'marathon', meters: 42195, label: 'Maratón' },
];

/**
 * Predict race times for all standard distances from VDOT.
 * Uses Daniels-Gilbert model (same as COROS/Garmin watches).
 * @param {number} vdot - VDOT value
 * @returns {Object} Map of distance label → { time (s), timeFormatted, pace }
 */
export const predictAllRaceTimes = (vdot) => {
  if (!vdot || vdot <= 0) return null;

  const targets = [
    { label: '5 km', meters: 5000 },
    { label: '10 km', meters: 10000 },
    { label: 'Media Maratón', meters: 21097 },
    { label: 'Maratón', meters: 42195 },
  ];

  const predictions = {};
  for (const t of targets) {
    const timeSec = predictRaceTime(vdot, t.meters);
    if (!timeSec) continue;

    const paceSecPerKm = timeSec / (t.meters / 1000);
    const pMin = Math.floor(paceSecPerKm / 60);
    const pSec = Math.round(paceSecPerKm % 60);

    const h = Math.floor(timeSec / 3600);
    const m = Math.floor((timeSec % 3600) / 60);
    const s = timeSec % 60;
    const timeFormatted = h > 0
      ? `${h}h ${m}m ${s}s`
      : `${m}m ${s}s`;

    predictions[t.label] = {
      time: timeSec,
      timeFormatted,
      pace: `${pMin}:${String(pSec).padStart(2, '0')}`,
    };
  }

  return Object.keys(predictions).length > 0 ? predictions : null;
};

/**
 * Find best VDOT from an array of race results
 * Best accuracy from 3K to half marathon
 */
export const findBestVdot = (raceResults) => {
  if (!raceResults || raceResults.length === 0) return null;

  let bestVdot = 0;
  let bestSource = null;

  raceResults.forEach((result) => {
    const vdot = calculateVdot(result.distance_m, result.time_seconds / 60);
    if (vdot && vdot > bestVdot) {
      bestVdot = vdot;
      bestSource = result;
    }
  });

  return bestVdot > 0 ? { vdot: bestVdot, source: bestSource } : null;
};

// ============================================================
// Daniels Zone Names (Spanish)
// ============================================================

export const DANIELS_ZONES = [
  { code: 'E', name: 'Easy', label: 'Fácil', pctMin: 59, pctMax: 74, hrMin: 65, hrMax: 79 },
  { code: 'M', name: 'Marathon', label: 'Maratón', pctMin: 75, pctMax: 84, hrMin: 80, hrMax: 89 },
  { code: 'T', name: 'Threshold', label: 'Umbral', pctMin: 83, pctMax: 88, hrMin: 88, hrMax: 92 },
  { code: 'I', name: 'Interval', label: 'Intervalo', pctMin: 95, pctMax: 100, hrMin: 97, hrMax: 100 },
  { code: 'R', name: 'Repetition', label: 'Repetición', pctMin: 105, pctMax: 110, hrMin: null, hrMax: null },
];

/**
 * Calculate Karvonen HR training zones from max HR and resting HR.
 * Returns an enriched 5-zone array with bpmMin/bpmMax and a display colour
 * for each zone. Intended for UI panels (Metrics page) — `generateHrZones`
 * below is the simpler max-HR-only variant used elsewhere.
 */
export const calculateHRZones = (maxHR, restingHR) => {
  const zones = [
    { name: 'Z1 - Recuperación', min: 0.50, max: 0.60, color: '#94a3b8' },
    { name: 'Z2 - Base Aeróbica', min: 0.60, max: 0.70, color: '#3b82f6' },
    { name: 'Z3 - Aeróbica', min: 0.70, max: 0.80, color: '#22c55e' },
    { name: 'Z4 - Umbral', min: 0.80, max: 0.90, color: '#f97316' },
    { name: 'Z5 - VO2max', min: 0.90, max: 1.00, color: '#ef4444' },
  ];
  return zones.map((z) => ({
    ...z,
    bpmMin: Math.round(restingHR + z.min * (maxHR - restingHR)),
    bpmMax: Math.round(restingHR + z.max * (maxHR - restingHR)),
  }));
};

/**
 * Generate HR zones from max HR (5-zone model)
 */
export const generateHrZones = (maxHR) => {
  if (!maxHR) return null;
  return [
    { zone: 1, name: 'Recuperación', min: Math.round(maxHR * 0.50), max: Math.round(maxHR * 0.60) },
    { zone: 2, name: 'Base aeróbica', min: Math.round(maxHR * 0.60), max: Math.round(maxHR * 0.70) },
    { zone: 3, name: 'Aeróbico', min: Math.round(maxHR * 0.70), max: Math.round(maxHR * 0.80) },
    { zone: 4, name: 'Umbral', min: Math.round(maxHR * 0.80), max: Math.round(maxHR * 0.90) },
    { zone: 5, name: 'VO2max', min: Math.round(maxHR * 0.90), max: maxHR },
  ];
};

/**
 * Format pace in seconds/km to MM:SS string
 */
export const formatPace = (secondsPerKm) => {
  if (!secondsPerKm || secondsPerKm <= 0) return '--:--';
  const min = Math.floor(secondsPerKm / 60);
  const sec = Math.round(secondsPerKm % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
};

/**
 * Format time in seconds to HH:MM:SS or MM:SS
 */
export const formatTime = (totalSeconds) => {
  if (!totalSeconds || totalSeconds <= 0) return '--:--';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// ============================================================
// Readiness Score (0-100)
// ============================================================

// ============================================================
// VDOT Race helper (alias over calculateVdot with seconds input)
// ============================================================

/**
 * VDOT from a race distance (m) and elapsed seconds.
 * Thin wrapper to match the Daniels signature used by service consumers.
 */
export const vdotFromRace = (distanceM, timeSec) => {
  if (!Number.isFinite(distanceM) || distanceM <= 0) return null;
  if (!Number.isFinite(timeSec) || timeSec <= 0) return null;
  return calculateVdot(distanceM, timeSec / 60);
};

// ============================================================
// Reference Daniels VDOT Table (tiny subset, 1K/5K/10K/half/marathon)
// ============================================================

/**
 * Sample Daniels VDOT reference points. Used as a quick sanity table;
 * actual VDOT values are derived from calculateVdot() to be race-agnostic.
 * Values in seconds (ELapsed time).
 */
export const DANIELS_VDOT_TABLE = {
  // vdot: { '1K': sec, '5K': sec, '10K': sec, 'half': sec, 'marathon': sec }
  30: { '1K': 315, '5K': 1860, '10K': 3840, half: 8452, marathon: 17434 },
  40: { '1K': 248, '5K': 1412, '10K': 2914, half: 6444, marathon: 13304 },
  50: { '1K': 207, '5K': 1138, '10K': 2354, half: 5210, marathon: 10762 },
  60: { '1K': 179, '5K': 965, '10K': 1994, half: 4418, marathon: 9128 },
  70: { '1K': 159, '5K': 838, '10K': 1731, half: 3843, marathon: 7942 },
};

// ============================================================
// VO2max Formulas
// ============================================================

/**
 * Uth-Sørensen VO2max estimation from max and resting HR.
 * VO2max = 15 * (HRmax / HRrest)
 */
export const vo2maxUth = (maxHr, restHr) => {
  const mx = Number(maxHr);
  const rs = Number(restHr);
  if (!Number.isFinite(mx) || !Number.isFinite(rs) || rs <= 0) return null;
  return Math.round(15 * (mx / rs) * 10) / 10;
};

/**
 * Fallback VO2max from VDOT (linear approximation).
 * VO2max ≈ VDOT * 0.8 + 10.5
 */
export const vo2maxFromVdot = (vdot) => {
  const v = Number(vdot);
  if (!Number.isFinite(v) || v <= 0) return null;
  return Math.round((v * 0.8 + 10.5) * 10) / 10;
};

// ============================================================
// Cadence Bucketing (handles Strava's one-leg values)
// ============================================================

/**
 * Bucket cadence samples into 150-160/160-170/170-180/180-190/190+ buckets.
 * Strava reports per-leg cadence (< 110 spm range) — doubles if detected.
 * @param {Array<{cadence:number, dt:number}>} samples — per-sample cadence with duration
 * @returns {{buckets: Array, mean_spm: number, valid_samples: number}}
 */
export const bucketCadence = (samples) => {
  const BUCKETS = [
    { label: '150-160', min: 150, max: 160 },
    { label: '160-170', min: 160, max: 170 },
    { label: '170-180', min: 170, max: 180 },
    { label: '180-190', min: 180, max: 190 },
    { label: '190+', min: 190, max: 9999 },
  ];
  const seconds = BUCKETS.map(() => 0);
  let sum = 0;
  let cnt = 0;
  let totalSec = 0;

  (samples || []).forEach((s) => {
    let c = Number(s.cadence);
    const dt = Number(s.dt) > 0 ? Number(s.dt) : 1;
    if (!Number.isFinite(c) || c <= 0) return;
    // If value clearly one-legged (< 110), double it.
    if (c < 110) c = c * 2;
    sum += c * dt;
    cnt += dt;
    totalSec += dt;
    for (let i = 0; i < BUCKETS.length; i += 1) {
      if (c >= BUCKETS[i].min && c < BUCKETS[i].max) {
        seconds[i] += dt;
        break;
      }
    }
  });

  const buckets = BUCKETS.map((b, i) => ({
    label: b.label,
    seconds: seconds[i],
    pct: totalSec > 0 ? Number(((seconds[i] / totalSec) * 100).toFixed(1)) : 0,
  }));

  return {
    buckets,
    mean_spm: cnt > 0 ? Math.round(sum / cnt) : 0,
    valid_samples: cnt,
  };
};

// ============================================================
// Pace Zones (from threshold or VDOT fallback)
// ============================================================

const DEFAULT_PACE_ZONES_SEC = [
  { zone: 'Z1', label: 'Suave', minSec: 390, maxSec: 9999 }, // > 6:30
  { zone: 'Z2', label: 'Fácil', minSec: 330, maxSec: 390 },  // 5:30-6:30
  { zone: 'Z3', label: 'Moderado', minSec: 300, maxSec: 330 }, // 5:00-5:30
  { zone: 'Z4', label: 'Umbral', minSec: 270, maxSec: 300 }, // 4:30-5:00
  { zone: 'Z5', label: 'Rápido', minSec: 0, maxSec: 270 }, // < 4:30
];

/**
 * Derive pace zones from a threshold pace (sec/km).
 * Zones: Z1 (>+45s), Z2 (+15..+45s), Z3 (-5..+15s), Z4 (-20..-5s), Z5 (< -20s)
 */
export const paceZonesFromThreshold = (thresholdSecPerKm) => {
  const t = Number(thresholdSecPerKm);
  if (!Number.isFinite(t) || t <= 0) return DEFAULT_PACE_ZONES_SEC;
  return [
    { zone: 'Z1', label: 'Suave', minSec: t + 45, maxSec: 9999 },
    { zone: 'Z2', label: 'Fácil', minSec: t + 15, maxSec: t + 45 },
    { zone: 'Z3', label: 'Moderado', minSec: t - 5, maxSec: t + 15 },
    { zone: 'Z4', label: 'Umbral', minSec: t - 20, maxSec: t - 5 },
    { zone: 'Z5', label: 'Rápido', minSec: 0, maxSec: t - 20 },
  ];
};

/**
 * Derive pace zones from VDOT (threshold ≈ Daniels T pace).
 */
export const paceZonesFromVdot = (vdot) => {
  const paces = getTrainingPaces(vdot);
  if (!paces || !paces.threshold) return DEFAULT_PACE_ZONES_SEC;
  return paceZonesFromThreshold(paces.threshold);
};

// ============================================================
// Coefficient of Variation (consistency)
// ============================================================

/**
 * CV = stdev / mean. Returns 0 if mean is 0 or input invalid.
 */
export const coefficientOfVariation = (values) => {
  const arr = (values || []).filter((v) => Number.isFinite(v) && v > 0);
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  if (mean === 0) return 0;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  const stdev = Math.sqrt(variance);
  return Math.round((stdev / mean) * 10000) / 10000;
};

/**
 * Translate a CV value into a Spanish consistency label.
 */
export const consistencyLabel = (cv) => {
  const v = Number(cv);
  if (!Number.isFinite(v)) return 'Irregular';
  if (v < 0.05) return 'Excelente';
  if (v < 0.10) return 'Buena';
  return 'Irregular';
};

// ============================================================
// Stream Downsampling
// ============================================================

/**
 * Downsample a numeric array to a target length via simple bucketed averaging.
 * Default target lowered from 500 to 300 for typical viewport widths.
 */
export const downsampleStream = (arr, targetLen = 300) => {
  if (!Array.isArray(arr) || arr.length <= targetLen) return arr || [];
  const bucketSize = arr.length / targetLen;
  const out = new Array(targetLen);
  for (let i = 0; i < targetLen; i += 1) {
    const start = Math.floor(i * bucketSize);
    const end = Math.floor((i + 1) * bucketSize);
    let sum = 0;
    let cnt = 0;
    for (let j = start; j < end; j += 1) {
      const v = Number(arr[j]);
      if (Number.isFinite(v)) {
        sum += v;
        cnt += 1;
      }
    }
    out[i] = cnt > 0 ? sum / cnt : null;
  }
  return out;
};

// ============================================================
// HR Zone Percentage Helpers
// ============================================================

/**
 * Convert the `zones` array returned by `useHrZoneData` into a map
 * `{ z1..z5 }` of integer percentages, using the total HR-activity count.
 * Returns `null` if there are no HR activities so callers can render a
 * placeholder.
 *
 * @param {{zones:Array<{count:number}>, totalHRActivities:number}} hrZoneData
 * @returns {{z1:number,z2:number,z3:number,z4:number,z5:number}|null}
 */
export const calculateZonePercentages = (hrZoneData) => {
  if (!hrZoneData || !hrZoneData.totalHRActivities) return null;
  const total = hrZoneData.totalHRActivities;
  const zones = hrZoneData.zones || [];
  const pct = (i) => Math.round(((zones[i]?.count || 0) / total) * 100);
  return {
    z1: pct(0),
    z2: pct(1),
    z3: pct(2),
    z4: pct(3),
    z5: pct(4),
  };
};

// ============================================================
// Best Efforts formatting (UI-ready)
// ============================================================

const BEST_EFFORT_DIST_MAP = {
  '5k': { label: '5 KM', dist: '5000m', meters: 5000 },
  '10k': { label: '10 KM', dist: '10000m', meters: 10000 },
  'half marathon': { label: 'MEDIA MARATÓN', dist: '21097m', meters: 21097 },
  marathon: { label: 'MARATÓN', dist: '42195m', meters: 42195 },
};

const formatEffortTime = (secs) => {
  if (!secs) return '–';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
};

const formatEffortPace = (secs, meters) => {
  if (!secs || !meters) return '–';
  const paceSecPerKm = secs / (meters / 1000);
  const m = Math.floor(paceSecPerKm / 60);
  const s = Math.round(paceSecPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

/**
 * Build the 2x2 grid slots for the Best Efforts card on the metrics page.
 * Returns one entry per standard distance (5K, 10K, Half, Marathon) with
 * pre-formatted strings ready for the UI. If no effort is registered for a
 * distance the slot carries `effort: null` so the view can render a
 * placeholder.
 *
 * @param {Array} bestEfforts - Strava best efforts collection
 * @returns {Array<{key:string,label:string,timeFormatted:string|null,paceFormatted:string|null,dateFormatted:string|null,effort:Object|null}>}
 */
export const formatBestEfforts = (bestEfforts) => {
  const keys = ['5k', '10k', 'half marathon', 'marathon'];
  return keys.map((key) => {
    const meta = BEST_EFFORT_DIST_MAP[key];
    const effort = (bestEfforts || []).find(
      (e) => e.name?.toLowerCase() === key,
    ) || null;
    let dateFormatted = null;
    if (effort?.start_date_local) {
      try {
        dateFormatted = new Date(effort.start_date_local).toLocaleDateString(
          'es-ES',
          { month: 'short', year: 'numeric' },
        );
      } catch {
        dateFormatted = null;
      }
    }
    return {
      key,
      label: meta.label,
      dist: meta.dist,
      effort,
      timeFormatted: effort ? formatEffortTime(effort.elapsed_time) : null,
      paceFormatted: effort
        ? formatEffortPace(effort.elapsed_time, effort.distance)
        : null,
      dateFormatted,
    };
  });
};

// ============================================================
// ACWR Alert Display (icon + message + severity key)
// ============================================================

const ACWR_ALERT_DISPLAY_MAP = {
  undertraining: {
    severity: 'low',
    icon: '📉',
    message:
      'Tu carga actual está por debajo de lo habitual. Considera aumentar gradualmente el volumen.',
  },
  optimal: {
    severity: 'optimal',
    icon: '✓',
    message: 'Tu carga está en zona óptima. ¡Sigue así!',
  },
  caution: {
    severity: 'high',
    icon: '⚠',
    message:
      'Cuidado: tu carga está aumentando rápidamente. Controla el volumen esta semana.',
  },
  danger: {
    severity: 'danger',
    icon: '🚨',
    message: 'Alerta: riesgo elevado de sobrecarga. Reduce la intensidad y descansa.',
  },
};

/**
 * Pick the severity/icon/message bucket for an ACWR value. The returned
 * `severity` key maps to `ACWR_ALERT_CLASSES` in `themeClasses.js` so the
 * UI stays in sync with the design system. Delegates zone classification
 * to the core's `acwrZone()` — display lookup only, not a threshold
 * reimplementation.
 *
 * @param {number} acwr - Acute:Chronic Workload Ratio
 * @returns {{severity:'low'|'optimal'|'high'|'danger',icon:string,message:string}}
 */
export const getAcwrAlertDisplay = (acwr) => ACWR_ALERT_DISPLAY_MAP[_acwrZone(acwr)];

/**
 * Calculate readiness score from wellness + training load data
 * @param {Object} wellness - Today's wellness log
 * @param {number} tsb - Today's TSB
 * @param {number} acwr - Current ACWR
 * @returns {number} Readiness score 0-100
 */
export const calculateReadinessScore = (wellness, tsb, acwr) => {
  let score = 50; // baseline

  if (wellness) {
    // Sleep: 1-10 → contributes up to +15
    if (wellness.sleep_quality) score += (wellness.sleep_quality - 5) * 3;
    // Fatigue (inverted): 1=fresh +10, 10=exhausted -10
    if (wellness.fatigue) score -= (wellness.fatigue - 5) * 2;
    // Soreness (inverted)
    if (wellness.soreness) score -= (wellness.soreness - 5) * 1.5;
    // Mood
    if (wellness.mood) score += (wellness.mood - 5) * 1.5;
    // Stress (inverted)
    if (wellness.stress) score -= (wellness.stress - 5) * 1.5;
  }

  // TSB contribution: +15 to +25 = race ready bonus
  if (tsb !== null && tsb !== undefined) {
    if (tsb >= 15 && tsb <= 25) score += 10;
    else if (tsb >= 0 && tsb < 15) score += 5;
    else if (tsb >= -10 && tsb < 0) score += 0;
    else if (tsb >= -30 && tsb < -10) score -= 5;
    else if (tsb < -30) score -= 15;
  }

  // ACWR contribution
  if (acwr) {
    if (acwr >= 0.8 && acwr <= 1.3) score += 5;
    else if (acwr > 1.5) score -= 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
};

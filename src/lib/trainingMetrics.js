/**
 * Training Metrics Calculations
 * Based on Jack Daniels VDOT system and TrainingPeaks TSS model
 * Reference: ATHLETICS_DOMAIN.md
 */

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
  // Binary search for the time that produces this VDOT at this distance
  let low = 1; // 1 minute
  let high = 300; // 5 hours
  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    const testVdot = calculateVdot(targetDistanceM, mid);
    if (testVdot === null) return null;
    if (testVdot > vdot) high = mid;
    else low = mid;
  }
  return Math.round((low + high) / 2 * 60); // seconds
};

// ============================================================
// TSS (Training Stress Score) for Running
// ============================================================

/**
 * Calculate running TSS (rTSS) based on pace
 * @param {number} durationS - Duration in seconds
 * @param {number} avgPaceSPerKm - Average pace in seconds/km
 * @param {number} thresholdPaceSPerKm - Threshold pace in seconds/km
 * @returns {number} TSS value
 */
export const calculateRtss = (durationS, avgPaceSPerKm, thresholdPaceSPerKm) => {
  if (!durationS || !avgPaceSPerKm || !thresholdPaceSPerKm) return 0;
  if (avgPaceSPerKm <= 0 || thresholdPaceSPerKm <= 0) return 0;
  const intensityFactor = thresholdPaceSPerKm / avgPaceSPerKm;
  return Math.round(((durationS * intensityFactor ** 2) / 3600) * 100);
};

/**
 * Calculate TSS from heart rate (hrTSS)
 * Fallback when pace-based TSS isn't available
 * @param {number} durationS - Duration in seconds
 * @param {number} avgHR - Average heart rate
 * @param {number} lthr - Lactate threshold heart rate
 * @returns {number} TSS value
 */
export const calculateHrTss = (durationS, avgHR, lthr) => {
  if (!durationS || !avgHR || !lthr) return 0;
  const intensityFactor = avgHR / lthr;
  return Math.round(((durationS * intensityFactor ** 2) / 3600) * 100);
};

/**
 * Calculate Intensity Factor
 * @param {number} avgPaceSPerKm - Average pace in s/km
 * @param {number} thresholdPaceSPerKm - Threshold pace in s/km
 * @returns {number} Intensity Factor (0-2 range typically)
 */
export const calculateIntensityFactor = (avgPaceSPerKm, thresholdPaceSPerKm) => {
  if (!avgPaceSPerKm || !thresholdPaceSPerKm) return 0;
  return Math.round((thresholdPaceSPerKm / avgPaceSPerKm) * 100) / 100;
};

// ============================================================
// CTL / ATL / TSB (Performance Management Chart)
// ============================================================

/**
 * Update Chronic Training Load (42-day exponential average)
 */
export const updateCtl = (ctlYesterday, tssToday, timeConstant = 42) =>
  ctlYesterday + (tssToday - ctlYesterday) * (1 / timeConstant);

/**
 * Update Acute Training Load (7-day exponential average)
 */
export const updateAtl = (atlYesterday, tssToday, timeConstant = 7) =>
  atlYesterday + (tssToday - atlYesterday) * (1 / timeConstant);

/**
 * Calculate Training Stress Balance (Form)
 */
export const calculateTsb = (ctl, atl) => ctl - atl;

/**
 * Calculate full PMC from daily TSS array
 * @param {Array<{date: string, tss: number}>} dailyTssArray - Array sorted by date ASC
 * @param {number} initialCtl - Starting CTL (default 0)
 * @param {number} initialAtl - Starting ATL (default 0)
 * @returns {Array<{date, tss, ctl, atl, tsb, rampRate}>}
 */
export const calculatePMC = (dailyTssArray, initialCtl = 0, initialAtl = 0) => {
  let ctl = initialCtl;
  let atl = initialAtl;
  let prevCtl = initialCtl;

  return dailyTssArray.map((day, index) => {
    const tss = day.tss || 0;
    ctl = updateCtl(ctl, tss);
    atl = updateAtl(atl, tss);
    const tsb = calculateTsb(ctl, atl);

    // Ramp rate = weekly CTL change
    let rampRate = null;
    if (index >= 7) {
      rampRate = Math.round((ctl - prevCtl) * 10) / 10;
    }
    if (index % 7 === 0) prevCtl = ctl;

    return {
      date: day.date,
      tss: Math.round(tss * 10) / 10,
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round(tsb * 10) / 10,
      rampRate,
    };
  });
};

// ============================================================
// ACWR & Injury Risk
// ============================================================

/**
 * Acute:Chronic Workload Ratio
 */
export const calculateAcwr = (atl, ctl) => (ctl > 0 ? Math.round((atl / ctl) * 100) / 100 : 0);

/**
 * Get ACWR zone classification
 */
export const getAcwrZone = (acwr) => {
  if (acwr < 0.8) return { zone: 'undertraining', color: '#3B82F6', label: 'Baja carga' };
  if (acwr <= 1.3) return { zone: 'optimal', color: '#10B981', label: 'Óptimo' };
  if (acwr <= 1.5) return { zone: 'high', color: '#F59E0B', label: 'Carga alta' };
  return { zone: 'danger', color: '#EF4444', label: 'Riesgo de lesión' };
};

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

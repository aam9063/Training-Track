/**
 * Training Load Service
 * Handles CRUD for daily_training_load, activity_splits, wellness_log, training_zones
 */
import { supabase } from '../lib/supabase';
import { toLocalDateStr } from '../lib/dateUtils';
import {
  calculateRtss,
  calculateHrTss,
  calculateIntensityFactor,
  updateCtl,
  updateAtl,
  calculateTsb,
  calculateVdot,
  getTrainingPaces,
  calculateReadinessScore,
  calculateAcwr,
} from '../lib/trainingMetrics';

// ============================================================
// DAILY TRAINING LOAD
// ============================================================

/**
 * Get daily training load for an athlete within a date range
 */
export const getDailyTrainingLoad = async (athleteId, startDate, endDate) => {
  const { data, error } = await supabase
    .from('daily_training_load')
    .select('*')
    .eq('athlete_id', athleteId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) throw error;
  return data || [];
};

/**
 * Calculate and save TSS/CTL/ATL/TSB from Strava activities
 * @param {string} athleteId - Athlete UUID
 * @param {Array} activities - Strava activities array
 * @param {Object} athleteProfile - Athlete profile with lactate_threshold_pace, lactate_threshold_hr
 */
export const recalculateTrainingLoad = async (athleteId, activities, athleteProfile) => {
  if (!activities || activities.length === 0) return [];

  const thresholdPace = athleteProfile?.lactate_threshold_pace; // s/km
  const thresholdHR = athleteProfile?.lactate_threshold_hr;

  // Group activities by date and calculate daily TSS
  const dailyMap = {};

  activities
    .filter(a => a.type === 'Run' || a.type === 'TrailRun' || a.type === 'VirtualRun')
    .forEach((activity) => {
      const date = activity.start_date_local?.split('T')[0];
      if (!date) return;

      if (!dailyMap[date]) {
        dailyMap[date] = { tss: 0, totalDistanceM: 0, totalDurationS: 0, count: 0 };
      }

      // Calculate TSS for this activity
      let tss = 0;
      const durationS = activity.moving_time || activity.elapsed_time || 0;
      const distanceM = activity.distance || 0;

      if (distanceM > 0 && durationS > 0) {
        const avgPaceSPerKm = (durationS / distanceM) * 1000;

        if (thresholdPace && thresholdPace > 0) {
          tss = calculateRtss(durationS, avgPaceSPerKm, thresholdPace);
        } else if (thresholdHR && activity.average_heartrate) {
          tss = calculateHrTss(durationS, activity.average_heartrate, thresholdHR);
        } else {
          // Fallback: estimate from duration (1 hour easy = ~60 TSS)
          tss = Math.round((durationS / 3600) * 60);
        }
      }

      dailyMap[date].tss += tss;
      dailyMap[date].totalDistanceM += distanceM;
      dailyMap[date].totalDurationS += durationS;
      dailyMap[date].count += 1;
    });

  // Sort dates and fill gaps
  const dates = Object.keys(dailyMap).sort();
  if (dates.length === 0) return [];

  const startDate = new Date(dates[0]);
  const endDate = new Date(dates[dates.length - 1]);
  const allDays = [];

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = toLocalDateStr(d);
    allDays.push({
      date: dateStr,
      tss: dailyMap[dateStr]?.tss || 0,
      totalDistanceM: dailyMap[dateStr]?.totalDistanceM || 0,
      totalDurationS: dailyMap[dateStr]?.totalDurationS || 0,
      count: dailyMap[dateStr]?.count || 0,
    });
  }

  // Get existing load to use as seed for CTL/ATL
  let prevCtl = 0;
  let prevAtl = 0;

  const { data: existingLoad } = await supabase
    .from('daily_training_load')
    .select('ctl, atl')
    .eq('athlete_id', athleteId)
    .lt('date', allDays[0].date)
    .order('date', { ascending: false })
    .limit(1);

  if (existingLoad && existingLoad.length > 0) {
    prevCtl = existingLoad[0].ctl || 0;
    prevAtl = existingLoad[0].atl || 0;
  }

  // Calculate CTL/ATL/TSB for each day
  const records = allDays.map((day) => {
    const ctl = updateCtl(prevCtl, day.tss);
    const atl = updateAtl(prevAtl, day.tss);
    const tsb = calculateTsb(ctl, atl);

    const record = {
      athlete_id: athleteId,
      date: day.date,
      tss: Math.round(day.tss * 10) / 10,
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round(tsb * 10) / 10,
      intensity_factor: day.tss > 0 && thresholdPace ? calculateIntensityFactor(
        (day.totalDurationS / day.totalDistanceM) * 1000,
        thresholdPace
      ) : null,
      total_distance_m: Math.round(day.totalDistanceM),
      total_duration_s: Math.round(day.totalDurationS),
      activity_count: day.count,
      source: 'strava',
      updated_at: new Date().toISOString(),
    };

    prevCtl = ctl;
    prevAtl = atl;

    return record;
  });

  // Upsert in batches
  const batchSize = 50;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase
      .from('daily_training_load')
      .upsert(batch, { onConflict: 'athlete_id,date' });
    if (error) throw error;
  }

  return records;
};

/**
 * Get current PMC status (latest CTL, ATL, TSB, chronic_load_28)
 */
export const getCurrentPMCStatus = async (athleteId) => {
  const { data, error } = await supabase
    .from('daily_training_load')
    .select('date, ctl, atl, tsb, tss, ramp_rate, chronic_load_28')
    .eq('athlete_id', athleteId)
    .order('date', { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
};

// ============================================================
// ACTIVITY SPLITS
// ============================================================

/**
 * Save activity splits from Strava detail
 */
export const saveActivitySplits = async (athleteId, stravaActivityId, splits) => {
  if (!splits || splits.length === 0) return;

  const records = splits.map((split, index) => ({
    athlete_id: athleteId,
    strava_activity_id: String(stravaActivityId),
    split_number: index + 1,
    split_type: 'distance',
    distance_m: split.distance || null,
    elapsed_time_s: split.elapsed_time || null,
    moving_time_s: split.moving_time || null,
    pace_seconds_per_km: split.average_speed > 0
      ? Math.round(1000 / split.average_speed)
      : null,
    average_speed: split.average_speed || null,
    average_heartrate: split.average_heartrate || null,
    max_heartrate: split.max_heartrate || null,
    elevation_difference: split.elevation_difference || null,
    average_cadence: split.average_cadence || null,
  }));

  const { error } = await supabase
    .from('activity_splits')
    .upsert(records, { onConflict: 'strava_activity_id,split_number,split_type' });

  if (error) throw error;
};

/**
 * Get splits for an activity
 */
export const getActivitySplits = async (stravaActivityId) => {
  const { data, error } = await supabase
    .from('activity_splits')
    .select('*')
    .eq('strava_activity_id', String(stravaActivityId))
    .order('split_number', { ascending: true });

  if (error) throw error;
  return data || [];
};

// ============================================================
// WELLNESS LOG
// ============================================================

/**
 * Save or update today's wellness entry
 */
export const saveWellnessEntry = async (athleteId, date, entry) => {
  const record = {
    athlete_id: athleteId,
    date,
    ...entry,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('wellness_log')
    .upsert(record, { onConflict: 'athlete_id,date' })
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Get wellness entries for a date range
 */
export const getWellnessLog = async (athleteId, startDate, endDate) => {
  const { data, error } = await supabase
    .from('wellness_log')
    .select('*')
    .eq('athlete_id', athleteId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * Get today's wellness entry
 */
export const getTodayWellness = async (athleteId) => {
  const today = toLocalDateStr(new Date());
  const { data, error } = await supabase
    .from('wellness_log')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('date', today)
    .maybeSingle();

  if (error) throw error;
  return data;
};

// ============================================================
// TRAINING ZONES
// ============================================================

/**
 * Save training zones for an athlete
 */
export const saveTrainingZones = async (athleteId, zoneType, zones) => {
  const today = toLocalDateStr(new Date());

  // Expire older zones of this type (rows from previous days)
  await supabase
    .from('training_zones')
    .update({ valid_until: today })
    .eq('athlete_id', athleteId)
    .eq('zone_type', zoneType)
    .is('valid_until', null)
    .neq('valid_from', today);

  // Upsert today's zones — handles re-runs on the same day without 409
  const records = zones.map((z) => ({
    athlete_id: athleteId,
    zone_type: zoneType,
    zone_number: z.zone,
    zone_name: z.name,
    min_value: z.min,
    max_value: z.max,
    unit: z.unit || (zoneType === 'hr' ? 'bpm' : 's/km'),
    description: z.description || null,
    valid_from: today,
    valid_until: null,
  }));

  const { error } = await supabase
    .from('training_zones')
    .upsert(records, { onConflict: 'athlete_id,zone_type,zone_number,valid_from' });

  if (error) throw error;
};

/**
 * Get current training zones for an athlete
 */
export const getTrainingZones = async (athleteId, zoneType = null) => {
  let query = supabase
    .from('training_zones')
    .select('*')
    .eq('athlete_id', athleteId)
    .is('valid_until', null)
    .order('zone_number', { ascending: true });

  if (zoneType) {
    query = query.eq('zone_type', zoneType);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

// ============================================================
// VDOT AUTO-CALCULATION
// ============================================================

/**
 * Update athlete's VDOT from their best efforts/PBs
 * @param {string} athleteId
 * @param {Array} bestEfforts - Array of {distance, elapsed_time, name} from Strava
 */
export const updateAthleteVdot = async (athleteId, bestEfforts) => {
  if (!bestEfforts || bestEfforts.length === 0) return null;

  // Map Strava best effort names to distances in meters
  const distanceMap = {
    '400m': 400, '1/2 mile': 805, '1k': 1000, '1 mile': 1609,
    '2 mile': 3219, '5k': 5000, '10k': 10000,
    '15k': 15000, '10 mile': 16093, '20k': 20000,
    'Half-Marathon': 21097, 'Marathon': 42195,
  };

  let bestVdot = 0;
  let bestSource = null;

  bestEfforts.forEach((effort) => {
    const distanceM = distanceMap[effort.name] || effort.distance;
    const time = effort.moving_time || effort.elapsed_time;
    if (!distanceM || !time) return;
    const timeMin = time / 60;
    const vdot = calculateVdot(distanceM, timeMin);
    if (vdot && vdot > bestVdot) {
      bestVdot = vdot;
      bestSource = { distance: effort.name, time };
    }
  });

  if (bestVdot > 0) {
    // Update athlete's VDOT
    await supabase
      .from('athletes')
      .update({ vdot: bestVdot })
      .eq('id', athleteId);

    // Auto-generate training paces from VDOT
    const paces = getTrainingPaces(bestVdot);
    if (paces) {
      await autoGenerateTrainingZones(athleteId, bestVdot, paces);
    }

    return { vdot: bestVdot, source: bestSource, paces };
  }

  return null;
};

/**
 * Auto-generate pace-based training zones from VDOT
 */
const autoGenerateTrainingZones = async (athleteId, vdot, paces) => {
  const zones = [
    { zone: 1, name: 'Easy (E)', min: paces.easy.max, max: paces.easy.min, unit: 's/km', description: 'Ritmo fácil, conversacional' },
    { zone: 2, name: 'Tempo (M)', min: paces.marathon, max: paces.marathon, unit: 's/km', description: 'Ritmo maratón / Tempo' },
    { zone: 3, name: 'Threshold (T)', min: paces.threshold, max: paces.threshold, unit: 's/km', description: 'Umbral de lactato' },
    { zone: 4, name: 'Interval (I)', min: paces.interval, max: paces.interval, unit: 's/km', description: 'Desarrollo VO2max' },
    { zone: 5, name: 'Repetition (R)', min: paces.repetition, max: paces.repetition, unit: 's/km', description: 'Velocidad y economía' },
  ];

  await saveTrainingZones(athleteId, 'pace_daniels', zones);
};

// ============================================================
// AUTO-SYNC PERSONAL BESTS
// ============================================================

/**
 * Sync Strava best efforts to personal_bests table.
 * Uses 2 queries total regardless of how many efforts are passed:
 * 1. Fetch all existing PBs for this athlete (one SELECT)
 * 2. Upsert only the efforts that improve on existing records (one batch UPSERT)
 */
export const syncPersonalBests = async (athleteId, bestEfforts) => {
  if (!bestEfforts || bestEfforts.length === 0) return;

  // 1. Fetch all existing auto-detected PBs in one query
  const { data: existingPBs } = await supabase
    .from('personal_bests')
    .select('distance, time_seconds')
    .eq('athlete_id', athleteId)
    .eq('official', false);

  // Build a map of distance → best existing time
  const existingMap = {};
  for (const pb of existingPBs || []) {
    if (!existingMap[pb.distance] || pb.time_seconds < existingMap[pb.distance]) {
      existingMap[pb.distance] = pb.time_seconds;
    }
  }

  // Find the best time per distance across all efforts (deduplicate in memory)
  const bestPerDistance = {};
  for (const effort of bestEfforts) {
    if (!effort.elapsed_time || !effort.name) continue;
    const existing = bestPerDistance[effort.name];
    if (!existing || effort.elapsed_time < existing.elapsed_time) {
      bestPerDistance[effort.name] = effort;
    }
  }

  // 2. Build upsert batch — only efforts that beat the current DB record
  const toUpsert = [];
  for (const [distance, effort] of Object.entries(bestPerDistance)) {
    const currentBest = existingMap[distance];
    if (!currentBest || effort.elapsed_time < currentBest) {
      toUpsert.push({
        athlete_id: athleteId,
        distance,
        time_seconds: effort.elapsed_time,
        date: effort.start_date_local?.split('T')[0] || null,
        official: false,
        notes: 'Auto-detectado desde Strava',
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (toUpsert.length === 0) return;

  await supabase
    .from('personal_bests')
    .upsert(toUpsert, { onConflict: 'athlete_id,distance,date', ignoreDuplicates: true });
};

// ============================================================
// READINESS SCORE
// ============================================================

/**
 * Get today's readiness score combining wellness + training load
 */
export const getReadinessScore = async (athleteId) => {
  const today = toLocalDateStr(new Date());

  const [wellness, pmcStatus] = await Promise.all([
    getTodayWellness(athleteId),
    getCurrentPMCStatus(athleteId),
  ]);

  const tsb = pmcStatus?.tsb ?? null;
  // ACWR denominator: chronic_load_28 (D1's canonical 28-day chronic window)
  // once the row has been recomputed by the agent (Phase 3) or a backfill;
  // falls back to the legacy `ctl` (42-day) denominator for rows that
  // haven't been recomputed yet, so this stays non-null during the
  // transition instead of dropping to 0 the moment chronic_load_28 is
  // still unpopulated (migration 1.9 adds it as nullable).
  const acwrDenominator = pmcStatus?.chronic_load_28 ?? pmcStatus?.ctl ?? null;
  const acwr = pmcStatus ? calculateAcwr(pmcStatus.atl, acwrDenominator) : null;

  const score = calculateReadinessScore(wellness, tsb, acwr);

  // Update wellness_log with readiness score if wellness exists
  if (wellness) {
    await supabase
      .from('wellness_log')
      .update({ readiness_score: score })
      .eq('id', wellness.id);
  }

  return {
    score,
    wellness,
    tsb,
    ctl: pmcStatus?.ctl ?? null,
    atl: pmcStatus?.atl ?? null,
    acwr,
    date: today,
  };
};

// ============================================================
// MESOCYCLES & MICROCYCLES
// ============================================================

/**
 * Create a mesocycle within a training plan
 */
export const createMesocycle = async (planId, mesocycle) => {
  const { data, error } = await supabase
    .from('mesocycles')
    .insert({ plan_id: planId, ...mesocycle })
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Get mesocycles for a training plan
 */
export const getMesocycles = async (planId) => {
  const { data, error } = await supabase
    .from('mesocycles')
    .select('*, microcycles(*)')
    .eq('plan_id', planId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
};

/**
 * Create a microcycle within a mesocycle
 */
export const createMicrocycle = async (mesocycleId, microcycle) => {
  const { data, error } = await supabase
    .from('microcycles')
    .insert({ mesocycle_id: mesocycleId, ...microcycle })
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Update a microcycle
 */
export const updateMicrocycle = async (microcycleId, updates) => {
  const { data, error } = await supabase
    .from('microcycles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', microcycleId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Delete a mesocycle and its microcycles
 */
export const deleteMesocycle = async (mesocycleId) => {
  const { error } = await supabase
    .from('mesocycles')
    .delete()
    .eq('id', mesocycleId);

  if (error) throw error;
};

/**
 * Get or create the active training plan for an athlete (for periodization)
 * If no active plan exists, creates one automatically.
 */
export const getOrCreateActivePlan = async (athleteId, coachId) => {
  // Try to find existing active plan
  const { data: existing, error: fetchError } = await supabase
    .from('training_plans')
    .select('id')
    .eq('athlete_id', athleteId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!fetchError && existing) return existing.id;

  // Create a default plan
  const { data: newPlan, error: createError } = await supabase
    .from('training_plans')
    .insert({
      coach_id: coachId,
      athlete_id: athleteId,
      name: 'Plan de Entrenamiento',
      is_active: true,
    })
    .select('id')
    .single();

  if (createError) throw createError;
  return newPlan.id;
};

/**
 * Get mesocycles for an athlete (via active training plan)
 */
export const getMesocyclesByAthlete = async (athleteId) => {
  const { data, error } = await supabase
    .from('mesocycles')
    .select('*, microcycles(*), training_plans!inner(athlete_id)')
    .eq('training_plans.athlete_id', athleteId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
};

/**
 * Update a mesocycle
 */
export const updateMesocycle = async (mesocycleId, updates) => {
  const { data, error } = await supabase
    .from('mesocycles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', mesocycleId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

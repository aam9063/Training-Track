import { supabase } from '../lib/supabase';
import { getStravaActivities, getStravaActivityDetail } from './stravaService';
import { calculateVdot, predictAllRaceTimes } from '../lib/trainingMetrics';
import {
  upsertActivities,
  getLatestCachedActivityDate,
  updateActivityDetails,
  updateLastSync,
  getCachedActivityCount,
  getActivitiesWithoutDetails,
} from './stravaCacheService';
import { syncPersonalBests, updateAthleteVdot } from './trainingLoadService';
import { isUuid } from '../lib/stravaIdUtils';

/**
 * Incremental sync: fetch only activities newer than the latest cached one.
 * Lightweight — runs on every hook load.
 */
export const incrementalSync = async (athleteId, onProgress) => {
  const latestDate = await getLatestCachedActivityDate(athleteId);

  const afterEpoch = latestDate
    ? Math.floor(new Date(latestDate).getTime() / 1000) + 1
    : Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60; // Fallback: 1 year

  let page = 1;
  let totalNew = 0;

  while (true) {
    const { data: activities, error } = await getStravaActivities({
      after: afterEpoch,
      page,
      per_page: 200,
    });

    if (error || !activities || activities.length === 0) break;

    await upsertActivities(athleteId, activities);
    totalNew += activities.length;
    onProgress?.(`Sincronizadas ${totalNew} actividades nuevas...`);

    if (activities.length < 200) break;
    page++;
  }

  if (totalNew > 0) {
    await updateLastSync(athleteId);
  }

  const totalCached = await getCachedActivityCount(athleteId);
  return { newCount: totalNew, totalCached };
};

/**
 * Full historical sync: fetch ALL activities from Strava, page by page.
 * Called manually via "Sincronizar Todo" button.
 */
export const fullHistoricalSync = async (athleteId, onProgress, signal) => {
  let page = 1;
  let totalSynced = 0;

  while (true) {
    if (signal?.aborted) throw new Error('Sincronización cancelada');

    const { data: activities, error } = await getStravaActivities({
      page,
      per_page: 200,
    });

    if (error || !activities || activities.length === 0) break;

    await upsertActivities(athleteId, activities);
    totalSynced += activities.length;
    onProgress?.({ page, fetched: activities.length, total: totalSynced });

    if (activities.length < 200) break;
    page++;

    // Rate limit safety: Strava allows 200 req/15min
    if (page % 180 === 0) {
      onProgress?.({ page, fetched: 0, total: totalSynced, waiting: true });
      await new Promise((r) => setTimeout(r, 15 * 60 * 1000));
    }
  }

  await updateLastSync(athleteId);
  return { totalSynced };
};

/**
 * Fetch detailed data (best_efforts) for running activities that don't have it yet.
 * After fetching, syncs PBs, VDOT, and race predictions.
 */
export const syncActivityDetails = async (athleteId, batchSize = 20, onProgress) => {
  const activities = await getActivitiesWithoutDetails(athleteId, batchSize);

  if (!activities.length) return { fetched: 0, effortsFound: 0 };

  let fetched = 0;
  const allEfforts = [];

  for (const act of activities) {
    const { data: detail, error } = await getStravaActivityDetail(act.strava_id);
    if (error || !detail) continue;

    await updateActivityDetails(athleteId, act.strava_id, {
      best_efforts: detail.best_efforts || [],
      splits_metric: detail.splits_metric || null,
      laps: detail.laps || null,
      weighted_average_watts: detail.weighted_average_watts ?? null,
      workout_type: detail.workout_type ?? null,
      gear_id: detail.gear_id ?? null,
      device_name: detail.device_name ?? null,
    });

    if (detail.best_efforts?.length) {
      allEfforts.push(...detail.best_efforts);
    }

    fetched++;
    onProgress?.({ fetched, total: activities.length });
  }

  // Sync PBs, VDOT, and race predictions from collected best efforts
  if (allEfforts.length > 0) {
    await Promise.all([
      syncPersonalBests(athleteId, allEfforts),
      updateAthleteVdot(athleteId, allEfforts),
    ]);

    await persistRacePredictions(athleteId, allEfforts);
  }

  return { fetched, effortsFound: allEfforts.length };
};

/**
 * Persist race predictions to the race_predictions table.
 * Uses Daniels-Gilbert VDOT model (same as COROS/Garmin watches).
 */
const persistRacePredictions = async (athleteId, bestEfforts) => {
  // Map Strava effort names to meters
  const distanceMap = {
    '1k': 1000, '1 mile': 1609,
    '5k': 5000, '10k': 10000,
    '15k': 15000, '10 mile': 16093,
    '20k': 20000,
    'Half-Marathon': 21097, 'Marathon': 42195,
  };

  // Find the best VDOT from all efforts
  let bestVdot = 0;
  let bestRef = null;

  for (const effort of bestEfforts) {
    const meters = distanceMap[effort.name];
    const time = effort.moving_time || effort.elapsed_time;
    if (!meters || !time) continue;
    const vdot = calculateVdot(meters, time / 60);
    if (vdot && vdot > bestVdot) {
      bestVdot = vdot;
      bestRef = { ...effort, _time: time };
    }
  }

  if (!bestVdot || !bestRef) return;

  const predictions = predictAllRaceTimes(bestVdot);
  if (!predictions) return;

  const predictionRow = {
    athlete_id: athleteId,
    based_on_distance: bestRef.name,
    based_on_time_seconds: bestRef._time,
    vdot: Math.round(bestVdot * 10) / 10,
    predicted_5k: predictions['5 km']?.time || null,
    predicted_10k: predictions['10 km']?.time || null,
    predicted_half_marathon: predictions['Media Maratón']?.time || null,
    predicted_marathon: predictions['Maratón']?.time || null,
    calculated_at: new Date().toISOString(),
  };

  // Delete old predictions for this athlete and insert new
  await supabase
    .from('race_predictions')
    .delete()
    .eq('athlete_id', athleteId);

  const { error } = await supabase
    .from('race_predictions')
    .insert(predictionRow);

  if (error) {
    console.error('Error persisting race predictions:', error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Deep-ingestion helpers (strava-deep-ingestion change)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * On-demand backfill of detailed fields (splits_metric, laps, best_efforts,
 * weighted_average_watts, etc.) for a single activity identified by its
 * internal `strava_activities.id` UUID.
 *
 * Flow:
 *  1. Look up the row to resolve `strava_id` + `athlete_id`.
 *  2. Fetch the detailed activity from Strava.
 *  3. Persist via updateActivityDetails (splits/laps/best_efforts).
 *
 * Returns { data: { hasSplits, hasLaps, hasBestEfforts }, error }.
 * Used by SplitsComparisonChart / LapsAnalysisChart when the local row has
 * no detailed data. Respects Strava rate limits because each call is one
 * detail request.
 */
export const fetchActivityDetailById = async (activityDbId) => {
  if (!activityDbId) {
    return { data: null, error: { code: 'invalid_input', message: 'activityDbId requerido' } };
  }

  // 1. Resolve the row (RLS ensures only the owner athlete can read it).
  // Accept either the internal UUID or the Strava bigint — historically some
  // callers passed `activity.id` (the bigint) which caused PostgREST 400s.
  const baseQuery = supabase
    .from('strava_activities')
    .select('id, strava_id, athlete_id');
  const resolverQuery = isUuid(activityDbId)
    ? baseQuery.eq('id', activityDbId)
    : baseQuery.eq('strava_id', activityDbId);
  const { data: row, error: rowErr } = await resolverQuery.maybeSingle();

  if (rowErr) {
    return { data: null, error: { code: 'db_error', message: rowErr.message } };
  }
  if (!row) {
    return { data: null, error: { code: 'not_found', message: 'Actividad no encontrada' } };
  }
  if (!row.strava_id) {
    return { data: null, error: { code: 'no_strava_id', message: 'Actividad sin strava_id' } };
  }

  // 2. Fetch detail from Strava (scope: activity:read_all covers this)
  const { data: detail, error: detailErr } = await getStravaActivityDetail(row.strava_id);
  if (detailErr || !detail) {
    return {
      data: null,
      error: {
        code: 'strava_error',
        message: detailErr?.message || 'No se pudo obtener el detalle desde Strava',
      },
    };
  }

  // 3. Persist the extended columns
  await updateActivityDetails(row.athlete_id, row.strava_id, {
    best_efforts: detail.best_efforts || [],
    splits_metric: detail.splits_metric || null,
    laps: detail.laps || null,
    weighted_average_watts: detail.weighted_average_watts ?? null,
    workout_type: detail.workout_type ?? null,
    gear_id: detail.gear_id ?? null,
    device_name: detail.device_name ?? null,
  });

  return {
    data: {
      hasSplits: Array.isArray(detail.splits_metric) && detail.splits_metric.length > 0,
      hasLaps: Array.isArray(detail.laps) && detail.laps.length > 0,
      hasBestEfforts: Array.isArray(detail.best_efforts) && detail.best_efforts.length > 0,
    },
    error: null,
  };
};

/**
 * On-demand streams fetch for a single activity.
 * - First checks local cache (strava_activity_streams) via PostgREST.
 * - If missing, invokes the strava-fetch-streams edge function.
 * Returns { data, error } where data carries `{ cached, samples?, reason? }`.
 */
export const fetchStreamsForActivity = async (activityId) => {
  if (!activityId) {
    return { data: null, error: { code: 'invalid_input', message: 'activityId requerido' } };
  }

  // 1. Quick cache read via RLS-protected PostgREST
  const { data: cached, error: cacheErr } = await supabase
    .from('strava_activity_streams')
    .select('activity_id')
    .eq('activity_id', activityId)
    .maybeSingle();

  if (!cacheErr && cached) {
    return { data: { cached: true }, error: null };
  }

  // 2. Resolve athlete_id of the caller
  const { data: sessionData } = await supabase.auth.getSession();
  const athleteId = sessionData?.session?.user?.id;
  if (!athleteId) {
    return { data: null, error: { code: 'unauthenticated', message: 'Debes iniciar sesión' } };
  }

  // 3. Invoke edge function
  const { data, error } = await supabase.functions.invoke('strava-fetch-streams', {
    body: { activity_id: activityId, athlete_id: athleteId },
  });

  if (error) {
    return {
      data: null,
      error: { code: 'network', message: error.message || 'Error al obtener streams' },
    };
  }

  if (data?.ok === false) {
    return {
      data: null,
      error: { code: data.reason || data.code || 'unknown', message: data.message || '' },
    };
  }

  return { data, error: null };
};

/**
 * Trigger HR zones sync from Strava for an athlete.
 * Phase 1 stub: real implementation ships with a dedicated edge function.
 */
export const syncAthleteHrZones = async (athleteId) => {
  if (!athleteId) {
    return { data: null, error: { code: 'invalid_input', message: 'athleteId requerido' } };
  }
  return {
    data: null,
    error: { code: 'not_implemented', message: 'syncAthleteHrZones llegará en fase 2' },
  };
};

/**
 * Read athlete gear from athlete_gear via RLS.
 * Returns active gear sorted by distance_meters desc.
 */
export const getAthleteGear = async (athleteId) => {
  if (!athleteId) {
    return { data: [], error: { code: 'invalid_input', message: 'athleteId requerido' } };
  }
  const { data, error } = await supabase
    .from('athlete_gear')
    .select('id, name, brand_name, model_name, distance_meters, active, primary_gear, last_synced_at')
    .eq('athlete_id', athleteId)
    .order('distance_meters', { ascending: false });

  if (error) {
    return { data: [], error: { code: 'db_error', message: error.message } };
  }
  return { data: data ?? [], error: null };
};

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

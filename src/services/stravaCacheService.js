import { supabase } from '../lib/supabase';

// --- Mapping helpers ---

const mapActivityToRow = (athleteId, activity) => ({
  athlete_id: athleteId,
  strava_id: activity.id,
  name: activity.name,
  sport_type: activity.sport_type,
  type: activity.type,
  start_date: activity.start_date,
  start_date_local: activity.start_date_local,
  distance: activity.distance || 0,
  moving_time: activity.moving_time || 0,
  elapsed_time: activity.elapsed_time || 0,
  total_elevation_gain: activity.total_elevation_gain || 0,
  average_speed: activity.average_speed || null,
  max_speed: activity.max_speed || null,
  average_heartrate: activity.average_heartrate || null,
  max_heartrate: activity.max_heartrate || null,
  average_cadence: activity.average_cadence || null,
  calories: activity.calories || null,
  suffer_score: activity.suffer_score || null,
  has_heartrate: activity.has_heartrate || false,
  map_summary_polyline: activity.map?.summary_polyline || null,
  kudos_count: activity.kudos_count || 0,
  achievement_count: activity.achievement_count || 0,
});

const mapRowToActivity = (row) => ({
  id: row.strava_id,
  name: row.name,
  type: row.type,
  sport_type: row.sport_type,
  start_date: row.start_date,
  start_date_local: row.start_date_local,
  distance: Number(row.distance),
  moving_time: row.moving_time,
  elapsed_time: row.elapsed_time,
  total_elevation_gain: Number(row.total_elevation_gain),
  average_speed: row.average_speed != null ? Number(row.average_speed) : null,
  max_speed: row.max_speed != null ? Number(row.max_speed) : null,
  average_heartrate: row.average_heartrate != null ? Number(row.average_heartrate) : null,
  max_heartrate: row.max_heartrate != null ? Number(row.max_heartrate) : null,
  average_cadence: row.average_cadence != null ? Number(row.average_cadence) : null,
  calories: row.calories,
  suffer_score: row.suffer_score,
  has_heartrate: row.has_heartrate,
  map: { summary_polyline: row.map_summary_polyline },
  best_efforts: row.best_efforts,
  kudos_count: row.kudos_count,
  achievement_count: row.achievement_count,
});

// --- CRUD functions ---

/**
 * Get cached activities for an athlete, optionally filtered.
 * Returns objects in Strava API shape for compatibility with existing functions.
 */
export const getCachedActivities = async (athleteId, options = {}) => {
  const { after, before, sportType, limit } = options;

  let query = supabase
    .from('strava_activities')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('start_date_local', { ascending: false });

  if (after) {
    const afterISO = after instanceof Date ? after.toISOString() : after;
    query = query.gte('start_date_local', afterISO);
  }
  if (before) {
    const beforeISO = before instanceof Date ? before.toISOString() : before;
    query = query.lte('start_date_local', beforeISO);
  }
  if (sportType) {
    query = query.eq('sport_type', sportType);
  }
  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching cached activities:', error);
    return [];
  }

  return (data || []).map(mapRowToActivity);
};

/**
 * Get the most recent cached activity date for incremental sync.
 */
export const getLatestCachedActivityDate = async (athleteId) => {
  const { data, error } = await supabase
    .from('strava_activities')
    .select('start_date_local')
    .eq('athlete_id', athleteId)
    .order('start_date_local', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data.start_date_local;
};

/**
 * Upsert a batch of raw Strava activities into the cache.
 */
export const upsertActivities = async (athleteId, activities) => {
  if (!activities?.length) return 0;

  const rows = activities.map((a) => mapActivityToRow(athleteId, a));

  // Upsert in batches of 50 to avoid payload limits
  const BATCH_SIZE = 50;
  let total = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('strava_activities')
      .upsert(batch, { onConflict: 'athlete_id,strava_id' });

    if (error) {
      console.error('Error upserting activities batch:', error);
    } else {
      total += batch.length;
    }
  }

  return total;
};

/**
 * Update a cached activity with detail data (best_efforts, splits_metric, laps, etc.).
 * Only writes columns whose value is provided (undefined → skipped) so partial
 * detail payloads don't clobber existing data.
 */
export const updateActivityDetails = async (athleteId, stravaId, detailData) => {
  const patch = { has_details: true };

  if (detailData.best_efforts !== undefined) {
    patch.best_efforts = detailData.best_efforts || [];
  }
  if (detailData.splits_metric !== undefined) {
    patch.splits_metric = detailData.splits_metric || null;
  }
  if (detailData.laps !== undefined) {
    patch.laps = detailData.laps || null;
  }
  if (detailData.weighted_average_watts !== undefined) {
    patch.weighted_average_watts = detailData.weighted_average_watts ?? null;
  }
  if (detailData.workout_type !== undefined) {
    patch.workout_type = detailData.workout_type ?? null;
  }
  if (detailData.gear_id !== undefined) {
    patch.gear_id = detailData.gear_id ?? null;
  }
  if (detailData.device_name !== undefined) {
    patch.device_name = detailData.device_name ?? null;
  }

  const { error } = await supabase
    .from('strava_activities')
    .update(patch)
    .eq('athlete_id', athleteId)
    .eq('strava_id', stravaId);

  if (error) {
    console.error('Error updating activity details:', error);
  }
};

/**
 * Get all-time aggregate stats for an athlete directly from the DB.
 * Returns a single row instead of fetching all activities to the client.
 * Used for: longestRun, fastestPace, observedMaxHR, bestEfforts summary.
 */
export const getAthleteAllTimeStats = async (athleteId) => {
  // Aggregate query: longest run, fastest pace (min avg_speed on runs > 1km), max HR
  const { data, error } = await supabase
    .from('strava_activities')
    .select('distance, average_speed, max_heartrate, best_efforts, start_date_local')
    .eq('athlete_id', athleteId)
    .in('sport_type', ['Run', 'TrailRun', 'VirtualRun', 'Walk', 'Hike'])
    .order('start_date_local', { ascending: false })
    .limit(500); // last 500 run activities is enough for all-time records

  if (error || !data) return null;

  let longestRun = null;
  let fastestPaceActivity = null;
  let observedMaxHR = 0;
  const allBestEfforts = [];

  for (const row of data) {
    const dist = Number(row.distance || 0);
    const speed = row.average_speed ? Number(row.average_speed) : null;
    const hr = row.max_heartrate ? Number(row.max_heartrate) : null;

    if (!longestRun || dist > longestRun.distance) {
      longestRun = { distance: dist, start_date_local: row.start_date_local };
    }
    // Fastest pace: highest average_speed on runs > 1km
    if (speed && dist > 1000) {
      if (!fastestPaceActivity || speed > fastestPaceActivity.average_speed) {
        fastestPaceActivity = { average_speed: speed, distance: dist };
      }
    }
    if (hr && hr > observedMaxHR) observedMaxHR = hr;
    if (row.best_efforts?.length) allBestEfforts.push(...row.best_efforts);
  }

  return {
    longestRun: longestRun
      ? { distance: longestRun.distance, start_date_local: longestRun.start_date_local }
      : null,
    fastestPace: fastestPaceActivity
      ? 1000 / fastestPaceActivity.average_speed // seconds per km
      : null,
    observedMaxHR: observedMaxHR > 0 ? observedMaxHR : null,
    bestEfforts: allBestEfforts,
  };
};

/**
 * Get count of cached activities for an athlete.
 */
export const getCachedActivityCount = async (athleteId) => {
  const { count, error } = await supabase
    .from('strava_activities')
    .select('id', { count: 'exact', head: true })
    .eq('athlete_id', athleteId);

  if (error) {
    console.error('Error counting cached activities:', error);
    return 0;
  }
  return count || 0;
};

/**
 * Get IDs of running activities that haven't had details fetched yet.
 */
export const getActivitiesWithoutDetails = async (athleteId, limit = 20) => {
  const { data, error } = await supabase
    .from('strava_activities')
    .select('strava_id')
    .eq('athlete_id', athleteId)
    .eq('has_details', false)
    .in('type', ['Run', 'TrailRun', 'VirtualRun'])
    .order('start_date_local', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching activities without details:', error);
    return [];
  }
  return data || [];
};

/**
 * Update last_sync on the devices table.
 */
export const updateLastSync = async (athleteId) => {
  const { error } = await supabase
    .from('devices')
    .update({ last_sync: new Date().toISOString() })
    .eq('athlete_id', athleteId)
    .eq('device_type', 'strava');

  if (error) {
    console.error('Error updating last_sync:', error);
  }
};

/**
 * Get last_sync timestamp from devices table.
 */
/**
 * Get a single cached activity by its Strava ID.
 */
export const getCachedActivityByStravaId = async (athleteId, stravaId) => {
  const { data, error } = await supabase
    .from('strava_activities')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('strava_id', stravaId)
    .single();

  if (error || !data) return null;
  return mapRowToActivity(data);
};

/**
 * Get last_sync timestamp from devices table.
 */
export const getLastSync = async (athleteId) => {
  const { data, error } = await supabase
    .from('devices')
    .select('last_sync')
    .eq('athlete_id', athleteId)
    .eq('device_type', 'strava')
    .single();

  if (error || !data) return null;
  return data.last_sync;
};

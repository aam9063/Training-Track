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
 * Update a cached activity with detail data (best_efforts).
 */
export const updateActivityDetails = async (athleteId, stravaId, detailData) => {
  const { error } = await supabase
    .from('strava_activities')
    .update({
      best_efforts: detailData.best_efforts || [],
      has_details: true,
    })
    .eq('athlete_id', athleteId)
    .eq('strava_id', stravaId);

  if (error) {
    console.error('Error updating activity details:', error);
  }
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

import { supabase } from '../lib/supabase';
import { toLocalDateStr } from '../lib/dateUtils';

/**
 * Service for managing training metrics and analytics
 */

// Get athlete performance metrics
export const getAthletePerformance = async (athleteId, startDate, endDate) => {
  try {
    const { data, error } = await supabase
      .from('training_metrics')
      .select(`
        *,
        session:training_sessions!session_id(
          scheduled_date,
          training_type,
          title
        )
      `)
      .eq('athlete_id', athleteId)
      .gte('session.scheduled_date', startDate)
      .lte('session.scheduled_date', endDate)
      .order('session.scheduled_date', { ascending: true });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// Get all athletes performance summary (for coach)
export const getAllAthletesPerformance = async (coachId, startDate, endDate) => {
  try {
    // Get all active athletes
    const { data: relationships, error: relError } = await supabase
      .from('coach_athlete_relationship')
      .select('athlete_id')
      .eq('coach_id', coachId)
      .eq('status', 'active');

    if (relError) throw relError;

    const athleteIds = relationships.map(r => r.athlete_id);

    if (athleteIds.length === 0) {
      return { data: [], error: null };
    }

    // Get metrics for all athletes
    const { data, error } = await supabase
      .from('training_metrics')
      .select(`
        *,
        athlete:athletes!athlete_id(
          id,
          user:users!id(
            first_name,
            last_name
          )
        ),
        session:training_sessions!session_id(
          scheduled_date,
          training_type
        )
      `)
      .in('athlete_id', athleteIds)
      .gte('session.scheduled_date', startDate)
      .lte('session.scheduled_date', endDate);

    if (error) throw error;

    // Group by athlete
    const grouped = {};
    data.forEach(metric => {
      const id = metric.athlete_id;
      if (!grouped[id]) {
        grouped[id] = {
          athleteId: id,
          athleteName: `${metric.athlete.user.first_name} ${metric.athlete.user.last_name}`,
          metrics: [],
        };
      }
      grouped[id].metrics.push(metric);
    });

    return { data: Object.values(grouped), error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// Get weekly analytics summary
export const getWeeklyAnalytics = async (athleteId, weekStart) => {
  try {
    const { data, error } = await supabase
      .from('analytics_weekly_summary')
      .select('*')
      .eq('athlete_id', athleteId)
      .eq('week_start', weekStart)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return { data: data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// Calculate average pace improvement
export const calculatePaceImprovement = (metrics) => {
  if (!metrics || metrics.length < 2) return 0;

  const sorted = [...metrics].sort((a, b) =>
    new Date(a.created_at) - new Date(b.created_at)
  );

  const firstPace = sorted[0]?.average_pace_seconds;
  const lastPace = sorted[sorted.length - 1]?.average_pace_seconds;

  if (!firstPace || !lastPace) return 0;

  // Lower pace is better, so improvement is when pace decreases
  const improvement = ((firstPace - lastPace) / firstPace) * 100;
  return Math.round(improvement * 10) / 10;
};

// Calculate training load trend
export const calculateLoadTrend = (metrics) => {
  if (!metrics || metrics.length === 0) return 0;

  const totalLoad = metrics.reduce((sum, m) => {
    const duration = m.total_duration_seconds / 60; // minutes
    const rpe = m.rpe_score || 5;
    return sum + (duration * rpe);
  }, 0);

  return Math.round(totalLoad);
};

// ─── Internal (non-Strava) metrics for independent athletes ─────────────────

/**
 * Fetch completed training_sessions for the given athlete over the last N weeks.
 * Prefers Strava distance when strava_activity_id is set.
 *
 * @param {string} userId
 * @param {number} weeks - number of past weeks to fetch (default 8)
 * @returns {{ data: Array, error: Error|null }}
 */
export const getWeeklyKm = async (userId, weeks = 8) => {
  if (!userId) return { data: [], error: new Error('No userId') };

  const since = new Date();
  since.setDate(since.getDate() - weeks * 7);

  const { data, error } = await supabase
    .from('training_sessions')
    .select('scheduled_date, actual_distance_km, strava_activity_id, status, training_type')
    .eq('athlete_id', userId)
    .eq('status', 'completed')
    .neq('training_type', 'rest')
    .gte('scheduled_date', toLocalDateStr(since))
    .order('scheduled_date', { ascending: true });

  if (error) return { data: [], error };
  return { data: data ?? [], error: null };
};

/**
 * Fetch RPE trend: completed sessions with rpe values.
 *
 * @param {string} userId
 * @param {number} weeks
 * @returns {{ data: Array, error: Error|null }}
 */
export const getRpeTrend = async (userId, weeks = 8) => {
  if (!userId) return { data: [], error: new Error('No userId') };

  const since = new Date();
  since.setDate(since.getDate() - weeks * 7);

  const { data, error } = await supabase
    .from('training_sessions')
    .select('scheduled_date, rpe, status, training_type')
    .eq('athlete_id', userId)
    .eq('status', 'completed')
    .neq('training_type', 'rest')
    .not('rpe', 'is', null)
    .gte('scheduled_date', toLocalDateStr(since))
    .order('scheduled_date', { ascending: true });

  if (error) return { data: [], error };
  return { data: data ?? [], error: null };
};

/**
 * Fetch pace trend: completed sessions with both actual_distance_km and actual_time_minutes.
 *
 * @param {string} userId
 * @param {number} weeks
 * @returns {{ data: Array, error: Error|null }}
 */
export const getPaceTrend = async (userId, weeks = 8) => {
  if (!userId) return { data: [], error: new Error('No userId') };

  const since = new Date();
  since.setDate(since.getDate() - weeks * 7);

  const { data, error } = await supabase
    .from('training_sessions')
    .select('scheduled_date, actual_distance_km, actual_time_minutes, status, training_type')
    .eq('athlete_id', userId)
    .eq('status', 'completed')
    .eq('training_type', 'running')
    .not('actual_distance_km', 'is', null)
    .not('actual_time_minutes', 'is', null)
    .gte('scheduled_date', toLocalDateStr(since))
    .order('scheduled_date', { ascending: true });

  if (error) return { data: [], error };
  return { data: data ?? [], error: null };
};

/**
 * Fetch personal bests from competitions (actual_time_minutes) and training_sessions
 * for standard distances 5K, 10K, Half Marathon, Marathon.
 *
 * @param {string} userId
 * @returns {{ data: Object, error: Error|null }}
 * data shape: { '5k': { minutes, date } | null, '10k': ..., 'half': ..., 'marathon': ... }
 */
export const getPersonalBests = async (userId) => {
  if (!userId) return { data: null, error: new Error('No userId') };

  // Fetch competition results
  const { data: competitions, error: compError } = await supabase
    .from('competitions')
    .select('distance_km, actual_time_minutes, event_date')
    .eq('athlete_id', userId)
    .not('actual_time_minutes', 'is', null)
    .order('actual_time_minutes', { ascending: true });

  // Fetch manual session completions with distance + time (running)
  const { data: sessions, error: sessError } = await supabase
    .from('training_sessions')
    .select('actual_distance_km, actual_time_minutes, completed_at, scheduled_date')
    .eq('athlete_id', userId)
    .eq('status', 'completed')
    .eq('training_type', 'running')
    .not('actual_distance_km', 'is', null)
    .not('actual_time_minutes', 'is', null)
    .order('actual_time_minutes', { ascending: true });

  if (compError && sessError) return { data: null, error: compError };

  // Tolerance ranges for standard distances (in km)
  const DISTANCES = {
    '5k': { min: 4.8, max: 5.2, label: '5K' },
    '10k': { min: 9.8, max: 10.2, label: '10K' },
    'half': { min: 21.0, max: 21.2, label: 'Media Maratón' },
    'marathon': { min: 42.0, max: 42.4, label: 'Maratón' },
  };

  const bests = { '5k': null, '10k': null, 'half': null, 'marathon': null };

  const checkAndUpdate = (distanceKm, timeMinutes, dateStr) => {
    if (!distanceKm || !timeMinutes) return;
    for (const [key, range] of Object.entries(DISTANCES)) {
      if (distanceKm >= range.min && distanceKm <= range.max) {
        if (!bests[key] || timeMinutes < bests[key].minutes) {
          bests[key] = { minutes: timeMinutes, date: dateStr };
        }
      }
    }
  };

  (competitions ?? []).forEach(c => checkAndUpdate(c.distance_km, c.actual_time_minutes, c.event_date));
  (sessions ?? []).forEach(s => checkAndUpdate(s.actual_distance_km, s.actual_time_minutes, s.completed_at?.split('T')[0] || s.scheduled_date));

  return { data: bests, error: null };
};

/**
 * Completion rate: percentage of non-rest planned sessions that are completed
 * within the athlete's current plan window (last planId if provided, else current week).
 *
 * @param {string} userId
 * @param {string|null} planId - optional training_plan id to scope the query
 * @returns {{ data: { completed: number, total: number, pct: number }, error: Error|null }}
 */
export const getCompletionRate = async (userId, planId = null) => {
  if (!userId) return { data: null, error: new Error('No userId') };

  let query = supabase
    .from('training_sessions')
    .select('status, training_type')
    .eq('athlete_id', userId)
    .neq('training_type', 'rest');

  if (planId) {
    query = query.eq('plan_id', planId);
  } else {
    // Default: last 4 weeks
    const since = new Date();
    since.setDate(since.getDate() - 28);
    query = query.gte('scheduled_date', toLocalDateStr(since));
  }

  const { data, error } = await query;

  if (error) return { data: null, error };

  const total = data?.length ?? 0;
  const completed = data?.filter(s => s.status === 'completed').length ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { data: { completed, total, pct }, error: null };
};

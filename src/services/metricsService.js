import { supabase } from '../lib/supabase';

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
    console.error('Error fetching athlete performance:', error);
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
      const athleteId = metric.athlete_id;
      if (!grouped[athleteId]) {
        grouped[athleteId] = {
          athleteId,
          athleteName: `${metric.athlete.user.first_name} ${metric.athlete.user.last_name}`,
          metrics: [],
        };
      }
      grouped[athleteId].metrics.push(metric);
    });

    return { data: Object.values(grouped), error: null };
  } catch (error) {
    console.error('Error fetching all athletes performance:', error);
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
    console.error('Error fetching weekly analytics:', error);
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

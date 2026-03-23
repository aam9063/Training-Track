import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toLocalDateStr } from '../lib/dateUtils';
import { showError } from '../lib/toast';
import { getWeekStartDate } from '../services/weeklyTrainingService';
import { parseKmFromDescription } from '../lib/trainingUtils';
import { getAthleteCompetitions } from '../services/athleteService';
import { getCachedActivities } from '../services/stravaCacheService';
import { getCurrentWeekDiary } from '../services/weeklyDiaryService';

/**
 * Custom hook that encapsulates all business logic for the Athlete Dashboard.
 * Handles supabase queries, data transformations, streak calculation,
 * distance stats, and Strava metrics aggregation.
 */
export default function useAthleteDashboardData(profileId) {
  const [loading, setLoading] = useState(true);
  const [hasDiaryThisWeek, setHasDiaryThisWeek] = useState(true); // optimistic: hide banner until loaded
  const [weekStats, setWeekStats] = useState({
    totalKm: 0,
    totalTime: '0h 0m',
    sessions: 0,
  });
  const [streak, setStreak] = useState(0);
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [upcomingCompetitions, setUpcomingCompetitions] = useState([]);

  const loadDashboardData = useCallback(async () => {
    if (!profileId) {
      setLoading(false);
      return;
    }
    // Check if diary filled this week (for Sunday banner)
    getCurrentWeekDiary(profileId)
      .then(({ data, error }) => {
        if (!error) setHasDiaryThisWeek(!!data);
      })
      .catch(() => {});

    setLoading(true);
    try {
      const weekStart = getWeekStartDate();
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const { data: weekSessions, error: weekError } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('athlete_id', profileId)
        .gte('scheduled_date', toLocalDateStr(weekStart))
        .lte('scheduled_date', toLocalDateStr(weekEnd))
        .order('scheduled_date', { ascending: true });

      if (weekError) throw weekError;

      const { data: upcomingData, error: upcomingError } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('athlete_id', profileId)
        .gte('scheduled_date', toLocalDateStr(weekStart))
        .neq('training_type', 'rest')
        .order('scheduled_date', { ascending: true })
        .limit(10);

      if (upcomingError) throw upcomingError;

      let weekSessionsWithExercises = weekSessions || [];
      if (weekSessions?.length > 0) {
        const sessionIds = weekSessions.map(s => s.id);
        const { data: exercises } = await supabase
          .from('training_session_exercises')
          .select('*')
          .in('session_id', sessionIds);

        weekSessionsWithExercises = weekSessions.map(session => ({
          ...session,
          exercises: exercises?.filter(e => e.session_id === session.id) || [],
        }));
      }

      const stravaActivities = await getCachedActivities(profileId, {
        after: weekStart,
        before: new Date(weekEnd.getTime() + 24 * 60 * 60 * 1000),
      });

      let stravaDistanceMeters = 0;
      let stravaMovingTimeSeconds = 0;
      stravaActivities.forEach((a) => {
        stravaDistanceMeters += a.distance || 0;
        stravaMovingTimeSeconds += a.moving_time || 0;
      });

      let plannedDistanceMeters = 0;
      let plannedDurationMinutes = 0;
      weekSessionsWithExercises.forEach((session) => {
        if (session.training_type !== 'rest') {
          if (session.estimated_duration_minutes) {
            plannedDurationMinutes += session.estimated_duration_minutes;
          }
          let sessionDistance = 0;
          session.exercises?.forEach((ex) => {
            if (ex.planned_distance_meters) {
              const sets = ex.planned_sets || 1;
              const reps = ex.planned_reps || 1;
              sessionDistance += ex.planned_distance_meters * sets * reps;
            }
          });
          if (sessionDistance === 0 && session.description) {
            const parsedKm = parseKmFromDescription(session.description);
            if (parsedKm > 0) sessionDistance = parsedKm * 1000;
          }
          plannedDistanceMeters += sessionDistance;
        }
      });

      const hasStrava = stravaActivities.length > 0;
      const totalDistanceMeters = hasStrava ? stravaDistanceMeters : plannedDistanceMeters;
      const totalDurationMinutes = hasStrava
        ? Math.round(stravaMovingTimeSeconds / 60)
        : plannedDurationMinutes;

      const totalKm = (totalDistanceMeters / 1000).toFixed(1);
      const hours = Math.floor(totalDurationMinutes / 60);
      const minutes = totalDurationMinutes % 60;
      const totalTime = `${hours}h ${minutes}m`;

      setWeekStats({
        totalKm: parseFloat(totalKm),
        totalTime,
        sessions: weekSessionsWithExercises.filter(s => s.training_type !== 'rest').length,
      });

      const upcoming = (upcomingData || []).map(session => ({
        id: session.id,
        title: session.title || 'Entrenamiento',
        date: session.scheduled_date,
        time: session.scheduled_time || '',
        type: session.training_type,
        status: session.status,
      }));
      setUpcomingSessions(upcoming.slice(0, 4));

      const { data: competitions } = await getAthleteCompetitions(profileId);
      setUpcomingCompetitions((competitions || []).slice(0, 1));

      // Streak: count consecutive days with completed sessions going back from today
      const streakStart = new Date();
      streakStart.setDate(streakStart.getDate() - 60);
      const { data: recentSessions } = await supabase
        .from('training_sessions')
        .select('scheduled_date, status')
        .eq('athlete_id', profileId)
        .eq('status', 'completed')
        .neq('training_type', 'rest')
        .gte('scheduled_date', toLocalDateStr(streakStart))
        .order('scheduled_date', { ascending: false });

      if (recentSessions?.length > 0) {
        const completedDates = new Set(recentSessions.map(s => s.scheduled_date));
        let count = 0;
        const cursor = new Date();
        // If today has no completed session yet, start counting from yesterday
        if (!completedDates.has(toLocalDateStr(cursor))) cursor.setDate(cursor.getDate() - 1);
        while (completedDates.has(toLocalDateStr(cursor))) {
          count++;
          cursor.setDate(cursor.getDate() - 1);
        }
        setStreak(count);
      }
    } catch (error) {
      showError('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  return {
    loading,
    weekStats,
    streak,
    upcomingSessions,
    upcomingCompetitions,
    hasDiaryThisWeek,
    setHasDiaryThisWeek,
  };
}

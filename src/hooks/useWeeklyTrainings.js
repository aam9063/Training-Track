import { useState, useEffect, useCallback } from 'react';
import { getWeekStartDate } from '../services/weeklyTrainingService';

/**
 * Hook for week navigation + training session loading.
 * @param {Function} fetchFn - (weekStart) => Promise<{data, error}> — the fetch function for sessions
 * @param {Array} deps - additional dependencies for the fetch (e.g. [profileId, athleteId])
 * @param {Function} [transformFn] - optional (sessions) => object transform for the raw data
 */
export default function useWeeklyTrainings({ fetchFn, deps = [], transformFn }) {
  const [currentWeek, setCurrentWeek] = useState(getWeekStartDate());
  const [trainings, setTrainings] = useState({});
  const [loading, setLoading] = useState(true);

  const defaultTransform = useCallback((data) => {
    const trainingsByDay = {};
    if (data?.length > 0) {
      data.forEach((session) => {
        const sessionDate = new Date(session.scheduled_date);
        const dayIndex = (sessionDate.getDay() + 6) % 7;

        const exercises = session.exercises?.map((ex) => {
          const exercise = ex.running_exercise || ex.gym_exercise;
          const isGym = !!ex.gym_exercise_id;
          return {
            id: ex.id,
            name: exercise?.name || 'Ejercicio',
            category: exercise?.category,
            isGym,
            sets: ex.planned_sets,
            reps: ex.planned_reps,
            distance: ex.planned_distance_meters,
            durationSeconds: ex.planned_duration_seconds,
            weight: ex.planned_weight_kg,
            paceCode: ex.pace_code,
            paceDescription: ex.pace_description,
            rest: ex.rest_seconds,
            notes: ex.notes,
            completedSets: ex.completed_sets,
            completedReps: ex.completed_reps,
            completedDistance: ex.completed_distance_meters,
            completedDuration: ex.completed_duration_seconds,
            completedWeight: ex.completed_weight_kg,
          };
        }) || [];

        let totalDistance = 0;
        exercises.forEach((ex) => {
          if (ex.distance) totalDistance += (ex.distance * (ex.sets || 1) * (ex.reps || 1));
        });

        trainingsByDay[dayIndex] = {
          id: session.id,
          title: session.title || 'Entrenamiento',
          type: session.training_type,
          description: session.description,
          notes: session.notes_coach,
          notesAthlete: session.notes_athlete,
          duration: session.estimated_duration_minutes,
          actualDuration: session.actual_duration_minutes,
          exercises,
          totalDistance: totalDistance > 0 ? `${(totalDistance / 1000).toFixed(1)} km` : null,
          totalDistanceMeters: totalDistance,
          status: session.status,
          date: session.scheduled_date,
          rpeScore: session.rpe_score,
          rpeNotes: session.rpe_notes,
          completedAt: session.completed_at,
        };
      });
    }
    return trainingsByDay;
  }, []);

  const transform = transformFn || defaultTransform;

  const loadTrainings = useCallback(async () => {
    if (deps.some(d => !d)) {
      setTrainings({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await fetchFn(currentWeek);
      if (error) throw error;
      setTrainings(transform(data));
    } catch (error) {
      console.error('Error loading trainings:', error);
      setTrainings({});
    } finally {
      setLoading(false);
    }
  }, [currentWeek, ...deps]);

  useEffect(() => {
    loadTrainings();
  }, [loadTrainings]);

  const goToPreviousWeek = useCallback(() => {
    setCurrentWeek(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }, []);

  const goToNextWeek = useCallback(() => {
    setCurrentWeek(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }, []);

  const goToCurrentWeek = useCallback(() => {
    setCurrentWeek(getWeekStartDate());
  }, []);

  const getWeekDays = useCallback((startDate) => {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startDate);
      day.setDate(day.getDate() + i);
      week.push(day);
    }
    return week;
  }, []);

  return {
    currentWeek,
    trainings,
    loading,
    loadTrainings,
    goToPreviousWeek,
    goToNextWeek,
    goToCurrentWeek,
    getWeekDays,
  };
}

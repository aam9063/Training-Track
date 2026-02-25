import { useState, useEffect, useCallback } from 'react';
import { getWeekStartDate } from '../services/weeklyTrainingService';

/**
 * Parses km from free-text training descriptions.
 * Recognizes: "8km", "10x400m", "2km + 6x1000m", standalone "1500m", etc.
 */
function parseKmFromDescription(text) {
  if (!text || !text.trim()) return 0;
  const normalized = text.toLowerCase().replace(/,/g, '.');
  let totalKm = 0;
  const usedRanges = [];

  // Repetitions: "10x400m", "8 x 1000"
  const repRegex = /(\d+)\s*x\s*(\d+)\s*m?\b/g;
  let match;
  while ((match = repRegex.exec(normalized)) !== null) {
    const reps = parseInt(match[1]);
    const meters = parseInt(match[2]);
    if (reps > 0 && reps <= 100 && meters > 0 && meters <= 50000) {
      totalKm += (reps * meters) / 1000;
      usedRanges.push([match.index, match.index + match[0].length]);
    }
  }

  // Direct km: "8km", "8 km", "8k", "12.5km"
  const kmRegex = /(\d+(?:\.\d+)?)\s*k(?:m)?\b/g;
  while ((match = kmRegex.exec(normalized)) !== null) {
    const overlaps = usedRanges.some(([s, e]) => match.index >= s && match.index < e);
    if (!overlaps) {
      const km = parseFloat(match[1]);
      if (km > 0 && km <= 300) {
        totalKm += km;
        usedRanges.push([match.index, match.index + match[0].length]);
      }
    }
  }

  // Standalone meters: "1500m", "800m"
  const mRegex = /(?<!\dx?\s*)(\d+)\s*m\b/g;
  while ((match = mRegex.exec(normalized)) !== null) {
    const overlaps = usedRanges.some(([s, e]) => match.index >= s && match.index < e);
    if (!overlaps) {
      const meters = parseInt(match[1]);
      if (meters >= 200 && meters <= 50000) {
        totalKm += meters / 1000;
        usedRanges.push([match.index, match.index + match[0].length]);
      }
    }
  }

  return Math.round(totalKm * 10) / 10;
}

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

        // If no exercise-based distance, parse km from description text
        if (totalDistance === 0 && session.description) {
          const parsedKm = parseKmFromDescription(session.description);
          if (parsedKm > 0) totalDistance = parsedKm * 1000;
        }

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
          stravaActivityId: session.strava_activity_id,
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

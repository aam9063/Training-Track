import { useState, useEffect, useCallback } from 'react';
import { showSuccess, showError } from '../lib/toast';
import { useAuth } from '../contexts/AuthContext';
import {
  getAthleteDetails,
  getAthleteMetrics,
  getAthleteCompetitions,
  createAthleteCompetition,
  deleteAthleteCompetition,
} from '../services/athleteService';
import {
  getAthleteWeeklyTraining,
} from '../services/weeklyTrainingService';
import useWeeklyTrainings from './useWeeklyTrainings';
import useCoachStravaData from './useCoachStravaData';
import useMapbox from './useMapbox';
import useAthleteProfile from './useAthleteProfile';

/**
 * Custom hook that encapsulates all data fetching and state management
 * for the AthleteProfile page.
 *
 * @param {string} athleteId - The athlete's ID from route params
 * @returns {object} All state and handler functions needed by the component
 */
const useAthleteProfileData = (athleteId) => {
  const { profile } = useAuth();

  // Core athlete state
  const [athlete, setAthlete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState([]);
  const [events, setEvents] = useState([]);

  // Coach training transform for weekly trainings
  const coachTrainingTransform = useCallback((data) => {
    const trainingsByDay = {};
    if (data?.length > 0) {
      data.forEach((session) => {
        const sessionDate = new Date(session.scheduled_date);
        const dayIndex = (sessionDate.getDay() + 6) % 7;
        const exercises = session.exercises?.map((ex) => {
          const exercise = ex.running_exercise || ex.gym_exercise;
          return {
            name: exercise?.name || 'Ejercicio',
            sets: ex.planned_sets,
            reps: ex.planned_reps,
            distance: ex.planned_distance_meters,
            paceCode: ex.pace_code,
          };
        }) || [];
        trainingsByDay[dayIndex] = {
          id: session.id,
          title: session.title || 'Entrenamiento',
          type: session.training_type,
          description: session.description,
          duration: session.estimated_duration_minutes,
          exercises,
          status: session.status,
          rpe_score: session.rpe_score,
          // Agent 3 provenance — `training_sessions.adjusted_by_agent`
          // already comes through getAthleteWeeklyTraining's `select('*')`
          // (the migration is additive on the same table, no service query
          // change needed), just wasn't carried into this narrower
          // per-day view-model until now.
          adjustedByAgent: session.adjusted_by_agent === true,
        };
      });
    }
    return trainingsByDay;
  }, []);

  // Weekly trainings hook
  const {
    currentWeek, trainings, loading: trainingsLoading,
    loadTrainings, goToPreviousWeek, goToNextWeek, getWeekDays,
  } = useWeeklyTrainings({
    fetchFn: (weekStart) => getAthleteWeeklyTraining(profile?.id, athleteId, weekStart),
    deps: [profile?.id, athleteId],
    transformFn: coachTrainingTransform,
  });

  // Strava data hook
  const {
    stravaActivities, stravaLoading, stravaConnected, visibleActivities,
    stravaMetrics, stravaBestEfforts, activitiesRPE,
    rpeDetailActivity, setRpeDetailActivity,
    selectedActivity, setSelectedActivity,
    loadActivityDetail, showMoreActivities,
  } = useCoachStravaData(athleteId);

  // Mapbox hook for activity detail
  const { mapContainerRef } = useMapbox(selectedActivity?.polyline, selectedActivity?.loading);

  // Athlete profile (onboarding data) for "Perfil Deportivo" section
  const { profile: athleteProfile, loading: profileLoading } = useAthleteProfile(athleteId);

  // Load athlete details
  useEffect(() => {
    const loadAthlete = async () => {
      if (!athleteId) return;

      setLoading(true);
      try {
        const { data, error } = await getAthleteDetails(athleteId);
        if (error) throw error;
        setAthlete(data);
      } catch {
        showError('Error al cargar los datos del atleta');
      } finally {
        setLoading(false);
      }
    };

    loadAthlete();
  }, [athleteId]);

  // Load competitions
  const loadCompetitions = useCallback(async () => {
    if (!athleteId) return;
    try {
      const { data, error } = await getAthleteCompetitions(athleteId);
      if (error) throw error;
      setEvents(data || []);
    } catch {
      showError('Error al cargar las competiciones');
    }
  }, [athleteId]);

  // Load metrics and competitions
  useEffect(() => {
    const loadAdditionalData = async () => {
      if (!athleteId) return;

      try {
        const [metricsRes, competitionsRes] = await Promise.all([
          getAthleteMetrics(athleteId),
          getAthleteCompetitions(athleteId),
        ]);

        setMetrics(metricsRes.data || []);
        setEvents(competitionsRes.data || []);
      } catch {
        showError('Error al cargar datos adicionales');
      }
    };

    loadAdditionalData();
  }, [athleteId]);

  // Refresh athlete data (used after Conconi test success)
  const refreshAthlete = useCallback(async () => {
    const { data } = await getAthleteDetails(athleteId);
    if (data) setAthlete(data);
  }, [athleteId]);

  // Handle save competition
  const handleSaveEvent = useCallback(async (newEvent, callbacks) => {
    if (!newEvent.name || !newEvent.date) return;

    callbacks?.setSavingEvent?.(true);
    try {
      const competitionData = {
        name: newEvent.name,
        event_date: newEvent.date,
        distance_km: newEvent.distance ? parseFloat(newEvent.distance) : null,
        location: newEvent.location || null,
        notes: newEvent.notes || null,
      };

      const { error } = await createAthleteCompetition(profile.id, athleteId, competitionData);
      if (error) throw error;

      callbacks?.resetForm?.();
      callbacks?.closeModal?.();

      await loadCompetitions();
      showSuccess('Competición guardada correctamente');
    } catch {
      showError('Error al guardar la competición');
    } finally {
      callbacks?.setSavingEvent?.(false);
    }
  }, [profile?.id, athleteId, loadCompetitions]);

  // Handle delete competition
  const handleDeleteEvent = useCallback(async (competitionId) => {
    if (!window.confirm('¿Eliminar esta competición?')) return;

    try {
      const { error } = await deleteAthleteCompetition(competitionId);
      if (error) throw error;

      await loadCompetitions();
      showSuccess('Competición eliminada');
    } catch {
      showError('Error al eliminar la competición');
    }
  }, [loadCompetitions]);

  // Derived values
  const weekDays = getWeekDays(currentWeek);
  const athleteName = `${athlete?.user?.first_name || ''} ${athlete?.user?.last_name || ''}`.trim() || 'Atleta';
  const initials = `${athlete?.user?.first_name?.[0] || ''}${athlete?.user?.last_name?.[0] || ''}`.toUpperCase() || 'AT';

  return {
    // Auth
    profile,

    // Core athlete data
    athlete,
    loading,
    metrics,
    events,
    athleteName,
    initials,

    // Weekly trainings
    currentWeek,
    trainings,
    trainingsLoading,
    loadTrainings,
    goToPreviousWeek,
    goToNextWeek,
    weekDays,

    // Strava
    stravaActivities,
    stravaLoading,
    stravaConnected,
    visibleActivities,
    stravaMetrics,
    stravaBestEfforts,
    activitiesRPE,
    rpeDetailActivity,
    setRpeDetailActivity,
    selectedActivity,
    setSelectedActivity,
    loadActivityDetail,
    showMoreActivities,
    mapContainerRef,

    // Athlete profile (onboarding)
    athleteProfile,
    profileLoading,

    // Event handlers
    handleSaveEvent,
    handleDeleteEvent,
    refreshAthlete,
  };
};

export default useAthleteProfileData;

import { supabase } from '../lib/supabase';
import { toLocalDateStr } from '../lib/dateUtils';

/**
 * Obtiene los ejercicios de carrera del banco de ejercicios
 */
export const getRunningExercises = async (coachId = null) => {
  try {
    let query = supabase
      .from('running_exercises_bank')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    // Obtener ejercicios globales o del coach
    if (coachId) {
      query = query.or(`coach_id.is.null,coach_id.eq.${coachId}`);
    } else {
      query = query.is('coach_id', null);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching running exercises:', error);
    return { data: [], error };
  }
};

/**
 * Obtiene los ejercicios de gimnasio del banco de ejercicios
 */
export const getGymExercises = async (coachId = null) => {
  try {
    let query = supabase
      .from('gym_exercises_bank')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    // Obtener ejercicios globales o del coach
    if (coachId) {
      query = query.or(`coach_id.is.null,coach_id.eq.${coachId}`);
    } else {
      query = query.is('coach_id', null);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching gym exercises:', error);
    return { data: [], error };
  }
};

/**
 * Crea un entrenamiento semanal para un atleta
 * @param {Object} weeklyPlan - Plan semanal con datos de cada día
 * @param {string} weeklyPlan.coachId - ID del coach
 * @param {string} weeklyPlan.athleteId - ID del atleta
 * @param {Date} weeklyPlan.weekStartDate - Fecha de inicio de la semana (lunes)
 * @param {Array} weeklyPlan.days - Array de 7 días con sus entrenamientos
 */
export const createWeeklyTraining = async (weeklyPlan) => {
  try {
    const { coachId, athleteId, weekStartDate, days } = weeklyPlan;

    // Crear las sesiones para cada día
    const sessions = [];

    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      if (!day || day.type === 'rest_empty') continue; // Skip días vacíos

      const sessionDate = new Date(weekStartDate);
      sessionDate.setDate(sessionDate.getDate() + i);

      const sessionData = {
        coach_id: coachId,
        athlete_id: athleteId,
        scheduled_date: toLocalDateStr(sessionDate),
        training_type: day.type || 'running',
        status: 'planned',
        title: day.title || '',
        description: day.description || '',
        notes_coach: day.notes || '',
        estimated_duration_minutes: day.duration || null,
      };

      sessions.push(sessionData);
    }

    if (sessions.length === 0) {
      return { data: [], error: null };
    }

    // Insertar todas las sesiones
    const { data: createdSessions, error: sessionsError } = await supabase
      .from('training_sessions')
      .insert(sessions)
      .select();

    if (sessionsError) throw sessionsError;

    // Ahora insertar los ejercicios de cada sesión
    const exercisesToInsert = [];

    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      if (!day || day.type === 'rest_empty' || !day.exercises?.length) continue;

      // Encontrar la sesión correspondiente
      const sessionDate = new Date(weekStartDate);
      sessionDate.setDate(sessionDate.getDate() + i);
      const dateStr = toLocalDateStr(sessionDate);

      const session = createdSessions.find(s => s.scheduled_date === dateStr);
      if (!session) continue;

      day.exercises.forEach((exercise, order) => {
        const exerciseData = {
          session_id: session.id,
          exercise_order: order + 1,
          running_exercise_id: exercise.type === 'running' ? exercise.exerciseId : null,
          gym_exercise_id: exercise.type === 'gym' ? exercise.exerciseId : null,
          planned_sets: exercise.sets || null,
          planned_reps: exercise.reps || null,
          planned_distance_meters: exercise.distance || null,
          planned_duration_seconds: exercise.durationSeconds || null,
          pace_code: exercise.paceCode || null,
          pace_description: exercise.paceDescription || null,
          rest_seconds: exercise.restSeconds || null,
          notes: exercise.notes || null,
        };

        exercisesToInsert.push(exerciseData);
      });
    }

    if (exercisesToInsert.length > 0) {
      const { error: exercisesError } = await supabase
        .from('training_session_exercises')
        .insert(exercisesToInsert);

      if (exercisesError) throw exercisesError;
    }

    return { data: createdSessions, error: null };
  } catch (error) {
    console.error('Error creating weekly training:', error);
    return { data: null, error };
  }
};

/**
 * Obtiene el entrenamiento semanal de un atleta
 * @param {string} athleteId - ID del atleta
 * @param {Date} weekStartDate - Fecha de inicio de la semana
 */
export const getWeeklyTraining = async (athleteId, weekStartDate) => {
  try {
    const startDate = new Date(weekStartDate);
    const endDate = new Date(weekStartDate);
    endDate.setDate(endDate.getDate() + 6);

    // Obtener sesiones de la semana
    const { data: sessions, error: sessionsError } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('athlete_id', athleteId)
      .gte('scheduled_date', toLocalDateStr(startDate))
      .lte('scheduled_date', toLocalDateStr(endDate))
      .order('scheduled_date', { ascending: true });

    if (sessionsError) throw sessionsError;

    if (!sessions?.length) {
      return { data: [], error: null };
    }

    // Obtener ejercicios de cada sesión
    const sessionIds = sessions.map(s => s.id);

    const { data: exercises, error: exercisesError } = await supabase
      .from('training_session_exercises')
      .select(`
        *,
        running_exercise:running_exercises_bank(*),
        gym_exercise:gym_exercises_bank(*)
      `)
      .in('session_id', sessionIds)
      .order('exercise_order', { ascending: true });

    if (exercisesError) throw exercisesError;

    // Combinar sesiones con sus ejercicios
    const sessionsWithExercises = sessions.map(session => ({
      ...session,
      exercises: exercises?.filter(e => e.session_id === session.id) || [],
    }));

    return { data: sessionsWithExercises, error: null };
  } catch (error) {
    console.error('Error fetching weekly training:', error);
    return { data: [], error };
  }
};

/**
 * Obtiene el entrenamiento semanal de un atleta por coach
 * @param {string} coachId - ID del coach
 * @param {string} athleteId - ID del atleta
 * @param {Date} weekStartDate - Fecha de inicio de la semana
 */
export const getAthleteWeeklyTraining = async (coachId, athleteId, weekStartDate) => {
  try {
    const startDate = new Date(weekStartDate);
    const endDate = new Date(weekStartDate);
    endDate.setDate(endDate.getDate() + 6);

    const { data: sessions, error: sessionsError } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('coach_id', coachId)
      .eq('athlete_id', athleteId)
      .gte('scheduled_date', toLocalDateStr(startDate))
      .lte('scheduled_date', toLocalDateStr(endDate))
      .order('scheduled_date', { ascending: true });

    if (sessionsError) throw sessionsError;

    if (!sessions?.length) {
      return { data: [], error: null };
    }

    // Obtener ejercicios
    const sessionIds = sessions.map(s => s.id);

    const { data: exercises, error: exercisesError } = await supabase
      .from('training_session_exercises')
      .select(`
        *,
        running_exercise:running_exercises_bank(*),
        gym_exercise:gym_exercises_bank(*)
      `)
      .in('session_id', sessionIds)
      .order('exercise_order', { ascending: true });

    if (exercisesError) throw exercisesError;

    const sessionsWithExercises = sessions.map(session => ({
      ...session,
      exercises: exercises?.filter(e => e.session_id === session.id) || [],
    }));

    return { data: sessionsWithExercises, error: null };
  } catch (error) {
    console.error('Error fetching athlete weekly training:', error);
    return { data: [], error };
  }
};

/**
 * Actualiza una sesión de entrenamiento
 */
export const updateTrainingSession = async (sessionId, updates) => {
  try {
    const { data, error } = await supabase
      .from('training_sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error updating training session:', error);
    return { data: null, error };
  }
};

/**
 * Elimina una sesión de entrenamiento y sus ejercicios
 */
export const deleteTrainingSession = async (sessionId) => {
  try {
    // Primero eliminar ejercicios
    await supabase
      .from('training_session_exercises')
      .delete()
      .eq('session_id', sessionId);

    // Luego eliminar la sesión
    const { error } = await supabase
      .from('training_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Error deleting training session:', error);
    return { error };
  }
};

/**
 * Elimina todas las sesiones de una semana para un atleta
 */
export const deleteWeeklyTraining = async (coachId, athleteId, weekStartDate) => {
  try {
    const startDate = new Date(weekStartDate);
    const endDate = new Date(weekStartDate);
    endDate.setDate(endDate.getDate() + 6);

    // Obtener IDs de sesiones a eliminar
    const { data: sessions, error: fetchError } = await supabase
      .from('training_sessions')
      .select('id')
      .eq('coach_id', coachId)
      .eq('athlete_id', athleteId)
      .gte('scheduled_date', toLocalDateStr(startDate))
      .lte('scheduled_date', toLocalDateStr(endDate));

    if (fetchError) throw fetchError;

    if (sessions?.length) {
      const sessionIds = sessions.map(s => s.id);

      // Eliminar ejercicios
      await supabase
        .from('training_session_exercises')
        .delete()
        .in('session_id', sessionIds);

      // Eliminar sesiones
      const { error: deleteError } = await supabase
        .from('training_sessions')
        .delete()
        .in('id', sessionIds);

      if (deleteError) throw deleteError;
    }

    return { error: null };
  } catch (error) {
    console.error('Error deleting weekly training:', error);
    return { error };
  }
};

/**
 * Actualiza los ejercicios de una sesión
 */
export const updateSessionExercises = async (sessionId, exercises) => {
  try {
    // Eliminar ejercicios existentes
    await supabase
      .from('training_session_exercises')
      .delete()
      .eq('session_id', sessionId);

    if (!exercises?.length) {
      return { error: null };
    }

    // Insertar nuevos ejercicios
    const exercisesToInsert = exercises.map((exercise, order) => ({
      session_id: sessionId,
      exercise_order: order + 1,
      running_exercise_id: exercise.type === 'running' ? exercise.exerciseId : null,
      gym_exercise_id: exercise.type === 'gym' ? exercise.exerciseId : null,
      planned_sets: exercise.sets || null,
      planned_reps: exercise.reps || null,
      planned_distance_meters: exercise.distance || null,
      planned_duration_seconds: exercise.durationSeconds || null,
      pace_code: exercise.paceCode || null,
      pace_description: exercise.paceDescription || null,
      rest_seconds: exercise.restSeconds || null,
      notes: exercise.notes || null,
    }));

    const { error } = await supabase
      .from('training_session_exercises')
      .insert(exercisesToInsert);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Error updating session exercises:', error);
    return { error };
  }
};

// Helpers para fechas
export const getWeekStartDate = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar al lunes
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const formatDateForDisplay = (date) => {
  return new Date(date).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  });
};

// Categorías de ejercicios para mostrar en UI
export const RUNNING_CATEGORIES = {
  series_short: 'Series Cortas (80-150m)',
  series_medium: 'Series Medias (200-1000m)',
  series_long: 'Series Largas (1500-5000m)',
  warmup_run: 'Calentamiento',
  easy_run: 'Rodaje Suave',
  long_run: 'Tirada Larga',
  tempo_run: 'Tempo Run',
  fartlek_time: 'Fartlek (Tiempo)',
  fartlek_distance: 'Fartlek (Distancia)',
  hill_repeats: 'Cuestas',
  recovery_run: 'Recuperación',
  race: 'Competición',
  test: 'Test',
};

export const GYM_CATEGORIES = {
  max_strength: 'Fuerza Máxima',
  general_strength: 'Fuerza General',
  explosive_strength: 'Fuerza Explosiva',
  core: 'Core',
  mobility: 'Movilidad',
  plyometrics: 'Pliometría',
};

export const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

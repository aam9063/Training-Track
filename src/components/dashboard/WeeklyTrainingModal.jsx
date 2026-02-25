import { useState, useEffect } from 'react';
import { showSuccess, showError } from '../../lib/toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX,
  FiPlus,
  FiTrash2,
  FiChevronLeft,
  FiChevronRight,
  FiSave,
  FiLoader,
} from 'react-icons/fi';
import {
  getRunningExercises,
  getGymExercises,
  createWeeklyTraining,
  getAthleteWeeklyTraining,
  deleteWeeklyTraining,
  getWeekStartDate,
  RUNNING_CATEGORIES,
  GYM_CATEGORIES,
  DAYS_OF_WEEK,
} from '../../services/weeklyTrainingService';
import { sendPushNotification } from '../../lib/pushNotifications';

const WeeklyTrainingModal = ({
  isOpen,
  onClose,
  athlete,
  coachId,
  onSuccess,
  existingTraining = null,
  initialWeekStartDate = null,
  embedded = false,
  mesocycleContext = null,
  onBack = null,
}) => {
  const [weekStartDate, setWeekStartDate] = useState(initialWeekStartDate || getWeekStartDate());
  const [days, setDays] = useState(initializeEmptyWeek());
  const [runningExercises, setRunningExercises] = useState([]);
  const [gymExercises, setGymExercises] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingWeekData, setExistingWeekData] = useState(null);
  const [activeDay, setActiveDay] = useState(0);

  // Initialize empty week
  function initializeEmptyWeek() {
    return DAYS_OF_WEEK.map(() => ({
      type: 'rest',
      title: '',
      description: '',
      notes: '',
      duration: 0,
      exercises: [],
    }));
  }

  // Sync weekStartDate when initialWeekStartDate changes (from wizard)
  useEffect(() => {
    if (initialWeekStartDate) {
      setWeekStartDate(initialWeekStartDate);
    }
  }, [initialWeekStartDate]);

  // Load exercises on mount
  useEffect(() => {
    if (isOpen) {
      loadExercises();
    }
  }, [isOpen, coachId]);

  // Load existing training when week changes
  useEffect(() => {
    if (isOpen && athlete?.id) {
      loadExistingTraining();
    }
  }, [isOpen, athlete?.id, weekStartDate]);

  const loadExercises = async () => {
    setLoading(true);
    try {
      const [runningRes, gymRes] = await Promise.all([
        getRunningExercises(coachId),
        getGymExercises(coachId),
      ]);

      setRunningExercises(runningRes.data || []);
      setGymExercises(gymRes.data || []);
    } catch (error) {
      console.error('Error loading exercises:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingTraining = async () => {
    try {
      const { data } = await getAthleteWeeklyTraining(coachId, athlete.id, weekStartDate);

      if (data?.length > 0) {
        setExistingWeekData(data);
        // Populate days from existing data
        const newDays = initializeEmptyWeek();

        data.forEach((session) => {
          const sessionDate = new Date(session.scheduled_date);
          const dayIndex = (sessionDate.getDay() + 6) % 7; // Convert to Monday=0

          newDays[dayIndex] = {
            id: session.id,
            type: session.training_type || 'running',
            title: session.title || '',
            description: session.description || '',
            notes: session.notes_coach || '',
            duration: session.estimated_duration_minutes || 0,
            exercises: session.exercises?.map((ex) => ({
              id: ex.id,
              type: ex.running_exercise_id ? 'running' : 'gym',
              exerciseId: ex.running_exercise_id || ex.gym_exercise_id,
              exerciseName:
                ex.running_exercise?.name || ex.gym_exercise?.name || '',
              sets: ex.planned_sets,
              reps: ex.planned_reps,
              distance: ex.planned_distance_meters,
              durationSeconds: ex.planned_duration_seconds,
              paceCode: ex.pace_code,
              paceDescription: ex.pace_description,
              restSeconds: ex.rest_seconds,
              notes: ex.notes,
            })) || [],
          };
        });

        setDays(newDays);
      } else {
        setExistingWeekData(null);
        setDays(initializeEmptyWeek());
      }
    } catch (error) {
      console.error('Error loading existing training:', error);
    }
  };

  const handlePreviousWeek = () => {
    const newDate = new Date(weekStartDate);
    newDate.setDate(newDate.getDate() - 7);
    setWeekStartDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(weekStartDate);
    newDate.setDate(newDate.getDate() + 7);
    setWeekStartDate(newDate);
  };

  const getWeekRange = () => {
    const start = new Date(weekStartDate);
    const end = new Date(weekStartDate);
    end.setDate(end.getDate() + 6);

    return `${start.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
    })} - ${end.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`;
  };

  const updateDay = (dayIndex, field, value) => {
    const newDays = [...days];
    newDays[dayIndex] = { ...newDays[dayIndex], [field]: value };

    // Reset exercises if type changes
    if (field === 'type' && value === 'rest') {
      newDays[dayIndex].exercises = [];
      newDays[dayIndex].title = '';
      newDays[dayIndex].description = '';
    }

    setDays(newDays);
  };

  const addExerciseToDay = (dayIndex, exerciseType) => {
    const newDays = [...days];
    newDays[dayIndex].exercises.push({
      type: exerciseType,
      exerciseId: '',
      exerciseName: '',
      sets: 1,
      reps: 1,
      distance: null,
      durationSeconds: null,
      paceCode: '',
      paceDescription: '',
      restSeconds: 60,
      notes: '',
    });
    setDays(newDays);
  };

  const updateExercise = (dayIndex, exerciseIndex, field, value) => {
    const newDays = [...days];
    newDays[dayIndex].exercises[exerciseIndex][field] = value;

    // Update exercise name when exerciseId changes
    if (field === 'exerciseId') {
      const exerciseType = newDays[dayIndex].exercises[exerciseIndex].type;
      const exerciseList =
        exerciseType === 'running' ? runningExercises : gymExercises;
      const exercise = exerciseList.find((e) => e.id === value);
      newDays[dayIndex].exercises[exerciseIndex].exerciseName =
        exercise?.name || '';
    }

    setDays(newDays);
  };

  const removeExercise = (dayIndex, exerciseIndex) => {
    const newDays = [...days];
    newDays[dayIndex].exercises.splice(exerciseIndex, 1);
    setDays(newDays);
  };

  const addMultipleGymExercises = (dayIndex, exerciseIds, defaults) => {
    const newDays = [...days];
    exerciseIds.forEach((exerciseId) => {
      const exercise = gymExercises.find((e) => e.id === exerciseId);
      newDays[dayIndex].exercises.push({
        type: 'gym',
        exerciseId,
        exerciseName: exercise?.name || '',
        sets: defaults.sets || 3,
        reps: defaults.reps || 10,
        distance: null,
        durationSeconds: null,
        paceCode: '',
        paceDescription: '',
        restSeconds: defaults.restSeconds || 60,
        notes: '',
      });
    });
    setDays(newDays);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete existing training for this week if any
      if (existingWeekData?.length > 0) {
        await deleteWeeklyTraining(coachId, athlete.id, weekStartDate);
      }

      // Create new weekly training
      const weeklyPlan = {
        coachId,
        athleteId: athlete.id,
        weekStartDate,
        days: days.map((day) => ({
          ...day,
          type: day.type === 'rest' && !day.title ? 'rest_empty' : day.type,
        })),
      };

      const { error } = await createWeeklyTraining(weeklyPlan);

      if (error) throw error;

      // Send a single push notification to the athlete
      sendPushNotification(
        [athlete.id],
        'Nuevo entrenamiento asignado',
        'Tu entrenador ha publicado el plan semanal',
        '/athlete/training',
        'tt-training'
      );

      showSuccess('Entrenamiento semanal guardado');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error saving weekly training:', error);
      showError('Error al guardar el entrenamiento semanal');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWeek = async () => {
    if (
      !confirm(
        '¿Estás seguro de que quieres eliminar el entrenamiento de esta semana?'
      )
    )
      return;

    setSaving(true);
    try {
      await deleteWeeklyTraining(coachId, athlete.id, weekStartDate);
      setDays(initializeEmptyWeek());
      setExistingWeekData(null);
      showSuccess('Entrenamiento eliminado');
      onSuccess?.();
    } catch (error) {
      console.error('Error deleting weekly training:', error);
      showError('Error al eliminar el entrenamiento');
    } finally {
      setSaving(false);
    }
  };

  // Group exercises by category
  const groupedRunningExercises = runningExercises.reduce((acc, ex) => {
    const cat = ex.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ex);
    return acc;
  }, {});

  const groupedGymExercises = gymExercises.reduce((acc, ex) => {
    const cat = ex.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ex);
    return acc;
  }, {});

  if (!isOpen) return null;

  const headerContent = (
    <div className={`${embedded ? 'px-4 sm:px-6 pb-4' : 'p-6'} border-b border-gray-200 dark:border-gray-700 flex-shrink-0`}>
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Entrenamiento Semanal
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {athlete?.firstName} {athlete?.lastName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <FiX className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      )}

      {/* Week Navigator */}
      <div className={`flex items-center justify-center space-x-4 ${embedded ? '' : 'mt-4'}`}>
        <button
          onClick={handlePreviousWeek}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <FiChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white min-w-[140px] sm:min-w-[200px] text-center">
          {getWeekRange()}
        </span>
        <button
          onClick={handleNextWeek}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <FiChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  const bodyContent = (
    <div className={`flex-1 overflow-y-auto ${embedded ? 'px-4 sm:px-6 py-4' : 'p-6'}`}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <FiLoader className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              {/* Day Tabs */}
              <div className="flex space-x-1 sm:space-x-2 mb-6 overflow-x-auto pb-2 -mx-1 px-1">
                {DAYS_OF_WEEK.map((day, index) => {
                  const dayDate = new Date(weekStartDate);
                  dayDate.setDate(dayDate.getDate() + index);
                  const hasContent =
                    days[index]?.type !== 'rest' || days[index]?.title;

                  return (
                    <button
                      key={day}
                      onClick={() => setActiveDay(index)}
                      className={`px-2 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                        activeDay === index
                          ? 'bg-blue-600 text-white'
                          : hasContent
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span className="hidden sm:inline">{day}</span>
                      <span className="sm:hidden">{day.slice(0, 3)}</span>
                      <span className="ml-1 sm:ml-2 text-xs opacity-75">
                        {dayDate.getDate()}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active Day Editor */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-6">
                <DayEditor
                  day={days[activeDay]}
                  dayIndex={activeDay}
                  dayName={DAYS_OF_WEEK[activeDay]}
                  updateDay={updateDay}
                  addExerciseToDay={addExerciseToDay}
                  addMultipleGymExercises={addMultipleGymExercises}
                  updateExercise={updateExercise}
                  removeExercise={removeExercise}
                  runningExercises={groupedRunningExercises}
                  gymExercises={groupedGymExercises}
                  gymExercisesFlat={gymExercises}
                  runningCategories={RUNNING_CATEGORIES}
                  gymCategories={GYM_CATEGORIES}
                />
              </div>
            </>
          )}
    </div>
  );

  const footerContent = (
    <div className={`${embedded ? 'px-4 sm:px-6 pt-4 pb-2' : 'p-6'} border-t border-gray-200 dark:border-gray-700 flex-shrink-0`}>
      <div className="flex justify-between">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center space-x-1"
            >
              <FiChevronLeft className="w-4 h-4" />
              <span>Atrás</span>
            </button>
          )}
          {existingWeekData?.length > 0 && (
            <button
              onClick={handleDeleteWeek}
              disabled={saving}
              className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center space-x-2"
            >
              <FiTrash2 className="w-4 h-4" />
              <span>Eliminar Semana</span>
            </button>
          )}
        </div>
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50"
          >
            {saving ? (
              <FiLoader className="w-4 h-4 animate-spin" />
            ) : (
              <FiSave className="w-4 h-4" />
            )}
            <span>{existingWeekData?.length ? 'Actualizar' : 'Guardar'}</span>
          </button>
        </div>
      </div>
    </div>
  );

  // Embedded mode: render without overlay wrapper (used inside TrainingPlanningWizard)
  if (embedded) {
    return (
      <div className="flex flex-col h-full">
        {headerContent}
        {bodyContent}
        {footerContent}
      </div>
    );
  }

  // Standalone mode: render with full-screen overlay
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {headerContent}
        {bodyContent}
        {footerContent}
      </motion.div>
    </div>
  );
};

// Day Editor Component
const DayEditor = ({
  day,
  dayIndex,
  dayName,
  updateDay,
  addExerciseToDay,
  addMultipleGymExercises,
  updateExercise,
  removeExercise,
  runningExercises,
  gymExercises,
  gymExercisesFlat,
  runningCategories,
  gymCategories,
}) => {
  const [gymMultiSelectOpen, setGymMultiSelectOpen] = useState(false);
  const [selectedGymExercises, setSelectedGymExercises] = useState([]);
  const [gymDefaultSets, setGymDefaultSets] = useState(3);
  const [gymDefaultReps, setGymDefaultReps] = useState(10);
  const [gymDefaultRest, setGymDefaultRest] = useState(60);

  // Get already selected gym exercise IDs for this day
  const existingGymExerciseIds = day.exercises
    ?.filter(ex => ex.type === 'gym')
    .map(ex => ex.exerciseId) || [];

  const handleToggleGymExercise = (exerciseId) => {
    setSelectedGymExercises(prev =>
      prev.includes(exerciseId)
        ? prev.filter(id => id !== exerciseId)
        : [...prev, exerciseId]
    );
  };

  const handleAddSelectedGymExercises = () => {
    if (selectedGymExercises.length === 0) return;

    addMultipleGymExercises(dayIndex, selectedGymExercises, {
      sets: gymDefaultSets,
      reps: gymDefaultReps,
      restSeconds: gymDefaultRest,
    });

    setSelectedGymExercises([]);
    setGymMultiSelectOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Training Type */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tipo de Entrenamiento
          </label>
          <select
            value={day.type}
            onChange={(e) => updateDay(dayIndex, 'type', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="rest">Descanso</option>
            <option value="running">Carrera</option>
            <option value="gym">Gimnasio</option>
            <option value="cross_training">Cross Training</option>
          </select>
        </div>

        {day.type !== 'rest' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Título
              </label>
              <input
                type="text"
                value={day.title}
                onChange={(e) => updateDay(dayIndex, 'title', e.target.value)}
                placeholder="Ej: Series 8x400m"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Duración (min)
              </label>
              <input
                type="number"
                value={day.duration || ''}
                onChange={(e) =>
                  updateDay(dayIndex, 'duration', parseInt(e.target.value) || 0)
                }
                placeholder="60"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </>
        )}
      </div>

      {day.type !== 'rest' && (
        <>
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Descripción
            </label>
            <textarea
              value={day.description}
              onChange={(e) => updateDay(dayIndex, 'description', e.target.value)}
              rows={2}
              placeholder="Descripción del entrenamiento..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notas para el atleta
            </label>
            <textarea
              value={day.notes}
              onChange={(e) => updateDay(dayIndex, 'notes', e.target.value)}
              rows={2}
              placeholder="Instrucciones especiales..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            />
          </div>

          {/* Exercises */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Ejercicios
              </label>
              <div className="flex space-x-2">
                {(day.type === 'running' || day.type === 'cross_training') && (
                  <button
                    onClick={() => addExerciseToDay(dayIndex, 'running')}
                    className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors flex items-center space-x-1"
                  >
                    <FiPlus className="w-4 h-4" />
                    <span>Carrera</span>
                  </button>
                )}
                {(day.type === 'gym' || day.type === 'cross_training') && (
                  <button
                    onClick={() => setGymMultiSelectOpen(true)}
                    className="px-3 py-1 text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors flex items-center space-x-1"
                  >
                    <FiPlus className="w-4 h-4" />
                    <span>Añadir Ejercicios</span>
                  </button>
                )}
              </div>
            </div>

            {/* Gym Multi-Select Panel */}
            <AnimatePresence>
              {gymMultiSelectOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-purple-700 dark:text-purple-300">
                      Seleccionar Ejercicios de Gimnasio
                    </h4>
                    <button
                      onClick={() => {
                        setGymMultiSelectOpen(false);
                        setSelectedGymExercises([]);
                      }}
                      className="p-1 text-purple-500 hover:bg-purple-200 dark:hover:bg-purple-800 rounded"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Default values for all selected exercises */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 pb-4 border-b border-purple-200 dark:border-purple-700">
                    <div>
                      <label className="block text-xs text-purple-600 dark:text-purple-400 mb-1">
                        <span className="hidden sm:inline">Series (para todos)</span>
                        <span className="sm:hidden">Series</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={gymDefaultSets}
                        onChange={(e) => setGymDefaultSets(parseInt(e.target.value) || 3)}
                        className="w-full px-3 py-2 text-sm border border-purple-300 dark:border-purple-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-purple-600 dark:text-purple-400 mb-1">
                        <span className="hidden sm:inline">Repeticiones (para todos)</span>
                        <span className="sm:hidden">Reps</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={gymDefaultReps}
                        onChange={(e) => setGymDefaultReps(parseInt(e.target.value) || 10)}
                        className="w-full px-3 py-2 text-sm border border-purple-300 dark:border-purple-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-purple-600 dark:text-purple-400 mb-1">
                        <span className="hidden sm:inline">Descanso seg (para todos)</span>
                        <span className="sm:hidden">Desc.</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={gymDefaultRest}
                        onChange={(e) => setGymDefaultRest(parseInt(e.target.value) || 60)}
                        className="w-full px-3 py-2 text-sm border border-purple-300 dark:border-purple-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Exercise Categories with checkboxes */}
                  <div className="max-h-64 overflow-y-auto space-y-4">
                    {Object.entries(gymExercises).map(([category, exercises]) => (
                      <div key={category}>
                        <h5 className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2">
                          {gymCategories[category] || category}
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {exercises.map((ex) => {
                            const isSelected = selectedGymExercises.includes(ex.id);
                            const isAlreadyAdded = existingGymExerciseIds.includes(ex.id);

                            return (
                              <label
                                key={ex.id}
                                className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${
                                  isAlreadyAdded
                                    ? 'bg-gray-200 dark:bg-gray-600 opacity-50 cursor-not-allowed'
                                    : isSelected
                                    ? 'bg-purple-200 dark:bg-purple-700'
                                    : 'bg-white dark:bg-gray-700 hover:bg-purple-100 dark:hover:bg-purple-800'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={isAlreadyAdded}
                                  onChange={() => handleToggleGymExercise(ex.id)}
                                  className="w-4 h-4 text-purple-600 border-purple-300 rounded focus:ring-purple-500 mr-2"
                                />
                                <span className={`text-sm ${isAlreadyAdded ? 'text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                                  {ex.name}
                                  {isAlreadyAdded && <span className="ml-1 text-xs">(ya añadido)</span>}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add selected button */}
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={handleAddSelectedGymExercises}
                      disabled={selectedGymExercises.length === 0}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      <FiPlus className="w-4 h-4" />
                      <span>
                        Añadir {selectedGymExercises.length > 0 ? `(${selectedGymExercises.length})` : ''} ejercicios
                      </span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Exercise List */}
            <div className="space-y-4">
              <AnimatePresence>
                {day.exercises?.map((exercise, exIndex) => (
                  <motion.div
                    key={exIndex}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`p-4 rounded-lg border ${
                      exercise.type === 'running'
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                        : 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          exercise.type === 'running'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                            : 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                        }`}
                      >
                        {exercise.type === 'running' ? 'Carrera' : 'Gimnasio'}
                      </span>
                      <button
                        onClick={() => removeExercise(dayIndex, exIndex)}
                        className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Exercise Select */}
                      <div className="md:col-span-2">
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                          Ejercicio
                        </label>
                        {exercise.type === 'gym' ? (
                          <div className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white">
                            {exercise.exerciseName || gymExercisesFlat?.find(e => e.id === exercise.exerciseId)?.name || 'Ejercicio'}
                          </div>
                        ) : (
                          <select
                            value={exercise.exerciseId}
                            onChange={(e) =>
                              updateExercise(
                                dayIndex,
                                exIndex,
                                'exerciseId',
                                e.target.value
                              )
                            }
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="">Seleccionar ejercicio...</option>
                            {Object.entries(runningExercises).map(
                              ([category, exercises]) => (
                                <optgroup
                                  key={category}
                                  label={runningCategories[category] || category}
                                >
                                  {exercises.map((ex) => (
                                    <option key={ex.id} value={ex.id}>
                                      {ex.name}
                                    </option>
                                  ))}
                                </optgroup>
                              )
                            )}
                          </select>
                        )}
                      </div>

                      {/* Sets */}
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                          Series
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={exercise.sets || ''}
                          onChange={(e) =>
                            updateExercise(
                              dayIndex,
                              exIndex,
                              'sets',
                              parseInt(e.target.value) || 1
                            )
                          }
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>

                      {/* Reps */}
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                          Repeticiones
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={exercise.reps || ''}
                          onChange={(e) =>
                            updateExercise(
                              dayIndex,
                              exIndex,
                              'reps',
                              parseInt(e.target.value) || 1
                            )
                          }
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>

                      {/* Distance (for running) */}
                      {exercise.type === 'running' && (
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                            Distancia (m)
                          </label>
                          <input
                            type="number"
                            value={exercise.distance || ''}
                            onChange={(e) =>
                              updateExercise(
                                dayIndex,
                                exIndex,
                                'distance',
                                parseInt(e.target.value) || null
                              )
                            }
                            placeholder="400"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                      )}

                      {/* Pace Code (for running) */}
                      {exercise.type === 'running' && (
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                            Ritmo
                          </label>
                          <select
                            value={exercise.paceCode || ''}
                            onChange={(e) =>
                              updateExercise(
                                dayIndex,
                                exIndex,
                                'paceCode',
                                e.target.value
                              )
                            }
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="">Sin ritmo</option>
                            <option value="R1">R1 - Regenerativo</option>
                            <option value="R2">R2 - Aeróbico 1</option>
                            <option value="R3">R3 - Aeróbico 2</option>
                            <option value="R4">R4 - Aeróbico 3</option>
                            <option value="R5">R5 - Umbral</option>
                            <option value="R6">R6 - VO2 Bajo</option>
                            <option value="R7">R7 - VO2 Alto</option>
                            <option value="R8">R8 - Anaeróbico</option>
                            <option value="R9">R9 - Velocidad</option>
                            <option value="R10">R10 - Sprint</option>
                          </select>
                        </div>
                      )}

                      {/* Rest */}
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                          Descanso (seg)
                        </label>
                        <input
                          type="number"
                          value={exercise.restSeconds || ''}
                          onChange={(e) =>
                            updateExercise(
                              dayIndex,
                              exIndex,
                              'restSeconds',
                              parseInt(e.target.value) || 0
                            )
                          }
                          placeholder="60"
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>

                      {/* Notes */}
                      <div className="md:col-span-2">
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                          Notas
                        </label>
                        <input
                          type="text"
                          value={exercise.notes || ''}
                          onChange={(e) =>
                            updateExercise(
                              dayIndex,
                              exIndex,
                              'notes',
                              e.target.value
                            )
                          }
                          placeholder="Notas adicionales..."
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {day.exercises?.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>No hay ejercicios añadidos</p>
                  <p className="text-sm">
                    Usa los botones de arriba para añadir ejercicios
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {day.type === 'rest' && (
        <div className="text-center py-8">
          <span className="text-4xl">💤</span>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Día de descanso</p>
        </div>
      )}
    </div>
  );
};

export default WeeklyTrainingModal;

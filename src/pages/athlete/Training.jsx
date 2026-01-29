import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiCalendar,
  FiLoader,
  FiX,
  FiClock,
  FiTarget,
} from 'react-icons/fi';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../../contexts/AuthContext';
import { getWeeklyTraining, getWeekStartDate, DAYS_OF_WEEK } from '../../services/weeklyTrainingService';

const Training = () => {
  const { profile } = useAuth();
  const [currentWeek, setCurrentWeek] = useState(getWeekStartDate());
  const [trainings, setTrainings] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(null);

  // Load trainings when week changes
  const loadTrainings = useCallback(async () => {
    if (!profile?.id) {
      setTrainings({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await getWeeklyTraining(profile.id, currentWeek);

      if (error) throw error;

      // Convert sessions array to day-indexed object
      const trainingsByDay = {};

      if (data?.length > 0) {
        data.forEach((session) => {
          const sessionDate = new Date(session.scheduled_date);
          const dayIndex = (sessionDate.getDay() + 6) % 7; // Convert to Monday=0

          // Format exercises for display
          const exercises = session.exercises?.map((ex) => {
            const exercise = ex.running_exercise || ex.gym_exercise;
            return {
              name: exercise?.name || 'Ejercicio',
              category: exercise?.category,
              sets: ex.planned_sets,
              reps: ex.planned_reps,
              distance: ex.planned_distance_meters,
              paceCode: ex.pace_code,
              paceDescription: ex.pace_description,
              rest: ex.rest_seconds,
              notes: ex.notes,
            };
          }) || [];

          // Calculate total distance from exercises
          let totalDistance = 0;
          exercises.forEach((ex) => {
            if (ex.distance) {
              totalDistance += (ex.distance * (ex.sets || 1) * (ex.reps || 1));
            }
          });

          trainingsByDay[dayIndex] = {
            id: session.id,
            title: session.title || 'Entrenamiento',
            type: session.training_type,
            description: session.description,
            notes: session.notes_coach,
            duration: session.estimated_duration_minutes,
            exercises,
            totalDistance: totalDistance > 0 ? `${(totalDistance / 1000).toFixed(1)} km` : null,
            totalDistanceMeters: totalDistance,
            status: session.status,
            date: session.scheduled_date,
          };
        });
      }

      setTrainings(trainingsByDay);
    } catch (error) {
      console.error('Error loading trainings:', error);
      setTrainings({});
    } finally {
      setLoading(false);
    }
  }, [profile?.id, currentWeek]);

  useEffect(() => {
    loadTrainings();
  }, [loadTrainings]);

  // Get week days array
  const getWeekDays = (startDate) => {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startDate);
      day.setDate(day.getDate() + i);
      week.push(day);
    }
    return week;
  };

  const weekDays = getWeekDays(currentWeek);

  const nextWeek = () => {
    const next = new Date(currentWeek);
    next.setDate(next.getDate() + 7);
    setCurrentWeek(next);
  };

  const prevWeek = () => {
    const prev = new Date(currentWeek);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeek(prev);
  };

  const openDayDetail = (training, dayIndex) => {
    if (training) {
      setSelectedDay(training);
      setSelectedDayIndex(dayIndex);
    }
  };

  const closeDayDetail = () => {
    setSelectedDay(null);
    setSelectedDayIndex(null);
  };

  const downloadPDF = () => {
    const doc = new jsPDF();

    // Título
    doc.setFontSize(20);
    doc.text('Plan de Entrenamiento Semanal', 14, 20);

    // Fecha de la semana
    doc.setFontSize(12);
    const weekStart = weekDays[0].toLocaleDateString('es-ES');
    const weekEnd = weekDays[6].toLocaleDateString('es-ES');
    doc.text(`Semana: ${weekStart} - ${weekEnd}`, 14, 30);

    // Tabla de entrenamientos
    const tableData = weekDays.map((day, index) => {
      const training = trainings[index];
      if (!training) return [DAYS_OF_WEEK[index], '-', '-', '-', '-'];

      if (training.type === 'rest') {
        return [DAYS_OF_WEEK[index], 'Descanso', '-', '-', '-'];
      }

      const exerciseList = training.exercises
        ?.map((ex) => `${ex.name}${ex.sets ? ` ${ex.sets}x${ex.reps || ''}` : ''}`)
        .join(', ') || '-';

      return [
        DAYS_OF_WEEK[index],
        training.title || '-',
        training.totalDistance || '-',
        training.duration ? `${training.duration} min` : '-',
        exerciseList,
      ];
    });

    autoTable(doc, {
      head: [['Día', 'Entrenamiento', 'Distancia', 'Duración', 'Ejercicios']],
      body: tableData,
      startY: 40,
      theme: 'grid',
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 35 },
        2: { cellWidth: 25 },
        3: { cellWidth: 22 },
        4: { cellWidth: 80 },
      },
    });

    // Footer
    doc.setFontSize(10);
    doc.text(
      `Generado el ${new Date().toLocaleDateString('es-ES')} | TrackPro`,
      14,
      doc.internal.pageSize.height - 10
    );

    doc.save(`plan-entrenamiento-${weekStart}.pdf`);
  };

  const getTypeLabel = (type) => {
    const labels = {
      running: 'Carrera',
      gym: 'Gimnasio',
      rest: 'Descanso',
      cross_training: 'Cross Training',
    };
    return labels[type] || type;
  };

  const getTypeColor = (type) => {
    const colors = {
      running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      gym: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      rest: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400',
      cross_training: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    };
    return colors[type] || colors.running;
  };

  const getPaceLabel = (paceCode) => {
    const paces = {
      R1: 'R1 - Regenerativo',
      R2: 'R2 - Aeróbico 1',
      R3: 'R3 - Aeróbico 2',
      R4: 'R4 - Aeróbico 3',
      R5: 'R5 - Umbral',
      R6: 'R6 - VO2 Bajo',
      R7: 'R7 - VO2 Alto',
      R8: 'R8 - Anaeróbico',
      R9: 'R9 - Velocidad',
      R10: 'R10 - Sprint',
    };
    return paces[paceCode] || paceCode;
  };

  const formatDistance = (meters) => {
    if (!meters) return null;
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${meters} m`;
  };

  const formatRest = (seconds) => {
    if (!seconds) return null;
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return secs > 0 ? `${mins}' ${secs}"` : `${mins} min`;
    }
    return `${seconds} seg`;
  };

  const hasAnyTraining = Object.keys(trainings).length > 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Mis Entrenamientos
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Plan semanal de entrenamiento
          </p>
        </div>
        <button
          onClick={downloadPDF}
          disabled={!hasAnyTraining}
          className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm sm:text-base"
        >
          <FiDownload className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">Descargar PDF</span>
          <span className="sm:hidden">PDF</span>
        </button>
      </div>

      {/* Week Navigator */}
      <div className="flex items-center justify-between mb-4 sm:mb-6 bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <button
          onClick={prevWeek}
          className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <FiChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 dark:text-gray-400" />
        </button>

        <div className="flex items-center space-x-2 text-gray-900 dark:text-white">
          <FiCalendar className="w-4 h-4 sm:w-5 sm:h-5 hidden sm:block" />
          <span className="font-semibold text-xs sm:text-sm lg:text-base text-center">
            {weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
            {' - '}
            {weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>

        <button
          onClick={nextWeek}
          className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <FiChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <FiLoader className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : !hasAnyTraining ? (
        /* Empty State */
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 sm:p-12 text-center border border-gray-200 dark:border-gray-700">
          <div className="max-w-md mx-auto">
            <FiCalendar className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No hay entrenamientos esta semana
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Tu entrenador aún no ha creado un plan para esta semana.
              Prueba a navegar a otras semanas o contacta con tu entrenador.
            </p>
          </div>
        </div>
      ) : (
        /* Weekly Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 sm:gap-4">
          {weekDays.map((day, index) => {
            const training = trainings[index];
            const isRest = training?.type === 'rest';
            const isToday = day.toDateString() === new Date().toDateString();
            const hasTraining = !!training;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => openDayDetail(training, index)}
                className={`
                  bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-2
                  ${isToday
                    ? 'border-blue-500 dark:border-blue-400'
                    : 'border-gray-200 dark:border-gray-700'}
                  ${isRest ? 'bg-gray-50 dark:bg-gray-800/50' : ''}
                  ${hasTraining ? 'cursor-pointer hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500 transition-all' : ''}
                  min-h-[250px] sm:min-h-[280px] lg:min-h-[300px]
                `}
              >
                {/* Day Header */}
                <div className="mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                    {DAYS_OF_WEEK[index]}
                  </p>
                  <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                    {day.getDate()}
                  </p>
                  {isToday && (
                    <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                      Hoy
                    </span>
                  )}
                </div>

                {/* Training Content */}
                {training ? (
                  <div className="space-y-2 sm:space-y-3">
                    {/* Type Badge */}
                    <span className={`inline-block text-xs px-2 py-1 rounded-full ${getTypeColor(training.type)}`}>
                      {getTypeLabel(training.type)}
                    </span>

                    <h3 className={`font-bold text-base sm:text-lg ${
                      isRest
                        ? 'text-gray-500 dark:text-gray-400'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {training.title}
                    </h3>

                    {!isRest && (
                      <>
                        {training.totalDistance && (
                          <div className="flex items-start space-x-2">
                            <span className="text-xs sm:text-sm">📏</span>
                            <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                              {training.totalDistance}
                            </p>
                          </div>
                        )}

                        {training.duration && (
                          <div className="flex items-start space-x-2">
                            <span className="text-xs sm:text-sm">⏰</span>
                            <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                              {training.duration} min
                            </p>
                          </div>
                        )}

                        {/* Exercises Summary */}
                        {training.exercises?.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Ejercicios:</p>
                            <ul className="space-y-1">
                              {training.exercises.slice(0, 3).map((ex, i) => (
                                <li key={i} className="text-xs text-gray-700 dark:text-gray-300 truncate">
                                  • {ex.name}
                                  {ex.sets && <span className="text-gray-500"> ({ex.sets}x{ex.reps || ''})</span>}
                                </li>
                              ))}
                              {training.exercises.length > 3 && (
                                <li className="text-xs text-gray-500 dark:text-gray-400">
                                  +{training.exercises.length - 3} más
                                </li>
                              )}
                            </ul>
                          </div>
                        )}

                        {/* Click indicator */}
                        <div className="mt-2 pt-2 text-center">
                          <span className="text-xs text-blue-500 dark:text-blue-400">
                            Click para ver detalles →
                          </span>
                        </div>
                      </>
                    )}

                    {isRest && (
                      <div className="text-center py-4 sm:py-6">
                        <span className="text-3xl sm:text-4xl">💤</span>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-2">
                          Día de recuperación
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 sm:py-12 text-gray-400">
                    <p className="text-xs sm:text-sm">Sin entrenamiento</p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Training Detail Modal */}
      <AnimatePresence>
        {selectedDay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      {selectedDayIndex !== null && DAYS_OF_WEEK[selectedDayIndex]} -{' '}
                      {selectedDay.date && new Date(selectedDay.date).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {selectedDay.title}
                    </h2>
                    <span className={`inline-block mt-2 text-xs px-3 py-1 rounded-full ${getTypeColor(selectedDay.type)}`}>
                      {getTypeLabel(selectedDay.type)}
                    </span>
                  </div>
                  <button
                    onClick={closeDayDetail}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <FiX className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {selectedDay.type === 'rest' ? (
                  <div className="text-center py-12">
                    <span className="text-6xl mb-4 block">💤</span>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      Día de Descanso
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Aprovecha para recuperarte y prepararte para el próximo entrenamiento.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      {selectedDay.totalDistance && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-1">
                            <FiTarget className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm text-blue-600 dark:text-blue-400">Distancia Total</span>
                          </div>
                          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                            {selectedDay.totalDistance}
                          </p>
                        </div>
                      )}
                      {selectedDay.duration && (
                        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-1">
                            <FiClock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            <span className="text-sm text-purple-600 dark:text-purple-400">Duración</span>
                          </div>
                          <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                            {selectedDay.duration} min
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    {selectedDay.description && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Descripción
                        </h4>
                        <p className="text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                          {selectedDay.description}
                        </p>
                      </div>
                    )}

                    {/* Exercises List */}
                    {selectedDay.exercises?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                          Ejercicios ({selectedDay.exercises.length})
                        </h4>
                        <div className="space-y-3">
                          {selectedDay.exercises.map((exercise, index) => (
                            <div
                              key={index}
                              className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <h5 className="font-medium text-gray-900 dark:text-white">
                                  {index + 1}. {exercise.name}
                                </h5>
                                {exercise.paceCode && (
                                  <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                                    {exercise.paceCode}
                                  </span>
                                )}
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                {exercise.sets && (
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Series:</span>
                                    <span className="ml-1 font-medium text-gray-900 dark:text-white">{exercise.sets}</span>
                                  </div>
                                )}
                                {exercise.reps && (
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Reps:</span>
                                    <span className="ml-1 font-medium text-gray-900 dark:text-white">{exercise.reps}</span>
                                  </div>
                                )}
                                {exercise.distance && (
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Distancia:</span>
                                    <span className="ml-1 font-medium text-gray-900 dark:text-white">{formatDistance(exercise.distance)}</span>
                                  </div>
                                )}
                                {exercise.rest && (
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Descanso:</span>
                                    <span className="ml-1 font-medium text-gray-900 dark:text-white">{formatRest(exercise.rest)}</span>
                                  </div>
                                )}
                              </div>

                              {exercise.paceCode && (
                                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    Ritmo: {getPaceLabel(exercise.paceCode)}
                                  </span>
                                </div>
                              )}

                              {exercise.notes && (
                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 italic">
                                  💡 {exercise.notes}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Coach Notes */}
                    {selectedDay.notes && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                        <h4 className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 mb-2 flex items-center">
                          💬 Notas del Entrenador
                        </h4>
                        <p className="text-yellow-800 dark:text-yellow-300">
                          {selectedDay.notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                <button
                  onClick={closeDayDetail}
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Training;

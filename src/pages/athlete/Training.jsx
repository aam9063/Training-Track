import { useState, useEffect, useCallback, useRef } from 'react';
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
  FiActivity,
  FiHeart,
  FiMapPin,
  FiTrendingUp,
  FiFlag,
  FiExternalLink,
} from 'react-icons/fi';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../../contexts/AuthContext';
import { getWeeklyTraining, getWeekStartDate, DAYS_OF_WEEK } from '../../services/weeklyTrainingService';
import {
  isStravaConnected,
  getStravaActivities,
  getStravaActivityDetail,
  formatStravaActivity,
  formatDuration,
  calculatePace,
  getActivityTypeLabel,
  loadStravaTokens,
} from '../../services/stravaService';
import { saveActivityRPE, getActivitiesRPE, getRPEEmoji } from '../../services/rpeService';
import RPEModal from '../../components/athlete/RPEModal';
import mapboxgl from 'mapbox-gl';
import polyline from '@mapbox/polyline';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

const Training = () => {
  const { profile } = useAuth();
  const [currentWeek, setCurrentWeek] = useState(getWeekStartDate());
  const [trainings, setTrainings] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(null);

  // Strava state
  const [stravaConnected, setStravaConnected] = useState(false);
  const [stravaActivities, setStravaActivities] = useState([]);
  const [loadingStrava, setLoadingStrava] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [visibleActivities, setVisibleActivities] = useState(5);
  const [activitiesRPE, setActivitiesRPE] = useState({});
  const [editRpeActivity, setEditRpeActivity] = useState(null);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  // Load Strava activities
  useEffect(() => {
    const checkStrava = async () => {
      if (!profile?.id) return;
      const { connected } = await loadStravaTokens(profile.id);
      const isConnected = connected || isStravaConnected();
      setStravaConnected(isConnected);

      if (isConnected) {
        setLoadingStrava(true);
        try {
          const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
          const { data: activities, error: activitiesError } = await getStravaActivities({
            after: thirtyDaysAgo,
            per_page: 50,
          });
          if (!activitiesError && activities) {
            const sorted = activities
              .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
              .map(formatStravaActivity);
            setStravaActivities(sorted);

            // Fetch RPE for all activities
            const ids = sorted.map((a) => String(a.id));
            const { data: rpeMap } = await getActivitiesRPE(profile.id, ids);
            setActivitiesRPE(rpeMap || {});
          }
        } catch (err) {
          console.error('Error loading Strava activities:', err);
        }
        setLoadingStrava(false);
      }
    };
    checkStrava();
  }, [profile?.id]);

  // Load activity detail
  const loadActivityDetail = async (activity) => {
    setSelectedActivity({ ...activity, loading: true });
    try {
      const { data, error: detailError } = await getStravaActivityDetail(activity.id);
      if (detailError) throw detailError;
      setSelectedActivity({
        ...activity,
        loading: false,
        laps: data.laps || [],
        splits_metric: data.splits_metric || [],
        segment_efforts: data.segment_efforts || [],
        description: data.description,
        calories: data.calories,
        device_name: data.device_name,
        polyline: data.map?.polyline || data.map?.summary_polyline,
      });
    } catch (err) {
      console.error('Error loading activity details:', err);
      setSelectedActivity({ ...activity, loading: false, error: true });
    }
  };

  // Initialize map when activity with polyline is selected
  useEffect(() => {
    if (!selectedActivity?.polyline || selectedActivity.loading || !mapContainerRef.current) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    try {
      const coordinates = polyline.decode(selectedActivity.polyline).map(([lat, lng]) => [lng, lat]);
      if (coordinates.length === 0) return;
      const bounds = coordinates.reduce((b, coord) => b.extend(coord), new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));
      const map = new mapboxgl.Map({ container: mapContainerRef.current, style: 'mapbox://styles/mapbox/outdoors-v12', bounds, fitBoundsOptions: { padding: 40 } });
      mapRef.current = map;
      map.on('load', () => {
        map.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } } });
        map.addLayer({ id: 'route-outline', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#000', 'line-width': 6, 'line-opacity': 0.3 } });
        map.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#f97316', 'line-width': 4 } });
        new mapboxgl.Marker({ color: '#22c55e' }).setLngLat(coordinates[0]).setPopup(new mapboxgl.Popup().setHTML('<strong>Inicio</strong>')).addTo(map);
        new mapboxgl.Marker({ color: '#ef4444' }).setLngLat(coordinates[coordinates.length - 1]).setPopup(new mapboxgl.Popup().setHTML('<strong>Fin</strong>')).addTo(map);
      });
      map.addControl(new mapboxgl.NavigationControl(), 'top-right');
      map.addControl(new mapboxgl.FullscreenControl(), 'top-right');
    } catch (err) { console.error('Error initializing map:', err); }
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [selectedActivity?.polyline, selectedActivity?.loading]);

  // RPE handler
  const handleEditRPESave = async (score, notes) => {
    if (!editRpeActivity || !profile?.id) return;
    await saveActivityRPE(profile.id, String(editRpeActivity.id), score, notes);
    setActivitiesRPE((prev) => ({ ...prev, [String(editRpeActivity.id)]: { score, notes } }));
    setEditRpeActivity(null);
  };

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

      {/* Mis Últimos Entrenamientos (Strava) */}
      {stravaConnected && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
            <FiActivity className="w-5 h-5 text-[#FC4C02]" />
            <span>Mis Últimos Entrenamientos</span>
            <span className="text-sm font-normal text-gray-500">(últimos 30 días)</span>
          </h2>

          {loadingStrava ? (
            <div className="flex items-center justify-center py-8">
              <FiLoader className="w-6 h-6 animate-spin text-[#FC4C02]" />
              <span className="ml-3 text-gray-500 dark:text-gray-400">Cargando actividades de Strava...</span>
            </div>
          ) : stravaActivities.length === 0 ? (
            <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <FiActivity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                No hay actividades en los últimos 30 días
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {stravaActivities.slice(0, visibleActivities).map((activity) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => loadActivityDetail(activity)}
                  className="p-4 bg-white dark:bg-gray-800 rounded-xl hover:shadow-md cursor-pointer transition-all border-2 border-gray-200 dark:border-gray-700 hover:border-orange-400 dark:hover:border-orange-500"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">
                          {activity.name}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(activity.date).toLocaleDateString('es-ES', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })} · {getActivityTypeLabel(activity.type)}
                        </p>
                      </div>
                      {activitiesRPE[String(activity.id)]?.score ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditRpeActivity(activity); }}
                          className="text-2xl hover:scale-110 transition-transform"
                          title={`Esfuerzo: ${activitiesRPE[String(activity.id)].score}/5 - Click para editar`}
                        >
                          {getRPEEmoji(activitiesRPE[String(activity.id)].score)}
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditRpeActivity(activity); }}
                          className="px-2.5 py-1 text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
                        >
                          Valorar
                        </button>
                      )}
                    </div>
                    {activity.has_heartrate && (
                      <span className="flex items-center text-xs text-red-500">
                        <FiHeart className="w-3 h-3 mr-1" />
                        {activity.average_heartrate} bpm
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {activity.distanceKm}
                      </p>
                      <p className="text-xs text-gray-500">km</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                        {activity.formattedTime}
                      </p>
                      <p className="text-xs text-gray-500">tiempo</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        {activity.pace}
                      </p>
                      <p className="text-xs text-gray-500">ritmo</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                        {activity.total_elevation_gain || 0}
                      </p>
                      <p className="text-xs text-gray-500">m+</p>
                    </div>
                  </div>

                  <div className="mt-2 text-center">
                    <span className="text-xs text-orange-500">Click para ver detalles</span>
                  </div>
                </motion.div>
              ))}

              {/* Load more / pagination */}
              {visibleActivities < stravaActivities.length && (
                <div className="text-center pt-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setVisibleActivities(prev => prev + 5); }}
                    className="px-6 py-2.5 bg-[#FC4C02] hover:bg-[#E34402] text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Cargar más ({stravaActivities.length - visibleActivities} restantes)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Strava Activity Detail Modal */}
      <AnimatePresence>
        {selectedActivity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-[#FC4C02] to-[#E34402]">
                <div className="flex items-start justify-between">
                  <div className="text-white">
                    <h2 className="text-xl font-bold">{selectedActivity.name}</h2>
                    <p className="text-orange-100 text-sm mt-1">
                      {new Date(selectedActivity.date).toLocaleDateString('es-ES', {
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                      })} · {getActivityTypeLabel(selectedActivity.type)}
                    </p>
                  </div>
                  <button onClick={() => setSelectedActivity(null)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                    <FiX className="w-6 h-6 text-white" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar-orange">
                {selectedActivity.loading ? (
                  <div className="flex items-center justify-center py-12">
                    <FiLoader className="w-8 h-8 animate-spin text-orange-500" />
                    <span className="ml-3 text-gray-500">Cargando detalles...</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Main Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{selectedActivity.distanceKm}</p>
                        <p className="text-xs text-blue-500">km</p>
                      </div>
                      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{selectedActivity.formattedTime}</p>
                        <p className="text-xs text-purple-500">tiempo</p>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{selectedActivity.pace}</p>
                        <p className="text-xs text-green-500">ritmo medio</p>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">{selectedActivity.average_heartrate || '-'}</p>
                        <p className="text-xs text-red-500">bpm medio</p>
                      </div>
                    </div>

                    {/* Additional Stats */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <p className="font-semibold text-gray-900 dark:text-white">{selectedActivity.total_elevation_gain || 0}m</p>
                        <p className="text-xs text-gray-500">desnivel+</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <p className="font-semibold text-gray-900 dark:text-white">{selectedActivity.max_heartrate || '-'}</p>
                        <p className="text-xs text-gray-500">FC max</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <p className="font-semibold text-gray-900 dark:text-white">{selectedActivity.calories || '-'}</p>
                        <p className="text-xs text-gray-500">kcal</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <p className="font-semibold text-gray-900 dark:text-white">{selectedActivity.suffer_score || '-'}</p>
                        <p className="text-xs text-gray-500">esfuerzo</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <p className="font-semibold text-gray-900 dark:text-white">{selectedActivity.kudos_count || 0}</p>
                        <p className="text-xs text-gray-500">kudos</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <p className="font-semibold text-gray-900 dark:text-white">{selectedActivity.achievement_count || 0}</p>
                        <p className="text-xs text-gray-500">logros</p>
                      </div>
                    </div>

                    {/* Map */}
                    {selectedActivity.polyline && (
                      <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                          <FiMapPin className="w-4 h-4 mr-2 text-orange-500" />Recorrido
                        </h3>
                        <div ref={mapContainerRef} className="h-64 rounded-lg overflow-hidden" style={{ minHeight: '256px' }} />
                      </div>
                    )}

                    {/* Laps */}
                    {selectedActivity.laps && selectedActivity.laps.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                          <FiActivity className="w-4 h-4 mr-2 text-blue-500" />Vueltas ({selectedActivity.laps.length})
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 dark:bg-gray-700">
                                <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">#</th>
                                <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">Distancia</th>
                                <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">Tiempo</th>
                                <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">Ritmo</th>
                                <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">FC</th>
                                <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">Cadencia</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                              {selectedActivity.laps.map((lap, index) => (
                                <tr key={lap.id || index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                  <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{lap.name || `Vuelta ${index + 1}`}</td>
                                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{(lap.distance / 1000).toFixed(2)} km</td>
                                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{formatDuration(lap.moving_time)}</td>
                                  <td className="px-3 py-2 text-right font-mono text-gray-900 dark:text-white">{calculatePace(lap.moving_time, lap.distance)}</td>
                                  <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">{lap.average_heartrate ? `${Math.round(lap.average_heartrate)}` : '-'}</td>
                                  <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">{lap.average_cadence ? `${Math.round(lap.average_cadence * 2)}` : '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Splits per KM */}
                    {selectedActivity.splits_metric && selectedActivity.splits_metric.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                          <FiTrendingUp className="w-4 h-4 mr-2 text-green-500" />Parciales por Kilómetro
                        </h3>
                        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                          {selectedActivity.splits_metric.map((split, index) => {
                            const pace = calculatePace(split.moving_time, split.distance);
                            const isGoodPace = split.average_heartrate && split.average_heartrate < (selectedActivity.average_heartrate || 150);
                            return (
                              <div key={index} className={`p-2 rounded-lg text-center ${isGoodPace ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                                <p className="text-xs text-gray-500 mb-1">km {index + 1}</p>
                                <p className="font-mono text-sm font-bold text-gray-900 dark:text-white">{pace}</p>
                                {split.average_heartrate && <p className="text-xs text-red-500 mt-1">{Math.round(split.average_heartrate)}</p>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Segments */}
                    {selectedActivity.segment_efforts && selectedActivity.segment_efforts.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                          <FiFlag className="w-4 h-4 mr-2 text-yellow-500" />Segmentos ({selectedActivity.segment_efforts.length})
                        </h3>
                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                          {selectedActivity.segment_efforts.slice(0, 10).map((effort) => (
                            <div key={effort.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                              <div className="flex-1 min-w-0 mr-3">
                                <p className="font-medium text-gray-900 dark:text-white truncate">{effort.segment?.name || effort.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{(effort.segment?.distance || effort.distance) / 1000 || 0} km</p>
                              </div>
                              <div className="text-right">
                                <p className="font-mono font-semibold text-gray-900 dark:text-white">{formatDuration(effort.moving_time || effort.elapsed_time)}</p>
                                {effort.pr_rank && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${effort.pr_rank === 1 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : effort.pr_rank === 2 ? 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                                    PR #{effort.pr_rank}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Strava Link */}
                    <a
                      href={`https://www.strava.com/activities/${selectedActivity.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center space-x-2 w-full py-3 bg-[#FC4C02] hover:bg-[#E34402] text-white rounded-xl transition-colors"
                    >
                      <span>Ver en Strava</span>
                      <FiExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

      {/* RPE Modal */}
      {editRpeActivity && (
        <RPEModal
          activity={editRpeActivity}
          athleteName={profile?.first_name || 'Atleta'}
          onSubmit={handleEditRPESave}
          onClose={() => setEditRpeActivity(null)}
          initialScore={activitiesRPE[String(editRpeActivity.id)]?.score}
          initialNotes={activitiesRPE[String(editRpeActivity.id)]?.notes || ''}
          editMode
        />
      )}
    </div>
  );
};

export default Training;

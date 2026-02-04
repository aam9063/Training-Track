import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiArrowLeft,
  FiChevronLeft,
  FiChevronRight,
  FiCalendar,
  FiClock,
  FiMapPin,
  FiActivity,
  FiHeart,
  FiTrendingUp,
  FiLoader,
  FiMessageCircle,
  FiSearch,
  FiFlag,
  FiTarget,
  FiZap,
  FiX,
} from 'react-icons/fi';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);
import { useAuth } from '../../contexts/AuthContext';
import {
  getAthleteDetails,
  getAthleteStravaActivities,
  getAthleteStravaConnection,
  getAthleteStravaActivityDetail,
  getAthleteMetrics,
  getAthleteEvents,
} from '../../services/athleteService';
import {
  getAthleteWeeklyTraining,
  getWeekStartDate,
  DAYS_OF_WEEK,
} from '../../services/weeklyTrainingService';
import {
  formatStravaActivity,
  formatDuration,
  calculatePace,
  getActivityTypeLabel,
} from '../../services/stravaService';
import mapboxgl from 'mapbox-gl';
import polyline from '@mapbox/polyline';
import 'mapbox-gl/dist/mapbox-gl.css';

// Set Mapbox access token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

const AthleteProfile = () => {
  const { athleteId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  // States
  const [athlete, setAthlete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(getWeekStartDate());
  const [trainings, setTrainings] = useState({});
  const [trainingsLoading, setTrainingsLoading] = useState(true);
  const [stravaActivities, setStravaActivities] = useState([]);
  const [stravaLoading, setStravaLoading] = useState(true);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [metrics, setMetrics] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  // Load athlete data
  useEffect(() => {
    const loadAthlete = async () => {
      if (!athleteId) return;

      setLoading(true);
      try {
        const { data, error } = await getAthleteDetails(athleteId);
        if (error) throw error;
        setAthlete(data);
      } catch (error) {
        console.error('Error loading athlete:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAthlete();
  }, [athleteId]);

  // Load weekly trainings
  const loadTrainings = useCallback(async () => {
    if (!athleteId || !profile?.id) return;

    setTrainingsLoading(true);
    try {
      const { data, error } = await getAthleteWeeklyTraining(profile.id, athleteId, currentWeek);
      if (error) throw error;

      // Convert to day-indexed object
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
          };
        });
      }
      setTrainings(trainingsByDay);
    } catch (error) {
      console.error('Error loading trainings:', error);
    } finally {
      setTrainingsLoading(false);
    }
  }, [athleteId, profile?.id, currentWeek]);

  useEffect(() => {
    loadTrainings();
  }, [loadTrainings]);

  // Load Strava activities
  useEffect(() => {
    const loadStravaData = async () => {
      if (!athleteId) return;

      setStravaLoading(true);
      try {
        // Check connection
        const { data: connection } = await getAthleteStravaConnection(athleteId);
        setStravaConnected(!!connection);

        if (connection) {
          // Get last 30 days
          const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
          const { data: activities } = await getAthleteStravaActivities(athleteId, {
            after: thirtyDaysAgo,
            per_page: 15,
          });

          setStravaActivities(activities?.map(formatStravaActivity) || []);
        }
      } catch (error) {
        console.error('Error loading Strava data:', error);
      } finally {
        setStravaLoading(false);
      }
    };

    loadStravaData();
  }, [athleteId]);

  // Load metrics and events
  useEffect(() => {
    const loadAdditionalData = async () => {
      if (!athleteId) return;

      try {
        const [metricsRes, eventsRes] = await Promise.all([
          getAthleteMetrics(athleteId),
          getAthleteEvents(athleteId),
        ]);

        setMetrics(metricsRes.data || []);
        setEvents(eventsRes.data || []);
      } catch (error) {
        console.error('Error loading additional data:', error);
      }
    };

    loadAdditionalData();
  }, [athleteId]);

  // Load activity details when clicked
  const loadActivityDetail = async (activity) => {
    setSelectedActivity({ ...activity, loading: true });

    try {
      const { data, error } = await getAthleteStravaActivityDetail(athleteId, activity.id);
      if (error) throw error;

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
    } catch (error) {
      console.error('Error loading activity details:', error);
      setSelectedActivity({ ...activity, loading: false, error: true });
    }
  };

  // Initialize map when activity with polyline is selected
  useEffect(() => {
    if (!selectedActivity?.polyline || selectedActivity.loading || !mapContainerRef.current) {
      return;
    }

    // Clean up previous map
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    try {
      // Decode polyline to coordinates
      const coordinates = polyline.decode(selectedActivity.polyline).map(([lat, lng]) => [lng, lat]);

      if (coordinates.length === 0) return;

      // Calculate bounds
      const bounds = coordinates.reduce(
        (bounds, coord) => bounds.extend(coord),
        new mapboxgl.LngLatBounds(coordinates[0], coordinates[0])
      );

      // Create map
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/outdoors-v12',
        bounds: bounds,
        fitBoundsOptions: { padding: 40 },
      });

      mapRef.current = map;

      map.on('load', () => {
        // Add route line
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: coordinates,
            },
          },
        });

        // Route outline (shadow)
        map.addLayer({
          id: 'route-outline',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#000',
            'line-width': 6,
            'line-opacity': 0.3,
          },
        });

        // Main route line
        map.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#f97316',
            'line-width': 4,
          },
        });

        // Start marker
        new mapboxgl.Marker({ color: '#22c55e' })
          .setLngLat(coordinates[0])
          .setPopup(new mapboxgl.Popup().setHTML('<strong>Inicio</strong>'))
          .addTo(map);

        // End marker
        new mapboxgl.Marker({ color: '#ef4444' })
          .setLngLat(coordinates[coordinates.length - 1])
          .setPopup(new mapboxgl.Popup().setHTML('<strong>Fin</strong>'))
          .addTo(map);
      });

      // Add controls
      map.addControl(new mapboxgl.NavigationControl(), 'top-right');
      map.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    } catch (error) {
      console.error('Error initializing map:', error);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [selectedActivity?.polyline, selectedActivity?.loading]);

  // Week navigation
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

  const getTypeColor = (type) => {
    const colors = {
      running: 'bg-blue-500',
      gym: 'bg-purple-500',
      rest: 'bg-gray-400',
      cross_training: 'bg-orange-500',
      race: 'bg-red-500',
    };
    return colors[type] || 'bg-gray-400';
  };

  const getTypeLabel = (type) => {
    const labels = {
      running: 'Carrera',
      gym: 'Gimnasio',
      rest: 'Descanso',
      cross_training: 'Cross',
      race: 'Competición',
    };
    return labels[type] || type;
  };

  // Get week number
  const getWeekNumber = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <FiLoader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!athlete) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Atleta no encontrado</p>
        <button
          onClick={() => navigate('/dashboard/athletes')}
          className="mt-4 text-blue-600 hover:underline"
        >
          Volver a mis atletas
        </button>
      </div>
    );
  }

  const athleteName = `${athlete.user?.first_name || ''} ${athlete.user?.last_name || ''}`.trim() || 'Atleta';
  const initials = `${athlete.user?.first_name?.[0] || ''}${athlete.user?.last_name?.[0] || ''}`.toUpperCase() || 'AT';

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/dashboard/athletes')}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <FiArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div className="flex items-center space-x-4">
            {athlete.user?.profile_image ? (
              <img
                src={athlete.user.profile_image}
                alt={athleteName}
                className="w-16 h-16 rounded-full object-cover border-2 border-blue-500"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                {initials}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {athleteName}
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                {athlete.specialties?.join(' - ') || 'Sin especialidades'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Icons */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {/* TODO: Historic trainings */}}
            className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-200 dark:border-gray-700 group"
            title="Histórico de entrenamientos"
          >
            <FiSearch className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-blue-600" />
          </button>
          <button
            onClick={() => {/* TODO: Messages */}}
            className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-200 dark:border-gray-700 group"
            title="Enviar mensaje"
          >
            <FiMessageCircle className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-blue-600" />
          </button>
        </div>
      </div>

      {/* Main Content - Collage Layout */}
      <div className="grid grid-cols-12 gap-4 lg:gap-6">
        {/* Weekly Training Grid - Spans full width */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="col-span-12 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          {/* Week Navigator */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
              <FiCalendar className="w-5 h-5 mr-2 text-blue-600" />
              Planificación Semanal
            </h2>
            <div className="flex items-center space-x-4">
              <button
                onClick={prevWeek}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <FiChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <span className="font-medium text-gray-700 dark:text-gray-300 min-w-[200px] text-center">
                Semana {getWeekNumber(currentWeek)} ({weekDays[0].toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} - {weekDays[6].toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })})
              </span>
              <button
                onClick={nextWeek}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <FiChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Week Grid */}
          {trainingsLoading ? (
            <div className="flex items-center justify-center py-12">
              <FiLoader className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="grid grid-cols-7 divide-x divide-gray-200 dark:divide-gray-700">
              {weekDays.map((day, index) => {
                const training = trainings[index];
                const isToday = day.toDateString() === new Date().toDateString();

                return (
                  <div
                    key={index}
                    className={`min-h-[180px] p-3 ${isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  >
                    {/* Day Header */}
                    <div className="text-center mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                        {DAYS_OF_WEEK[index].slice(0, 3)}
                      </p>
                      <p className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-900 dark:text-white'}`}>
                        {day.getDate()}
                      </p>
                    </div>

                    {/* Training Content */}
                    {training ? (
                      <div className="space-y-2">
                        <div className={`h-1.5 rounded-full ${getTypeColor(training.type)}`} />
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          {getTypeLabel(training.type)}
                        </p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">
                          {training.title}
                        </p>
                        {training.duration && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                            <FiClock className="w-3 h-3 mr-1" />
                            {training.duration} min
                          </p>
                        )}
                        {training.exercises?.length > 0 && (
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {training.exercises.length} ejercicio{training.exercises.length > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-24 text-gray-300 dark:text-gray-600">
                        <span className="text-xs">Sin entreno</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Strava Activities - Large section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="col-span-12 lg:col-span-7 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-orange-500 to-orange-600">
            <h2 className="text-lg font-bold text-white flex items-center">
              <FiActivity className="w-5 h-5 mr-2" />
              Últimos Entrenamientos (Strava)
            </h2>
          </div>

          <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar-orange">
            {stravaLoading ? (
              <div className="flex items-center justify-center py-8">
                <FiLoader className="w-6 h-6 animate-spin text-orange-500" />
              </div>
            ) : !stravaConnected ? (
              <div className="text-center py-8">
                <FiActivity className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  Este atleta no ha conectado Strava
                </p>
              </div>
            ) : stravaActivities.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">
                  No hay actividades recientes
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {stravaActivities.map((activity) => (
                  <div
                    key={activity.id}
                    onClick={() => loadActivityDetail(activity)}
                    className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer border-2 border-transparent hover:border-orange-400"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">
                          {activity.name}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(activity.date).toLocaleDateString('es-ES', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })} • {getActivityTypeLabel(activity.type)}
                        </p>
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Metrics Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="col-span-12 lg:col-span-5 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
              <FiTrendingUp className="w-5 h-5 mr-2 text-green-600" />
              Métricas
            </h2>
            <button
              onClick={() => navigate(`/dashboard/athletes/${athleteId}/metrics`)}
              className="text-sm text-blue-600 hover:underline"
            >
              Ver todo →
            </button>
          </div>

          <div className="p-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {athlete.vo2_max && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                  <p className="text-xs text-green-600 dark:text-green-400 mb-1">VO2 Max</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {athlete.vo2_max}
                  </p>
                </div>
              )}
              {athlete.resting_heart_rate && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                  <p className="text-xs text-red-600 dark:text-red-400 mb-1">FC Reposo</p>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                    {athlete.resting_heart_rate} <span className="text-sm font-normal">bpm</span>
                  </p>
                </div>
              )}
              {athlete.max_heart_rate && (
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                  <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">FC Max</p>
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                    {athlete.max_heart_rate} <span className="text-sm font-normal">bpm</span>
                  </p>
                </div>
              )}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Actividades</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {stravaActivities.length}
                  <span className="text-sm font-normal ml-1">este mes</span>
                </p>
              </div>
            </div>

            {/* Mini Chart */}
            {metrics.length > 0 && (
              <div className="h-32">
                <Line
                  data={{
                    labels: metrics.slice(-7).map((_, i) => `D${i + 1}`),
                    datasets: [
                      {
                        data: metrics.slice(-7).map((m) => m.distance_meters || 0),
                        borderColor: '#3B82F6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                    },
                    scales: {
                      x: { display: false },
                      y: { display: false },
                    },
                  }}
                />
              </div>
            )}
          </div>
        </motion.div>

        {/* Upcoming Events */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="col-span-12 lg:col-span-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-red-500 to-pink-500">
            <h2 className="text-lg font-bold text-white flex items-center">
              <FiFlag className="w-5 h-5 mr-2" />
              Próximos Eventos
            </h2>
          </div>

          <div className="p-4">
            {events.length === 0 ? (
              <div className="text-center py-6">
                <FiFlag className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No hay eventos programados
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border-l-4 border-red-500"
                  >
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {event.title}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(event.scheduled_date).toLocaleDateString('es-ES', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Personal Bests */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="col-span-12 lg:col-span-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
              <FiTarget className="w-5 h-5 mr-2 text-yellow-500" />
              Mejores Marcas
            </h2>
          </div>

          <div className="p-4">
            {athlete.personal_bests?.length === 0 ? (
              <div className="text-center py-6">
                <FiTarget className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Sin marcas registradas
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {athlete.personal_bests?.slice(0, 5).map((pb) => (
                  <div
                    key={pb.id}
                    className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg"
                  >
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {pb.distance_name || `${pb.distance_meters}m`}
                    </span>
                    <span className="font-mono font-bold text-gray-900 dark:text-white">
                      {pb.time_formatted || formatDuration(pb.time_seconds)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Training Zones / Paces */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="col-span-12 lg:col-span-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
              <FiZap className="w-5 h-5 mr-2 text-blue-500" />
              Ritmos de Entrenamiento
            </h2>
          </div>

          <div className="p-4">
            {athlete.athlete_paces?.length === 0 ? (
              <div className="text-center py-6">
                <FiZap className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Sin ritmos configurados
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {athlete.athlete_paces?.map((pace) => (
                  <div
                    key={pace.id}
                    className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg"
                  >
                    <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                      pace.pace_code?.startsWith('R')
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {pace.pace_code}
                    </span>
                    <span className="font-mono text-sm text-gray-900 dark:text-white">
                      {pace.pace_per_km || '-'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Activity Detail Modal */}
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
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-orange-500 to-orange-600">
                <div className="flex items-start justify-between">
                  <div className="text-white">
                    <h2 className="text-xl font-bold">{selectedActivity.name}</h2>
                    <p className="text-orange-100 text-sm mt-1">
                      {new Date(selectedActivity.date).toLocaleDateString('es-ES', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })} • {getActivityTypeLabel(selectedActivity.type)}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedActivity(null)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
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
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {selectedActivity.distanceKm}
                        </p>
                        <p className="text-xs text-blue-500">km</p>
                      </div>
                      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {selectedActivity.formattedTime}
                        </p>
                        <p className="text-xs text-purple-500">tiempo</p>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {selectedActivity.pace}
                        </p>
                        <p className="text-xs text-green-500">ritmo medio</p>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {selectedActivity.average_heartrate || '-'}
                        </p>
                        <p className="text-xs text-red-500">bpm medio</p>
                      </div>
                    </div>

                    {/* Additional Stats */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {selectedActivity.total_elevation_gain || 0}m
                        </p>
                        <p className="text-xs text-gray-500">desnivel+</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {selectedActivity.max_heartrate || '-'}
                        </p>
                        <p className="text-xs text-gray-500">FC max</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {selectedActivity.calories || '-'}
                        </p>
                        <p className="text-xs text-gray-500">kcal</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {selectedActivity.suffer_score || '-'}
                        </p>
                        <p className="text-xs text-gray-500">esfuerzo</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {selectedActivity.kudos_count || 0}
                        </p>
                        <p className="text-xs text-gray-500">kudos</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {selectedActivity.achievement_count || 0}
                        </p>
                        <p className="text-xs text-gray-500">logros</p>
                      </div>
                    </div>

                    {/* Activity Map */}
                    {selectedActivity.polyline && (
                      <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                          <FiMapPin className="w-4 h-4 mr-2 text-orange-500" />
                          Recorrido
                        </h3>
                        <div
                          ref={mapContainerRef}
                          className="h-64 rounded-lg overflow-hidden"
                          style={{ minHeight: '256px' }}
                        />
                      </div>
                    )}

                    {/* Laps / Splits */}
                    {selectedActivity.laps && selectedActivity.laps.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                          <FiActivity className="w-4 h-4 mr-2 text-blue-500" />
                          Vueltas ({selectedActivity.laps.length})
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
                                  <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                                    {lap.name || `Vuelta ${index + 1}`}
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                                    {(lap.distance / 1000).toFixed(2)} km
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                                    {formatDuration(lap.moving_time)}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-gray-900 dark:text-white">
                                    {calculatePace(lap.moving_time, lap.distance)}
                                  </td>
                                  <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">
                                    {lap.average_heartrate ? `${Math.round(lap.average_heartrate)}` : '-'}
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                                    {lap.average_cadence ? `${Math.round(lap.average_cadence * 2)}` : '-'}
                                  </td>
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
                          <FiTrendingUp className="w-4 h-4 mr-2 text-green-500" />
                          Parciales por Kilómetro
                        </h3>
                        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                          {selectedActivity.splits_metric.map((split, index) => {
                            const pace = calculatePace(split.moving_time, split.distance);
                            const isGoodPace = split.average_heartrate && split.average_heartrate < (selectedActivity.average_heartrate || 150);
                            return (
                              <div
                                key={index}
                                className={`p-2 rounded-lg text-center ${
                                  isGoodPace
                                    ? 'bg-green-50 dark:bg-green-900/20'
                                    : 'bg-gray-50 dark:bg-gray-700/50'
                                }`}
                              >
                                <p className="text-xs text-gray-500 mb-1">km {index + 1}</p>
                                <p className="font-mono text-sm font-bold text-gray-900 dark:text-white">
                                  {pace}
                                </p>
                                {split.average_heartrate && (
                                  <p className="text-xs text-red-500 mt-1">
                                    {Math.round(split.average_heartrate)}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Segment Efforts */}
                    {selectedActivity.segment_efforts && selectedActivity.segment_efforts.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                          <FiFlag className="w-4 h-4 mr-2 text-yellow-500" />
                          Segmentos ({selectedActivity.segment_efforts.length})
                        </h3>
                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                          {selectedActivity.segment_efforts.slice(0, 10).map((effort) => (
                            <div
                              key={effort.id}
                              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                            >
                              <div className="flex-1">
                                <p className="font-medium text-gray-900 dark:text-white text-sm">
                                  {effort.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {(effort.segment?.distance / 1000).toFixed(2)} km
                                  {effort.segment?.average_grade && ` • ${effort.segment.average_grade.toFixed(1)}%`}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-mono font-bold text-gray-900 dark:text-white">
                                  {formatDuration(effort.moving_time)}
                                </p>
                                {effort.pr_rank && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    effort.pr_rank === 1
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : effort.pr_rank === 2
                                      ? 'bg-gray-100 text-gray-700'
                                      : effort.pr_rank === 3
                                      ? 'bg-orange-100 text-orange-700'
                                      : 'bg-blue-100 text-blue-700'
                                  }`}>
                                    PR #{effort.pr_rank}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                          {selectedActivity.segment_efforts.length > 10 && (
                            <p className="text-center text-sm text-gray-500">
                              +{selectedActivity.segment_efforts.length - 10} segmentos más
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Description */}
                    {selectedActivity.description && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4">
                        <h3 className="font-semibold text-yellow-700 dark:text-yellow-400 mb-2">
                          Descripción
                        </h3>
                        <p className="text-gray-700 dark:text-gray-300 text-sm">
                          {selectedActivity.description}
                        </p>
                      </div>
                    )}

                    {/* Device */}
                    {selectedActivity.device_name && (
                      <p className="text-xs text-gray-400 text-center">
                        Registrado con {selectedActivity.device_name}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setSelectedActivity(null)}
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

export default AthleteProfile;

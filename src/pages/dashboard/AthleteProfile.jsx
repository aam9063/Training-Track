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
  FiPlus,
  FiTrash2,
  FiAward,
  FiSend,
  FiUser,
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
  getAthleteCompetitions,
  createAthleteCompetition,
  deleteAthleteCompetition,
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
  calculateStravaMetrics,
  extractBestEfforts,
} from '../../services/stravaService';
import mapboxgl from 'mapbox-gl';
import polyline from '@mapbox/polyline';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../../lib/supabase';
import { getActivitiesRPE, getRPEEmoji, getRPELabel } from '../../services/rpeService';

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
  const [stravaMetrics, setStravaMetrics] = useState(null);
  const [stravaBestEfforts, setStravaBestEfforts] = useState([]);
  const [activitiesRPE, setActivitiesRPE] = useState({});
  const [rpeDetailActivity, setRpeDetailActivity] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ name: '', date: '', distance: '', location: '', notes: '' });
  const [savingEvent, setSavingEvent] = useState(false);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  // Message modal states
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageData, setMessageData] = useState({ subject: '', content: '' });
  const [sendingMessage, setSendingMessage] = useState(false);

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
          // Get latest activities (30 for metrics calculation)
          const { data: activities } = await getAthleteStravaActivities(athleteId, {
            per_page: 30,
          });

          if (activities?.length > 0) {
            const formatted = activities.slice(0, 15).map(formatStravaActivity);
            setStravaActivities(formatted);
            // Calculate metrics from all 30 activities
            setStravaMetrics(calculateStravaMetrics(activities));
            // Extract best efforts/personal bests
            setStravaBestEfforts(extractBestEfforts(activities));

            // Fetch RPE for displayed activities
            const ids = formatted.map((a) => String(a.id));
            const { data: rpeMap } = await getActivitiesRPE(athleteId, ids);
            setActivitiesRPE(rpeMap || {});
          } else {
            setStravaActivities([]);
            setStravaMetrics(null);
            setStravaBestEfforts([]);
          }
        }
      } catch (error) {
        console.error('Error loading Strava data:', error);
      } finally {
        setStravaLoading(false);
      }
    };

    loadStravaData();
  }, [athleteId]);

  // Load competitions
  const loadCompetitions = useCallback(async () => {
    if (!athleteId) return;
    try {
      const { data, error } = await getAthleteCompetitions(athleteId);
      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error loading competitions:', error);
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
      } catch (error) {
        console.error('Error loading additional data:', error);
      }
    };

    loadAdditionalData();
  }, [athleteId]);

  // Handle save competition
  const handleSaveEvent = async () => {
    if (!newEvent.name || !newEvent.date) return;

    setSavingEvent(true);
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

      // Reset form and close modal
      setNewEvent({ name: '', date: '', distance: '', location: '', notes: '' });
      setShowEventModal(false);

      // Reload competitions
      await loadCompetitions();
    } catch (error) {
      console.error('Error saving competition:', error);
    } finally {
      setSavingEvent(false);
    }
  };

  // Handle delete competition
  const handleDeleteEvent = async (competitionId) => {
    if (!confirm('¿Eliminar esta competición?')) return;

    try {
      const { error } = await deleteAthleteCompetition(competitionId);
      if (error) throw error;

      // Reload competitions
      await loadCompetitions();
    } catch (error) {
      console.error('Error deleting competition:', error);
    }
  };

  // Handle send message to athlete
  const handleSendMessage = async () => {
    if (!messageData.subject || !messageData.content) return;

    setSendingMessage(true);
    try {
      const { error } = await supabase.from('coach_messages').insert({
        coach_id: profile.id,
        athlete_id: athleteId,
        subject: messageData.subject,
        content: messageData.content,
        read: false,
      });

      if (error) throw error;

      // Reset form and close modal
      setMessageData({ subject: '', content: '' });
      setShowMessageModal(false);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

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
              {athlete.race_distances?.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {athlete.race_distances.map((dist) => (
                    <span key={dist} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                      {dist}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Sin distancias configuradas
                </p>
              )}
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
            onClick={() => setShowMessageModal(true)}
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
                            })} • {getActivityTypeLabel(activity.type)}
                          </p>
                        </div>
                        {activitiesRPE[String(activity.id)]?.score && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setRpeDetailActivity(activity); }}
                            className="text-2xl hover:scale-110 transition-transform"
                            title={`Esfuerzo: ${getRPELabel(activitiesRPE[String(activity.id)].score)} - Click para ver detalles`}
                          >
                            {getRPEEmoji(activitiesRPE[String(activity.id)].score)}
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Personal Data + Metrics Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="col-span-12 lg:col-span-5 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          {/* Personal Data */}
          {(athlete.date_of_birth || athlete.weight || athlete.height) && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center">
                <FiUser className="w-4 h-4 mr-1.5" />
                Datos Personales
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {athlete.date_of_birth && (
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Edad</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {Math.floor((new Date() - new Date(athlete.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000))}
                    </p>
                    <p className="text-[10px] text-gray-400">{new Date(athlete.date_of_birth).toLocaleDateString('es-ES')}</p>
                  </div>
                )}
                {athlete.weight && (
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Peso</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {athlete.weight} <span className="text-xs font-normal">kg</span>
                    </p>
                  </div>
                )}
                {athlete.height && (
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Estatura</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {athlete.height} <span className="text-xs font-normal">cm</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

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

          <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
            {stravaMetrics ? (
              <>
                {/* Main Strava Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
                    <p className="text-xs text-orange-600 dark:text-orange-400 mb-1">Distancia Total</p>
                    <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                      {stravaMetrics.totalDistanceKm}
                      <span className="text-sm font-normal ml-1">km</span>
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Tiempo Total</p>
                    <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                      {stravaMetrics.totalTimeFormatted}
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                    <p className="text-xs text-green-600 dark:text-green-400 mb-1">Ritmo Medio</p>
                    <p className="text-xl font-bold text-green-700 dark:text-green-300">
                      {stravaMetrics.avgPace || '-'}
                    </p>
                  </div>
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                    <p className="text-xs text-red-600 dark:text-red-400 mb-1">FC Media</p>
                    <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                      {stravaMetrics.avgHeartrate || '-'}
                      {stravaMetrics.avgHeartrate && <span className="text-sm font-normal ml-1">bpm</span>}
                    </p>
                  </div>
                </div>

                {/* Additional Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {stravaMetrics.totalActivities}
                    </p>
                    <p className="text-xs text-gray-500">Actividades</p>
                  </div>
                  <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {stravaMetrics.totalElevation}m
                    </p>
                    <p className="text-xs text-gray-500">Desnivel</p>
                  </div>
                  <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {stravaMetrics.avgDistanceKm}km
                    </p>
                    <p className="text-xs text-gray-500">Media/Activ.</p>
                  </div>
                </div>

                {/* Weekly Stats Chart */}
                {stravaMetrics.weeklyStats?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Volumen Semanal (km)
                    </p>
                    <div className="h-24">
                      <Line
                        data={{
                          labels: stravaMetrics.weeklyStats.slice().reverse().map(w => w.weekNumber),
                          datasets: [
                            {
                              data: stravaMetrics.weeklyStats.slice().reverse().map(w => parseFloat(w.distanceKm)),
                              borderColor: '#f97316',
                              backgroundColor: 'rgba(249, 115, 22, 0.1)',
                              fill: true,
                              tension: 0.4,
                              pointRadius: 4,
                              pointBackgroundColor: '#f97316',
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
                            x: {
                              display: true,
                              ticks: { font: { size: 9 } },
                              grid: { display: false },
                            },
                            y: {
                              display: true,
                              ticks: { font: { size: 9 } },
                              grid: { color: 'rgba(0,0,0,0.05)' },
                            },
                          },
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Best Performances */}
                {(stravaMetrics.longestRun || stravaMetrics.fastestPace) && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Mejores Resultados (últimas actividades)
                    </p>
                    {stravaMetrics.longestRun && (
                      <div className="flex items-center justify-between p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <div className="flex items-center">
                          <FiTarget className="w-4 h-4 text-yellow-600 mr-2" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">Más larga</span>
                        </div>
                        <span className="text-sm font-bold text-yellow-700 dark:text-yellow-300">
                          {stravaMetrics.longestRun.distanceKm} km
                        </span>
                      </div>
                    )}
                    {stravaMetrics.fastestPace && (
                      <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="flex items-center">
                          <FiZap className="w-4 h-4 text-green-600 mr-2" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">Más rápida</span>
                        </div>
                        <span className="text-sm font-bold text-green-700 dark:text-green-300">
                          {stravaMetrics.fastestPace.pace}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Fallback to athlete data if no Strava */}
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
                    </p>
                  </div>
                </div>

                {/* Mini Chart from metrics */}
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

                {!stravaConnected && (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                    <FiActivity className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>Sin conexión a Strava</p>
                  </div>
                )}
              </>
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
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-red-500 to-pink-500 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center">
              <FiFlag className="w-5 h-5 mr-2" />
              Próximos Eventos
            </h2>
            <button
              onClick={() => setShowEventModal(true)}
              className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              title="Añadir evento"
            >
              <FiPlus className="w-4 h-4 text-white" />
            </button>
          </div>

          <div className="p-4 max-h-[250px] overflow-y-auto custom-scrollbar">
            {events.length === 0 ? (
              <div className="text-center py-6">
                <FiFlag className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No hay eventos programados
                </p>
                <button
                  onClick={() => setShowEventModal(true)}
                  className="mt-3 text-sm text-red-500 hover:text-red-600 font-medium"
                >
                  + Añadir competición
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((competition) => (
                  <div
                    key={competition.id}
                    className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border-l-4 border-red-500 group relative"
                  >
                    <button
                      onClick={() => handleDeleteEvent(competition.id)}
                      className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Eliminar competición"
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                    </button>
                    <p className="font-semibold text-gray-900 dark:text-white pr-6">
                      {competition.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(competition.event_date).toLocaleDateString('es-ES', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}
                    </p>
                    {competition.distance_km && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-medium">
                        {competition.distance_km} km
                      </p>
                    )}
                    {competition.location && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        📍 {competition.location}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Personal Bests - From Strava */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="col-span-12 lg:col-span-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-yellow-500 to-amber-500">
            <h2 className="text-lg font-bold text-white flex items-center">
              <FiAward className="w-5 h-5 mr-2" />
              Mejores Marcas
            </h2>
          </div>

          <div className="p-4 max-h-[250px] overflow-y-auto custom-scrollbar">
            {stravaBestEfforts.length > 0 ? (
              <div className="space-y-2">
                {stravaBestEfforts.map((effort, index) => (
                  <div
                    key={effort.name + index}
                    className="flex items-center justify-between p-2.5 bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded-lg transition-colors"
                  >
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {effort.name}
                      </span>
                      {effort.pace && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {effort.pace}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-yellow-700 dark:text-yellow-300">
                        {effort.timeFormatted}
                      </span>
                      {effort.date && (
                        <p className="text-xs text-gray-400">
                          {new Date(effort.date).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : athlete.personal_bests?.length > 0 ? (
              <div className="space-y-2">
                {athlete.personal_bests.slice(0, 5).map((pb) => (
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
            ) : (
              <div className="text-center py-6">
                <FiAward className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {stravaConnected
                    ? 'No hay suficientes datos para calcular marcas'
                    : 'Conecta Strava para ver marcas'}
                </p>
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

      {/* Event Modal */}
      <AnimatePresence>
        {showEventModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-red-500 to-pink-500">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white flex items-center">
                    <FiFlag className="w-5 h-5 mr-2" />
                    Nueva Competición
                  </h2>
                  <button
                    onClick={() => setShowEventModal(false)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <FiX className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-5 space-y-4">
                {/* Event Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nombre del evento *
                  </label>
                  <input
                    type="text"
                    value={newEvent.name}
                    onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                    placeholder="Ej: Media Maratón Valencia"
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                {/* Event Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                {/* Distance and Location in a row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Distancia (km)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={newEvent.distance}
                      onChange={(e) => setNewEvent({ ...newEvent, distance: e.target.value })}
                      placeholder="21.1"
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Ubicación
                    </label>
                    <input
                      type="text"
                      value={newEvent.location}
                      onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                      placeholder="Valencia"
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notas
                  </label>
                  <textarea
                    value={newEvent.notes}
                    onChange={(e) => setNewEvent({ ...newEvent, notes: e.target.value })}
                    placeholder="Objetivo, tiempo esperado, etc."
                    rows={2}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex space-x-3">
                <button
                  onClick={() => setShowEventModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEvent}
                  disabled={!newEvent.name || !newEvent.date || savingEvent}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg hover:from-red-600 hover:to-pink-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {savingEvent ? (
                    <>
                      <FiLoader className="w-4 h-4 animate-spin mr-2" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Message Modal */}
      <AnimatePresence>
        {showMessageModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Enviar Mensaje
                </h2>
                <button
                  onClick={() => setShowMessageModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <FiX className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Recipient info */}
                <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-semibold text-sm">
                      {athlete?.user?.first_name?.[0] || 'A'}{athlete?.user?.last_name?.[0] || ''}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Para: {athlete?.user?.first_name} {athlete?.user?.last_name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Atleta</p>
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Asunto
                  </label>
                  <input
                    type="text"
                    value={messageData.subject}
                    onChange={(e) => setMessageData({ ...messageData, subject: e.target.value })}
                    placeholder="Asunto del mensaje"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Mensaje
                  </label>
                  <textarea
                    value={messageData.content}
                    onChange={(e) => setMessageData({ ...messageData, content: e.target.value })}
                    placeholder="Escribe tu mensaje..."
                    rows={5}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowMessageModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !messageData.subject || !messageData.content}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
                >
                  {sendingMessage ? (
                    <FiLoader className="w-5 h-5 animate-spin" />
                  ) : (
                    <FiSend className="w-5 h-5" />
                  )}
                  <span>Enviar</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RPE Detail Modal (Coach read-only) */}
      <AnimatePresence>
        {rpeDetailActivity && activitiesRPE[String(rpeDetailActivity.id)] && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="bg-gradient-to-r from-[#FC4C02] to-[#E34402] p-4 text-white relative">
                <button
                  onClick={() => setRpeDetailActivity(null)}
                  className="absolute top-3 right-3 p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <FiX className="w-5 h-5" />
                </button>
                <p className="font-bold">Percepción de Esfuerzo</p>
                <p className="text-white/80 text-sm mt-1">{rpeDetailActivity.name}</p>
              </div>
              <div className="p-5 text-center">
                <span className="text-5xl">
                  {getRPEEmoji(activitiesRPE[String(rpeDetailActivity.id)].score)}
                </span>
                <p className="mt-2 font-semibold text-gray-900 dark:text-white">
                  {getRPELabel(activitiesRPE[String(rpeDetailActivity.id)].score)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {activitiesRPE[String(rpeDetailActivity.id)].score}/5
                </p>
                {activitiesRPE[String(rpeDetailActivity.id)].notes && (
                  <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-left">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Sensaciones del atleta:</p>
                    <p className="text-sm text-gray-800 dark:text-gray-200">
                      {activitiesRPE[String(rpeDetailActivity.id)].notes}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => setRpeDetailActivity(null)}
                  className="mt-4 px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
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

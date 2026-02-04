import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiActivity,
  FiCheckCircle,
  FiAlertCircle,
  FiRefreshCw,
  FiExternalLink,
  FiClock,
  FiMapPin,
  FiHeart,
  FiTrendingUp,
  FiChevronRight,
  FiLoader,
  FiX,
  FiFlag,
} from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import {
  getStravaAuthUrl,
  exchangeStravaCode,
  isStravaConnected,
  getStoredAthlete,
  disconnectStrava,
  getStravaActivities,
  getStravaAthleteStats,
  getStravaActivityDetail,
  formatStravaActivity,
  formatDuration,
  calculatePace,
  getActivityTypeLabel,
  loadStravaTokens,
} from '../../services/stravaService';
import mapboxgl from 'mapbox-gl';
import polyline from '@mapbox/polyline';
import 'mapbox-gl/dist/mapbox-gl.css';

// Set Mapbox access token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

const Devices = () => {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stravaConnected, setStravaConnected] = useState(false);
  const [stravaAthlete, setStravaAthlete] = useState(null);
  const [stravaActivities, setStravaActivities] = useState([]);
  const [stravaStats, setStravaStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  const loadStravaData = useCallback(async () => {
    setSyncing(true);

    try {
      // Load activities (last 30 days)
      const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
      const { data: activities, error: activitiesError } = await getStravaActivities({
        after: thirtyDaysAgo,
        per_page: 50,
      });

      if (!activitiesError && activities) {
        // Sort by date descending (most recent first) and format
        const sortedActivities = activities
          .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
          .map(formatStravaActivity);
        setStravaActivities(sortedActivities);
      }

      // Load athlete stats
      const athlete = getStoredAthlete();
      if (athlete?.id) {
        const { data: stats } = await getStravaAthleteStats(athlete.id);
        if (stats) {
          setStravaStats(stats);
        }
      }
    } catch (err) {
      console.error('Error loading Strava data:', err);
    }

    setSyncing(false);
  }, []);

  const checkStravaConnection = useCallback(async () => {
    if (!profile?.id) return;

    setLoading(true);

    // First try to load from database (for persistence across sessions)
    const { connected: dbConnected } = await loadStravaTokens(profile.id);

    // Then check localStorage
    const connected = dbConnected || isStravaConnected();
    setStravaConnected(connected);

    if (connected) {
      const athlete = getStoredAthlete();
      setStravaAthlete(athlete);
      await loadStravaData();
    }
    setLoading(false);
  }, [loadStravaData, profile?.id]);

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');

    if (code) {
      handleStravaCallback(code);
      // Clear URL params
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  // Check connection status on mount
  useEffect(() => {
    checkStravaConnection();
  }, [checkStravaConnection]);

  const handleStravaCallback = async (code) => {
    setLoading(true);
    setError(null);

    // Pass athleteId to save tokens to database
    const { data, error: callbackError } = await exchangeStravaCode(code, profile?.id);

    if (callbackError) {
      // Check if it's the athlete limit error
      if (callbackError.isLimitError) {
        setError(callbackError.userMessage);
      } else {
        setError('Error al conectar con Strava. Inténtalo de nuevo.');
      }
      setLoading(false);
      return;
    }

    setStravaConnected(true);
    setStravaAthlete(data.athlete);
    await loadStravaData();
    setLoading(false);
  };

  const handleConnectStrava = () => {
    window.location.href = getStravaAuthUrl();
  };

  const handleDisconnectStrava = async () => {
    // Pass athleteId to delete from database
    await disconnectStrava(profile?.id);
    setStravaConnected(false);
    setStravaAthlete(null);
    setStravaActivities([]);
    setStravaStats(null);
  };

  const handleSync = () => {
    loadStravaData();
  };

  // Load activity details when clicked
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
        (b, coord) => b.extend(coord),
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

    } catch (err) {
      console.error('Error initializing map:', err);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [selectedActivity?.polyline, selectedActivity?.loading]);

  // Other devices (not yet implemented)
  const otherDevices = [
    {
      id: 'garmin',
      name: 'Garmin Connect',
      description: 'Sincroniza automáticamente tus entrenamientos desde tu reloj Garmin',
      logo: '/img/integrations/garmin.svg',
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-white',
      comingSoon: true,
    },
    {
      id: 'coros',
      name: 'COROS',
      description: 'Importa datos de tus entrenamientos desde COROS',
      logo: '/img/integrations/coros.jpeg',
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-black',
      comingSoon: true,
    },
    {
      id: 'polar',
      name: 'Polar Flow',
      description: 'Importa entrenamientos desde Polar Flow',
      logo: '/img/integrations/polar.svg',
      color: 'from-red-600 to-red-700',
      bgColor: 'bg-white',
      comingSoon: true,
    },
    {
      id: 'suunto',
      name: 'Suunto',
      description: 'Conecta con tu Suunto para sincronizar actividades',
      logo: '/img/integrations/suunto.svg',
      color: 'from-gray-700 to-gray-900',
      bgColor: 'bg-white',
      comingSoon: true,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <FiLoader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Cargando dispositivos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Mis Dispositivos
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Conecta tus dispositivos para sincronizar entrenamientos automáticamente
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FiAlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <span className="text-red-700 dark:text-red-300">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Strava Card - Main Integration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div
          className={`
            bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg border-2
            ${stravaConnected ? 'border-green-500' : 'border-gray-200 dark:border-gray-700'}
          `}
        >
          {/* Strava Header */}
          <div className="bg-gradient-to-r from-[#FC4C02] to-[#E34402] p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center p-2">
                  <img
                    src="/img/integrations/strava.svg"
                    alt="Strava"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Strava</h2>
                  {stravaAthlete && (
                    <p className="text-white/80">
                      {stravaAthlete.firstname} {stravaAthlete.lastname}
                    </p>
                  )}
                </div>
              </div>
              {stravaConnected && (
                <div className="flex items-center space-x-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                  <FiCheckCircle className="w-5 h-5" />
                  <span className="font-semibold">Conectado</span>
                </div>
              )}
            </div>
          </div>

          {/* Strava Content */}
          <div className="p-6">
            {stravaConnected ? (
              <>
                {/* Stats Summary */}
                {stravaStats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {stravaStats.all_run_totals?.count || 0}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Carreras totales</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {((stravaStats.all_run_totals?.distance || 0) / 1000).toFixed(0)} km
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Distancia total</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {stravaStats.recent_run_totals?.count || 0}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Últimas 4 sem</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {((stravaStats.recent_run_totals?.distance || 0) / 1000).toFixed(1)} km
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Últimas 4 sem</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-3 mb-6">
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="flex items-center space-x-2 px-4 py-2 bg-[#FC4C02] hover:bg-[#E34402] text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    <FiRefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                    <span>{syncing ? 'Sincronizando...' : 'Sincronizar ahora'}</span>
                  </button>
                  <a
                    href="https://www.strava.com/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                  >
                    <FiExternalLink className="w-4 h-4" />
                    <span>Abrir Strava</span>
                  </a>
                  <button
                    onClick={handleDisconnectStrava}
                    className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <span>Desconectar</span>
                  </button>
                </div>

                {/* Recent Activities */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                    <FiActivity className="w-5 h-5 text-[#FC4C02]" />
                    <span>Actividades Recientes</span>
                    <span className="text-sm font-normal text-gray-500">
                      (últimos 30 días)
                    </span>
                  </h3>

                  {stravaActivities.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                      <FiActivity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-gray-400">
                        No hay actividades en los últimos 30 días
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {stravaActivities.slice(0, 15).map((activity) => (
                        <motion.div
                          key={activity.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          onClick={() => loadActivityDetail(activity)}
                          className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border-2 border-transparent hover:border-orange-400"
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
                        </motion.div>
                      ))}

                      {stravaActivities.length > 15 && (
                        <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-2">
                          Mostrando 15 de {stravaActivities.length} actividades
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Conecta tu cuenta de Strava para sincronizar automáticamente tus entrenamientos
                </p>
                <button
                  onClick={handleConnectStrava}
                  className="inline-flex items-center space-x-2 px-6 py-3 bg-[#FC4C02] hover:bg-[#E34402] text-white rounded-xl font-semibold transition-all transform hover:scale-105"
                >
                  <span>Conectar con Strava</span>
                  <FiExternalLink className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Other Devices Grid */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          Otras Integraciones
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {otherDevices.map((device, index) => (
            <motion.div
              key={device.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700 relative"
            >
              {device.comingSoon && (
                <div className="absolute top-2 right-2 z-10">
                  <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-semibold rounded-full">
                    Próximamente
                  </span>
                </div>
              )}
              <div className={`bg-gradient-to-r ${device.color} p-4`}>
                <div className={`w-12 h-12 ${device.bgColor} rounded-lg flex items-center justify-center p-2`}>
                  <img
                    src={device.logo}
                    alt={device.name}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  {device.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                  {device.description}
                </p>
                <button
                  disabled
                  className="w-full py-2 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 rounded-lg cursor-not-allowed text-sm"
                >
                  No disponible
                </button>
              </div>
            </motion.div>
          ))}
        </div>
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
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-[#FC4C02] to-[#E34402]">
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
                              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                              <div className="flex-1 min-w-0 mr-3">
                                <p className="font-medium text-gray-900 dark:text-white truncate">
                                  {effort.segment?.name || effort.name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {(effort.segment?.distance || effort.distance) / 1000 || 0} km
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-mono font-semibold text-gray-900 dark:text-white">
                                  {formatDuration(effort.moving_time || effort.elapsed_time)}
                                </p>
                                {effort.pr_rank && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                                    effort.pr_rank === 1
                                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                      : effort.pr_rank === 2
                                      ? 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                                      : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                  }`}>
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
    </div>
  );
};

export default Devices;

import { useState, useEffect, useCallback } from 'react';
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
  formatStravaActivity,
  getActivityTypeLabel,
  loadStravaTokens,
} from '../../services/stravaService';

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
        setStravaActivities(activities.map(formatStravaActivity));
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
                      {stravaActivities.slice(0, 10).map((activity) => (
                        <motion.div
                          key={activity.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          onClick={() => setSelectedActivity(activity)}
                          className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors group"
                        >
                          <div className="flex items-center space-x-4">
                            <div
                              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                activity.type === 'Run' || activity.type === 'TrailRun'
                                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600'
                                  : activity.type === 'Ride'
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                                  : activity.type === 'Swim'
                                  ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600'
                                  : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600'
                              }`}
                            >
                              <FiActivity className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {activity.name}
                              </p>
                              <div className="flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-400">
                                <span>{getActivityTypeLabel(activity.type)}</span>
                                <span>
                                  {new Date(activity.date).toLocaleDateString('es-ES', {
                                    day: 'numeric',
                                    month: 'short',
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-6">
                            <div className="text-right hidden sm:block">
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {activity.distanceKm} km
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {activity.pace}
                              </p>
                            </div>
                            <div className="text-right hidden md:block">
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {activity.formattedTime}
                              </p>
                              {activity.average_heartrate && (
                                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-end space-x-1">
                                  <FiHeart className="w-3 h-3 text-red-500" />
                                  <span>{Math.round(activity.average_heartrate)} bpm</span>
                                </p>
                              )}
                            </div>
                            <FiChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                          </div>
                        </motion.div>
                      ))}

                      {stravaActivities.length > 10 && (
                        <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-2">
                          Mostrando 10 de {stravaActivities.length} actividades
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-[#FC4C02] to-[#E34402] p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                    {getActivityTypeLabel(selectedActivity.type)}
                  </span>
                  <button
                    onClick={() => setSelectedActivity(null)}
                    className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <FiX className="w-6 h-6" />
                  </button>
                </div>
                <h3 className="text-xl font-bold">{selectedActivity.name}</h3>
                <p className="text-white/80">
                  {new Date(selectedActivity.date).toLocaleDateString('es-ES', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                    <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400 mb-1">
                      <FiMapPin className="w-4 h-4" />
                      <span className="text-sm">Distancia</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedActivity.distanceKm} km
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                    <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400 mb-1">
                      <FiClock className="w-4 h-4" />
                      <span className="text-sm">Tiempo</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedActivity.formattedTime}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                    <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400 mb-1">
                      <FiTrendingUp className="w-4 h-4" />
                      <span className="text-sm">Ritmo</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedActivity.pace}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                    <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400 mb-1">
                      <FiHeart className="w-4 h-4" />
                      <span className="text-sm">FC Media</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedActivity.average_heartrate
                        ? `${Math.round(selectedActivity.average_heartrate)} bpm`
                        : '-'}
                    </p>
                  </div>
                </div>

                {/* Additional Stats */}
                <div className="space-y-3">
                  {selectedActivity.total_elevation_gain > 0 && (
                    <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-gray-600 dark:text-gray-400">Desnivel positivo</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {selectedActivity.total_elevation_gain} m
                      </span>
                    </div>
                  )}
                  {selectedActivity.max_heartrate && (
                    <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-gray-600 dark:text-gray-400">FC Máxima</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {Math.round(selectedActivity.max_heartrate)} bpm
                      </span>
                    </div>
                  )}
                  {selectedActivity.calories > 0 && (
                    <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-gray-600 dark:text-gray-400">Calorías</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {selectedActivity.calories} kcal
                      </span>
                    </div>
                  )}
                  {selectedActivity.kudos_count > 0 && (
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600 dark:text-gray-400">Kudos</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {selectedActivity.kudos_count}
                      </span>
                    </div>
                  )}
                </div>

                {/* Strava Link */}
                <a
                  href={`https://www.strava.com/activities/${selectedActivity.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 flex items-center justify-center space-x-2 w-full py-3 bg-[#FC4C02] hover:bg-[#E34402] text-white rounded-xl transition-colors"
                >
                  <span>Ver en Strava</span>
                  <FiExternalLink className="w-4 h-4" />
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Devices;

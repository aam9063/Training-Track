import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiCheckCircle,
  FiAlertCircle,
  FiExternalLink,
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
  loadStravaTokens,
} from '../../services/stravaService';

const Devices = () => {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stravaConnected, setStravaConnected] = useState(false);
  const [stravaAthlete, setStravaAthlete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkStravaConnection = useCallback(async () => {
    if (!profile?.id) return;

    setLoading(true);
    const { connected: dbConnected } = await loadStravaTokens(profile.id);
    const connected = dbConnected || isStravaConnected();
    setStravaConnected(connected);

    if (connected) {
      const athlete = getStoredAthlete();
      setStravaAthlete(athlete);
    }
    setLoading(false);
  }, [profile?.id]);

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      handleStravaCallback(code);
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

    const { data, error: callbackError } = await exchangeStravaCode(code, profile?.id);

    if (callbackError) {
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
    setLoading(false);
  };

  const handleConnectStrava = () => {
    window.location.href = getStravaAuthUrl();
  };

  const handleDisconnectStrava = async () => {
    await disconnectStrava(profile?.id);
    setStravaConnected(false);
    setStravaAthlete(null);
  };

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

      {/* Strava Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
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
                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center p-2">
                  <img
                    src="/img/integrations/strava.svg"
                    alt="Strava"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Strava</h2>
                  {stravaAthlete && (
                    <p className="text-white/80 text-sm">
                      {stravaAthlete.firstname} {stravaAthlete.lastname}
                    </p>
                  )}
                </div>
              </div>
              {stravaConnected && (
                <div className="flex items-center space-x-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <FiCheckCircle className="w-4 h-4" />
                  <span className="font-semibold text-sm">Conectado</span>
                </div>
              )}
            </div>
          </div>

          {/* Strava Content */}
          <div className="p-6">
            {stravaConnected ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Tu cuenta de Strava está vinculada. Tus actividades se muestran en <span className="font-medium text-gray-900 dark:text-white">Mis Entrenamientos</span>.
                </p>
                <button
                  onClick={handleDisconnectStrava}
                  className="flex-shrink-0 ml-4 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors font-medium"
                >
                  Desvincular
                </button>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-600 dark:text-gray-400 mb-5">
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

      {/* Otras Integraciones */}
      <div className="mt-8">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          Otras Integraciones
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          {/* Garmin */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700 relative"
          >
            <div className="absolute top-2 right-2 z-10">
              <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-semibold rounded-full">
                Próximamente
              </span>
            </div>
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4">
              <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center p-2">
                <img
                  src="/img/integrations/garmin.svg"
                  alt="Garmin"
                  className="w-full h-full object-contain"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Garmin Connect</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Sincroniza automáticamente tus entrenamientos desde tu reloj Garmin
              </p>
              <button disabled className="w-full py-2 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 rounded-lg cursor-not-allowed text-sm">
                No disponible
              </button>
            </div>
          </motion.div>

          {/* COROS */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700 relative"
          >
            <div className="absolute top-2 right-2 z-10">
              <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-semibold rounded-full">
                Próximamente
              </span>
            </div>
            <div className="bg-gradient-to-r from-red-500 to-red-600 p-4">
              <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center p-2">
                <img
                  src="/img/integrations/coros.jpeg"
                  alt="COROS"
                  className="w-full h-full object-contain"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">COROS</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Importa datos de tus entrenamientos desde COROS
              </p>
              <button disabled className="w-full py-2 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 rounded-lg cursor-not-allowed text-sm">
                No disponible
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Devices;

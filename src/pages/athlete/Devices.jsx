import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FiCheckCircle,
  FiAlertCircle,
  FiLoader,
  FiX,
  FiRefreshCw,
  FiZap,
  FiLink,
  FiMinusCircle,
} from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import {
  getStravaAuthUrl,
  exchangeStravaCode,
  isStravaConnected,
  getStoredAthlete,
  disconnectStrava,
  loadStravaTokens,
  getStravaAthlete,
} from '../../services/stravaService';
import { supabase } from '../../lib/supabase';
import { getCachedActivityCount, getLastSync } from '../../services/stravaCacheService';
import { fullHistoricalSync, syncActivityDetails } from '../../services/stravaSyncService';

const Devices = () => {
  const { profile } = useAuth();
  const [stravaConnected, setStravaConnected] = useState(false);
  const [stravaAthlete, setStravaAthlete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [cachedCount, setCachedCount] = useState(null);
  const [lastSyncDate, setLastSyncDate] = useState(null);

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

  useEffect(() => {
    if (stravaConnected && profile?.id) {
      getCachedActivityCount(profile.id).then(setCachedCount);
      getLastSync(profile.id).then(setLastSyncDate);
    }
  }, [stravaConnected, profile?.id]);

  // Lazy backfill: ensure strava_athlete_id is set in devices table
  useEffect(() => {
    if (!stravaConnected || !profile?.id) return;
    (async () => {
      try {
        const { data: device, error: deviceErr } = await supabase
          .from('devices')
          .select('strava_athlete_id')
          .eq('athlete_id', profile.id)
          .eq('device_type', 'strava')
          .maybeSingle();
        if (deviceErr || !device) return;
        if (!device.strava_athlete_id) {
          const { data: athlete } = await getStravaAthlete();
          if (athlete?.id) {
            const { error: updateErr } = await supabase
              .from('devices')
              .update({ strava_athlete_id: athlete.id })
              .eq('athlete_id', profile.id)
              .eq('device_type', 'strava');
            if (updateErr) return;
          }
        }
      } catch {
        // Backfill is non-critical — silently ignore
      }
    })();
  }, [stravaConnected, profile?.id]);

  const handleStravaCallback = useCallback(async (code) => {
    setLoading(true);
    setError(null);
    const { data, error: callbackError } = await exchangeStravaCode(code, profile?.id);
    if (callbackError) {
      setError(callbackError.isLimitError ? callbackError.userMessage : 'Error al conectar con Strava. Inténtalo de nuevo.');
      setLoading(false);
      return;
    }
    setStravaConnected(true);
    setStravaAthlete(data.athlete);
    setLoading(false);
  }, [profile?.id]);

  const handleConnectStrava = () => {
    window.location.href = getStravaAuthUrl();
  };

  const handleDisconnectStrava = async () => {
    await disconnectStrava(profile?.id);
    setStravaConnected(false);
    setStravaAthlete(null);
    setCachedCount(null);
    setLastSyncDate(null);
  };

  const handleFullSync = async () => {
    if (!profile?.id) return;
    setSyncing(true);
    setSyncProgress('Iniciando sincronización...');
    setSyncResult(null);
    try {
      const { totalSynced } = await fullHistoricalSync(
        profile.id,
        ({ total, waiting }) => {
          if (waiting) setSyncProgress('Esperando límite de API de Strava...');
          else setSyncProgress(`Sincronizadas ${total} actividades...`);
        }
      );
      setSyncProgress('Obteniendo marcas personales...');
      await syncActivityDetails(profile.id, 50, ({ fetched, total }) => {
        setSyncProgress(`Procesando detalles: ${fetched}/${total}...`);
      });
      const count = await getCachedActivityCount(profile.id);
      setCachedCount(count);
      setLastSyncDate(new Date().toISOString());
      setSyncResult(`${totalSynced} actividades procesadas correctamente.`);
    } catch (err) {
      setSyncResult(`Error: ${err.message}`);
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  };

  // On mount: capture OAuth code from URL and save to sessionStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      sessionStorage.setItem('strava_oauth_code', code);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // When profile is ready: process saved code OR check existing connection
  useEffect(() => {
    if (!profile?.id) {
      return;
    }

    const code = sessionStorage.getItem('strava_oauth_code');
    if (code) {
      sessionStorage.removeItem('strava_oauth_code');
      handleStravaCallback(code);
    } else {
      checkStravaConnection();
    }
  }, [profile?.id, handleStravaCallback, checkStravaConnection]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <FiLoader className="w-7 h-7 animate-spin text-brand-primary mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-gray-400">Cargando dispositivos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 max-w-3xl">
      {/* Page Header */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Integraciones
        </h1>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
          Conecta tus aplicaciones y dispositivos para sincronizar entrenamientos automáticamente
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
        >
          <FiAlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 transition-colors">
            <FiX className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Section: Activas */}
      <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
        Aplicaciones
      </p>

      {/* Strava Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl border border-brand-border dark:border-gray-700 overflow-hidden mb-3"
      >
        {/* Card top row */}
        <div className="flex items-center gap-4 p-5">
          {/* Logo */}
          <div className="w-11 h-11 rounded-xl bg-[#FC4C02]/10 flex items-center justify-center flex-shrink-0">
            <img
              src="/img/integrations/strava.svg"
              alt="Strava"
              className="w-6 h-6 object-contain"
            />
          </div>

          {/* Name + description */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 dark:text-white text-sm">Strava</span>
              {stravaConnected && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded-full border border-green-200 dark:border-green-700">
                  <FiCheckCircle className="w-3 h-3" />
                  Conectado
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5 truncate">
              {stravaConnected && stravaAthlete
                ? `${stravaAthlete.firstname} ${stravaAthlete.lastname}`
                : 'Sincroniza tus actividades de running y ciclismo'}
            </p>
          </div>

          {/* Action button */}
          {stravaConnected ? (
            <button
              onClick={handleDisconnectStrava}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-brand-border dark:border-gray-600"
            >
              <FiMinusCircle className="w-3.5 h-3.5" />
              Desvincular
            </button>
          ) : (
            <button
              onClick={handleConnectStrava}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#FC4C02] hover:bg-[#E34402] rounded-lg transition-colors"
            >
              <FiLink className="w-3.5 h-3.5" />
              Conectar
            </button>
          )}
        </div>

        {/* Connected: stats + sync */}
        {stravaConnected && (
          <div className="border-t border-brand-border dark:border-gray-700 px-5 py-4 bg-slate-50/50 dark:bg-gray-800/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Histórico sincronizado
                </p>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                  {cachedCount !== null ? (
                    <><span className="font-semibold text-slate-900 dark:text-white">{cachedCount}</span> actividades en caché</>
                  ) : (
                    'Calculando...'
                  )}
                  {lastSyncDate && (
                    <span className="ml-2 text-slate-400">
                      · {new Date(lastSyncDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={handleFullSync}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-700 border border-brand-border dark:border-gray-600 text-slate-700 dark:text-slate-200 hover:bg-brand-primary hover:text-white hover:border-brand-primary dark:hover:bg-brand-primary dark:hover:border-brand-primary rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncing ? (
                  <FiLoader className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FiRefreshCw className="w-3.5 h-3.5" />
                )}
                {syncing ? 'Sincronizando...' : 'Sincronizar todo'}
              </button>
            </div>

            {/* Progress */}
            {syncProgress && (
              <div className="mt-3 flex items-center gap-2 p-3 bg-brand-primary/5 dark:bg-brand-primary/10 rounded-lg">
                <FiLoader className="w-3.5 h-3.5 text-brand-primary animate-spin flex-shrink-0" />
                <p className="text-xs text-brand-primary">{syncProgress}</p>
              </div>
            )}

            {/* Result */}
            {syncResult && !syncProgress && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`mt-3 flex items-center gap-2 p-3 rounded-lg ${
                  syncResult.startsWith('Error')
                    ? 'bg-red-50 dark:bg-red-900/20'
                    : 'bg-green-50 dark:bg-green-900/20'
                }`}
              >
                <FiCheckCircle className={`w-3.5 h-3.5 flex-shrink-0 ${syncResult.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`} />
                <p className={`text-xs ${syncResult.startsWith('Error') ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>
                  {syncResult}
                </p>
              </motion.div>
            )}
          </div>
        )}
      </motion.div>

      {/* Section: Próximamente */}
      <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 mt-7">
        Próximamente
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Garmin */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-brand-border dark:border-gray-700 p-5 opacity-60"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <img
                src="/img/integrations/garmin.svg"
                alt="Garmin"
                className="w-5 h-5 object-contain"
                onError={(e) => { e.currentTarget.classList.add('hidden'); }}
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Garmin Connect</p>
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Próximamente</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed">
            Sincroniza automáticamente tus entrenamientos desde tu reloj Garmin
          </p>
        </motion.div>

        {/* COROS */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-brand-border dark:border-gray-700 p-5 opacity-60"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
              <img
                src="/img/integrations/coros.jpeg"
                alt="COROS"
                className="w-5 h-5 object-contain rounded"
                onError={(e) => { e.currentTarget.classList.add('hidden'); }}
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">COROS</p>
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Próximamente</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed">
            Importa datos de tus entrenamientos desde tu dispositivo COROS
          </p>
        </motion.div>
      </div>

      {/* Info note */}
      <div className="mt-6 flex items-start gap-3 p-4 bg-brand-primary/5 dark:bg-brand-primary/10 rounded-xl border border-brand-primary/10 dark:border-brand-primary/20">
        <FiZap className="w-4 h-4 text-brand-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Las actividades sincronizadas desde Strava se vinculan automáticamente con tus sesiones de entrenamiento y se muestran en <span className="font-medium text-slate-900 dark:text-white">Mis Entrenamientos</span>.
        </p>
      </div>
    </div>
  );
};

export default Devices;

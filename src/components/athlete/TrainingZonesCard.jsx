import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FiTarget, FiRefreshCw, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { getTrainingZones, updateAthleteVdot } from '../../services/trainingLoadService';
import { getTrainingPaces, generateHrZones, formatPace, DANIELS_ZONES } from '../../lib/trainingMetrics';
import { showSuccess, showError } from '../../lib/toast';
import { supabase } from '../../lib/supabase';

const ZONE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function TrainingZonesCard({ bestEfforts, athleteId: propAthleteId }) {
  const { user, profile } = useAuth();
  const athleteId = propAthleteId || profile?.id || user?.id;
  // If viewing own profile, use local profile data; otherwise fetch from DB
  const isOwnProfile = !propAthleteId || propAthleteId === (profile?.id || user?.id);

  const [paceZones, setPaceZones] = useState([]);
  const [hrZones, setHrZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState('pace');
  const [remoteAthleteData, setRemoteAthleteData] = useState(null);

  const athleteData = isOwnProfile ? profile?.athlete : remoteAthleteData;
  const vdot = athleteData?.vdot;
  const maxHR = athleteData?.max_heart_rate;

  // Generate pace zones from VDOT
  const derivedPaces = useMemo(() => {
    if (!vdot) return null;
    return getTrainingPaces(vdot);
  }, [vdot]);

  // Generate HR zones from maxHR
  const derivedHrZones = useMemo(() => {
    if (!maxHR) return null;
    return generateHrZones(maxHR);
  }, [maxHR]);

  // Fetch remote athlete data when viewing another athlete (coach view)
  useEffect(() => {
    if (isOwnProfile || !athleteId) return;
    const fetchAthleteData = async () => {
      const { data } = await supabase
        .from('athletes')
        .select('vdot, max_heart_rate, resting_heart_rate')
        .eq('id', athleteId)
        .single();
      if (data) setRemoteAthleteData(data);
    };
    fetchAthleteData();
  }, [athleteId, isOwnProfile]);

  useEffect(() => {
    const loadZones = async () => {
      if (!athleteId) return;
      try {
        const zones = await getTrainingZones(athleteId);
        setPaceZones(zones.filter(z => z.zone_type === 'pace_daniels'));
        setHrZones(zones.filter(z => z.zone_type === 'hr'));
      } catch (err) {
        console.error('Error loading zones:', err);
      } finally {
        setLoading(false);
      }
    };
    loadZones();
  }, [athleteId]);

  const handleUpdateVdot = async () => {
    if (!bestEfforts || bestEfforts.length === 0) {
      showError('No hay best efforts de Strava disponibles');
      return;
    }
    setUpdating(true);
    try {
      const result = await updateAthleteVdot(athleteId, bestEfforts);
      if (result) {
        showSuccess(`VDOT actualizado: ${result.vdot}`);
        // Refresh athlete data and zones
        if (!isOwnProfile) {
          setRemoteAthleteData(prev => ({ ...prev, vdot: result.vdot }));
        }
        const zones = await getTrainingZones(athleteId);
        setPaceZones(zones.filter(z => z.zone_type === 'pace_daniels'));
      } else {
        showError('No se pudo calcular VDOT');
      }
    } catch (err) {
      console.error('Error updating VDOT:', err);
      showError('Error al actualizar VDOT');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  const hasPaceData = paceZones.length > 0 || derivedPaces;
  const hasHrData = hrZones.length > 0 || derivedHrZones;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FiTarget className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Zonas de Entrenamiento</h3>
          {vdot && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium">
              VDOT: {vdot}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {bestEfforts && bestEfforts.length > 0 && (
            <button
              onClick={handleUpdateVdot}
              disabled={updating}
              className="text-xs px-2 py-1 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <FiRefreshCw className={`w-3 h-3 ${updating ? 'animate-spin' : ''}`} />
              {updating ? 'Calculando...' : 'Auto VDOT'}
            </button>
          )}
          <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            {expanded ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          {/* Tabs */}
          {(hasPaceData || hasHrData) && (
            <div className="flex gap-1 mb-3">
              <button
                onClick={() => setActiveTab('pace')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  activeTab === 'pace'
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}
              >
                Ritmos (Daniels)
              </button>
              <button
                onClick={() => setActiveTab('hr')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  activeTab === 'hr'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}
              >
                Frecuencia Cardíaca
              </button>
            </div>
          )}

          {/* Pace Zones */}
          {activeTab === 'pace' && (
            <div className="space-y-2">
              {(paceZones.length > 0 ? paceZones : (derivedPaces ? DANIELS_ZONES : [])).map((zone, i) => {
                const zoneData = paceZones.length > 0
                  ? zone
                  : {
                      zone_name: zone.label,
                      zone_number: i + 1,
                      min_value: i === 0 ? derivedPaces.easy.max : [0, derivedPaces.marathon, derivedPaces.threshold, derivedPaces.interval, derivedPaces.repetition][i],
                      max_value: i === 0 ? derivedPaces.easy.min : [0, derivedPaces.marathon, derivedPaces.threshold, derivedPaces.interval, derivedPaces.repetition][i],
                    };

                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-2 h-8 rounded-full" style={{ backgroundColor: ZONE_COLORS[i] }} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          Z{zoneData.zone_number || i + 1} — {zoneData.zone_name}
                        </span>
                        <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                          {zoneData.min_value && zoneData.max_value && zoneData.min_value !== zoneData.max_value
                            ? `${formatPace(zoneData.min_value)} – ${formatPace(zoneData.max_value)}`
                            : formatPace(zoneData.min_value || zoneData.max_value)
                          } /km
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!hasPaceData && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  Conecta Strava y haz clic en "Auto VDOT" para calcular tus zonas automáticamente
                </p>
              )}
            </div>
          )}

          {/* HR Zones */}
          {activeTab === 'hr' && (
            <div className="space-y-2">
              {(hrZones.length > 0 ? hrZones : (derivedHrZones || [])).map((zone, i) => {
                const zoneData = hrZones.length > 0
                  ? zone
                  : { zone_name: zone.name, zone_number: zone.zone, min_value: zone.min, max_value: zone.max };

                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-2 h-8 rounded-full" style={{ backgroundColor: ZONE_COLORS[i] }} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          Z{zoneData.zone_number || zoneData.zone || i + 1} — {zoneData.zone_name || zoneData.name}
                        </span>
                        <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                          {Math.round(zoneData.min_value || zoneData.min)} – {Math.round(zoneData.max_value || zoneData.max)} bpm
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!hasHrData && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  Configura tu FC máxima en el perfil para ver tus zonas de frecuencia cardíaca
                </p>
              )}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

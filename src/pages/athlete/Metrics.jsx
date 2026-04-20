import { useState, useEffect, useMemo } from 'react';

import { motion } from 'framer-motion';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import {
  FiTrendingUp,
  FiActivity,
  FiTarget,
  FiLoader,
  FiHeart,
  FiZap,
  FiMapPin,
  FiClock,
  FiDownload,
  FiNavigation,
} from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import ACWRGauge, { getACWRZone } from '../../components/shared/ACWRGauge';
import PMCChart from '../../components/athlete/PMCChart';
import TrainingZonesCard from '../../components/athlete/TrainingZonesCard';
import InfoTooltip from '../../components/common/InfoTooltip';
import useStravaMetrics from '../../hooks/useStravaMetrics';
import useInternalMetrics from '../../hooks/useInternalMetrics';
import { computeAge } from '../../lib/athleteUtils';
import { exportActivitiesCSV, exportLoadCSV } from '../../lib/dataExport';
import useAiAnalysisQuota from '../../hooks/useAiAnalysisQuota';
import useAthleteTestData from '../../hooks/useAthleteTestData';
import useMetricsLoadData from '../../hooks/useMetricsLoadData';
import useRacePredictions from '../../hooks/useRacePredictions';
import useHrZoneData from '../../hooks/useHrZoneData';
import useSportCharts from '../../hooks/useSportCharts';
import { getPersonalBestsByAthlete } from '../../services/personalBestsService';
import { CHART_COLORS } from '../../lib/chartColors';
import { buildWeeklyChartData, buildAverageSpeedData } from '../../lib/chartBuilders';
import { buildMetricsAnalysisPayload } from '../../lib/analysisPayloadBuilder';
import BestEffortsChart from '../../components/athlete/charts/BestEffortsChart';
import TimeInZoneChart from '../../components/athlete/charts/TimeInZoneChart';
import IntensityDistributionChart from '../../components/athlete/charts/IntensityDistributionChart';
import ShoesWidget from '../../components/athlete/charts/ShoesWidget';
import ActivitySelector from '../../components/athlete/charts/ActivitySelector';
import Vo2maxCard from '../../components/athlete/charts/Vo2maxCard';
import SufferScoreChart from '../../components/athlete/charts/SufferScoreChart';
import RestDaysCalendar from '../../components/athlete/charts/RestDaysCalendar';
import WeeklyHeatmapChart from '../../components/athlete/charts/WeeklyHeatmapChart';
import PaceZonesChart from '../../components/athlete/charts/PaceZonesChart';
import CadenceHistogramChart from '../../components/athlete/charts/CadenceHistogramChart';
import GapVsPaceChart from '../../components/athlete/charts/GapVsPaceChart';
import VdotProgressionChart from '../../components/athlete/charts/VdotProgressionChart';
import ElevationProfileChart from '../../components/athlete/charts/ElevationProfileChart';
import SplitsComparisonChart from '../../components/athlete/charts/SplitsComparisonChart';
import LapsAnalysisChart from '../../components/athlete/charts/LapsAnalysisChart';
import { AiAnalysisPanel } from '../../components/athlete/AiAnalysisPanel';
import { MetricAIAnalyzer } from '../../components/athlete/MetricAIAnalyzer';
import {
  getBestEffortsEvolution,
  getTimeInZoneAggregate,
  getIntensityDistribution,
  getShoes,
  getWeeklyLoadSeries,
} from '../../services/metricsAnalyticsService';
import { showError } from '../../lib/toast';
import {
  calculateZonePercentages,
  formatBestEfforts,
  getAcwrAlertConfig,
} from '../../lib/trainingMetrics';
import {
  STAT_CARD_GRADIENTS,
  SPORT_SECTION_CLASSES,
  RACE_PREDICTOR_CLASSES,
  STRAVA_PROMPT_CLASSES,
  ACWR_ALERT_CLASSES,
} from '../../lib/themeClasses';
import InternalMetricsSection from '../../components/athlete/InternalMetricsSection';
import ActivityTypeDistribution from '../../components/athlete/charts/ActivityTypeDistribution';
import TotalActivityTimeChart from '../../components/athlete/charts/TotalActivityTimeChart';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const AthleteMetrics = () => {
  const { profile, isIndependent } = useAuth();
  const { latestVam } = useAthleteTestData(profile?.id);
  const aiQuota = useAiAnalysisQuota();
  const {
    loading, stravaConnected, stravaMetrics, bestEfforts,
    stravaStats, weekFilter, setWeekFilter, rawActivities,
  } = useStravaMetrics(profile?.id);
  const [activityTimePeriod, setActivityTimePeriod] = useState('7days');
  const [exportOpen, setExportOpen] = useState(false);
  const [dbPersonalBests, setDbPersonalBests] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [preparingAnalysis, setPreparingAnalysis] = useState(false);
  const [analysisPayload, setAnalysisPayload] = useState(null);

  // Internal metrics (from completed training_sessions, not Strava)
  const {
    loading: internalLoading,
    weeklyKm,
    weeklyRpe,
    weeklyPace,
    completionRate,
    hasData: hasInternalData,
  } = useInternalMetrics(profile?.id, 8);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile?.id) return;
      const { data } = await getPersonalBestsByAthlete(profile.id);
      if (!cancelled) setDbPersonalBests(data || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const loadData = useMetricsLoadData(rawActivities);

  const racePredictions = useRacePredictions({
    bestEfforts,
    dbPersonalBests,
    storedVdot: profile?.athlete?.vdot,
  });

  const estimatedAge = profile?.athlete?.date_of_birth
    ? computeAge(profile.athlete.date_of_birth)
    : null;
  const hrZoneData = useHrZoneData({
    rawActivities,
    maxHeartRate: profile?.athlete?.max_heart_rate,
    restingHeartRate: profile?.athlete?.resting_heart_rate,
    estimatedAge,
  });

  // Shared z1..z5 percentage map derived once; feeds both the zones card
  // props and the AI analyzer payload so we don't re-run the math inline.
  const hrZonePercentages = useMemo(
    () => calculateZonePercentages(hrZoneData),
    [hrZoneData],
  );

  // Athlete context passed to the AI analyzers.
  // VAM (Velocidad Aeróbica Máxima) comes from the `vam_tests` table in km/h
  // (typical human range 10-22 km/h). We intentionally do NOT fall back to
  // VDOT here — VDOT is a dimensionless Daniels-Gilbert index (~30-85) and
  // passing it as "VAM km/h" caused Gemma to report absurd values like
  // "VAM 46 km/h". If no VAM test is registered, send null and let the model
  // skip the field.
  const athleteContext = useMemo(() => {
    const rawVam = latestVam?.vam_kmh != null ? parseFloat(latestVam.vam_kmh) : null;
    // Defensive clamp: ignore anything outside biologically plausible human VAM.
    const vamKmh = Number.isFinite(rawVam) && rawVam >= 8 && rawVam <= 25
      ? Math.round(rawVam * 10) / 10
      : null;
    return {
      nivel: profile?.athlete?.nivel || profile?.nivel || null,
      objetivo: profile?.athlete?.objetivo || profile?.objetivo || null,
      vam: vamKmh,
    };
  }, [profile, latestVam]);

  const handleGenerateAnalysis = async () => {
    if (preparingAnalysis) return;
    if (!aiQuota.canUse) {
      setAnalysisOpen(true);
      return;
    }
    setPreparingAnalysis(true);
    try {
      const [best, tiz, intensity, shoes, weeklyLoad] = await Promise.all([
        getBestEffortsEvolution(profile.id, 50),
        getTimeInZoneAggregate(profile.id, 4),
        getIntensityDistribution(profile.id, 4),
        getShoes(profile.id),
        getWeeklyLoadSeries(profile.id, 12),
      ]);
      setAnalysisPayload(buildMetricsAnalysisPayload({
        timeInZone: tiz.data,
        intensity: intensity.data,
        shoes: shoes.data,
        bestEfforts: best.data,
        weeklyLoad: weeklyLoad.data,
        weeks: 4,
      }));
      setAnalysisOpen(true);
    } catch (err) {
      showError(err?.message || 'No se pudieron recopilar las métricas');
    } finally {
      setPreparingAnalysis(false);
    }
  };

  const sportCharts = useSportCharts(rawActivities);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: CHART_COLORS.grid,
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <FiLoader className="w-8 h-8 animate-spin text-ath-accent mx-auto mb-4" />
          <p className="text-ath-text-secondary">Cargando métricas...</p>
        </div>
      </div>
    );
  }

  if (!stravaConnected) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ath-text-primary mb-2">
            Mis Métricas
          </h1>
          <p className="text-sm sm:text-base text-ath-text-secondary">
            Análisis de rendimiento y progresión
          </p>
        </div>

        {/* Internal progression metrics (always visible) */}
        <InternalMetricsSection
          weeklyKm={weeklyKm}
          weeklyRpe={weeklyRpe}
          weeklyPace={weeklyPace}
          completionRate={completionRate}
          hasData={hasInternalData}
          loading={internalLoading}
        />

        {/* Strava connect prompt (only for non-independent athletes) */}
        {!isIndependent && (
          <div className="bg-ath-surface rounded-2xl border border-ath-border p-8 sm:p-10 text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${STRAVA_PROMPT_CLASSES.iconBg}`}>
              <FiActivity className={`w-8 h-8 ${STRAVA_PROMPT_CLASSES.iconFg}`} />
            </div>
            <h2 className="text-lg font-bold text-ath-text-primary mb-2">
              Conecta Strava para más métricas
            </h2>
            <p className="text-ath-text-muted mb-5 max-w-md mx-auto text-sm">
              Sincroniza tu cuenta de Strava para ver estadísticas detalladas: zonas de frecuencia cardíaca, predictor de tiempos, ACWR y más.
            </p>
            <a
              href="/athlete/devices"
              className={`inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl font-semibold transition-all text-sm ${STRAVA_PROMPT_CLASSES.button}`}
            >
              <span>Ir a Dispositivos</span>
              <FiActivity className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-ath-text-primary">
              Mis Métricas
            </h1>
            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => setExportOpen((o) => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-ath-text-secondary bg-ath-inset hover:bg-ath-inset rounded-lg transition-colors"
              >
                <FiDownload className="w-3.5 h-3.5" />
                Exportar
              </button>
              {exportOpen && (
                <>
                  {/* Backdrop to close on outside click */}
                  <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 w-48 bg-ath-surface rounded-xl shadow-lg border border-ath-border py-1 z-20">
                    <button
                      onClick={() => { exportActivitiesCSV(rawActivities, profile?.full_name || 'atleta'); setExportOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-ath-text-secondary hover:bg-ath-inset flex items-center gap-2"
                    >
                      <FiActivity className="w-4 h-4 text-orange-500" />
                      Actividades (CSV)
                    </button>
                    <button
                      onClick={() => { exportLoadCSV(loadData?.weeklyLoads, profile?.full_name || 'atleta'); setExportOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-ath-text-secondary hover:bg-ath-inset flex items-center gap-2"
                    >
                      <FiTrendingUp className="w-4 h-4 text-blue-500" />
                      Carga semanal (CSV)
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          <p className="text-sm sm:text-base text-ath-text-secondary">
            Análisis de rendimiento basado en Strava
          </p>
          {!aiQuota.loading && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-ath-accent-surface text-ath-accent">
              <FiZap className="w-3 h-3" />
              {aiQuota.source === 'coach' ? (
                <span>Análisis IA cubiertos por tu coach</span>
              ) : aiQuota.limit === -1 ? (
                <span>Análisis IA ilimitados</span>
              ) : (
                <span>{aiQuota.remaining}/{aiQuota.limit} análisis IA este mes</span>
              )}
            </div>
          )}
        </div>

        {/* Week Filter */}
        <div className="flex items-center bg-ath-inset rounded-xl p-1 gap-0.5">
          {[4, 8, 12].map((weeks) => (
            <button
              key={weeks}
              onClick={() => setWeekFilter(weeks)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                weekFilter === weeks
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : 'text-ath-text-secondary hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {weeks} sem
            </button>
          ))}
        </div>
      </div>

      {/* Main Stats Cards */}
      {stravaMetrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-gradient-to-br ${STAT_CARD_GRADIENTS.running} rounded-xl p-4 sm:p-5 text-white shadow-lg`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium opacity-90">Running</span>
              <FiMapPin className="w-4 h-4 opacity-75" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold mb-1">{stravaMetrics.runningDistanceKm}</p>
            <p className="text-xs opacity-75">km running</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`bg-gradient-to-br ${STAT_CARD_GRADIENTS.time} rounded-xl p-4 sm:p-5 text-white shadow-lg`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium opacity-90">Tiempo</span>
              <FiClock className="w-4 h-4 opacity-75" />
            </div>
            <p className="text-xl sm:text-2xl font-bold mb-1">{stravaMetrics.totalTimeFormatted}</p>
            <p className="text-xs opacity-75">total</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`bg-gradient-to-br ${STAT_CARD_GRADIENTS.pace} rounded-xl p-4 sm:p-5 text-white shadow-lg`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium opacity-90">Ritmo</span>
              <FiTrendingUp className="w-4 h-4 opacity-75" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold mb-1">{stravaMetrics.avgPace || '-'}</p>
            <p className="text-xs opacity-75">min/km medio</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`bg-gradient-to-br ${STAT_CARD_GRADIENTS.heartRate} rounded-xl p-4 sm:p-5 text-white shadow-lg`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium opacity-90">FC Media</span>
              <FiHeart className="w-4 h-4 opacity-75" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold mb-1">
              {stravaMetrics.avgHeartrate || '-'}
            </p>
            <p className="text-xs opacity-75">bpm</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`bg-gradient-to-br ${STAT_CARD_GRADIENTS.activities} rounded-xl p-4 sm:p-5 text-white shadow-lg`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium opacity-90">Actividades</span>
              <FiActivity className="w-4 h-4 opacity-75" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold mb-1">{stravaMetrics.totalActivities}</p>
            <p className="text-xs opacity-75">entrenamientos</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className={`bg-gradient-to-br ${STAT_CARD_GRADIENTS.elevation} rounded-xl p-4 sm:p-5 text-white shadow-lg`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium opacity-90">Desnivel</span>
              <FiZap className="w-4 h-4 opacity-75" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold mb-1">{stravaMetrics.totalElevation}</p>
            <p className="text-xs opacity-75">metros</p>
          </motion.div>
        </div>
      )}

      {/* Compact AI analysis banner — placed here so the primary action is high in the page */}
      {profile?.id && (
        <div className="mt-6 bg-ath-surface rounded-2xl border border-ath-border p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-ath-accent-surface flex items-center justify-center shrink-0">
              <FiZap className="w-5 h-5 text-ath-accent-text" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-ath-text-primary truncate">Análisis general con IA</p>
              <p className="text-xs text-ath-text-muted truncate">
                Resumen holístico de tu forma, carga y progreso
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleGenerateAnalysis}
            disabled={preparingAnalysis || aiQuota.loading}
            className="px-4 py-2 rounded-xl bg-ath-accent text-ath-on-accent text-sm font-semibold hover:bg-ath-accent-hover transition-colors disabled:opacity-60 shrink-0 inline-flex items-center gap-2"
          >
            {preparingAnalysis ? (
              <>
                <FiLoader className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Preparando...</span>
              </>
            ) : (
              <>
                <FiZap className="w-4 h-4" />
                <span>Generar</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Internal progression metrics (available even with Strava connected) */}
      <InternalMetricsSection
        weeklyKm={weeklyKm}
        weeklyRpe={weeklyRpe}
        weeklyPace={weeklyPace}
        completionRate={completionRate}
        hasData={hasInternalData}
        loading={internalLoading}
      />

      {/* Race Time Predictor */}
      {racePredictions && Object.keys(racePredictions.predictions).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-ath-surface rounded-2xl p-4 sm:p-5 border border-ath-border"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <FiTarget className="w-4 h-4 text-violet-500" />
              <h3 className="text-base font-bold text-ath-text-primary">
                Predictor de Tiempos
                <InfoTooltip text="Estimación de tiempos usando el modelo VDOT de Jack Daniels, el mismo sistema que usan relojes deportivos como COROS y Garmin. Basado en tu mejor marca registrada." />
              </h3>
            </div>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${RACE_PREDICTOR_CLASSES.badge}`}>
              VDOT {racePredictions.vdot}
            </span>
          </div>
          <p className="text-xs text-ath-text-muted mb-4">
            Modelo Daniels-Gilbert · Actualizado hoy
          </p>

          {/* 2×2 prediction cards */}
          {(() => {
            const barColors = {
              '5 km': 'bg-blue-500',
              '10 km': 'bg-green-500',
              'Media Maratón': 'bg-orange-500',
              'Maratón': 'bg-red-500',
            };
            const entries = Object.entries(racePredictions.predictions).slice(0, 4);
            return (
              <div className="grid grid-cols-2 gap-2.5">
                {entries.map(([distance, data]) => (
                  <div key={distance} className="bg-ath-inset rounded-xl p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-ath-text-muted mb-1">
                      {distance.toUpperCase()}
                    </p>
                    <p className="text-2xl font-bold text-ath-text-primary leading-none mb-0.5">
                      {data.timeFormatted}
                    </p>
                    <p className="text-xs text-ath-text-muted mb-2">
                      {data.pace} min/km
                    </p>
                    <div className="w-full h-1 bg-ath-inset rounded-full overflow-hidden">
                      <div className={`h-1 rounded-full w-full ${barColors[distance] || 'bg-violet-500'}`} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          <p className="text-[11px] text-ath-text-muted mt-3 flex items-center gap-1">
            <span className={`inline-block w-3.5 h-3.5 rounded-full text-center leading-3.5 text-[9px] ${RACE_PREDICTOR_CLASSES.infoDot}`}>i</span>
            Cada punto de VDOT ≈ 30s menos en 5km
          </p>
        </motion.div>
      )}

      {/* PMC Chart (CTL/ATL/TSB) */}
      {stravaConnected && rawActivities.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.33 }}
          className="mb-6"
        >
          <PMCChart
            activities={rawActivities}
            athleteProfile={profile?.athlete}
            athleteId={profile?.id}
            athleteContext={athleteContext}
          />
        </motion.div>
      )}

      {/* Training Zones (Daniels + HR) */}
      {stravaConnected && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mb-6"
        >
          <TrainingZonesCard
            bestEfforts={rawActivities.flatMap(a => a.best_efforts || [])}
            athleteId={profile?.id}
            athleteContext={athleteContext}
            hrDistribution={hrZonePercentages}
          />
        </motion.div>
      )}

      {/* HR Training Zones */}
      {hrZoneData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-ath-surface rounded-2xl mb-4 sm:mb-6 p-4 sm:p-5 border border-ath-border"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-0.5">
            <div className="flex items-center gap-2 min-w-0">
              <FiClock className="w-4 h-4 text-slate-500 shrink-0" />
              <h3 className="text-base font-bold text-ath-text-primary">Zonas de Entrenamiento</h3>
            </div>
            <MetricAIAnalyzer
              chartType="training_zones"
              data={{
                vdot: racePredictions?.vdot ?? null,
                max_hr: hrZoneData.maxHR,
                rest_hr: hrZoneData.restingHR,
                distribution: hrZonePercentages || { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 },
                weeks: weekFilter,
                sample: 'fc',
              }}
              athleteContext={athleteContext}
              compact
              title="Análisis de Zonas de Entrenamiento"
              disabled={!hrZoneData || hrZoneData.totalHRActivities === 0}
            />
          </div>
          <p className="text-xs text-ath-text-muted mb-4">
            VDOT: {racePredictions?.vdot ?? '–'} · FC Máx: {hrZoneData.maxHR} bpm · FC Reposo: {hrZoneData.restingHR} bpm
          </p>

          {/* Zone list */}
          <div className="space-y-2 mb-5">
            {hrZoneData.zones.map((zone) => (
              <div key={zone.name} className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: zone.color }} />
                <span className="flex-1 text-sm font-medium text-ath-text-secondary">{zone.name}</span>
                <span className="text-xs font-mono text-ath-text-muted whitespace-nowrap">
                  {zone.bpmMin}–{zone.bpmMax} bpm
                </span>
              </div>
            ))}
          </div>

          {/* Distribución por zona */}
          <div className="border-t border-ath-border pt-4">
            <p className="text-xs font-semibold text-ath-text-secondary mb-0.5">Distribución por zona</p>
            <p className="text-[11px] text-ath-text-muted mb-3">
              Basado en FC · últimas {weekFilter} semanas
            </p>

            {hrZoneData.totalHRActivities > 0 ? (
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                {/* Donut */}
                <div className="relative flex-shrink-0 w-32 h-32 mx-auto sm:mx-0">
                  <Doughnut
                    data={{
                      labels: hrZoneData.zones.map(z => z.name),
                      datasets: [{
                        data: hrZoneData.zones.map(z => z.count),
                        backgroundColor: hrZoneData.zones.map(z => z.color),
                        borderWidth: 2,
                        borderColor: 'transparent',
                      }],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: true,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          callbacks: {
                            label: (ctx) => {
                              const pct = hrZoneData.totalHRActivities > 0
                                ? Math.round((ctx.raw / hrZoneData.totalHRActivities) * 100)
                                : 0;
                              return `${ctx.label}: ${pct}%`;
                            },
                          },
                        },
                      },
                      cutout: '62%',
                    }}
                  />
                  {/* Center label */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-lg font-bold text-ath-text-primary">
                      {hrZoneData.zones[1] && hrZoneData.totalHRActivities > 0
                        ? Math.round((hrZoneData.zones[1].count / hrZoneData.totalHRActivities) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>

                {/* Legend + bars */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  {hrZoneData.zones.map((zone) => {
                    const pct = hrZoneData.totalHRActivities > 0
                      ? Math.round((zone.count / hrZoneData.totalHRActivities) * 100)
                      : 0;
                    const shortName = zone.name.replace('Z1 - ', 'Z1 ').replace('Z2 - ', 'Z2 ').replace('Z3 - ', 'Z3 ').replace('Z4 - ', 'Z4 ').replace('Z5 - ', 'Z5 ');
                    return (
                      <div key={zone.name} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: zone.color }} />
                        <span className="text-[11px] text-ath-text-muted w-20 truncate">{shortName}</span>
                        <span className="text-[11px] font-semibold text-ath-text-secondary w-8 text-right flex-shrink-0">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <FiHeart className="w-8 h-8 text-ath-text-muted mx-auto mb-2" />
                <p className="text-sm text-ath-text-muted">No hay datos de frecuencia cardíaca</p>
              </div>
            )}

            {/* Progress bars */}
            {hrZoneData.totalHRActivities > 0 && (
              <div className="mt-4 space-y-2">
                {hrZoneData.zones.map((zone) => {
                  const pct = hrZoneData.totalHRActivities > 0
                    ? Math.round((zone.count / hrZoneData.totalHRActivities) * 100)
                    : 0;
                  const shortName = zone.name.replace('Z1 - ', 'Z1 ').replace('Z2 - ', 'Z2 ').replace('Z3 - ', 'Z3 ').replace('Z4 - ', 'Z4 ').replace('Z5 - ', 'Z5 ');
                  return (
                    <div key={zone.name} className="flex items-center gap-2">
                      <span className="text-[11px] text-ath-text-muted w-24 flex-shrink-0">{shortName}</span>
                      <div className="flex-1 h-2 bg-ath-inset rounded-full overflow-hidden">
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: zone.color }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-ath-text-muted w-7 text-right flex-shrink-0">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Activity Distribution and Total Activity Time Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
        {/* Activity Type Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-ath-surface rounded-2xl p-4 sm:p-5 border border-ath-border overflow-hidden"
        >
          <div className="flex items-center gap-2 mb-1">
            <FiActivity className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <h3 className="text-base font-bold text-ath-text-primary">
              Distribución de Actividades
              <InfoTooltip text="Proporción de cada tipo de actividad (carrera, ciclismo, natación, etc.) registrada en Strava durante el período seleccionado." />
            </h3>
          </div>
          <p className="text-xs text-ath-text-muted mb-4">Últimas {weekFilter} semanas</p>
          <ActivityTypeDistribution activities={rawActivities} />
        </motion.div>

        {/* Total Activity Time Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <TotalActivityTimeChart
            activities={rawActivities}
            selectedPeriod={activityTimePeriod}
            onPeriodChange={setActivityTimePeriod}
          />
        </motion.div>
      </div>

      {/* Dashboard de Carga */}
      {rawActivities.length > 0 && loadData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="bg-ath-surface rounded-2xl p-4 sm:p-5 border border-ath-border mb-4 sm:mb-6"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <FiZap className="w-4 h-4 text-amber-500 shrink-0" />
              <h3 className="text-base font-bold text-ath-text-primary">
                Gestión de Carga
                <InfoTooltip text="Ratio de carga aguda/crónica (ACWR): compara el volumen de la última semana con la media de las 4 anteriores. Zona óptima: 0.8–1.3. Por encima de 1.5 aumenta el riesgo de lesión." />
              </h3>
            </div>
            <MetricAIAnalyzer
              chartType="acwr_load"
              data={{
                acute_km: loadData.acuteLoad,
                chronic_km: loadData.chronicLoadWeekly,
                acwr: Math.round(loadData.acwr * 100) / 100,
                status: loadData.acwr < 0.8 ? 'bajo' : loadData.acwr <= 1.3 ? 'optimo' : loadData.acwr <= 1.5 ? 'alto' : 'peligro',
                weeks: loadData.weeklyLoads.map((w) => ({
                  wk: w.label,
                  km: w.km,
                  zone: (w.acwr === null || w.acwr === undefined)
                    ? 'n/a'
                    : (w.acwr < 0.8 ? 'bajo' : w.acwr <= 1.3 ? 'optimo' : w.acwr <= 1.5 ? 'alto' : 'peligro'),
                })),
              }}
              athleteContext={athleteContext}
              compact
              title="Análisis de Gestión de Carga (ACWR)"
              disabled={!loadData}
            />
          </div>
          <p className="text-xs text-ath-text-muted mb-3">ACWR · ratio carga aguda/crónica</p>

          {/* Alert banner */}
          {(() => {
            const cfg = getAcwrAlertConfig(loadData.acwr);
            const palette = ACWR_ALERT_CLASSES[cfg.severity];
            return (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium ${palette.bg} ${palette.text} mb-4`}>
                <span className="flex-shrink-0">{cfg.icon}</span>
                <span>{cfg.message}</span>
              </div>
            );
          })()}

          {/* Gauge centrado + valor grande */}
          <div className="flex flex-col items-center mb-4">
            <ACWRGauge acwr={loadData.acwr} />
          </div>

          {/* 3 stat chips */}
          <div className="grid grid-cols-3 gap-2.5 mb-4">
            <div className="bg-ath-inset rounded-xl p-3 text-center">
              <p className="text-[10px] text-ath-text-muted mb-1">Carga aguda</p>
              <p className="text-xl font-bold text-ath-text-primary">{loadData.acuteLoad}</p>
              <p className="text-[10px] text-slate-400">km · 7 días</p>
            </div>
            <div className="bg-ath-inset rounded-xl p-3 text-center">
              <p className="text-[10px] text-ath-text-muted mb-1">Carga crónica</p>
              <p className="text-xl font-bold text-ath-text-primary">{loadData.chronicLoadWeekly}</p>
              <p className="text-[10px] text-slate-400">km/sem · 4 sem</p>
            </div>
            <div className="bg-ath-inset rounded-xl p-3 text-center">
              <p className="text-[10px] text-ath-text-muted mb-1">ACWR</p>
              <p className={`text-xl font-bold ${getACWRZone(loadData.acwr).textClass}`}>{loadData.acwr.toFixed(2)}</p>
              <p className={`text-[10px] font-medium ${getACWRZone(loadData.acwr).textClass}`}>{getACWRZone(loadData.acwr).label}</p>
            </div>
          </div>

          {/* Weekly Load Bar Chart */}
          <p className="text-xs font-semibold text-ath-text-secondary mb-2">
            Carga semanal · últimas 8 semanas
          </p>
          <div className="h-44">
            <Bar
              data={{
                labels: loadData.weeklyLoads.map(w => w.label),
                datasets: [{
                  label: 'km/semana',
                  data: loadData.weeklyLoads.map(w => w.km),
                  backgroundColor: loadData.weeklyLoads.map(w => w.color),
                  borderRadius: 4,
                  barPercentage: 0.7,
                }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => {
                        const week = loadData.weeklyLoads[ctx.dataIndex];
                        const acwrText = week.acwr !== null ? ` | ACWR: ${week.acwr}` : '';
                        return `${ctx.parsed.y} km${acwrText}`;
                      },
                    },
                  },
                },
                scales: {
                  x: { grid: { display: false }, ticks: { color: CHART_COLORS.axisTick, font: { size: 10 } } },
                  y: { beginAtZero: true, grid: { color: CHART_COLORS.grid }, ticks: { color: CHART_COLORS.axisTick, font: { size: 10 } } },
                },
              }}
            />
          </div>

          {/* Zone legend */}
          <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] text-ath-text-muted">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Bajo</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" />Óptimo</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" />Alto</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" />Peligro</span>
          </div>
        </motion.div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {/* Weekly KM Progression */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-ath-surface rounded-2xl border border-ath-border p-4 sm:p-5"
        >
          <h3 className="text-base sm:text-lg font-bold text-ath-text-primary mb-4 flex items-center">
            <FiTrendingUp className="w-5 h-5 mr-2 text-orange-500" />
            Progresión Semanal Running (km)
            <InfoTooltip text="Kilómetros de running recorridos cada semana. Solo incluye carrera, trail y carrera virtual. Permite ver la progresión del volumen y detectar aumentos bruscos de carga." />
          </h3>
          <div className="h-48 sm:h-64">
            {stravaMetrics?.weeklyStats?.length > 0 ? (
              <Line data={buildWeeklyChartData(stravaMetrics)} options={chartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                No hay datos suficientes
              </div>
            )}
          </div>
        </motion.div>

        {/* Average Speed Chart (Garmin style) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-ath-surface rounded-2xl border border-ath-border p-4 sm:p-5"
        >
          <h3 className="text-base sm:text-lg font-bold text-ath-text-primary mb-4 flex items-center">
            <FiZap className="w-5 h-5 mr-2 text-blue-500" />
            Velocidad Media por Actividad
            <InfoTooltip text="Velocidad media (km/h) de cada actividad a lo largo del tiempo. La línea punteada indica la media general. Permite ver tendencias de mejora o fatiga." />
          </h3>
          {(() => {
            const speedData = buildAverageSpeedData(rawActivities);
            if (speedData.labels.length === 0) {
              return (
                <div className="h-48 sm:h-64 flex items-center justify-center text-gray-400">
                  No hay datos suficientes
                </div>
              );
            }
            return (
              <>
                {/* Average line indicator */}
                <div className="flex items-center justify-end mb-2 text-xs sm:text-sm text-ath-text-muted">
                  <div className="flex items-center">
                    <div className="w-6 sm:w-8 h-0.5 bg-ath-text-muted mr-1.5 sm:mr-2 flex-shrink-0"></div>
                    <span className="whitespace-nowrap">Media = {speedData.avgSpeed} km/h</span>
                  </div>
                </div>
                <div className="h-48 sm:h-64">
                  <Line
                    data={{
                      labels: speedData.labels,
                      datasets: [
                        // Average line
                        {
                          label: 'Media',
                          data: speedData.labels.map(() => speedData.avgSpeed),
                          borderColor: CHART_COLORS.mutedDashed,
                          borderDash: [5, 5],
                          borderWidth: 1,
                          pointRadius: 0,
                          fill: false,
                        },
                        // Individual points
                        {
                          label: 'Velocidad (km/h)',
                          data: speedData.datasets[0]?.data || [],
                          borderColor: 'transparent',
                          backgroundColor: CHART_COLORS.fitnessSolid,
                          pointRadius: 7,
                          pointHoverRadius: 9,
                          showLine: false,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          callbacks: {
                            label: (ctx) => {
                              if (ctx.dataset.label === 'Media') return null;
                              return `Velocidad: ${ctx.parsed.y} km/h`;
                            },
                          },
                          filter: (tooltipItem) => tooltipItem.dataset.label !== 'Media',
                        },
                      },
                      scales: {
                        x: {
                          grid: { display: false },
                          ticks: {
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 8,
                          },
                        },
                        y: {
                          beginAtZero: true,
                          grid: { color: CHART_COLORS.grid },
                          title: {
                            display: true,
                            text: 'Kilómetros por hora',
                          },
                        },
                      },
                    }}
                  />
                </div>
              </>
            );
          })()}
        </motion.div>
      </div>

      {/* ── Sport-Specific Sections ── */}

      {/* Cycling Section */}
      {sportCharts.cycling && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="bg-ath-surface rounded-2xl border border-ath-border p-4 sm:p-5 mb-6 sm:mb-8"
        >
          <h3 className="text-base sm:text-lg font-bold text-ath-text-primary mb-4 flex items-center">
            <FiNavigation className={`w-5 h-5 mr-2 ${SPORT_SECTION_CLASSES.cycling.headerIcon}`} />
            Ciclismo
            <InfoTooltip text="Métricas de ciclismo: km semanales, velocidad media y desnivel acumulado. Solo incluye Ride y VirtualRide." />
          </h3>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className={`rounded-lg p-3 text-center ${SPORT_SECTION_CLASSES.cycling.chipBg}`}>
              <p className={`text-xl sm:text-2xl font-bold ${SPORT_SECTION_CLASSES.cycling.chipText}`}>{sportCharts.cycling.totalKm}</p>
              <p className="text-[10px] sm:text-xs text-ath-text-muted">km totales</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${SPORT_SECTION_CLASSES.cycling.chipBg}`}>
              <p className={`text-xl sm:text-2xl font-bold ${SPORT_SECTION_CLASSES.cycling.chipText}`}>{sportCharts.cycling.avgSpeed}</p>
              <p className="text-[10px] sm:text-xs text-ath-text-muted">km/h media</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${SPORT_SECTION_CLASSES.cycling.chipBg}`}>
              <p className={`text-xl sm:text-2xl font-bold ${SPORT_SECTION_CLASSES.cycling.chipText}`}>{sportCharts.cycling.totalElevation}</p>
              <p className="text-[10px] sm:text-xs text-ath-text-muted">m desnivel</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${SPORT_SECTION_CLASSES.cycling.chipBg}`}>
              <p className={`text-xl sm:text-2xl font-bold ${SPORT_SECTION_CLASSES.cycling.chipText}`}>{sportCharts.cycling.avgHR || '-'}</p>
              <p className="text-[10px] sm:text-xs text-ath-text-muted">bpm media</p>
            </div>
          </div>

          {/* Weekly km + speed chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-ath-text-secondary mb-3">Km semanales</h4>
              <div className="h-48">
                <Bar
                  data={{
                    labels: sportCharts.cycling.weeklyKm.map(w => w.label),
                    datasets: [{
                      label: 'km',
                      data: sportCharts.cycling.weeklyKm.map(w => w.km),
                      backgroundColor: CHART_COLORS.cyclingBar,
                      borderRadius: 4,
                      barPercentage: 0.7,
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { grid: { display: false } },
                      y: { beginAtZero: true, grid: { color: CHART_COLORS.grid }, title: { display: true, text: 'km' } },
                    },
                  }}
                />
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-ath-text-secondary mb-3">Velocidad media semanal</h4>
              <div className="h-48">
                <Line
                  data={{
                    labels: sportCharts.cycling.weeklyKm.map(w => w.label),
                    datasets: [{
                      label: 'km/h',
                      data: sportCharts.cycling.weeklyKm.map(w => w.avgSpeed),
                      borderColor: CHART_COLORS.cycling,
                      backgroundColor: CHART_COLORS.cyclingFill,
                      fill: true,
                      tension: 0.4,
                      pointRadius: 4,
                      pointBackgroundColor: CHART_COLORS.cycling,
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { grid: { display: false } },
                      y: { beginAtZero: false, grid: { color: CHART_COLORS.grid }, title: { display: true, text: 'km/h' } },
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Swimming Section */}
      {sportCharts.swimming && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-ath-surface rounded-2xl border border-ath-border p-4 sm:p-5 mb-6 sm:mb-8"
        >
          <h3 className="text-base sm:text-lg font-bold text-ath-text-primary mb-4 flex items-center">
            <FiActivity className={`w-5 h-5 mr-2 ${SPORT_SECTION_CLASSES.swimming.headerIcon}`} />
            Natación
            <InfoTooltip text="Métricas de natación: metros semanales y ritmo medio por 100m." />
          </h3>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className={`rounded-lg p-3 text-center ${SPORT_SECTION_CLASSES.swimming.chipBg}`}>
              <p className={`text-xl sm:text-2xl font-bold ${SPORT_SECTION_CLASSES.swimming.chipText}`}>{sportCharts.swimming.totalMeters}</p>
              <p className="text-[10px] sm:text-xs text-ath-text-muted">metros totales</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${SPORT_SECTION_CLASSES.swimming.chipBg}`}>
              <p className={`text-xl sm:text-2xl font-bold ${SPORT_SECTION_CLASSES.swimming.chipText}`}>{sportCharts.swimming.avgPace100m}</p>
              <p className="text-[10px] sm:text-xs text-ath-text-muted">min/100m</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${SPORT_SECTION_CLASSES.swimming.chipBg}`}>
              <p className={`text-xl sm:text-2xl font-bold ${SPORT_SECTION_CLASSES.swimming.chipText}`}>{sportCharts.swimming.count}</p>
              <p className="text-[10px] sm:text-xs text-ath-text-muted">sesiones</p>
            </div>
          </div>

          {/* Weekly meters chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-ath-text-secondary mb-3">Metros semanales</h4>
              <div className="h-48">
                <Bar
                  data={{
                    labels: sportCharts.swimming.weeklyMeters.map(w => w.label),
                    datasets: [{
                      label: 'metros',
                      data: sportCharts.swimming.weeklyMeters.map(w => w.meters),
                      backgroundColor: CHART_COLORS.swimmingBar,
                      borderRadius: 4,
                      barPercentage: 0.7,
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { grid: { display: false } },
                      y: { beginAtZero: true, grid: { color: CHART_COLORS.grid }, title: { display: true, text: 'metros' } },
                    },
                  }}
                />
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-ath-text-secondary mb-3">Ritmo medio /100m</h4>
              <div className="h-48">
                <Line
                  data={{
                    labels: sportCharts.swimming.weeklyMeters.map(w => w.label),
                    datasets: [{
                      label: 'seg/100m',
                      data: sportCharts.swimming.weeklyMeters.map(w => w.avgPace100m),
                      borderColor: CHART_COLORS.swimming,
                      backgroundColor: CHART_COLORS.swimmingFill,
                      fill: true,
                      tension: 0.4,
                      pointRadius: 4,
                      pointBackgroundColor: CHART_COLORS.swimming,
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => {
                            const secs = ctx.parsed.y;
                            if (!secs) return '-';
                            return `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')} /100m`;
                          },
                        },
                      },
                    },
                    scales: {
                      x: { grid: { display: false } },
                      y: {
                        reverse: true,
                        grid: { color: CHART_COLORS.grid },
                        title: { display: true, text: 'seg/100m' },
                        ticks: {
                          callback: (v) => `${Math.floor(v / 60)}:${(v % 60).toString().padStart(2, '0')}`,
                        },
                      },
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Gym / Strength Section */}
      {sportCharts.gym && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
          className="bg-ath-surface rounded-2xl border border-ath-border p-4 sm:p-5 mb-6 sm:mb-8"
        >
          <h3 className="text-base sm:text-lg font-bold text-ath-text-primary mb-4 flex items-center">
            <FiZap className={`w-5 h-5 mr-2 ${SPORT_SECTION_CLASSES.gym.headerIcon}`} />
            Fuerza / Gimnasio
            <InfoTooltip text="Sesiones de fuerza, pesas, CrossFit y yoga. Muestra frecuencia semanal y duración media." />
          </h3>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className={`rounded-lg p-3 text-center ${SPORT_SECTION_CLASSES.gym.chipBg}`}>
              <p className={`text-xl sm:text-2xl font-bold ${SPORT_SECTION_CLASSES.gym.chipText}`}>{sportCharts.gym.totalSessions}</p>
              <p className="text-[10px] sm:text-xs text-ath-text-muted">sesiones</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${SPORT_SECTION_CLASSES.gym.chipBg}`}>
              <p className={`text-xl sm:text-2xl font-bold ${SPORT_SECTION_CLASSES.gym.chipText}`}>{sportCharts.gym.avgDurationMin}</p>
              <p className="text-[10px] sm:text-xs text-ath-text-muted">min/sesión</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${SPORT_SECTION_CLASSES.gym.chipBg}`}>
              <p className={`text-xl sm:text-2xl font-bold ${SPORT_SECTION_CLASSES.gym.chipText}`}>{sportCharts.gym.totalMinutes}</p>
              <p className="text-[10px] sm:text-xs text-ath-text-muted">min totales</p>
            </div>
          </div>

          {/* Weekly sessions + duration chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-ath-text-secondary mb-3">Sesiones semanales</h4>
              <div className="h-48">
                <Bar
                  data={{
                    labels: sportCharts.gym.weeklyGym.map(w => w.label),
                    datasets: [{
                      label: 'sesiones',
                      data: sportCharts.gym.weeklyGym.map(w => w.sessions),
                      backgroundColor: CHART_COLORS.gymBar,
                      borderRadius: 4,
                      barPercentage: 0.7,
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { grid: { display: false } },
                      y: {
                        beginAtZero: true,
                        grid: { color: CHART_COLORS.grid },
                        title: { display: true, text: 'sesiones' },
                        ticks: { stepSize: 1 },
                      },
                    },
                  }}
                />
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-ath-text-secondary mb-3">Duración semanal</h4>
              <div className="h-48">
                <Bar
                  data={{
                    labels: sportCharts.gym.weeklyGym.map(w => w.label),
                    datasets: [{
                      label: 'minutos',
                      data: sportCharts.gym.weeklyGym.map(w => w.totalMinutes),
                      backgroundColor: CHART_COLORS.gymFill,
                      borderColor: CHART_COLORS.gym,
                      borderWidth: 1,
                      borderRadius: 4,
                      barPercentage: 0.7,
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { grid: { display: false } },
                      y: { beginAtZero: true, grid: { color: CHART_COLORS.grid }, title: { display: true, text: 'minutos' } },
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Records & Mejores Marcas */}
      {stravaMetrics && (stravaMetrics.longestRun || stravaMetrics.fastestPace || bestEfforts?.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-ath-surface rounded-2xl p-4 sm:p-5 border border-ath-border mb-4 sm:mb-6"
        >
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-amber-400">★</span>
            <h3 className="text-base font-bold text-ath-text-primary">Récords & Mejores marcas</h3>
          </div>
          <p className="text-xs text-ath-text-muted mb-4">Mejores registros históricos en Strava</p>

          {/* Top 2 highlight cards */}
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            {stravaMetrics.longestRun && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1">
                  <FiZap className="w-3 h-3" /> Carrera más larga
                </p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 leading-none mb-0.5">
                  {stravaMetrics.longestRun.distanceKm} km
                </p>
                <p className="text-[11px] text-slate-400 truncate">{stravaMetrics.longestRun.name}</p>
              </div>
            )}
            {stravaMetrics.fastestPace && (
              <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-ath-accent-text mb-1 flex items-center gap-1">
                  <FiZap className="w-3 h-3" /> Ritmo más rápido
                </p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300 leading-none mb-0.5">
                  {stravaMetrics.fastestPace.pace} <span className="text-sm font-normal"></span>
                </p>
                <p className="text-[11px] text-slate-400 truncate">{stravaMetrics.fastestPace.name}</p>
              </div>
            )}
          </div>

          {/* Best efforts grid 2×2 */}
          {bestEfforts && bestEfforts.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5">
              {formatBestEfforts(bestEfforts).map(({ key, label, effort, timeFormatted, paceFormatted, dateFormatted }) => (
                <div key={key} className="bg-ath-inset rounded-xl p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ath-text-muted mb-1">{label}</p>
                  {effort ? (
                    <>
                      <p className="text-xl font-bold text-ath-text-primary leading-none mb-0.5">
                        {timeFormatted}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">{paceFormatted} min/km</p>
                      <p className="text-[10px] text-ath-text-muted mt-0.5">
                        {dateFormatted || ''}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xl font-bold text-ath-text-muted leading-none mb-0.5">–</p>
                      <p className="text-[11px] text-ath-text-muted">Sin registro</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Athlete All-Time Stats */}
      {stravaStats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-ath-surface rounded-2xl border border-ath-border p-4 sm:p-5"
        >
          <h3 className="text-base sm:text-lg font-bold text-ath-text-primary mb-4 flex items-center">
            <FiActivity className="w-5 h-5 mr-2 text-orange-500" />
            Estadísticas Totales (Strava)
            <InfoTooltip text="Estadísticas acumuladas de toda tu historia en Strava: carreras totales, distancia, desnivel y tiempo de movimiento." />
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="text-center p-3 sm:p-4 bg-ath-inset rounded-xl">
              <p className="text-xl sm:text-3xl font-bold text-ath-text-primary">
                {stravaStats.all_run_totals?.count || 0}
              </p>
              <p className="text-[10px] sm:text-sm text-ath-text-muted">Carreras totales</p>
            </div>
            <div className="text-center p-3 sm:p-4 bg-ath-inset rounded-xl">
              <p className="text-xl sm:text-3xl font-bold text-ath-text-primary">
                {((stravaStats.all_run_totals?.distance || 0) / 1000).toFixed(0)} km
              </p>
              <p className="text-[10px] sm:text-sm text-ath-text-muted">Distancia total</p>
            </div>
            <div className="text-center p-3 sm:p-4 bg-ath-inset rounded-xl">
              <p className="text-xl sm:text-3xl font-bold text-ath-text-primary">
                {Math.round((stravaStats.all_run_totals?.elapsed_time || 0) / 3600)}h
              </p>
              <p className="text-[10px] sm:text-sm text-ath-text-muted">Tiempo total</p>
            </div>
            <div className="text-center p-3 sm:p-4 bg-ath-inset rounded-xl">
              <p className="text-xl sm:text-3xl font-bold text-ath-text-primary">
                {((stravaStats.all_run_totals?.elevation_gain || 0) / 1000).toFixed(1)}k
              </p>
              <p className="text-[10px] sm:text-sm text-ath-text-muted">Desnivel (m)</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Pillar A — Estado actual ─── */}
      {profile?.id && (
        <>
          <h2 className="text-sm font-bold text-ath-text-muted uppercase tracking-wider mt-10 mb-4">
            Estado actual
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <VdotProgressionChart athleteId={profile.id} athleteContext={athleteContext} />
            <Vo2maxCard athleteId={profile.id} />
          </div>

          {/* ─── Pillar B — Carga y ejecución ─── */}
          <h2 className="text-sm font-bold text-ath-text-muted uppercase tracking-wider mt-10 mb-4">
            Carga y ejecución
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <WeeklyHeatmapChart athleteId={profile.id} weeks={12} />
            <SufferScoreChart
              athleteId={profile.id}
              athleteContext={athleteContext}
              weeks={12}
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <RestDaysCalendar athleteId={profile.id} weeks={8} />
            <TimeInZoneChart athleteId={profile.id} athleteContext={athleteContext} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <PaceZonesChart athleteId={profile.id} />
            <IntensityDistributionChart athleteId={profile.id} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <CadenceHistogramChart athleteId={profile.id} />
            <GapVsPaceChart activityId={selectedActivity} athleteContext={athleteContext} />
          </div>

          {/* ─── Pillar C — Rendimiento y detalle ─── */}
          <h2 className="text-sm font-bold text-ath-text-muted uppercase tracking-wider mt-10 mb-4">
            Rendimiento y detalle
          </h2>
          <div className="mb-5">
            <BestEffortsChart
              athleteId={profile.id}
              athleteContext={athleteContext}
            />
          </div>
          <div className="mb-5">
            <ActivitySelector
              athleteId={profile.id}
              value={selectedActivity}
              onChange={setSelectedActivity}
            />
          </div>
          {selectedActivity && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
                <ElevationProfileChart activityId={selectedActivity} />
                <SplitsComparisonChart activityId={selectedActivity} athleteContext={athleteContext} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
                <LapsAnalysisChart activityId={selectedActivity} />
                <div className="hidden lg:block" />
              </div>
            </>
          )}
          <div>
            <ShoesWidget athleteId={profile.id} />
          </div>
        </>
      )}

      {analysisOpen && (
        <AiAnalysisPanel
          open={analysisOpen}
          onClose={() => setAnalysisOpen(false)}
          chartType="general"
          data={analysisPayload || {}}
          athleteContext={athleteContext}
          title="Análisis general"
          onSuccess={() => aiQuota.refetch()}
        />
      )}
    </div>
  );
};

export default AthleteMetrics;

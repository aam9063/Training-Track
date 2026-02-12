import { useState, useEffect, useMemo } from 'react';
import { showSuccess, showError } from '../../lib/toast';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiArrowLeft,
  FiActivity,
  FiHeart,
  FiTrendingUp,
  FiTrendingDown,
  FiLoader,
  FiCalendar,
  FiClock,
  FiTarget,
  FiZap,
  FiBarChart2,
  FiAlertTriangle,
  FiShield,
} from 'react-icons/fi';
import { BsStars } from 'react-icons/bs';
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

import { useAuth } from '../../contexts/AuthContext';
import {
  getAthleteDetails,
  getAthleteStravaActivities,
  getAthleteStravaConnection,
} from '../../services/athleteService';
import {
  formatDuration,
  calculatePace,
  getActivityTypeLabel,
  calculateStravaMetrics,
  calculatePeriodComparison,
  extractBestEfforts,
  estimateRaceTimes,
} from '../../services/stravaService';
import { generatePerformanceReport, getDailyLoads, calculateLoadMetrics } from '../../services/aiReportService';
import ACWRGauge, { getACWRZone } from '../../components/shared/ACWRGauge';
import { generateReportPDF } from '../../lib/reportPdfExport';

// Calculate HR training zones using Karvonen formula
const calculateHRZones = (maxHR, restingHR) => {
  const zones = [
    { name: 'Z1 - Recuperación', min: 0.50, max: 0.60, color: '#94a3b8' },
    { name: 'Z2 - Base Aeróbica', min: 0.60, max: 0.70, color: '#3b82f6' },
    { name: 'Z3 - Aeróbica', min: 0.70, max: 0.80, color: '#22c55e' },
    { name: 'Z4 - Umbral', min: 0.80, max: 0.90, color: '#f97316' },
    { name: 'Z5 - VO2max', min: 0.90, max: 1.00, color: '#ef4444' },
  ];
  return zones.map(z => ({
    ...z,
    bpmMin: Math.round(restingHR + z.min * (maxHR - restingHR)),
    bpmMax: Math.round(restingHR + z.max * (maxHR - restingHR)),
  }));
};

const AthleteMetricsView = () => {
  const { athleteId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [athlete, setAthlete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState([]);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [periodComparison, setPeriodComparison] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('4weeks'); // 4weeks, 8weeks, 12weeks
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState(null);

  // Training load calculations (ACWR, weekly loads)
  const loadData = useMemo(() => {
    if (!activities || activities.length === 0) return null;

    const metrics = calculateLoadMetrics(activities);
    const daily56 = getDailyLoads(activities, 56);

    const weeklyLoads = [];
    for (let w = 7; w >= 0; w--) {
      const startIdx = w * 7;
      const weekSlice = daily56.slice(startIdx, startIdx + 7);
      const weekKm = weekSlice.reduce((s, v) => s + v, 0);
      weeklyLoads.push({
        weekIndex: 7 - w,
        km: +weekKm.toFixed(1),
        label: w === 0 ? 'Esta sem.' : w === 1 ? 'Sem. -1' : `Sem. -${w}`,
      });
    }

    const weeklyLoadsWithAcwr = weeklyLoads.map((week, idx) => {
      if (idx < 4) {
        return { ...week, acwr: null, color: 'rgba(249, 115, 22, 0.7)' };
      }
      const acute = week.km;
      const chronic = (weeklyLoads[idx - 1].km + weeklyLoads[idx - 2].km +
                       weeklyLoads[idx - 3].km + weeklyLoads[idx - 4].km) / 4;
      const weekAcwr = chronic > 0 ? +(acute / chronic).toFixed(2) : 0;
      let color;
      if (weekAcwr < 0.8) color = 'rgba(59, 130, 246, 0.7)';
      else if (weekAcwr <= 1.3) color = 'rgba(34, 197, 94, 0.7)';
      else if (weekAcwr <= 1.5) color = 'rgba(249, 115, 22, 0.7)';
      else color = 'rgba(239, 68, 68, 0.7)';
      return { ...week, acwr: weekAcwr, color };
    });

    return {
      acuteLoad: metrics.acuteLoad,
      chronicLoadWeekly: metrics.chronicLoadWeekly,
      acwr: metrics.acwr,
      weeklyLoads: weeklyLoadsWithAcwr,
    };
  }, [activities]);

  // Best efforts from Strava activities
  const bestEfforts = useMemo(() => {
    if (!activities?.length) return [];
    return extractBestEfforts(activities);
  }, [activities]);

  // Race time predictions based on best efforts (Riegel formula)
  const racePredictions = useMemo(() => {
    if (!bestEfforts?.length) return null;
    const priority = ['10 km', '5 km', 'Media Maratón', '1 Milla', '1 km'];
    const ref = priority.map(n => bestEfforts.find(e => e.name === n)).find(Boolean);
    if (!ref) return null;
    return {
      reference: ref,
      predictions: estimateRaceTimes(ref.distance, ref.time),
    };
  }, [bestEfforts]);

  // HR training zones (Karvonen formula)
  const hrZoneData = useMemo(() => {
    const maxHR = athlete?.max_heart_rate
      || (athlete?.date_of_birth
        ? 220 - Math.floor((Date.now() - new Date(athlete.date_of_birth).getTime()) / 31557600000)
        : null);
    if (!maxHR) return null;
    const restingHR = athlete?.resting_heart_rate || 60;
    const zones = calculateHRZones(maxHR, restingHR);

    const hrActivities = activities.filter(a => a.average_heartrate);
    zones.forEach(z => { z.count = 0; });
    hrActivities.forEach(a => {
      const hr = a.average_heartrate;
      for (let i = zones.length - 1; i >= 0; i--) {
        if (hr >= zones[i].bpmMin) { zones[i].count++; break; }
      }
    });

    return { zones, maxHR, restingHR, totalHRActivities: hrActivities.length };
  }, [activities, athlete]);

  // Load athlete data
  useEffect(() => {
    const loadAthlete = async () => {
      if (!athleteId) return;

      try {
        const { data, error } = await getAthleteDetails(athleteId);
        if (error) throw error;
        setAthlete(data);
      } catch (error) {
        console.error('Error loading athlete:', error);
      }
    };

    loadAthlete();
  }, [athleteId]);

  // Load Strava activities
  useEffect(() => {
    const loadStravaData = async () => {
      if (!athleteId) return;

      setLoading(true);
      try {
        const { data: connection } = await getAthleteStravaConnection(athleteId);
        setStravaConnected(!!connection);

        if (connection) {
          // Get more activities for comprehensive metrics (up to 100)
          const perPage = selectedPeriod === '4weeks' ? 50 : selectedPeriod === '8weeks' ? 80 : 100;
          const { data: activitiesData } = await getAthleteStravaActivities(athleteId, {
            per_page: perPage,
          });

          if (activitiesData?.length > 0) {
            setActivities(activitiesData);
            setMetrics(calculateStravaMetrics(activitiesData));

            // Calculate period comparison (current 2 weeks vs previous 2 weeks)
            const now = new Date();
            const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
            const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

            const currentPeriod = activitiesData.filter(a => {
              const date = new Date(a.start_date_local);
              return date >= twoWeeksAgo;
            });

            const previousPeriod = activitiesData.filter(a => {
              const date = new Date(a.start_date_local);
              return date >= fourWeeksAgo && date < twoWeeksAgo;
            });

            setPeriodComparison(calculatePeriodComparison(currentPeriod, previousPeriod));
          }
        }
      } catch (error) {
        console.error('Error loading Strava data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStravaData();
  }, [athleteId, selectedPeriod]);

  // Calculate weekly data for charts
  const getWeeklyChartData = () => {
    if (!activities.length) return null;

    const weeks = [];
    const now = new Date();
    const numWeeks = selectedPeriod === '4weeks' ? 4 : selectedPeriod === '8weeks' ? 8 : 12;

    for (let i = numWeeks - 1; i >= 0; i--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - (i * 7));
      weekEnd.setHours(23, 59, 59, 999);

      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);

      const weekActivities = activities.filter(a => {
        const date = new Date(a.start_date_local);
        return date >= weekStart && date <= weekEnd;
      });

      const runningActivities = weekActivities.filter(a =>
        ['Run', 'TrailRun', 'VirtualRun'].includes(a.type)
      );

      const distance = weekActivities.reduce((sum, a) => sum + (a.distance || 0), 0);
      const time = weekActivities.reduce((sum, a) => sum + (a.moving_time || 0), 0);
      const elevation = weekActivities.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0);

      const hrActivities = weekActivities.filter(a => a.average_heartrate);
      const avgHr = hrActivities.length > 0
        ? hrActivities.reduce((sum, a) => sum + a.average_heartrate, 0) / hrActivities.length
        : null;

      const runningDistance = runningActivities.reduce((sum, a) => sum + (a.distance || 0), 0);
      const runningTime = runningActivities.reduce((sum, a) => sum + (a.moving_time || 0), 0);
      const avgPace = runningDistance > 0 ? runningTime / (runningDistance / 1000) : null;

      // Format week label as date range (e.g., "13-19 Ene")
      const startDay = weekStart.getDate();
      const endDay = weekEnd.getDate();
      const monthShort = weekStart.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');

      weeks.push({
        label: `${startDay}-${endDay} ${monthShort.charAt(0).toUpperCase() + monthShort.slice(1)}`,
        distance: distance / 1000,
        time: time / 60, // minutes
        elevation,
        activities: weekActivities.length,
        avgHr: avgHr ? Math.round(avgHr) : null,
        avgPace: avgPace ? avgPace / 60 : null, // min/km
      });
    }

    return weeks;
  };

  // Calculate activity type distribution
  const getActivityTypeDistribution = () => {
    if (!activities.length) return null;

    const types = {};
    activities.forEach(a => {
      const type = a.type || 'Other';
      if (!types[type]) {
        types[type] = { count: 0, distance: 0 };
      }
      types[type].count++;
      types[type].distance += a.distance || 0;
    });

    return Object.entries(types).map(([type, data]) => ({
      type,
      label: getActivityTypeLabel(type),
      count: data.count,
      distance: data.distance / 1000,
    }));
  };

  // Calculate average speed data for Garmin-style chart (individual points per activity)
  const getAverageSpeedData = () => {
    if (!activities.length) return null;

    // Filter running activities and sort by date
    const runningActivities = activities
      .filter(a => ['Run', 'TrailRun', 'VirtualRun'].includes(a.type))
      .filter(a => a.average_speed > 0)
      .sort((a, b) => new Date(a.start_date_local) - new Date(b.start_date_local));

    if (runningActivities.length === 0) return null;

    // Calculate average speed in km/h for each activity
    const speedsKmh = runningActivities.map(a => parseFloat((a.average_speed * 3.6).toFixed(1)));
    const avgSpeed = parseFloat((speedsKmh.reduce((sum, s) => sum + s, 0) / speedsKmh.length).toFixed(1));

    // Labels as dates
    const labels = runningActivities.map(a => {
      const date = new Date(a.start_date_local);
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    });

    return {
      labels,
      speeds: speedsKmh,
      avgSpeed,
    };
  };

  // Calculate daily data for detailed chart
  const getDailyChartData = () => {
    if (!activities.length) return null;

    const days = [];
    const now = new Date();
    const numDays = selectedPeriod === '4weeks' ? 28 : selectedPeriod === '8weeks' ? 56 : 84;

    for (let i = numDays - 1; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(day.getDate() - i);
      day.setHours(0, 0, 0, 0);

      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      const dayActivities = activities.filter(a => {
        const date = new Date(a.start_date_local);
        return date >= day && date <= dayEnd;
      });

      const distance = dayActivities.reduce((sum, a) => sum + (a.distance || 0), 0);

      days.push({
        date: day,
        label: day.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
        distance: distance / 1000,
        hasActivity: dayActivities.length > 0,
      });
    }

    return days;
  };

  // AI Report generation handler
  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    setReportError(null);

    try {
      // Fetch full athlete details (with personal_bests, paces, VAM, Conconi)
      const { data: athleteDetails, error: detailsError } = await getAthleteDetails(athleteId);
      if (detailsError) throw new Error('Error al obtener datos del atleta');

      // Map selectedPeriod to weeks
      const periodWeeks = selectedPeriod === '4weeks' ? 4 : selectedPeriod === '8weeks' ? 8 : 12;

      // Generate AI analysis via Edge Function (also saves to DB)
      const { reportData, aiAnalysis } = await generatePerformanceReport(
        athleteDetails,
        activities,
        periodWeeks
      );

      // Generate and download PDF
      generateReportPDF({
        athlete: athleteDetails,
        athleteName,
        reportData,
        aiAnalysis,
        generatedDate: new Date(),
      });

      showSuccess('Informe de rendimiento generado correctamente');
    } catch (error) {
      console.error('Error generating report:', error);
      setReportError(error.message || 'Error al generar el informe');
      showError('Error al generar el informe');
      // Auto-dismiss after 10 seconds
      setTimeout(() => setReportError(null), 10000);
    } finally {
      setGeneratingReport(false);
    }
  };

  const weeklyData = getWeeklyChartData();
  const activityTypes = getActivityTypeDistribution();
  const dailyData = getDailyChartData();
  const averageSpeedData = getAverageSpeedData();

  const athleteName = athlete
    ? `${athlete.user?.first_name || ''} ${athlete.user?.last_name || ''}`.trim() || 'Atleta'
    : 'Atleta';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <FiLoader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
          <button
            onClick={() => navigate(`/dashboard/athletes/${athleteId}`)}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
          >
            <FiArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
              Métricas de Rendimiento
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{athleteName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Period Selector */}
          <div className="flex items-center space-x-1 sm:space-x-2 bg-white dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
            {[
              { value: '4weeks', label: '4', labelFull: 'Semanas' },
              { value: '8weeks', label: '8', labelFull: 'Semanas' },
              { value: '12weeks', label: '12', labelFull: 'Semanas' },
            ].map((period) => (
              <button
                key={period.value}
                onClick={() => setSelectedPeriod(period.value)}
                className={`px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                  selectedPeriod === period.value
                    ? 'bg-sky-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {period.label} <span className="hidden sm:inline">{period.labelFull}</span><span className="sm:hidden">Sem.</span>
              </button>
            ))}
          </div>

          {/* AI Report Button */}
          <button
            onClick={handleGenerateReport}
            disabled={!stravaConnected || generatingReport || !activities.length}
            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white text-xs sm:text-sm font-medium rounded-lg shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            title="Generar informe de rendimiento con IA"
          >
            {generatingReport ? (
              <>
                <FiLoader className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Generando...</span>
              </>
            ) : (
              <>
                <BsStars className="w-4 h-4" />
                <span className="hidden sm:inline">Informe IA</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Report Error Banner */}
      {reportError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center justify-between"
        >
          <p className="text-sm text-red-600 dark:text-red-400">{reportError}</p>
          <button
            onClick={() => setReportError(null)}
            className="text-red-400 hover:text-red-600 dark:hover:text-red-300 ml-3"
          >
            <span className="text-lg leading-none">&times;</span>
          </button>
        </motion.div>
      )}

      {!stravaConnected ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center">
          <FiActivity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Sin conexión a Strava
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Este atleta no tiene Strava conectado. Las métricas se mostrarán cuando conecte su cuenta.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards with Comparison */}
          {periodComparison && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <FiActivity className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                  <span className={`text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded-full ${
                    periodComparison.changes.distance >= 0
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {periodComparison.changes.distance >= 0 ? '+' : ''}{periodComparison.changes.distance}%
                  </span>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
                  {(periodComparison.current.distance / 1000).toFixed(1)} km
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500">Distancia (últimas 2 sem.)</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <FiClock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                  <span className={`text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded-full ${
                    periodComparison.changes.time >= 0
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {periodComparison.changes.time >= 0 ? '+' : ''}{periodComparison.changes.time}%
                  </span>
                </div>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
                  {formatDuration(periodComparison.current.time)}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500">Tiempo (últimas 2 sem.)</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <FiCalendar className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
                  <span className={`text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded-full ${
                    periodComparison.changes.activities >= 0
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {periodComparison.changes.activities >= 0 ? '+' : ''}{periodComparison.changes.activities}%
                  </span>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {periodComparison.current.activities}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500">Actividades (últimas 2)</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <FiTrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                  <span className={`text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded-full ${
                    periodComparison.changes.elevation >= 0
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {periodComparison.changes.elevation >= 0 ? '+' : ''}{periodComparison.changes.elevation}%
                  </span>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {Math.round(periodComparison.current.elevation)}m
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500">Desnivel (últimas 2 sem.)</p>
              </motion.div>
            </div>
          )}

          {/* Race Time Predictor */}
          {racePredictions && Object.keys(racePredictions.predictions).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center space-x-2 mb-2">
                <FiTarget className="w-5 h-5 sm:w-6 sm:h-6 text-purple-500" />
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                  Predictor de Tiempos
                </h3>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 sm:mb-6">
                Basado en marca de {racePredictions.reference.name}: {racePredictions.reference.timeFormatted} (Fórmula de Riegel)
              </p>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {Object.entries(racePredictions.predictions).map(([distance, data]) => (
                  <div
                    key={distance}
                    className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800"
                  >
                    <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">
                      {distance}
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1">
                      {data.timeFormatted}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {data.pace} min/km
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* HR Training Zones */}
          {hrZoneData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center space-x-2 mb-2">
                <FiHeart className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                  Zonas de Entrenamiento
                </h3>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 sm:mb-6">
                FC Máx: {hrZoneData.maxHR} bpm | FC Reposo: {hrZoneData.restingHR} bpm (Karvonen)
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Doughnut Chart */}
                <div className="flex items-center justify-center">
                  {hrZoneData.totalHRActivities > 0 ? (
                    <div className="w-56 h-56 sm:w-64 sm:h-64">
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
                                  return `${ctx.label}: ${ctx.raw} act. (${pct}%)`;
                                },
                              },
                            },
                          },
                          cutout: '60%',
                        }}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FiHeart className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No hay datos de frecuencia cardíaca
                      </p>
                    </div>
                  )}
                </div>

                {/* Zone Table */}
                <div className="space-y-2">
                  {hrZoneData.zones.map((zone) => {
                    const pct = hrZoneData.totalHRActivities > 0
                      ? Math.round((zone.count / hrZoneData.totalHRActivities) * 100)
                      : 0;
                    return (
                      <div key={zone.name} className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: zone.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                              {zone.name}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">
                              {zone.bpmMin}-{zone.bpmMax} bpm
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.max(pct, 2)}%`,
                                backgroundColor: zone.color,
                              }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {zone.count} act. ({pct}%)
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* Dashboard de Carga */}
          {activities.length > 0 && loadData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <FiShield className="w-5 h-5 mr-2 text-orange-500" />
                Dashboard de Carga
              </h3>

              {/* Alert Banner (coach perspective) */}
              {(() => {
                const { acwr } = loadData;
                const name = athlete?.user?.first_name || 'El atleta';
                let alertConfig;
                if (acwr < 0.8) {
                  alertConfig = {
                    bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
                    text: 'text-blue-700 dark:text-blue-300',
                    message: `${name} tiene una carga por debajo de lo habitual. Considera aumentar el volumen gradualmente.`,
                  };
                } else if (acwr <= 1.3) {
                  alertConfig = {
                    bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
                    text: 'text-green-700 dark:text-green-300',
                    message: `La carga de ${name} está en zona óptima. Buen equilibrio entre estímulo y recuperación.`,
                  };
                } else if (acwr <= 1.5) {
                  alertConfig = {
                    bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
                    text: 'text-orange-700 dark:text-orange-300',
                    message: `Atención: la carga de ${name} está aumentando rápidamente. Valora moderar el volumen esta semana.`,
                  };
                } else {
                  alertConfig = {
                    bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
                    text: 'text-red-700 dark:text-red-300',
                    message: `Alerta: ${name} presenta riesgo elevado de sobrecarga. Recomendable reducir intensidad y volumen.`,
                  };
                }
                return (
                  <div className={`flex items-center p-3 rounded-lg border text-sm ${alertConfig.bg} ${alertConfig.text} mb-6`}>
                    <FiAlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span>{alertConfig.message}</span>
                  </div>
                );
              })()}

              {/* Gauge + Load Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="flex items-center justify-center">
                  <ACWRGauge acwr={loadData.acwr} />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 sm:p-4 text-center">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">Carga Aguda</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                      {loadData.acuteLoad}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">km (7 días)</p>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 sm:p-4 text-center">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">Carga Crónica</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                      {loadData.chronicLoadWeekly}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">km/sem (4 sem)</p>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 sm:p-4 text-center">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">ACWR</p>
                    <p className={`text-lg sm:text-2xl font-bold ${getACWRZone(loadData.acwr).textClass}`}>
                      {loadData.acwr.toFixed(2)}
                    </p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${getACWRZone(loadData.acwr).badgeClass}`}>
                      {getACWRZone(loadData.acwr).label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Weekly Load Bar Chart */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Carga semanal (últimas 8 semanas)
                </h4>
                <div className="h-48 sm:h-64">
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
                        x: {
                          grid: { display: false },
                          ticks: { color: 'rgb(156, 163, 175)' },
                        },
                        y: {
                          beginAtZero: true,
                          grid: { color: 'rgba(156, 163, 175, 0.1)' },
                          ticks: { color: 'rgb(156, 163, 175)' },
                          title: { display: true, text: 'Kilómetros', color: 'rgb(156, 163, 175)' },
                        },
                      },
                    }}
                  />
                </div>
              </div>

              {/* Zone legend */}
              <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center"><span className="w-3 h-3 rounded-full bg-blue-500 mr-1" />Bajo (&lt;0.8)</span>
                <span className="flex items-center"><span className="w-3 h-3 rounded-full bg-green-500 mr-1" />Óptimo (0.8-1.3)</span>
                <span className="flex items-center"><span className="w-3 h-3 rounded-full bg-orange-500 mr-1" />Alto (1.3-1.5)</span>
                <span className="flex items-center"><span className="w-3 h-3 rounded-full bg-red-500 mr-1" />Peligro (&gt;1.5)</span>
              </div>
            </motion.div>
          )}

          {/* Weekly Distance Chart */}
          {weeklyData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <FiBarChart2 className="w-5 h-5 mr-2 text-orange-500" />
                Volumen Semanal (km)
              </h3>
              <div className="h-64">
                <Bar
                  data={{
                    labels: weeklyData.map(w => w.label),
                    datasets: [
                      {
                        label: 'Distancia (km)',
                        data: weeklyData.map(w => w.distance.toFixed(1)),
                        backgroundColor: 'rgba(249, 115, 22, 0.8)',
                        borderColor: '#f97316',
                        borderWidth: 1,
                        borderRadius: 6,
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
                          label: (ctx) => `${ctx.parsed.y} km`,
                        },
                      },
                    },
                    scales: {
                      x: {
                        grid: { display: false },
                      },
                      y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: {
                          callback: (val) => `${val} km`,
                        },
                      },
                    },
                  }}
                />
              </div>
            </motion.div>
          )}

          {/* Two Column Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weekly Time Chart */}
            {weeklyData && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700"
              >
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                  <FiClock className="w-5 h-5 mr-2 text-blue-500" />
                  Tiempo Semanal (min)
                </h3>
                <div className="h-48">
                  <Line
                    data={{
                      labels: weeklyData.map(w => w.label),
                      datasets: [
                        {
                          label: 'Tiempo (min)',
                          data: weeklyData.map(w => Math.round(w.time)),
                          borderColor: '#3b82f6',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          fill: true,
                          tension: 0.4,
                          pointRadius: 4,
                          pointBackgroundColor: '#3b82f6',
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
                        x: { grid: { display: false } },
                        y: {
                          beginAtZero: true,
                          grid: { color: 'rgba(0,0,0,0.05)' },
                        },
                      },
                    }}
                  />
                </div>
              </motion.div>
            )}

            {/* Weekly Elevation Chart */}
            {weeklyData && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700"
              >
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                  <FiTrendingUp className="w-5 h-5 mr-2 text-green-500" />
                  Desnivel Semanal (m)
                </h3>
                <div className="h-48">
                  <Bar
                    data={{
                      labels: weeklyData.map(w => w.label),
                      datasets: [
                        {
                          label: 'Desnivel (m)',
                          data: weeklyData.map(w => Math.round(w.elevation)),
                          backgroundColor: 'rgba(34, 197, 94, 0.8)',
                          borderColor: '#22c55e',
                          borderWidth: 1,
                          borderRadius: 6,
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
                        x: { grid: { display: false } },
                        y: {
                          beginAtZero: true,
                          grid: { color: 'rgba(0,0,0,0.05)' },
                        },
                      },
                    }}
                  />
                </div>
              </motion.div>
            )}
          </div>

          {/* Average Speed Chart (Garmin style) */}
          {averageSpeedData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <FiZap className="w-5 h-5 mr-2 text-blue-500" />
                Velocidad Media
              </h3>
              {/* Average line indicator */}
              <div className="flex items-center justify-end mb-2 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center">
                  <div className="w-8 h-0.5 bg-gray-400 dark:bg-gray-500 mr-2"></div>
                  <span>Media = {averageSpeedData.avgSpeed} km/h</span>
                </div>
              </div>
              <div className="h-64">
                <Line
                  data={{
                    labels: averageSpeedData.labels,
                    datasets: [
                      // Average line
                      {
                        label: 'Media',
                        data: averageSpeedData.labels.map(() => averageSpeedData.avgSpeed),
                        borderColor: 'rgba(156, 163, 175, 0.6)',
                        borderDash: [5, 5],
                        borderWidth: 1,
                        pointRadius: 0,
                        fill: false,
                      },
                      // Individual points
                      {
                        label: 'Velocidad (km/h)',
                        data: averageSpeedData.speeds,
                        borderColor: 'transparent',
                        backgroundColor: 'rgba(59, 130, 246, 0.8)',
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
                          maxTicksLimit: 10,
                        },
                      },
                      y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        title: {
                          display: true,
                          text: 'Kilómetros por hora',
                        },
                      },
                    },
                  }}
                />
              </div>
            </motion.div>
          )}

          {/* HR and Pace Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Average HR Evolution */}
            {weeklyData && weeklyData.some(w => w.avgHr) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700"
              >
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                  <FiHeart className="w-5 h-5 mr-2 text-red-500" />
                  FC Media Semanal (bpm)
                </h3>
                <div className="h-48">
                  <Line
                    data={{
                      labels: weeklyData.map(w => w.label),
                      datasets: [
                        {
                          label: 'FC Media (bpm)',
                          data: weeklyData.map(w => w.avgHr),
                          borderColor: '#ef4444',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          fill: true,
                          tension: 0.4,
                          pointRadius: 4,
                          pointBackgroundColor: '#ef4444',
                          spanGaps: true,
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
                        x: { grid: { display: false } },
                        y: {
                          grid: { color: 'rgba(0,0,0,0.05)' },
                          suggestedMin: 100,
                          suggestedMax: 180,
                        },
                      },
                    }}
                  />
                </div>
              </motion.div>
            )}

            {/* Average Pace Evolution */}
            {weeklyData && weeklyData.some(w => w.avgPace) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700"
              >
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                  <FiZap className="w-5 h-5 mr-2 text-purple-500" />
                  Ritmo Medio Semanal (min/km)
                </h3>
                <div className="h-48">
                  <Line
                    data={{
                      labels: weeklyData.map(w => w.label),
                      datasets: [
                        {
                          label: 'Ritmo (min/km)',
                          data: weeklyData.map(w => w.avgPace?.toFixed(2)),
                          borderColor: '#8b5cf6',
                          backgroundColor: 'rgba(139, 92, 246, 0.1)',
                          fill: true,
                          tension: 0.4,
                          pointRadius: 4,
                          pointBackgroundColor: '#8b5cf6',
                          spanGaps: true,
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
                              const val = ctx.parsed.y;
                              const min = Math.floor(val);
                              const sec = Math.round((val - min) * 60);
                              return `${min}:${sec.toString().padStart(2, '0')} /km`;
                            },
                          },
                        },
                      },
                      scales: {
                        x: { grid: { display: false } },
                        y: {
                          reverse: true, // Lower pace is better
                          grid: { color: 'rgba(0,0,0,0.05)' },
                          ticks: {
                            callback: (val) => {
                              const min = Math.floor(val);
                              const sec = Math.round((val - min) * 60);
                              return `${min}:${sec.toString().padStart(2, '0')}`;
                            },
                          },
                        },
                      },
                    }}
                  />
                </div>
              </motion.div>
            )}
          </div>

          {/* Activity Type Distribution and Daily Heatmap */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Activity Type Distribution */}
            {activityTypes && activityTypes.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700"
              >
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                  <FiActivity className="w-5 h-5 mr-2 text-indigo-500" />
                  Tipos de Actividad
                </h3>
                <div className="h-48 flex items-center justify-center">
                  <Doughnut
                    data={{
                      labels: activityTypes.map(t => t.label),
                      datasets: [
                        {
                          data: activityTypes.map(t => t.count),
                          backgroundColor: [
                            '#f97316',
                            '#3b82f6',
                            '#22c55e',
                            '#8b5cf6',
                            '#ef4444',
                            '#eab308',
                            '#ec4899',
                          ],
                          borderWidth: 0,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'right',
                          labels: {
                            boxWidth: 12,
                            font: { size: 11 },
                          },
                        },
                      },
                    }}
                  />
                </div>
                <div className="mt-4 space-y-1">
                  {activityTypes.slice(0, 3).map((type, i) => (
                    <div key={type.type} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{type.label}</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {type.distance.toFixed(1)} km
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Activity Calendar / Heatmap */}
            {dailyData && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 lg:col-span-2"
              >
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                  <FiCalendar className="w-5 h-5 mr-2 text-teal-500" />
                  Calendario de Actividad
                </h3>
                <div className="grid grid-cols-7 gap-1">
                  {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => (
                    <div key={day} className="text-center text-xs text-gray-500 font-medium py-1">
                      {day}
                    </div>
                  ))}
                  {dailyData.map((day, i) => {
                    const intensity = day.distance > 0
                      ? Math.min(day.distance / 15, 1) // Normalize to max 15km
                      : 0;

                    return (
                      <div
                        key={i}
                        className={`aspect-square rounded-sm flex items-center justify-center text-xs ${
                          day.hasActivity
                            ? 'text-white'
                            : 'text-gray-400 dark:text-gray-600'
                        }`}
                        style={{
                          backgroundColor: day.hasActivity
                            ? `rgba(249, 115, 22, ${0.3 + intensity * 0.7})`
                            : 'rgba(0,0,0,0.05)',
                        }}
                        title={`${day.label}: ${day.distance.toFixed(1)} km`}
                      >
                        {day.date.getDate()}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center justify-end space-x-2 text-xs text-gray-500">
                  <span>Menos</span>
                  <div className="flex space-x-1">
                    {[0.1, 0.3, 0.5, 0.7, 1].map((opacity) => (
                      <div
                        key={opacity}
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: `rgba(249, 115, 22, ${opacity})` }}
                      />
                    ))}
                  </div>
                  <span>Más</span>
                </div>
              </motion.div>
            )}
          </div>

          {/* Metrics Summary */}
          {metrics && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 text-white"
            >
              <h3 className="text-lg font-bold mb-4 flex items-center">
                <FiTarget className="w-5 h-5 mr-2" />
                Resumen del Período
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div>
                  <p className="text-orange-100 text-sm">Total Actividades</p>
                  <p className="text-2xl font-bold">{metrics.totalActivities}</p>
                </div>
                <div>
                  <p className="text-orange-100 text-sm">Distancia Total</p>
                  <p className="text-2xl font-bold">{metrics.totalDistanceKm} km</p>
                </div>
                <div>
                  <p className="text-orange-100 text-sm">Tiempo Total</p>
                  <p className="text-2xl font-bold">{metrics.totalTimeFormatted}</p>
                </div>
                <div>
                  <p className="text-orange-100 text-sm">Desnivel Total</p>
                  <p className="text-2xl font-bold">{metrics.totalElevation}m</p>
                </div>
                <div>
                  <p className="text-orange-100 text-sm">Ritmo Medio</p>
                  <p className="text-2xl font-bold">{metrics.avgPace || '-'}</p>
                </div>
                <div>
                  <p className="text-orange-100 text-sm">FC Media</p>
                  <p className="text-2xl font-bold">{metrics.avgHeartrate || '-'} {metrics.avgHeartrate && 'bpm'}</p>
                </div>
              </div>

              {/* Best Performances */}
              {(metrics.longestRun || metrics.fastestPace) && (
                <div className="mt-6 pt-4 border-t border-orange-400/30">
                  <p className="text-orange-100 text-sm mb-3">Mejores Resultados</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {metrics.longestRun && (
                      <div className="bg-white/10 rounded-lg p-3">
                        <p className="text-orange-100 text-xs">Carrera más larga</p>
                        <p className="font-bold">{metrics.longestRun.distanceKm} km</p>
                        <p className="text-sm text-orange-200">{metrics.longestRun.name}</p>
                      </div>
                    )}
                    {metrics.fastestPace && (
                      <div className="bg-white/10 rounded-lg p-3">
                        <p className="text-orange-100 text-xs">Ritmo más rápido</p>
                        <p className="font-bold">{metrics.fastestPace.pace}</p>
                        <p className="text-sm text-orange-200">{metrics.fastestPace.name}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

        </div>
      )}
    </div>
  );
};

export default AthleteMetricsView;

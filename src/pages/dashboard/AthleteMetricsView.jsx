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
  FiShield,
  FiNavigation,
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
} from '../../services/stravaService';
import { calculateVdot, predictAllRaceTimes } from '../../lib/trainingMetrics';
import { generatePerformanceReport, getDailyLoads, calculateLoadMetrics } from '../../services/aiReportService';
import ACWRGauge, { getACWRZone } from '../../components/shared/ACWRGauge';
import { generateReportPDF } from '../../lib/reportPdfExport';
import PMCChart from '../../components/athlete/PMCChart';
import TrainingZonesCard from '../../components/athlete/TrainingZonesCard';
import InfoTooltip from '../../components/common/InfoTooltip';
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
      const wStart = new Date(); wStart.setDate(wStart.getDate() - w * 7 - wStart.getDay() + 1);
      weeklyLoads.push({
        weekIndex: 7 - w,
        km: +weekKm.toFixed(1),
        label: w === 0 ? 'Esta sem.' : wStart.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
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

  // Race time predictions using Daniels-Gilbert VDOT model
  const racePredictions = useMemo(() => {
    // 1. Try stored VDOT from athlete profile
    let vdot = athlete?.vdot;

    // 2. If no stored VDOT, calculate from best effort
    if (!vdot && bestEfforts?.length) {
      let bestVdot = 0;
      for (const e of bestEfforts) {
        if (!e.distance || !e.time) continue;
        const v = calculateVdot(e.distance, e.time / 60);
        if (v && v > bestVdot) bestVdot = v;
      }
      if (bestVdot > 0) vdot = bestVdot;
    }

    if (!vdot) return null;

    const predictions = predictAllRaceTimes(vdot);
    if (!predictions) return null;

    return { vdot: Math.round(vdot * 10) / 10, predictions };
  }, [bestEfforts, athlete?.vdot]);

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

  // Per-sport weekly charts data
  const sportCharts = useMemo(() => {
    if (!activities?.length) return {};

    const now = new Date();
    const CYCLING_TYPES = ['Ride', 'VirtualRide'];
    const SWIM_TYPES = ['Swim'];
    const GYM_TYPES = ['WeightTraining', 'Workout', 'CrossFit', 'Yoga'];

    const buildWeeklyData = (filterFn, metricFn) => {
      const weeks = [];
      for (let w = 7; w >= 0; w--) {
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() - w * 7);
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);

        const weekActs = activities.filter(a => {
          if (!filterFn(a)) return false;
          const d = new Date(a.start_date_local);
          return d >= weekStart && d <= weekEnd;
        });

        const wLabel = w === 0 ? 'Esta sem.' : weekStart.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        weeks.push({
          label: wLabel,
          ...metricFn(weekActs),
        });
      }
      return weeks;
    };

    const result = {};

    // Cycling
    const cyclingActs = activities.filter(a => CYCLING_TYPES.includes(a.type));
    if (cyclingActs.length > 0) {
      const weeklyKm = buildWeeklyData(
        a => CYCLING_TYPES.includes(a.type),
        acts => ({
          km: +(acts.reduce((s, a) => s + (a.distance || 0), 0) / 1000).toFixed(1),
          elevation: Math.round(acts.reduce((s, a) => s + (a.total_elevation_gain || 0), 0)),
          avgSpeed: acts.length > 0
            ? +((acts.reduce((s, a) => s + (a.average_speed || 0), 0) / acts.length) * 3.6).toFixed(1)
            : 0,
          count: acts.length,
        })
      );

      const hrActs = cyclingActs.filter(a => a.average_heartrate);
      result.cycling = {
        weeklyKm,
        totalKm: +(cyclingActs.reduce((s, a) => s + (a.distance || 0), 0) / 1000).toFixed(1),
        totalElevation: Math.round(cyclingActs.reduce((s, a) => s + (a.total_elevation_gain || 0), 0)),
        avgSpeed: +((cyclingActs.reduce((s, a) => s + (a.average_speed || 0), 0) / cyclingActs.length) * 3.6).toFixed(1),
        avgHR: hrActs.length > 0 ? Math.round(hrActs.reduce((s, a) => s + a.average_heartrate, 0) / hrActs.length) : null,
        count: cyclingActs.length,
      };
    }

    // Swimming
    const swimActs = activities.filter(a => SWIM_TYPES.includes(a.type));
    if (swimActs.length > 0) {
      const weeklyMeters = buildWeeklyData(
        a => SWIM_TYPES.includes(a.type),
        acts => ({
          meters: Math.round(acts.reduce((s, a) => s + (a.distance || 0), 0)),
          avgPace100m: acts.length > 0 ? (() => {
            const totalDist = acts.reduce((s, a) => s + (a.distance || 0), 0);
            const totalTime = acts.reduce((s, a) => s + (a.moving_time || 0), 0);
            if (totalDist === 0) return 0;
            return Math.round(totalTime / (totalDist / 100));
          })() : 0,
          count: acts.length,
        })
      );

      result.swimming = {
        weeklyMeters,
        totalMeters: Math.round(swimActs.reduce((s, a) => s + (a.distance || 0), 0)),
        avgPace100m: (() => {
          const d = swimActs.reduce((s, a) => s + (a.distance || 0), 0);
          const t = swimActs.reduce((s, a) => s + (a.moving_time || 0), 0);
          if (d === 0) return '-';
          const secs = Math.round(t / (d / 100));
          return `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`;
        })(),
        count: swimActs.length,
      };
    }

    // Gym / Strength
    const gymActs = activities.filter(a => GYM_TYPES.includes(a.type));
    if (gymActs.length > 0) {
      const weeklyGym = buildWeeklyData(
        a => GYM_TYPES.includes(a.type),
        acts => ({
          sessions: acts.length,
          totalMinutes: Math.round(acts.reduce((s, a) => s + (a.moving_time || 0), 0) / 60),
        })
      );

      result.gym = {
        weeklyGym,
        totalSessions: gymActs.length,
        avgDurationMin: Math.round(gymActs.reduce((s, a) => s + (a.moving_time || 0), 0) / 60 / gymActs.length),
        totalMinutes: Math.round(gymActs.reduce((s, a) => s + (a.moving_time || 0), 0) / 60),
        count: gymActs.length,
      };
    }

    return result;
  }, [activities]);

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

      const runningDistance = runningActivities.reduce((sum, a) => sum + (a.distance || 0), 0);
      const runningTime = runningActivities.reduce((sum, a) => sum + (a.moving_time || 0), 0);
      const time = weekActivities.reduce((sum, a) => sum + (a.moving_time || 0), 0);
      const elevation = weekActivities.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0);

      // HR only from running activities to avoid mixing intensities
      const hrActivities = runningActivities.filter(a => a.average_heartrate);
      const avgHr = hrActivities.length > 0
        ? hrActivities.reduce((sum, a) => sum + a.average_heartrate, 0) / hrActivities.length
        : null;

      const avgPace = runningDistance > 0 ? runningTime / (runningDistance / 1000) : null;

      // Format week label as date range (e.g., "13-19 Ene")
      const startDay = weekStart.getDate();
      const endDay = weekEnd.getDate();
      const monthShort = weekStart.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');

      weeks.push({
        label: `${startDay}-${endDay} ${monthShort.charAt(0).toUpperCase() + monthShort.slice(1)}`,
        distance: runningDistance / 1000,
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
                className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-3 sm:p-4 sm:p-5 text-white shadow-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs sm:text-sm font-medium opacity-90">Running</span>
                  <span className={`text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded-full bg-white/20 ${
                    periodComparison.changes.distance >= 0 ? 'text-white' : 'text-white'
                  }`}>
                    {periodComparison.changes.distance >= 0 ? '+' : ''}{periodComparison.changes.distance}%
                  </span>
                </div>
                <p className="text-xl sm:text-2xl font-bold mb-1 truncate">
                  {(periodComparison.current.distance / 1000).toFixed(1)} km
                </p>
                <p className="text-xs opacity-75">Distancia (últimas 2 sem.)</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-3 sm:p-4 sm:p-5 text-white shadow-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs sm:text-sm font-medium opacity-90">Tiempo</span>
                  <span className="text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded-full bg-white/20 text-white">
                    {periodComparison.changes.time >= 0 ? '+' : ''}{periodComparison.changes.time}%
                  </span>
                </div>
                <p className="text-lg sm:text-2xl font-bold mb-1 truncate">
                  {formatDuration(periodComparison.current.time)}
                </p>
                <p className="text-xs opacity-75">Tiempo (últimas 2 sem.)</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-3 sm:p-4 sm:p-5 text-white shadow-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs sm:text-sm font-medium opacity-90">Actividades</span>
                  <span className="text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded-full bg-white/20 text-white">
                    {periodComparison.changes.activities >= 0 ? '+' : ''}{periodComparison.changes.activities}%
                  </span>
                </div>
                <p className="text-xl sm:text-2xl font-bold mb-1">
                  {periodComparison.current.activities}
                </p>
                <p className="text-xs opacity-75">Actividades (últimas 2)</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gradient-to-br from-yellow-500 to-amber-600 rounded-xl p-3 sm:p-4 sm:p-5 text-white shadow-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs sm:text-sm font-medium opacity-90">Desnivel</span>
                  <span className="text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded-full bg-white/20 text-white">
                    {periodComparison.changes.elevation >= 0 ? '+' : ''}{periodComparison.changes.elevation}%
                  </span>
                </div>
                <p className="text-xl sm:text-2xl font-bold mb-1">
                  {Math.round(periodComparison.current.elevation)}m
                </p>
                <p className="text-xs opacity-75">Desnivel (últimas 2 sem.)</p>
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
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center">
                  Predictor de Tiempos
                  <InfoTooltip text="Estimación de tiempos usando el modelo VDOT de Jack Daniels, el mismo sistema que usan relojes deportivos como COROS y Garmin. Basado en la mejor marca registrada del atleta." />
                </h3>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 sm:mb-6">
                VDOT: {racePredictions.vdot} — Modelo Daniels-Gilbert
              </p>

              {(() => {
                const barColors = { '5 km': 'bg-blue-500', '10 km': 'bg-green-500', 'Media Maratón': 'bg-orange-500', 'Maratón': 'bg-red-500' };
                return (
                  <div className="grid grid-cols-2 gap-2.5">
                    {Object.entries(racePredictions.predictions).slice(0, 4).map(([distance, data]) => (
                      <div key={distance} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3.5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
                          {distance.toUpperCase()}
                        </p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white leading-none mb-0.5">
                          {data.timeFormatted}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
                          {data.pace} min/km
                        </p>
                        <div className="w-full h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div className={`h-1 rounded-full ${barColors[distance] || 'bg-violet-500'}`} style={{ width: '100%' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </motion.div>
          )}

          {/* HR Training Zones */}
          {hrZoneData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-5 border border-gray-200 dark:border-gray-700"
            >
              {/* Header */}
              <div className="flex items-center gap-2 mb-0.5">
                <FiHeart className="w-4 h-4 text-red-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Zonas de Entrenamiento
                  <InfoTooltip text="Zonas de entrenamiento basadas en frecuencia cardíaca calculadas con la fórmula de Karvonen (% de la frecuencia cardíaca de reserva). Cada zona trabaja un sistema energético diferente." />
                </h3>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
                FC Máx: {hrZoneData.maxHR} bpm · FC Reposo: {hrZoneData.restingHR} bpm
              </p>

              {/* Zone list */}
              <div className="space-y-2 mb-5">
                {hrZoneData.zones.map((zone) => (
                  <div key={zone.name} className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: zone.color }} />
                    <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300">{zone.name}</span>
                    <span className="text-xs font-mono text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      {zone.bpmMin}–{zone.bpmMax} bpm
                    </span>
                  </div>
                ))}
              </div>

              {/* Distribución por zona */}
              <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-0.5">Distribución por zona</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-3">
                  Basado en FC media de cada actividad
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
                        <span className="text-lg font-bold text-slate-900 dark:text-white">
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
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 w-20 truncate">{shortName}</span>
                            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 w-8 text-right flex-shrink-0">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <FiHeart className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No hay datos de frecuencia cardíaca</p>
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
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 w-24 flex-shrink-0">{shortName}</span>
                          <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-2 rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: zone.color }}
                            />
                          </div>
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 w-7 text-right flex-shrink-0">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Dashboard de Carga */}
          {activities.length > 0 && loadData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-5 border border-gray-200 dark:border-gray-700"
            >
              {/* Header */}
              <div className="flex items-center gap-2 mb-1">
                <FiZap className="w-4 h-4 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Gestión de Carga
                  <InfoTooltip text="Ratio de carga aguda/crónica (ACWR): compara el volumen de la última semana con la media de las 4 anteriores. Zona óptima: 0.8–1.3. Por encima de 1.5 aumenta el riesgo de lesión." />
                </h3>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">ACWR · ratio carga aguda/crónica</p>

              {/* Alert banner */}
              {(() => {
                const { acwr } = loadData;
                const name = athlete?.user?.first_name || 'El atleta';
                let cfg;
                if (acwr < 0.8) cfg = { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', icon: '📉', msg: `${name} tiene una carga por debajo de lo habitual. Considera aumentar el volumen gradualmente.` };
                else if (acwr <= 1.3) cfg = { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', icon: '✓', msg: `La carga de ${name} está en zona óptima. Buen equilibrio entre estímulo y recuperación.` };
                else if (acwr <= 1.5) cfg = { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', icon: '⚠', msg: `Atención: la carga de ${name} está aumentando rápidamente. Valora moderar el volumen esta semana.` };
                else cfg = { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', icon: '🚨', msg: `Alerta: ${name} presenta riesgo elevado de sobrecarga. Recomendable reducir intensidad y volumen.` };
                return (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium ${cfg.bg} ${cfg.text} mb-4`}>
                    <span className="flex-shrink-0">{cfg.icon}</span>
                    <span>{cfg.msg}</span>
                  </div>
                );
              })()}

              {/* Gauge centrado */}
              <div className="flex flex-col items-center mb-4">
                <ACWRGauge acwr={loadData.acwr} />
              </div>

              {/* 3 stat chips */}
              <div className="grid grid-cols-3 gap-2.5 mb-4">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-1">Carga aguda</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{loadData.acuteLoad}</p>
                  <p className="text-[10px] text-slate-400">km · 7 días</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-1">Carga crónica</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{loadData.chronicLoadWeekly}</p>
                  <p className="text-[10px] text-slate-400">km/sem · 4 sem</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-1">ACWR</p>
                  <p className={`text-xl font-bold ${getACWRZone(loadData.acwr).textClass}`}>{loadData.acwr.toFixed(2)}</p>
                  <p className={`text-[10px] font-medium ${getACWRZone(loadData.acwr).textClass}`}>{getACWRZone(loadData.acwr).label}</p>
                </div>
              </div>

              {/* Weekly Load Bar Chart */}
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
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
                      x: { grid: { display: false }, ticks: { color: 'rgb(156,163,175)', font: { size: 10 } } },
                      y: { beginAtZero: true, grid: { color: 'rgba(156,163,175,0.1)' }, ticks: { color: 'rgb(156,163,175)', font: { size: 10 } } },
                    },
                  }}
                />
              </div>

              {/* Zone legend */}
              <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] text-slate-400 dark:text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Bajo</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" />Óptimo</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" />Alto</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" />Peligro</span>
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
                Volumen Semanal Running (km)
                <InfoTooltip text="Kilómetros de running recorridos cada semana. Solo incluye carrera, trail y carrera virtual. Permite ver la progresión del volumen y detectar aumentos bruscos de carga." />
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

          {/* PMC Chart (CTL/ATL/TSB) - Coach view */}
          {stravaConnected && activities.length > 0 && (
            <PMCChart
              activities={activities}
              athleteProfile={athlete?.athlete}
              athleteId={athleteId}
            />
          )}

          {/* Training Zones - Coach view */}
          {stravaConnected && (
            <TrainingZonesCard
              bestEfforts={
                activities.flatMap(a => a.best_efforts || []).length > 0
                  ? activities.flatMap(a => a.best_efforts || [])
                  : bestEfforts.map(e => ({ name: e.name, distance: e.distance, elapsed_time: e.time }))
              }
              athleteId={athleteId}
            />
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
                  <InfoTooltip text="Minutos totales de entrenamiento por semana. Complementa el volumen en km ya que incluye todas las actividades independientemente de la distancia." />
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
                  <InfoTooltip text="Metros de desnivel positivo acumulado cada semana. Indicador clave para corredores de montaña y trail." />
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
                Velocidad Media por Actividad
                <InfoTooltip text="Velocidad media (km/h) de cada actividad a lo largo del tiempo. La línea punteada indica la media general. Permite ver tendencias de mejora o fatiga." />
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
                  FC Media Semanal Running (ppm)
                  <InfoTooltip text="Frecuencia cardíaca media de las actividades de running de cada semana. Si baja a mismo ritmo, indica mejora de eficiencia cardíaca. Si sube sin aumentar intensidad, puede indicar fatiga." />
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
                  <InfoTooltip text="Ritmo medio de carrera (minutos por kilómetro) cada semana. Un descenso indica que se corre más rápido. El eje está invertido: más abajo = más rápido." />
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

          {/* ── Sport-Specific Sections ── */}

          {/* Cycling Section */}
          {sportCharts.cycling && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <FiNavigation className="w-5 h-5 mr-2 text-yellow-500" />
                Ciclismo
                <InfoTooltip text="Métricas de ciclismo: km semanales, velocidad media y desnivel acumulado. Solo incluye Ride y VirtualRide." />
              </h3>

              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
                  <p className="text-xl sm:text-2xl font-bold text-yellow-700 dark:text-yellow-300">{sportCharts.cycling.totalKm}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">km totales</p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
                  <p className="text-xl sm:text-2xl font-bold text-yellow-700 dark:text-yellow-300">{sportCharts.cycling.avgSpeed}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">km/h media</p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
                  <p className="text-xl sm:text-2xl font-bold text-yellow-700 dark:text-yellow-300">{sportCharts.cycling.totalElevation}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">m desnivel</p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
                  <p className="text-xl sm:text-2xl font-bold text-yellow-700 dark:text-yellow-300">{sportCharts.cycling.avgHR || '-'}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">bpm media</p>
                </div>
              </div>

              {/* Weekly km + speed chart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Km semanales</h4>
                  <div className="h-48">
                    <Bar
                      data={{
                        labels: sportCharts.cycling.weeklyKm.map(w => w.label),
                        datasets: [{
                          label: 'km',
                          data: sportCharts.cycling.weeklyKm.map(w => w.km),
                          backgroundColor: 'rgba(245, 158, 11, 0.7)',
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
                          y: { beginAtZero: true, grid: { color: 'rgba(156,163,175,0.1)' }, title: { display: true, text: 'km' } },
                        },
                      }}
                    />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Velocidad media semanal</h4>
                  <div className="h-48">
                    <Line
                      data={{
                        labels: sportCharts.cycling.weeklyKm.map(w => w.label),
                        datasets: [{
                          label: 'km/h',
                          data: sportCharts.cycling.weeklyKm.map(w => w.avgSpeed),
                          borderColor: 'rgb(245, 158, 11)',
                          backgroundColor: 'rgba(245, 158, 11, 0.1)',
                          fill: true,
                          tension: 0.4,
                          pointRadius: 4,
                          pointBackgroundColor: 'rgb(245, 158, 11)',
                        }],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                          x: { grid: { display: false } },
                          y: { beginAtZero: false, grid: { color: 'rgba(156,163,175,0.1)' }, title: { display: true, text: 'km/h' } },
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
              transition={{ delay: 0.6 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <FiActivity className="w-5 h-5 mr-2 text-cyan-500" />
                Natación
                <InfoTooltip text="Métricas de natación: metros semanales y ritmo medio por 100m." />
              </h3>

              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-3 text-center">
                  <p className="text-xl sm:text-2xl font-bold text-cyan-700 dark:text-cyan-300">{sportCharts.swimming.totalMeters}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">metros totales</p>
                </div>
                <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-3 text-center">
                  <p className="text-xl sm:text-2xl font-bold text-cyan-700 dark:text-cyan-300">{sportCharts.swimming.avgPace100m}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">min/100m</p>
                </div>
                <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-3 text-center">
                  <p className="text-xl sm:text-2xl font-bold text-cyan-700 dark:text-cyan-300">{sportCharts.swimming.count}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">sesiones</p>
                </div>
              </div>

              {/* Weekly meters chart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Metros semanales</h4>
                  <div className="h-48">
                    <Bar
                      data={{
                        labels: sportCharts.swimming.weeklyMeters.map(w => w.label),
                        datasets: [{
                          label: 'metros',
                          data: sportCharts.swimming.weeklyMeters.map(w => w.meters),
                          backgroundColor: 'rgba(14, 165, 233, 0.7)',
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
                          y: { beginAtZero: true, grid: { color: 'rgba(156,163,175,0.1)' }, title: { display: true, text: 'metros' } },
                        },
                      }}
                    />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Ritmo medio /100m</h4>
                  <div className="h-48">
                    <Line
                      data={{
                        labels: sportCharts.swimming.weeklyMeters.map(w => w.label),
                        datasets: [{
                          label: 'seg/100m',
                          data: sportCharts.swimming.weeklyMeters.map(w => w.avgPace100m),
                          borderColor: 'rgb(14, 165, 233)',
                          backgroundColor: 'rgba(14, 165, 233, 0.1)',
                          fill: true,
                          tension: 0.4,
                          pointRadius: 4,
                          pointBackgroundColor: 'rgb(14, 165, 233)',
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
                            grid: { color: 'rgba(156,163,175,0.1)' },
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
              transition={{ delay: 0.65 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <FiZap className="w-5 h-5 mr-2 text-indigo-500" />
                Fuerza / Gimnasio
                <InfoTooltip text="Sesiones de fuerza, pesas, CrossFit y yoga. Muestra frecuencia semanal y duración media." />
              </h3>

              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 text-center">
                  <p className="text-xl sm:text-2xl font-bold text-indigo-700 dark:text-indigo-300">{sportCharts.gym.totalSessions}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">sesiones</p>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 text-center">
                  <p className="text-xl sm:text-2xl font-bold text-indigo-700 dark:text-indigo-300">{sportCharts.gym.avgDurationMin}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">min/sesión</p>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 text-center">
                  <p className="text-xl sm:text-2xl font-bold text-indigo-700 dark:text-indigo-300">{sportCharts.gym.totalMinutes}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">min totales</p>
                </div>
              </div>

              {/* Weekly sessions + duration chart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Sesiones semanales</h4>
                  <div className="h-48">
                    <Bar
                      data={{
                        labels: sportCharts.gym.weeklyGym.map(w => w.label),
                        datasets: [{
                          label: 'sesiones',
                          data: sportCharts.gym.weeklyGym.map(w => w.sessions),
                          backgroundColor: 'rgba(99, 102, 241, 0.7)',
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
                            grid: { color: 'rgba(156,163,175,0.1)' },
                            title: { display: true, text: 'sesiones' },
                            ticks: { stepSize: 1 },
                          },
                        },
                      }}
                    />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Duración semanal</h4>
                  <div className="h-48">
                    <Bar
                      data={{
                        labels: sportCharts.gym.weeklyGym.map(w => w.label),
                        datasets: [{
                          label: 'minutos',
                          data: sportCharts.gym.weeklyGym.map(w => w.totalMinutes),
                          backgroundColor: 'rgba(99, 102, 241, 0.4)',
                          borderColor: 'rgb(99, 102, 241)',
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
                          y: { beginAtZero: true, grid: { color: 'rgba(156,163,175,0.1)' }, title: { display: true, text: 'minutos' } },
                        },
                      }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

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
                  Distribución por Tipo de Actividad
                  <InfoTooltip text="Proporción de cada tipo de actividad (carrera, ciclismo, natación, etc.) registrada en Strava durante el período seleccionado." />
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
                  <InfoTooltip text="Mapa de calor diario del período. El color más intenso indica mayor distancia recorrida ese día. Permite ver patrones de entrenamiento y descanso." />
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
                  <p className="text-orange-100 text-sm">Running</p>
                  <p className="text-2xl font-bold">{metrics.runningDistanceKm} km</p>
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

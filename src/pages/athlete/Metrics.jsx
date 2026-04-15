import { useState, useEffect, useCallback, useMemo } from 'react';
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
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiNavigation,
  FiCheckCircle,
} from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { calculateVdot, predictAllRaceTimes } from '../../lib/trainingMetrics';
import { getDailyLoads, calculateLoadMetrics } from '../../services/aiReportService';
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
import AiAnalysisPanel from '../../components/athlete/AiAnalysisPanel';
import {
  getBestEffortsEvolution,
  getTimeInZoneAggregate,
  getIntensityDistribution,
  getShoes,
  getWeeklyLoadSeries,
} from '../../services/metricsAnalyticsService';
import { showError } from '../../lib/toast';

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

// Activity Type Distribution Chart
const ActivityTypeDistribution = ({ activities }) => {
  // Activity type labels in Spanish
  const activityTypeLabels = {
    Run: 'Carrera',
    TrailRun: 'Trail',
    VirtualRun: 'Carrera Virtual',
    Walk: 'Caminata',
    Hike: 'Senderismo',
    Ride: 'Ciclismo',
    VirtualRide: 'Ciclismo Virtual',
    Swim: 'Natación',
    WeightTraining: 'Pesas',
    Workout: 'Entrenamiento',
    CrossFit: 'CrossFit',
    Yoga: 'Yoga',
    Other: 'Otro',
  };

  // Colors for each activity type
  const activityColors = {
    Run: '#3b82f6',
    TrailRun: '#22c55e',
    VirtualRun: '#06b6d4',
    Walk: '#8b5cf6',
    Hike: '#10b981',
    Ride: '#f59e0b',
    VirtualRide: '#eab308',
    Swim: '#0ea5e9',
    WeightTraining: '#6366f1',
    Workout: '#ec4899',
    CrossFit: '#ef4444',
    Yoga: '#a855f7',
    Other: '#6b7280',
  };

  // Calculate distribution
  const distribution = {};
  let totalTime = 0;
  let totalDistance = 0;

  activities?.forEach(activity => {
    const type = activity.type || 'Other';
    if (!distribution[type]) {
      distribution[type] = { count: 0, time: 0, distance: 0 };
    }
    distribution[type].count++;
    distribution[type].time += activity.moving_time || 0;
    distribution[type].distance += activity.distance || 0;
    totalTime += activity.moving_time || 0;
    totalDistance += activity.distance || 0;
  });

  // Sort by time and get top activities
  const sortedTypes = Object.entries(distribution)
    .sort((a, b) => b[1].time - a[1].time)
    .slice(0, 5);

  const chartData = {
    labels: sortedTypes.map(([type]) => activityTypeLabels[type] || type),
    datasets: [{
      data: sortedTypes.map(([, data]) => Math.round(data.time / 60)), // Convert to minutes
      backgroundColor: sortedTypes.map(([type]) => activityColors[type] || '#6b7280'),
      borderWidth: 0,
      hoverOffset: 4,
    }],
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  if (!activities?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-8">
        <FiActivity className="w-12 h-12 text-ath-text-muted mb-3" />
        <p className="text-ath-text-muted">No hay actividades</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Chart + List */}
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Doughnut chart */}
        <div className="w-36 h-36 flex-shrink-0">
          <Doughnut
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: true,
              cutout: '65%',
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      const mins = ctx.parsed;
                      const h = Math.floor(mins / 60);
                      const m = mins % 60;
                      return ` ${ctx.label}: ${h > 0 ? `${h}h ` : ''}${m}m`;
                    },
                  },
                },
              },
            }}
          />
        </div>

        {/* List */}
        <div className="space-y-2 flex-1 w-full">
          {sortedTypes.map(([type, data]) => {
            const percentage = totalTime > 0 ? Math.round((data.time / totalTime) * 100) : 0;
            return (
              <div key={type} className="flex items-center gap-2.5">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: activityColors[type] || '#6b7280' }}
                />
                <span className="flex-1 text-sm font-medium text-ath-text-secondary truncate">
                  {activityTypeLabels[type] || type}
                </span>
                <span className="text-xs text-ath-text-muted whitespace-nowrap">
                  {data.count} act. · {formatTime(data.time)}
                </span>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 w-8 text-right flex-shrink-0">
                  {percentage}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t border-ath-border grid grid-cols-2 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold text-ath-text-primary">{activities.length}</p>
          <p className="text-xs text-ath-text-muted">Actividades totales</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-ath-text-primary">{(totalDistance / 1000).toFixed(1)}</p>
          <p className="text-xs text-ath-text-muted">km totales</p>
        </div>
      </div>
    </div>
  );
};

// Total Activity Time Chart (Garmin style)
const getDateRangeForPeriod = (period) => {
  const end = new Date();
  const start = new Date();
  switch (period) {
    case '7days': start.setDate(end.getDate() - 6); break;
    case '4weeks': start.setDate(end.getDate() - 27); break;
    case '6months': start.setMonth(end.getMonth() - 6); break;
    case '1year': start.setFullYear(end.getFullYear() - 1); break;
    default: start.setDate(end.getDate() - 6);
  }
  return { start, end };
};

const TotalActivityTimeChart = ({ activities, selectedPeriod, onPeriodChange }) => {
  const [dateRange, setDateRange] = useState(() => getDateRangeForPeriod(selectedPeriod));

  useEffect(() => {
    setDateRange(getDateRangeForPeriod(selectedPeriod));
  }, [selectedPeriod]);

  // Group activities by day/week/month depending on period
  const chartData = useCallback(() => {
    if (!activities?.length) return { labels: [], running: [], gym: [] };

    const { start, end } = dateRange;
    const labels = [];
    const runningData = [];
    const gymData = [];

    if (selectedPeriod === '7days') {
      // Daily data
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayStr = d.toLocaleDateString('es-ES', { weekday: 'short' });
        labels.push(dayStr.charAt(0).toUpperCase() + dayStr.slice(1, 3));

        const dayActivities = activities.filter(a => {
          const actDate = new Date(a.start_date_local);
          return actDate.toDateString() === d.toDateString();
        });

        const runningTime = dayActivities
          .filter(a => ['Run', 'TrailRun', 'VirtualRun'].includes(a.type))
          .reduce((sum, a) => sum + (a.moving_time || 0), 0) / 60;

        const gymTime = dayActivities
          .filter(a => ['WeightTraining', 'Workout', 'CrossFit'].includes(a.type))
          .reduce((sum, a) => sum + (a.moving_time || 0), 0) / 60;

        runningData.push(Math.round(runningTime));
        gymData.push(Math.round(gymTime));
      }
    } else {
      // Weekly/monthly aggregation simplified
      const weeks = selectedPeriod === '4weeks' ? 4 : selectedPeriod === '6months' ? 26 : 52;
      for (let i = weeks - 1; i >= 0; i--) {
        const weekEnd = new Date();
        weekEnd.setDate(weekEnd.getDate() - i * 7);
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);

        if (selectedPeriod === '4weeks') {
          labels.push(weekEnd.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }));
        } else {
          labels.push(weekEnd.toLocaleDateString('es-ES', { month: 'short' }));
        }

        const weekActivities = activities.filter(a => {
          const actDate = new Date(a.start_date_local);
          return actDate >= weekStart && actDate <= weekEnd;
        });

        const runningTime = weekActivities
          .filter(a => ['Run', 'TrailRun', 'VirtualRun'].includes(a.type))
          .reduce((sum, a) => sum + (a.moving_time || 0), 0) / 60;

        const gymTime = weekActivities
          .filter(a => ['WeightTraining', 'Workout', 'CrossFit'].includes(a.type))
          .reduce((sum, a) => sum + (a.moving_time || 0), 0) / 60;

        runningData.push(Math.round(runningTime));
        gymData.push(Math.round(gymTime));
      }
    }

    return { labels, running: runningData, gym: gymData };
  }, [activities, dateRange, selectedPeriod]);

  const data = chartData();
  const formatDateRange = () => {
    const options = { day: 'numeric', month: 'short' };
    return `${dateRange.start.toLocaleDateString('es-ES', options)} - ${dateRange.end.toLocaleDateString('es-ES', options)}`;
  };

  const navigatePeriod = (direction) => {
    const days = selectedPeriod === '7days' ? 7 : selectedPeriod === '4weeks' ? 28 : selectedPeriod === '6months' ? 180 : 365;
    const newEnd = new Date(dateRange.end);
    newEnd.setDate(newEnd.getDate() + (direction * days));

    // Don't go into the future
    if (newEnd > new Date()) return;

    const newStart = new Date(newEnd);
    newStart.setDate(newStart.getDate() - days + 1);
    setDateRange({ start: newStart, end: newEnd });
  };

  return (
    <div className="bg-ath-surface rounded-2xl border border-ath-border p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-bold text-ath-text-primary flex items-center">
            Tiempo Total por Actividad
            <InfoTooltip text="Tiempo de movimiento de cada actividad en el período seleccionado. Permite ver cómo se distribuye el esfuerzo en sesiones cortas vs largas." />
          </h3>
          <button className="sm:hidden text-ath-text-muted hover:text-ath-text-primary">
            <FiDownload className="w-5 h-5" />
          </button>
        </div>
        <button className="hidden sm:block text-ath-text-muted hover:text-ath-text-primary">
          <FiDownload className="w-5 h-5" />
        </button>
      </div>

      {/* Period selector and date navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigatePeriod(-1)}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <FiChevronLeft className="w-5 h-5 text-ath-text-secondary" />
          </button>
          <button
            onClick={() => navigatePeriod(1)}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <FiChevronRight className="w-5 h-5 text-ath-text-secondary" />
          </button>
          <span className="text-xs sm:text-sm text-ath-text-secondary flex items-center space-x-1 whitespace-nowrap">
            <FiClock className="w-4 h-4 flex-shrink-0" />
            <span>{formatDateRange()}</span>
          </span>
        </div>

        <div className="flex items-center bg-ath-inset rounded-lg p-1">
          {[
            { value: '7days', label: '7d', labelSm: '7 días' },
            { value: '4weeks', label: '4s', labelSm: '4 semanas' },
            { value: '6months', label: '6m', labelSm: '6 meses' },
            { value: '1year', label: '1a', labelSm: '1 año' },
          ].map((period) => (
            <button
              key={period.value}
              onClick={() => onPeriodChange(period.value)}
              className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                selectedPeriod === period.value
                  ? 'bg-ath-surface text-ath-text-primary shadow-sm'
                  : 'text-ath-text-secondary hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span className="sm:hidden">{period.label}</span>
              <span className="hidden sm:inline">{period.labelSm}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        <Bar
          data={{
            labels: data.labels,
            datasets: [
              {
                label: 'Carrera',
                data: data.running,
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                borderRadius: 4,
                barPercentage: 0.7,
              },
              {
                label: 'Gimnasio y equipo de fitness',
                data: data.gym,
                backgroundColor: 'rgba(17, 24, 39, 0.8)',
                borderRadius: 4,
                barPercentage: 0.7,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
                position: 'bottom',
                labels: {
                  usePointStyle: true,
                  pointStyle: 'circle',
                  padding: 20,
                },
              },
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} min`,
                },
              },
            },
            scales: {
              x: {
                stacked: true,
                grid: { display: false },
              },
              y: {
                stacked: true,
                beginAtZero: true,
                grid: { color: 'rgba(156, 163, 175, 0.1)' },
                title: {
                  display: true,
                  text: 'Minutos',
                },
              },
            },
          }}
        />
      </div>
    </div>
  );
};

// ─── Helper: format minutes as "Xh Ym" or "Xm Ys" ──────────────────────────
const formatMinutes = (totalMinutes) => {
  if (!totalMinutes && totalMinutes !== 0) return '–';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

// Format pace in min/km as "M:SS"
const formatPace = (minPerKm) => {
  if (!minPerKm) return '–';
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

// ─── InternalMetricsSection ──────────────────────────────────────────────────
/**
 * Displays progression metrics derived from completed training_sessions.
 * Shown for all athletes (independent and coached), with or without Strava.
 */
const InternalMetricsSection = ({
  weeklyKm,
  weeklyRpe,
  weeklyPace,
  personalBests,
  completionRate,
  hasData,
  loading,
}) => {
  const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: 'rgb(156,163,175)', font: { size: 10 } } },
      y: { beginAtZero: true, grid: { color: 'rgba(156,163,175,0.1)' }, ticks: { color: 'rgb(156,163,175)', font: { size: 10 } } },
    },
  };

  const pbSlots = [
    { key: '5k', label: '5K' },
    { key: '10k', label: '10K' },
    { key: 'half', label: 'Media Maratón' },
    { key: 'marathon', label: 'Maratón' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <FiLoader className="w-6 h-6 animate-spin text-ath-accent" />
      </div>
    );
  }

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-10 bg-ath-surface rounded-2xl border border-ath-border">
      <FiActivity className="w-10 h-10 text-ath-text-muted mb-3" />
      <p className="text-sm font-medium text-ath-text-muted text-center max-w-xs">
        Completa tus entrenamientos para ver tus métricas
      </p>
    </div>
  );

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2">
        <FiTrendingUp className="w-4 h-4 text-ath-accent" />
        <h2 className="text-base font-bold text-ath-text-primary">
          Progresión de Entrenamientos
        </h2>
        <span className="text-[10px] font-semibold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
          Últimas 8 semanas
        </span>
      </div>

      {!hasData ? (
        emptyState
      ) : (
        <>
          {/* Completion rate badge */}
          {completionRate && completionRate.total > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 bg-ath-surface rounded-2xl border border-ath-border p-4"
            >
              <div className="flex-shrink-0 w-14 h-14 relative">
                {/* Simple ring using SVG */}
                <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
                  <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor" strokeWidth="6" className="text-ath-inset" />
                  <circle
                    cx="28" cy="28" r="22" fill="none" stroke="currentColor" strokeWidth="6"
                    className="text-green-500"
                    strokeDasharray={`${2 * Math.PI * 22 * completionRate.pct / 100} ${2 * Math.PI * 22}`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-ath-text-primary">
                  {completionRate.pct}%
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-ath-text-primary flex items-center gap-1.5">
                  <FiCheckCircle className="w-4 h-4 text-green-500" />
                  Tasa de cumplimiento
                </p>
                <p className="text-xs text-ath-text-muted mt-0.5">
                  {completionRate.completed} de {completionRate.total} sesiones completadas (últimas 4 semanas)
                </p>
              </div>
            </motion.div>
          )}

          {/* Charts grid: km + RPE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weekly km bar chart */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-ath-surface rounded-2xl border border-ath-border p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <FiMapPin className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-bold text-ath-text-primary">
                  Km semanales
                </h3>
              </div>
              <div className="h-44">
                {weeklyKm.some(w => w.km > 0) ? (
                  <Bar
                    data={{
                      labels: weeklyKm.map(w => w.label),
                      datasets: [{
                        label: 'km',
                        data: weeklyKm.map(w => w.km),
                        backgroundColor: 'rgba(59, 130, 246, 0.7)',
                        borderRadius: 4,
                        barPercentage: 0.7,
                      }],
                    }}
                    options={{
                      ...commonChartOptions,
                      scales: {
                        ...commonChartOptions.scales,
                        y: { ...commonChartOptions.scales.y, title: { display: true, text: 'km', color: 'rgb(156,163,175)', font: { size: 10 } } },
                      },
                    }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-ath-text-muted">
                    Sin datos de kilómetros aún
                  </div>
                )}
              </div>
            </motion.div>

            {/* RPE trend line chart */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-ath-surface rounded-2xl border border-ath-border p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <FiZap className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-bold text-ath-text-primary">
                  Esfuerzo percibido (RPE)
                </h3>
              </div>
              <div className="h-44">
                {weeklyRpe.some(w => w.avgRpe != null) ? (
                  <Line
                    data={{
                      labels: weeklyRpe.map(w => w.label),
                      datasets: [{
                        label: 'RPE medio',
                        data: weeklyRpe.map(w => w.avgRpe),
                        borderColor: 'rgb(249, 115, 22)',
                        backgroundColor: 'rgba(249, 115, 22, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: 'rgb(249, 115, 22)',
                        spanGaps: true,
                      }],
                    }}
                    options={{
                      ...commonChartOptions,
                      scales: {
                        ...commonChartOptions.scales,
                        y: {
                          ...commonChartOptions.scales.y,
                          min: 1,
                          max: 10,
                          title: { display: true, text: 'RPE (1-10)', color: 'rgb(156,163,175)', font: { size: 10 } },
                        },
                      },
                    }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-ath-text-muted">
                    Sin datos de RPE aún
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Pace trend */}
          {weeklyPace.some(w => w.avgPace != null) && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-ath-surface rounded-2xl border border-ath-border p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <FiClock className="w-4 h-4 text-purple-500" />
                <h3 className="text-sm font-bold text-ath-text-primary">
                  Ritmo medio semanal (min/km)
                </h3>
              </div>
              <div className="h-44">
                <Line
                  data={{
                    labels: weeklyPace.map(w => w.label),
                    datasets: [{
                      label: 'min/km',
                      data: weeklyPace.map(w => w.avgPace),
                      borderColor: 'rgb(139, 92, 246)',
                      backgroundColor: 'rgba(139, 92, 246, 0.1)',
                      fill: true,
                      tension: 0.4,
                      pointRadius: 4,
                      pointBackgroundColor: 'rgb(139, 92, 246)',
                      spanGaps: true,
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => ctx.parsed.y != null ? `${formatPace(ctx.parsed.y)} min/km` : '–',
                        },
                      },
                    },
                    scales: {
                      x: { grid: { display: false }, ticks: { color: 'rgb(156,163,175)', font: { size: 10 } } },
                      y: {
                        reverse: true,
                        grid: { color: 'rgba(156,163,175,0.1)' },
                        ticks: {
                          color: 'rgb(156,163,175)',
                          font: { size: 10 },
                          callback: (v) => formatPace(v),
                        },
                        title: { display: true, text: 'min/km', color: 'rgb(156,163,175)', font: { size: 10 } },
                      },
                    },
                  }}
                />
              </div>
            </motion.div>
          )}

        </>
      )}
    </section>
  );
};

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
    personalBests,
    completionRate,
    hasData: hasInternalData,
  } = useInternalMetrics(profile?.id, 8);

  // Fetch personal bests from DB for race predictions
  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from('personal_bests')
      .select('distance, time_seconds, date')
      .eq('athlete_id', profile.id)
      .order('time_seconds', { ascending: true })
      .then(({ data }) => setDbPersonalBests(data || []));
  }, [profile?.id]);

  // Training load calculations (ACWR, weekly loads)
  const loadData = useMemo(() => {
    if (!rawActivities || rawActivities.length === 0) return null;

    const metrics = calculateLoadMetrics(rawActivities);
    const daily56 = getDailyLoads(rawActivities, 56);

    // Aggregate daily loads into 8 weekly buckets
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

    // Calculate per-week ACWR for bar coloring
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
  }, [rawActivities]);

  // Race time predictions using Daniels-Gilbert VDOT model
  const racePredictions = useMemo(() => {
    // 1. Try stored VDOT from athlete profile
    let vdot = profile?.athlete?.vdot;

    // 2. If no stored VDOT, calculate from best effort or DB personal best
    if (!vdot) {
      const allEfforts = [...(bestEfforts || [])];

      // Merge DB personal bests
      const pbDistanceMap = {
        '1 km': { name: '1 km', meters: 1000 },
        '1k': { name: '1 km', meters: 1000 },
        '1 Milla': { name: '1 Milla', meters: 1609 },
        '1 mile': { name: '1 Milla', meters: 1609 },
        '5 km': { name: '5 km', meters: 5000 },
        '5k': { name: '5 km', meters: 5000 },
        '10 km': { name: '10 km', meters: 10000 },
        '10k': { name: '10 km', meters: 10000 },
        'Media Maratón': { name: 'Media Maratón', meters: 21097 },
        'Half-Marathon': { name: 'Media Maratón', meters: 21097 },
        'Maratón': { name: 'Maratón', meters: 42195 },
        'Marathon': { name: 'Maratón', meters: 42195 },
      };

      if (dbPersonalBests?.length) {
        dbPersonalBests.forEach((pb) => {
          const mapped = pbDistanceMap[pb.distance];
          if (!mapped) return;
          const existing = allEfforts.find((e) => e.name === mapped.name);
          if (!existing || pb.time_seconds < existing.time) {
            const idx = allEfforts.findIndex((e) => e.name === mapped.name);
            const entry = {
              name: mapped.name,
              distance: mapped.meters,
              time: pb.time_seconds,
              date: pb.date,
            };
            if (idx >= 0) allEfforts[idx] = entry;
            else allEfforts.push(entry);
          }
        });
      }

      if (!allEfforts.length) return null;

      // Find best VDOT from all available efforts
      let bestVdot = 0;
      let bestRef = null;
      for (const e of allEfforts) {
        if (!e.distance || !e.time) continue;
        const v = calculateVdot(e.distance, e.time / 60);
        if (v && v > bestVdot) {
          bestVdot = v;
          bestRef = e;
        }
      }

      if (!bestVdot || !bestRef) return null;
      vdot = bestVdot;
    }

    const predictions = predictAllRaceTimes(vdot);
    if (!predictions) return null;

    return { vdot: Math.round(vdot * 10) / 10, predictions };
  }, [bestEfforts, dbPersonalBests, profile?.athlete?.vdot]);

  // HR training zones (Karvonen formula)
  const estimatedAge = profile?.athlete?.date_of_birth
    ? computeAge(profile.athlete.date_of_birth)
    : null;
  const hrZoneData = useMemo(() => {
    const maxHR = profile?.athlete?.max_heart_rate
      || (estimatedAge ? 220 - estimatedAge : null);
    if (!maxHR) return null;
    const restingHR = profile?.athlete?.resting_heart_rate || 60;
    const zones = calculateHRZones(maxHR, restingHR);

    // Distribute activities into zones by average_heartrate
    const hrActivities = rawActivities.filter(a => a.average_heartrate);
    zones.forEach(z => { z.count = 0; });
    hrActivities.forEach(a => {
      const hr = a.average_heartrate;
      for (let i = zones.length - 1; i >= 0; i--) {
        if (hr >= zones[i].bpmMin) { zones[i].count++; break; }
      }
    });

    return { zones, maxHR, restingHR, totalHRActivities: hrActivities.length };
  }, [rawActivities, profile, estimatedAge]);

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
      const summarizeBestEfforts = (rows) => {
        const byKey = new Map();
        (rows || []).forEach((r) => {
          const cur = byKey.get(r.distance_key);
          if (!cur || r.elapsed_time_sec < cur.best_time_sec) {
            byKey.set(r.distance_key, {
              distance: r.distance_key,
              best_time_sec: r.elapsed_time_sec,
              best_time_date: r.activity_date,
            });
          }
        });
        return Array.from(byKey.values());
      };
      setAnalysisPayload({
        time_in_zone: tiz.data?.hasZones ? { zones: tiz.data.zones, weeks: 4 } : null,
        intensity: intensity.data?.hasZones ? {
          z12_pct: intensity.data.z12_pct,
          z3_pct: intensity.data.z3_pct,
          z45_pct: intensity.data.z45_pct,
          label: intensity.data.label,
          weeks: 4,
        } : null,
        shoes: { shoes: (shoes.data || []).slice(0, 6).map((s) => ({ name: s.name, distance_km: s.distance_km, active: s.active })) },
        best_efforts_summary: { personal_bests: summarizeBestEfforts(best.data) },
        weekly_load: { series: weeklyLoad.data || [] },
      });
      setAnalysisOpen(true);
    } catch (err) {
      showError(err?.message || 'No se pudieron recopilar las métricas');
    } finally {
      setPreparingAnalysis(false);
    }
  };

  // Per-sport weekly charts data
  const sportCharts = useMemo(() => {
    if (!rawActivities?.length) return {};

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

        const weekActs = rawActivities.filter(a => {
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
    const cyclingActs = rawActivities.filter(a => CYCLING_TYPES.includes(a.type));
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
    const swimActs = rawActivities.filter(a => SWIM_TYPES.includes(a.type));
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
    const gymActs = rawActivities.filter(a => GYM_TYPES.includes(a.type));
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
  }, [rawActivities]);

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
          color: 'rgba(156, 163, 175, 0.1)',
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  // Prepare weekly progression chart data
  const getWeeklyChartData = () => {
    if (!stravaMetrics?.weeklyStats?.length) {
      return {
        labels: [],
        datasets: [{
          data: [],
          borderColor: 'rgb(249, 115, 22)',
          backgroundColor: 'rgba(249, 115, 22, 0.1)',
          fill: true,
          tension: 0.4,
        }],
      };
    }

    const reversed = [...stravaMetrics.weeklyStats].reverse();
    return {
      labels: reversed.map(w => w.weekNumber),
      datasets: [{
        label: 'Kilómetros',
        data: reversed.map(w => parseFloat(w.distanceKm)),
        borderColor: 'rgb(249, 115, 22)',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: 'rgb(249, 115, 22)',
      }],
    };
  };

  // Prepare average speed chart data (Garmin style - individual points per activity)
  const getAverageSpeedData = () => {
    if (!rawActivities?.length) {
      return {
        labels: [],
        datasets: [],
        avgSpeed: 0,
      };
    }

    // Filter running activities and sort by date
    const runningActivities = rawActivities
      .filter(a => ['Run', 'TrailRun', 'VirtualRun'].includes(a.type))
      .filter(a => a.average_speed > 0)
      .sort((a, b) => new Date(a.start_date_local) - new Date(b.start_date_local));

    if (runningActivities.length === 0) {
      return { labels: [], datasets: [], avgSpeed: 0 };
    }

    // Calculate average speed in km/h for each activity
    const speedsKmh = runningActivities.map(a => (a.average_speed * 3.6).toFixed(1));
    const avgSpeed = (speedsKmh.reduce((sum, s) => sum + parseFloat(s), 0) / speedsKmh.length).toFixed(1);

    // Labels as dates
    const labels = runningActivities.map(a => {
      const date = new Date(a.start_date_local);
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    });

    return {
      labels,
      datasets: [{
        label: 'Velocidad (km/h)',
        data: speedsKmh.map(s => parseFloat(s)),
        borderColor: 'transparent',
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        pointRadius: 6,
        pointHoverRadius: 8,
        showLine: false,
        type: 'scatter',
      }],
      avgSpeed: parseFloat(avgSpeed),
    };
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
          personalBests={personalBests}
          completionRate={completionRate}
          hasData={hasInternalData}
          loading={internalLoading}
        />

        {/* Strava connect prompt (only for non-independent athletes) */}
        {!isIndependent && (
          <div className="bg-ath-surface rounded-2xl border border-ath-border p-8 sm:p-10 text-center">
            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiActivity className="w-8 h-8 text-orange-500" />
            </div>
            <h2 className="text-lg font-bold text-ath-text-primary mb-2">
              Conecta Strava para más métricas
            </h2>
            <p className="text-ath-text-muted mb-5 max-w-md mx-auto text-sm">
              Sincroniza tu cuenta de Strava para ver estadísticas detalladas: zonas de frecuencia cardíaca, predictor de tiempos, ACWR y más.
            </p>
            <a
              href="/athlete/devices"
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition-all text-sm"
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
            className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 sm:p-5 text-white shadow-lg"
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
            className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 sm:p-5 text-white shadow-lg"
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
            className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 sm:p-5 text-white shadow-lg"
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
            className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 sm:p-5 text-white shadow-lg"
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
            className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 sm:p-5 text-white shadow-lg"
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
            className="bg-gradient-to-br from-yellow-500 to-amber-600 rounded-xl p-4 sm:p-5 text-white shadow-lg"
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
        personalBests={personalBests}
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
            <span className="text-[11px] font-bold bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-2.5 py-1 rounded-full">
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
                      <div className={`h-1 rounded-full ${barColors[distance] || 'bg-violet-500'}`} style={{ width: '100%' }} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          <p className="text-[11px] text-ath-text-muted mt-3 flex items-center gap-1">
            <span className="inline-block w-3.5 h-3.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-500 text-center leading-3.5 text-[9px]">i</span>
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
          <div className="flex items-center gap-2 mb-0.5">
            <FiClock className="w-4 h-4 text-slate-500" />
            <h3 className="text-base font-bold text-ath-text-primary">Zonas de Entrenamiento</h3>
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
          <div className="flex items-center gap-2 mb-1">
            <FiZap className="w-4 h-4 text-amber-500" />
            <h3 className="text-base font-bold text-ath-text-primary">
              Gestión de Carga
              <InfoTooltip text="Ratio de carga aguda/crónica (ACWR): compara el volumen de la última semana con la media de las 4 anteriores. Zona óptima: 0.8–1.3. Por encima de 1.5 aumenta el riesgo de lesión." />
            </h3>
          </div>
          <p className="text-xs text-ath-text-muted mb-3">ACWR · ratio carga aguda/crónica</p>

          {/* Alert banner */}
          {(() => {
            const { acwr } = loadData;
            let cfg;
            if (acwr < 0.8) cfg = { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', icon: '📉', msg: 'Tu carga actual está por debajo de lo habitual. Considera aumentar gradualmente el volumen.' };
            else if (acwr <= 1.3) cfg = { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', icon: '✓', msg: 'Tu carga está en zona óptima. ¡Sigue así!' };
            else if (acwr <= 1.5) cfg = { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', icon: '⚠', msg: 'Cuidado: tu carga está aumentando rápidamente. Controla el volumen esta semana.' };
            else cfg = { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', icon: '🚨', msg: 'Alerta: riesgo elevado de sobrecarga. Reduce la intensidad y descansa.' };
            return (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium ${cfg.bg} ${cfg.text} mb-4`}>
                <span className="flex-shrink-0">{cfg.icon}</span>
                <span>{cfg.msg}</span>
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
                  x: { grid: { display: false }, ticks: { color: 'rgb(156,163,175)', font: { size: 10 } } },
                  y: { beginAtZero: true, grid: { color: 'rgba(156,163,175,0.1)' }, ticks: { color: 'rgb(156,163,175)', font: { size: 10 } } },
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
              <Line data={getWeeklyChartData()} options={chartOptions} />
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
            const speedData = getAverageSpeedData();
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
                          borderColor: 'rgba(156, 163, 175, 0.6)',
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
                            maxTicksLimit: 8,
                          },
                        },
                        y: {
                          beginAtZero: true,
                          grid: { color: 'rgba(156, 163, 175, 0.1)' },
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
            <FiNavigation className="w-5 h-5 mr-2 text-yellow-500" />
            Ciclismo
            <InfoTooltip text="Métricas de ciclismo: km semanales, velocidad media y desnivel acumulado. Solo incluye Ride y VirtualRide." />
          </h3>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
              <p className="text-xl sm:text-2xl font-bold text-yellow-700 dark:text-yellow-300">{sportCharts.cycling.totalKm}</p>
              <p className="text-[10px] sm:text-xs text-ath-text-muted">km totales</p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
              <p className="text-xl sm:text-2xl font-bold text-yellow-700 dark:text-yellow-300">{sportCharts.cycling.avgSpeed}</p>
              <p className="text-[10px] sm:text-xs text-ath-text-muted">km/h media</p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
              <p className="text-xl sm:text-2xl font-bold text-yellow-700 dark:text-yellow-300">{sportCharts.cycling.totalElevation}</p>
              <p className="text-[10px] sm:text-xs text-ath-text-muted">m desnivel</p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
              <p className="text-xl sm:text-2xl font-bold text-yellow-700 dark:text-yellow-300">{sportCharts.cycling.avgHR || '-'}</p>
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
              <h4 className="text-sm font-semibold text-ath-text-secondary mb-3">Velocidad media semanal</h4>
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
          transition={{ delay: 0.7 }}
          className="bg-ath-surface rounded-2xl border border-ath-border p-4 sm:p-5 mb-6 sm:mb-8"
        >
          <h3 className="text-base sm:text-lg font-bold text-ath-text-primary mb-4 flex items-center">
            <FiActivity className="w-5 h-5 mr-2 text-cyan-500" />
            Natación
            <InfoTooltip text="Métricas de natación: metros semanales y ritmo medio por 100m." />
          </h3>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-3 text-center">
              <p className="text-xl sm:text-2xl font-bold text-cyan-700 dark:text-cyan-300">{sportCharts.swimming.totalMeters}</p>
              <p className="text-[10px] sm:text-xs text-ath-text-muted">metros totales</p>
            </div>
            <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-3 text-center">
              <p className="text-xl sm:text-2xl font-bold text-cyan-700 dark:text-cyan-300">{sportCharts.swimming.avgPace100m}</p>
              <p className="text-[10px] sm:text-xs text-ath-text-muted">min/100m</p>
            </div>
            <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-3 text-center">
              <p className="text-xl sm:text-2xl font-bold text-cyan-700 dark:text-cyan-300">{sportCharts.swimming.count}</p>
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
              <h4 className="text-sm font-semibold text-ath-text-secondary mb-3">Ritmo medio /100m</h4>
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
          transition={{ delay: 0.75 }}
          className="bg-ath-surface rounded-2xl border border-ath-border p-4 sm:p-5 mb-6 sm:mb-8"
        >
          <h3 className="text-base sm:text-lg font-bold text-ath-text-primary mb-4 flex items-center">
            <FiZap className="w-5 h-5 mr-2 text-indigo-500" />
            Fuerza / Gimnasio
            <InfoTooltip text="Sesiones de fuerza, pesas, CrossFit y yoga. Muestra frecuencia semanal y duración media." />
          </h3>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 text-center">
              <p className="text-xl sm:text-2xl font-bold text-indigo-700 dark:text-indigo-300">{sportCharts.gym.totalSessions}</p>
              <p className="text-[10px] sm:text-xs text-ath-text-muted">sesiones</p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 text-center">
              <p className="text-xl sm:text-2xl font-bold text-indigo-700 dark:text-indigo-300">{sportCharts.gym.avgDurationMin}</p>
              <p className="text-[10px] sm:text-xs text-ath-text-muted">min/sesión</p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 text-center">
              <p className="text-xl sm:text-2xl font-bold text-indigo-700 dark:text-indigo-300">{sportCharts.gym.totalMinutes}</p>
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
              <h4 className="text-sm font-semibold text-ath-text-secondary mb-3">Duración semanal</h4>
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
          {bestEfforts && bestEfforts.length > 0 && (() => {
            const distMap = {
              '5k': { label: '5 KM', dist: '5000m' },
              '10k': { label: '10 KM', dist: '10000m' },
              'half marathon': { label: 'MEDIA MARATÓN', dist: '21097m' },
              'marathon': { label: 'MARATÓN', dist: '42195m' },
            };
            const fmtTime = (secs) => {
              if (!secs) return '–';
              const h = Math.floor(secs / 3600);
              const m = Math.floor((secs % 3600) / 60);
              const s = secs % 60;
              if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
              return `${m}:${String(s).padStart(2,'0')}`;
            };
            const fmtPace = (secs, meters) => {
              if (!secs || !meters) return '–';
              const paceSecPerKm = secs / (meters / 1000);
              const m = Math.floor(paceSecPerKm / 60);
              const s = Math.round(paceSecPerKm % 60);
              return `${m}:${String(s).padStart(2,'0')}`;
            };
            const slots = ['5k', '10k', 'half marathon', 'marathon'].map(key => {
              const effort = bestEfforts.find(e => e.name?.toLowerCase() === key);
              return { key, ...distMap[key], effort };
            });
            return (
              <div className="grid grid-cols-2 gap-2.5">
                {slots.map(({ key, label, effort }) => (
                  <div key={key} className="bg-ath-inset rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-ath-text-muted mb-1">{label}</p>
                    {effort ? (
                      <>
                        <p className="text-xl font-bold text-ath-text-primary leading-none mb-0.5">
                          {fmtTime(effort.elapsed_time)}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono">{fmtPace(effort.elapsed_time, effort.distance)} min/km</p>
                        <p className="text-[10px] text-ath-text-muted mt-0.5">
                          {effort.start_date_local ? new Date(effort.start_date_local).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }) : ''}
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
            );
          })()}
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

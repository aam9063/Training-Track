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
  FiAward,
  FiTarget,
  FiLoader,
  FiHeart,
  FiZap,
  FiMapPin,
  FiClock,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiAlertTriangle,
  FiShield,
} from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import {
  isStravaConnected,
  getStravaActivities,
  getStravaAthleteStats,
  getStoredAthlete,
  loadStravaTokens,
  calculateStravaMetrics,
  extractBestEfforts,
  estimateRaceTimes,
} from '../../services/stravaService';
import { getDailyLoads, calculateLoadMetrics } from '../../services/aiReportService';
import ACWRGauge, { getACWRZone } from '../../components/shared/ACWRGauge';

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
        <FiActivity className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-gray-500 dark:text-gray-400">No hay actividades</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Chart */}
      <div className="flex items-center justify-center py-2">
        <div className="w-44 h-44 sm:w-48 sm:h-48">
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
                    label: (ctx) => `${ctx.label}: ${ctx.parsed} min`,
                  },
                },
              },
            }}
          />
        </div>
      </div>

      {/* Legend with details */}
      <div className="mt-4 space-y-2">
        {sortedTypes.map(([type, data]) => {
          const percentage = totalTime > 0 ? Math.round((data.time / totalTime) * 100) : 0;
          return (
            <div key={type} className="flex items-center justify-between text-xs sm:text-sm gap-2">
              <div className="flex items-center space-x-2 min-w-0">
                <div
                  className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: activityColors[type] || '#6b7280' }}
                />
                <span className="text-gray-700 dark:text-gray-300 truncate">
                  {activityTypeLabels[type] || type}
                </span>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-3 text-gray-500 dark:text-gray-400 flex-shrink-0 whitespace-nowrap">
                <span>{data.count} act.</span>
                <span>{formatTime(data.time)}</span>
                <span className="font-medium text-gray-900 dark:text-white">{percentage}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-4 text-center">
        <div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{activities.length}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Actividades</p>
        </div>
        <div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{(totalDistance / 1000).toFixed(1)}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">km totales</p>
        </div>
      </div>
    </div>
  );
};

// Total Activity Time Chart (Garmin style)
const TotalActivityTimeChart = ({ activities, selectedPeriod, onPeriodChange }) => {
  const [dateRange, setDateRange] = useState({ start: new Date(), end: new Date() });

  // Calculate date range based on period
  useEffect(() => {
    const end = new Date();
    const start = new Date();

    switch (selectedPeriod) {
      case '7days':
        start.setDate(end.getDate() - 6);
        break;
      case '4weeks':
        start.setDate(end.getDate() - 27);
        break;
      case '6months':
        start.setMonth(end.getMonth() - 6);
        break;
      case '1year':
        start.setFullYear(end.getFullYear() - 1);
        break;
      default:
        start.setDate(end.getDate() - 6);
    }

    setDateRange({ start, end });
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
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
            Tiempo total de la actividad
          </h3>
          <button className="sm:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <FiDownload className="w-5 h-5" />
          </button>
        </div>
        <button className="hidden sm:block text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
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
            <FiChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={() => navigatePeriod(1)}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <FiChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 flex items-center space-x-1 whitespace-nowrap">
            <FiClock className="w-4 h-4 flex-shrink-0" />
            <span>{formatDateRange()}</span>
          </span>
        </div>

        <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
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
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
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
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [stravaMetrics, setStravaMetrics] = useState(null);
  const [bestEfforts, setBestEfforts] = useState([]);
  const [stravaStats, setStravaStats] = useState(null);
  const [weekFilter, setWeekFilter] = useState(8); // Default 8 weeks
  const [activityTimePeriod, setActivityTimePeriod] = useState('7days');
  const [rawActivities, setRawActivities] = useState([]);

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
      weeklyLoads.push({
        weekIndex: 7 - w,
        km: +weekKm.toFixed(1),
        label: w === 0 ? 'Esta sem.' : w === 1 ? 'Sem. -1' : `Sem. -${w}`,
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
    const maxHR = profile?.athlete?.max_heart_rate
      || (profile?.athlete?.date_of_birth
        ? 220 - Math.floor((Date.now() - new Date(profile.athlete.date_of_birth).getTime()) / 31557600000)
        : null);
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
  }, [rawActivities, profile]);

  const loadStravaMetrics = useCallback(async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      // Check connection
      const { connected: dbConnected } = await loadStravaTokens(profile.id);
      const connected = dbConnected || isStravaConnected();
      setStravaConnected(connected);

      if (connected) {
        // Get activities for the selected period
        const weeksAgo = Math.floor(Date.now() / 1000) - weekFilter * 7 * 24 * 60 * 60;
        const { data: activities } = await getStravaActivities({
          after: weeksAgo,
          per_page: 100,
        });

        if (activities?.length > 0) {
          setRawActivities(activities);

          // Calculate metrics
          const metrics = calculateStravaMetrics(activities);
          setStravaMetrics(metrics);

          // Extract best efforts
          const efforts = extractBestEfforts(activities);
          setBestEfforts(efforts);
        }

        // Get athlete stats
        const athlete = getStoredAthlete();
        if (athlete?.id) {
          const { data: stats } = await getStravaAthleteStats(athlete.id);
          if (stats) {
            setStravaStats(stats);
          }
        }
      }
    } catch (error) {
      console.error('Error loading Strava metrics:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, weekFilter]);

  useEffect(() => {
    loadStravaMetrics();
  }, [loadStravaMetrics]);

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
          <FiLoader className="w-8 h-8 animate-spin text-orange-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Cargando métricas...</p>
        </div>
      </div>
    );
  }

  if (!stravaConnected) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Mis Métricas
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Análisis de rendimiento y progresión
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 sm:p-12 text-center shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiActivity className="w-10 h-10 text-orange-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
            Conecta Strava para ver tus métricas
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Sincroniza tu cuenta de Strava en la sección de Dispositivos para ver estadísticas detalladas de tus entrenamientos.
          </p>
          <a
            href="/athlete/devices"
            className="inline-flex items-center space-x-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition-all"
          >
            <span>Ir a Dispositivos</span>
            <FiActivity className="w-5 h-5" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Mis Métricas
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Análisis de rendimiento basado en Strava
          </p>
        </div>

        {/* Week Filter */}
        <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {[4, 8, 12].map((weeks) => (
            <button
              key={weeks}
              onClick={() => setWeekFilter(weeks)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                weekFilter === weeks
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
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
              <span className="text-xs sm:text-sm font-medium opacity-90">Distancia</span>
              <FiMapPin className="w-4 h-4 opacity-75" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold mb-1">{stravaMetrics.totalDistanceKm}</p>
            <p className="text-xs opacity-75">km totales</p>
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

      {/* Race Time Predictor */}
      {racePredictions && Object.keys(racePredictions.predictions).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4 sm:mb-6 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center space-x-2 mb-2">
            <FiTarget className="w-5 h-5 sm:w-6 sm:h-6 text-purple-500" />
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
              Predictor de Tiempos
            </h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 sm:mb-6">
            Basado en tu marca de {racePredictions.reference.name}: {racePredictions.reference.timeFormatted} (Fórmula de Riegel)
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
          transition={{ delay: 0.35 }}
          className="bg-white dark:bg-gray-800 rounded-xl mb-4 sm:mb-6 p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700"
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

      {/* Activity Distribution and Total Activity Time Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {/* Activity Type Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <FiActivity className="w-5 h-5 mr-2 text-blue-500 flex-shrink-0" />
            <span className="truncate">Distribución de Actividades</span>
          </h3>
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
          className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-6 sm:mb-8"
        >
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <FiShield className="w-5 h-5 mr-2 text-orange-500" />
            Dashboard de Carga
          </h3>

          {/* Alert Banner */}
          {(() => {
            const { acwr } = loadData;
            let alertConfig;
            if (acwr < 0.8) {
              alertConfig = {
                bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
                text: 'text-blue-700 dark:text-blue-300',
                message: 'Tu carga actual está por debajo de lo habitual. Considera aumentar gradualmente el volumen.',
              };
            } else if (acwr <= 1.3) {
              alertConfig = {
                bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
                text: 'text-green-700 dark:text-green-300',
                message: 'Tu carga está en zona óptima. ¡Sigue así!',
              };
            } else if (acwr <= 1.5) {
              alertConfig = {
                bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
                text: 'text-orange-700 dark:text-orange-300',
                message: 'Cuidado: tu carga está aumentando rápidamente. Controla el volumen esta semana.',
              };
            } else {
              alertConfig = {
                bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
                text: 'text-red-700 dark:text-red-300',
                message: 'Alerta: riesgo elevado de sobrecarga. Reduce la intensidad y descansa.',
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

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {/* Weekly KM Progression */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <FiTrendingUp className="w-5 h-5 mr-2 text-orange-500" />
            Progresión Semanal (km)
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
          className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <FiZap className="w-5 h-5 mr-2 text-blue-500" />
            Velocidad Media
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
                <div className="flex items-center justify-end mb-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex items-center">
                    <div className="w-6 sm:w-8 h-0.5 bg-gray-400 dark:bg-gray-500 mr-1.5 sm:mr-2 flex-shrink-0"></div>
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

      {/* Best Performances Summary */}
      {stravaMetrics && (stravaMetrics.longestRun || stravaMetrics.fastestPace) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 sm:mb-8"
        >
          {stravaMetrics.longestRun && (
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl p-4 sm:p-6 border-2 border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs sm:text-sm font-medium text-yellow-700 dark:text-yellow-400">
                  Carrera más larga
                </span>
                <FiTarget className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-yellow-700 dark:text-yellow-300 mb-1">
                {stravaMetrics.longestRun.distanceKm} km
              </p>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                {stravaMetrics.longestRun.name}
              </p>
            </div>
          )}
          {stravaMetrics.fastestPace && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 sm:p-6 border-2 border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs sm:text-sm font-medium text-green-700 dark:text-green-400">
                  Ritmo más rápido
                </span>
                <FiZap className="w-5 h-5 text-green-600 flex-shrink-0" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-green-700 dark:text-green-300 mb-1">
                {stravaMetrics.fastestPace.pace}
              </p>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                {stravaMetrics.fastestPace.name} ({stravaMetrics.fastestPace.distanceKm} km)
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Personal Bests / Best Efforts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-white dark:bg-gray-800 rounded-xl mb-4 sm:mb-6 p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700"
      >
        <div className="flex items-center space-x-2 mb-4 sm:mb-6">
          <FiAward className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" />
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
            Marcas Personales
          </h3>
        </div>

        {bestEfforts.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {bestEfforts.map((effort, index) => (
              <motion.div
                key={effort.name + index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 * index }}
                className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg p-4 border-2 border-yellow-200 dark:border-yellow-800 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                    {effort.name}
                  </span>
                  <span className="text-xl">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅'}
                  </span>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-yellow-600 dark:text-yellow-400 mb-2">
                  {effort.timeFormatted}
                </p>
                {effort.pace && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {effort.pace} min/km
                  </p>
                )}
                {effort.date && (
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    {new Date(effort.date).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <FiAward className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              No hay suficientes datos para calcular marcas personales
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Continúa entrenando y registrando actividades en Strava
            </p>
          </div>
        )}
      </motion.div>

      {/* Athlete All-Time Stats */}
      {stravaStats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <FiActivity className="w-5 h-5 mr-2 text-orange-500" />
            Estadísticas Totales (Strava)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="text-center p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <p className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {stravaStats.all_run_totals?.count || 0}
              </p>
              <p className="text-[10px] sm:text-sm text-gray-500 dark:text-gray-400">Carreras totales</p>
            </div>
            <div className="text-center p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <p className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {((stravaStats.all_run_totals?.distance || 0) / 1000).toFixed(0)} km
              </p>
              <p className="text-[10px] sm:text-sm text-gray-500 dark:text-gray-400">Distancia total</p>
            </div>
            <div className="text-center p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <p className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {Math.round((stravaStats.all_run_totals?.elapsed_time || 0) / 3600)}h
              </p>
              <p className="text-[10px] sm:text-sm text-gray-500 dark:text-gray-400">Tiempo total</p>
            </div>
            <div className="text-center p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <p className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {((stravaStats.all_run_totals?.elevation_gain || 0) / 1000).toFixed(1)}k
              </p>
              <p className="text-[10px] sm:text-sm text-gray-500 dark:text-gray-400">Desnivel (m)</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default AthleteMetrics;

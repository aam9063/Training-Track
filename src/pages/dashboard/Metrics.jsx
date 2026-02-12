import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import {
  FiTrendingUp,
  FiActivity,
  FiTarget,
  FiAward,
  FiZap,
  FiHeart,
  FiMapPin,
  FiLoader,
  FiChevronUp,
  FiChevronDown,
  FiUsers,
} from 'react-icons/fi';
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
  getAthletes,
  getAthleteStravaConnection,
  getAthleteStravaActivities,
  getAthleteSessions,
} from '../../services/athleteService';
import {
  calculateStravaMetrics,
  calculatePeriodComparison,
  getActivityTypeLabel,
} from '../../services/stravaService';
import { toLocalDateStr } from '../../lib/dateUtils';

// Register ChartJS components
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

const Metrics = () => {
  const { profile } = useAuth();
  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState('all');
  const [dateRange, setDateRange] = useState('30');
  const [loading, setLoading] = useState(true);

  // Cache of all athlete data
  const [athleteDataCache, setAthleteDataCache] = useState({});

  // Derived state for current view
  const [currentMetrics, setCurrentMetrics] = useState(null);
  const [currentActivities, setCurrentActivities] = useState([]);
  const [completionRate, setCompletionRate] = useState(null);
  const [periodComparison, setPeriodComparison] = useState(null);
  const [topPerformers, setTopPerformers] = useState([]);
  const [sortKey, setSortKey] = useState('totalDistanceKm');
  const [sortDirection, setSortDirection] = useState('desc');
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState([]);

  // Calculate the "after" epoch timestamp from dateRange
  const getAfterTimestamp = useCallback(() => {
    const now = new Date();
    now.setDate(now.getDate() - parseInt(dateRange));
    return Math.floor(now.getTime() / 1000);
  }, [dateRange]);

  // Load all athlete data in parallel
  const loadAllAthleteData = useCallback(async () => {
    if (!profile?.id) {
      setAthletes([]);
      setAthleteDataCache({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: athletesData } = await getAthletes(profile.id);
      setAthletes(athletesData || []);

      if (!athletesData?.length) {
        setAthleteDataCache({});
        setLoading(false);
        return;
      }

      const afterTimestamp = getAfterTimestamp();
      const startDate = toLocalDateStr(new Date(afterTimestamp * 1000));
      const endDate = toLocalDateStr(new Date());

      // For each athlete, fetch Strava + sessions in parallel
      const results = await Promise.allSettled(
        athletesData.map(async (athlete) => {
          const { data: connection } = await getAthleteStravaConnection(athlete.id);
          const stravaConnected = !!connection;

          let activities = [];
          let metrics = null;

          if (stravaConnected) {
            const { data: acts } = await getAthleteStravaActivities(athlete.id, {
              per_page: 200,
              after: afterTimestamp,
            });
            activities = acts || [];
            if (activities.length > 0) {
              metrics = calculateStravaMetrics(activities);
            }
          }

          // Fetch training sessions for completion rate
          const { data: sessions } = await getAthleteSessions(athlete.id, {
            startDate,
            endDate,
            limit: 200,
          });

          return {
            athleteId: athlete.id,
            athleteName: `${athlete.firstName} ${athlete.lastName}`,
            profileImage: athlete.profileImage,
            stravaConnected,
            activities,
            metrics,
            sessions: sessions || [],
          };
        })
      );

      // Build cache
      const cache = {};
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const d = result.value;
          cache[d.athleteId] = d;
        }
      });

      setAthleteDataCache(cache);
    } catch (error) {
      console.error('Error loading metrics data:', error);
      setAthleteDataCache({});
    } finally {
      setLoading(false);
    }
  }, [profile?.id, getAfterTimestamp]);

  // Load data when profile or dateRange changes
  useEffect(() => {
    loadAllAthleteData();
  }, [loadAllAthleteData]);

  // Compute individual athlete metrics
  const computeIndividualMetrics = useCallback((athleteId) => {
    const data = athleteDataCache[athleteId];
    if (!data) {
      setCurrentActivities([]);
      setCurrentMetrics(null);
      setCompletionRate(null);
      setPeriodComparison(null);
      setTopPerformers([]);
      return;
    }

    setCurrentActivities(data.activities);
    setCurrentMetrics(data.metrics);

    // Completion rate from training_sessions
    const total = data.sessions.length;
    const completed = data.sessions.filter(s => s.status === 'completed').length;
    setCompletionRate(total > 0 ? Math.round((completed / total) * 100) : null);

    // Period comparison
    if (data.activities.length > 0) {
      const halfDays = parseInt(dateRange) / 2;
      const now = new Date();
      const midpoint = new Date(now);
      midpoint.setDate(midpoint.getDate() - halfDays);

      const current = data.activities.filter(a => new Date(a.start_date_local) >= midpoint);
      const previous = data.activities.filter(a => new Date(a.start_date_local) < midpoint);
      setPeriodComparison(calculatePeriodComparison(current, previous));
    } else {
      setPeriodComparison(null);
    }

    setTopPerformers([]);
  }, [athleteDataCache, dateRange]);

  // Compute aggregated metrics for all athletes
  const computeAggregatedMetrics = useCallback(() => {
    const allData = Object.values(athleteDataCache);
    const allConnected = allData.filter(d => d.stravaConnected);
    const allActivities = allConnected.flatMap(d => d.activities);

    setCurrentActivities(allActivities);

    if (allActivities.length > 0) {
      setCurrentMetrics(calculateStravaMetrics(allActivities));
    } else {
      setCurrentMetrics(null);
    }

    // Aggregated completion rate
    const allSessions = allData.flatMap(d => d.sessions);
    const total = allSessions.length;
    const completed = allSessions.filter(s => s.status === 'completed').length;
    setCompletionRate(total > 0 ? Math.round((completed / total) * 100) : null);

    // Period comparison
    if (allActivities.length > 0) {
      const halfDays = parseInt(dateRange) / 2;
      const now = new Date();
      const midpoint = new Date(now);
      midpoint.setDate(midpoint.getDate() - halfDays);

      const current = allActivities.filter(a => new Date(a.start_date_local) >= midpoint);
      const previous = allActivities.filter(a => new Date(a.start_date_local) < midpoint);
      setPeriodComparison(calculatePeriodComparison(current, previous));
    } else {
      setPeriodComparison(null);
    }

    // Top performers ranked by total distance
    const performers = allConnected
      .filter(d => d.metrics)
      .map(d => ({
        id: d.athleteId,
        name: d.athleteName,
        profileImage: d.profileImage,
        totalDistanceKm: parseFloat(d.metrics.totalDistanceKm),
        avgPace: d.metrics.avgPace,
        totalActivities: d.metrics.totalActivities,
        avgHeartrate: d.metrics.avgHeartrate,
        totalElevation: parseFloat(d.metrics.totalElevation) || 0,
        totalTimeFormatted: d.metrics.totalTimeFormatted,
        longestRunKm: d.metrics.longestRun?.distanceKm || 0,
      }))
      .sort((a, b) => b.totalDistanceKm - a.totalDistanceKm);

    setTopPerformers(performers);
  }, [athleteDataCache, dateRange]);

  // When selection or cache changes, recompute
  useEffect(() => {
    if (Object.keys(athleteDataCache).length === 0) return;
    if (selectedAthlete === 'all') {
      computeAggregatedMetrics();
    } else {
      computeIndividualMetrics(selectedAthlete);
    }
  }, [selectedAthlete, athleteDataCache, computeAggregatedMetrics, computeIndividualMetrics]);

  // Sorted performers for ranking table
  const sortedPerformers = useMemo(() => {
    if (!topPerformers.length) return [];
    return [...topPerformers].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];
      // Handle pace strings (e.g. "5:30") — lower is better
      if (sortKey === 'avgPace') {
        const parsePace = (p) => {
          if (!p) return Infinity;
          const parts = p.split(':');
          return parseInt(parts[0]) * 60 + parseInt(parts[1] || 0);
        };
        aVal = parsePace(aVal);
        bVal = parsePace(bVal);
      }
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [topPerformers, sortKey, sortDirection]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection(key === 'avgPace' ? 'asc' : 'desc');
    }
  };

  const toggleCompareAthlete = (id) => {
    setSelectedForCompare(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  // ----- Chart data builders -----

  // Get number of weeks from date range
  const getWeekCount = () => {
    const days = parseInt(dateRange);
    return Math.max(1, Math.ceil(days / 7));
  };

  // Build weekly km progression data
  const weeklyProgressionData = useMemo(() => {
    if (!currentActivities.length) return null;

    const weekCount = getWeekCount();
    const labels = [];
    const distanceData = [];
    const now = new Date();

    for (let i = weekCount - 1; i >= 0; i--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - i * 7);
      weekEnd.setHours(23, 59, 59, 999);

      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);

      const weekActivities = currentActivities.filter(a => {
        const d = new Date(a.start_date_local);
        return d >= weekStart && d <= weekEnd;
      });

      const km = weekActivities.reduce((sum, a) => sum + (a.distance || 0), 0) / 1000;
      distanceData.push(parseFloat(km.toFixed(1)));

      if (weekCount <= 5) {
        labels.push(weekEnd.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }));
      } else {
        labels.push(weekEnd.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }));
      }
    }

    return {
      labels,
      datasets: [{
        label: 'Kilómetros',
        data: distanceData,
        borderColor: 'rgb(249, 115, 22)',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      }],
    };
  }, [currentActivities, dateRange]);

  // Build weekly training load (minutes) data
  const trainingLoadData = useMemo(() => {
    if (!currentActivities.length) return null;

    const weekCount = getWeekCount();
    const labels = [];
    const loadData = [];
    const now = new Date();

    for (let i = weekCount - 1; i >= 0; i--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - i * 7);
      weekEnd.setHours(23, 59, 59, 999);

      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);

      const weekActivities = currentActivities.filter(a => {
        const d = new Date(a.start_date_local);
        return d >= weekStart && d <= weekEnd;
      });

      const minutes = weekActivities.reduce((sum, a) => sum + (a.moving_time || 0), 0) / 60;
      loadData.push(Math.round(minutes));

      labels.push(weekEnd.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }));
    }

    return {
      labels,
      datasets: [{
        label: 'Minutos',
        data: loadData,
        backgroundColor: 'rgba(147, 51, 234, 0.8)',
        borderColor: 'rgb(147, 51, 234)',
        borderWidth: 1,
        borderRadius: 4,
      }],
    };
  }, [currentActivities, dateRange]);

  // Build activity type distribution data
  const activityDistributionData = useMemo(() => {
    if (!currentMetrics?.activityTypes) return null;

    const types = Object.entries(currentMetrics.activityTypes)
      .sort((a, b) => b[1].time - a[1].time)
      .slice(0, 6);

    if (types.length === 0) return null;

    const colors = [
      'rgba(59, 130, 246, 0.8)',
      'rgba(34, 197, 94, 0.8)',
      'rgba(147, 51, 234, 0.8)',
      'rgba(249, 115, 22, 0.8)',
      'rgba(236, 72, 153, 0.8)',
      'rgba(107, 114, 128, 0.8)',
    ];

    return {
      labels: types.map(([type]) => getActivityTypeLabel(type)),
      datasets: [{
        data: types.map(([, data]) => Math.round(data.time / 60)),
        backgroundColor: colors.slice(0, types.length),
        borderWidth: 0,
      }],
    };
  }, [currentMetrics]);

  // Build average speed scatter data
  const averageSpeedData = useMemo(() => {
    const runningTypes = ['Run', 'TrailRun', 'VirtualRun'];
    const runningActivities = currentActivities
      .filter(a => runningTypes.includes(a.type) && a.distance > 0 && a.moving_time > 0)
      .sort((a, b) => new Date(a.start_date_local) - new Date(b.start_date_local))
      .slice(-20); // last 20

    if (runningActivities.length === 0) return null;

    const speeds = runningActivities.map(a => parseFloat(((a.distance / 1000) / (a.moving_time / 3600)).toFixed(1)));
    const avgSpeed = speeds.length > 0
      ? parseFloat((speeds.reduce((s, v) => s + v, 0) / speeds.length).toFixed(1))
      : 0;

    const labels = runningActivities.map(a =>
      new Date(a.start_date_local).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    );

    return { labels, speeds, avgSpeed };
  }, [currentActivities]);

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(156, 163, 175, 0.1)' },
      },
      x: {
        grid: { display: false },
        ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
      },
    },
  };

  // Check if any athlete has Strava
  const anyStravaConnected = Object.values(athleteDataCache).some(d => d.stravaConnected);
  const selectedAthleteData = selectedAthlete !== 'all' ? athleteDataCache[selectedAthlete] : null;

  // --- RENDER ---

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FiLoader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Cargando métricas...</p>
        </div>
      </div>
    );
  }

  // Empty state: no athletes
  if (athletes.length === 0) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Métricas y Análisis
          </h1>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 sm:p-12 text-center shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiActivity className="w-10 h-10 text-blue-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
            Añade atletas para ver métricas
          </h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Cuando tus atletas conecten sus dispositivos y completen entrenamientos, podrás ver sus métricas y progresión aquí.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Métricas y Análisis
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Analiza el rendimiento y progreso de tus atletas
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Atleta
            </label>
            <select
              value={selectedAthlete}
              onChange={(e) => setSelectedAthlete(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los atletas</option>
              {athletes.map((athlete) => (
                <option key={athlete.id} value={athlete.id}>
                  {athlete.firstName} {athlete.lastName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Período
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 3 meses</option>
              <option value="180">Últimos 6 meses</option>
            </select>
          </div>
        </div>
      </div>

      {/* Empty state: selected athlete has no Strava */}
      {selectedAthlete !== 'all' && selectedAthleteData && !selectedAthleteData.stravaConnected && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <FiActivity className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Este atleta no tiene Strava conectado
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            El atleta necesita conectar su cuenta de Strava desde la sección de Dispositivos para ver sus métricas.
          </p>
        </div>
      )}

      {/* Empty state: no Strava connected at all (for "all" view) */}
      {selectedAthlete === 'all' && !anyStravaConnected && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <FiActivity className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Sin datos de Strava disponibles
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Tus atletas necesitan conectar sus cuentas de Strava para ver métricas detalladas de rendimiento.
          </p>
        </div>
      )}

      {/* Stats Cards */}
      {currentMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {/* Ritmo Promedio */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 sm:p-5 text-white shadow-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium opacity-90">Ritmo</span>
              <FiTrendingUp className="w-4 h-4 opacity-75" />
            </div>
            <p className="text-xl sm:text-2xl font-bold mb-1">{currentMetrics.avgPace || '-'}</p>
            <p className="text-xs opacity-75">promedio</p>
          </motion.div>

          {/* Distancia Total */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 sm:p-5 text-white shadow-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium opacity-90">Distancia</span>
              <FiMapPin className="w-4 h-4 opacity-75" />
            </div>
            <p className="text-xl sm:text-2xl font-bold mb-1">{currentMetrics.totalDistanceKm}</p>
            <p className="text-xs opacity-75">km totales</p>
            {periodComparison && (
              <p className={`text-xs mt-1 ${periodComparison.changes.distance >= 0 ? 'opacity-90' : 'opacity-75'}`}>
                {periodComparison.changes.distance >= 0 ? '↑' : '↓'} {Math.abs(periodComparison.changes.distance)}%
              </p>
            )}
          </motion.div>

          {/* Actividades */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 sm:p-5 text-white shadow-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium opacity-90">Actividades</span>
              <FiActivity className="w-4 h-4 opacity-75" />
            </div>
            <p className="text-xl sm:text-2xl font-bold mb-1">{currentMetrics.totalActivities}</p>
            <p className="text-xs opacity-75">entrenamientos</p>
            {periodComparison && (
              <p className={`text-xs mt-1 ${periodComparison.changes.activities >= 0 ? 'opacity-90' : 'opacity-75'}`}>
                {periodComparison.changes.activities >= 0 ? '↑' : '↓'} {Math.abs(periodComparison.changes.activities)}%
              </p>
            )}
          </motion.div>

          {/* FC Media */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 sm:p-5 text-white shadow-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium opacity-90">FC Media</span>
              <FiHeart className="w-4 h-4 opacity-75" />
            </div>
            <p className="text-xl sm:text-2xl font-bold mb-1">{currentMetrics.avgHeartrate || '-'}</p>
            <p className="text-xs opacity-75">bpm</p>
          </motion.div>

          {/* Desnivel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 sm:p-5 text-white shadow-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium opacity-90">Desnivel</span>
              <FiZap className="w-4 h-4 opacity-75" />
            </div>
            <p className="text-xl sm:text-2xl font-bold mb-1">{currentMetrics.totalElevation}</p>
            <p className="text-xs opacity-75">metros</p>
          </motion.div>

          {/* Tasa de Finalización */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-gradient-to-br from-yellow-500 to-amber-600 rounded-xl p-4 sm:p-5 text-white shadow-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium opacity-90">Finalización</span>
              <FiTarget className="w-4 h-4 opacity-75" />
            </div>
            <p className="text-xl sm:text-2xl font-bold mb-1">{completionRate != null ? `${completionRate}%` : '-'}</p>
            <p className="text-xs opacity-75">sesiones</p>
          </motion.div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {/* Weekly km progression */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6"
        >
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <FiTrendingUp className="w-5 h-5 mr-2 text-orange-500 flex-shrink-0" />
            Progresión Semanal (km)
          </h3>
          <div className="h-64 sm:h-80">
            {weeklyProgressionData ? (
              <Line data={weeklyProgressionData} options={chartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                <div className="text-center">
                  <FiActivity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sin actividades en este periodo</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Training load */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6"
        >
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <FiZap className="w-5 h-5 mr-2 text-purple-500 flex-shrink-0" />
            Carga de Entrenamiento (min/semana)
          </h3>
          <div className="h-64 sm:h-80">
            {trainingLoadData ? (
              <Bar data={trainingLoadData} options={chartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                <div className="text-center">
                  <FiActivity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sin actividades en este periodo</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Activity type distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6"
        >
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <FiActivity className="w-5 h-5 mr-2 text-blue-500 flex-shrink-0" />
            Distribución de Actividades
          </h3>
          <div className="h-64 sm:h-80 flex items-center justify-center">
            {activityDistributionData ? (
              <Doughnut
                data={activityDistributionData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } },
                    tooltip: {
                      callbacks: {
                        label: (ctx) => `${ctx.label}: ${ctx.parsed} min`,
                      },
                    },
                  },
                }}
              />
            ) : (
              <div className="text-center text-gray-400 dark:text-gray-500">
                <FiActivity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Sin actividades en este periodo</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Average speed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6"
        >
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <FiZap className="w-5 h-5 mr-2 text-blue-500 flex-shrink-0" />
            Velocidad Media
          </h3>
          {averageSpeedData ? (
            <>
              <div className="flex items-center justify-end mb-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center">
                  <div className="w-6 sm:w-8 h-0.5 bg-gray-400 dark:bg-gray-500 mr-1.5 sm:mr-2 flex-shrink-0" />
                  <span className="whitespace-nowrap">Media = {averageSpeedData.avgSpeed} km/h</span>
                </div>
              </div>
              <div className="h-56 sm:h-72">
                <Line
                  data={{
                    labels: averageSpeedData.labels,
                    datasets: [
                      {
                        label: 'Media',
                        data: averageSpeedData.labels.map(() => averageSpeedData.avgSpeed),
                        borderColor: 'rgba(156, 163, 175, 0.6)',
                        borderDash: [5, 5],
                        borderWidth: 1,
                        pointRadius: 0,
                        fill: false,
                      },
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
                        ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
                      },
                      y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(156, 163, 175, 0.1)' },
                        title: { display: true, text: 'km/h' },
                      },
                    },
                  }}
                />
              </div>
            </>
          ) : (
            <div className="h-64 sm:h-72 flex items-center justify-center text-gray-400 dark:text-gray-500">
              <div className="text-center">
                <FiActivity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Sin carreras en este periodo</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Ranking de Atletas (sortable + compare mode) */}
      {selectedAthlete === 'all' && sortedPerformers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center">
              <FiAward className="w-5 h-5 mr-2 text-yellow-500 flex-shrink-0" />
              Ranking de Atletas
            </h3>
            {sortedPerformers.length >= 2 && (
              <button
                onClick={() => { setCompareMode(prev => !prev); setSelectedForCompare([]); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  compareMode
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <FiUsers className="w-4 h-4" />
                {compareMode ? 'Cancelar' : 'Comparar'}
              </button>
            )}
          </div>

          {compareMode && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Selecciona 2-3 atletas para comparar ({selectedForCompare.length}/3)
            </p>
          )}

          {/* Sortable Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  {compareMode && <th className="py-2 px-1 w-8" />}
                  <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 w-8">#</th>
                  <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Atleta</th>
                  {[
                    { key: 'totalDistanceKm', label: 'Distancia' },
                    { key: 'avgPace', label: 'Ritmo' },
                    { key: 'totalActivities', label: 'Act.' },
                    { key: 'avgHeartrate', label: 'FC' },
                    { key: 'totalElevation', label: 'Desnivel' },
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="py-2 px-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none whitespace-nowrap"
                    >
                      <span className="inline-flex items-center gap-0.5">
                        {col.label}
                        {sortKey === col.key && (
                          sortDirection === 'asc'
                            ? <FiChevronUp className="w-3 h-3" />
                            : <FiChevronDown className="w-3 h-3" />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedPerformers.map((performer, index) => {
                  const isSelected = selectedForCompare.includes(performer.id);
                  return (
                    <tr
                      key={performer.id}
                      className={`border-b border-gray-100 dark:border-gray-700/50 transition-colors ${
                        isSelected ? 'bg-purple-50 dark:bg-purple-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                      }`}
                    >
                      {compareMode && (
                        <td className="py-2.5 px-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCompareAthlete(performer.id)}
                            disabled={!isSelected && selectedForCompare.length >= 3}
                            className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                        </td>
                      )}
                      <td className="py-2.5 px-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 ${
                          index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                          index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                          index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-800' :
                          'bg-gradient-to-br from-blue-500 to-purple-600'
                        }`}>
                          {index + 1}
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <p className="font-medium text-gray-900 dark:text-white truncate max-w-[120px]">
                          {performer.name}
                        </p>
                      </td>
                      <td className="py-2.5 px-2 text-right font-semibold text-gray-900 dark:text-white">
                        {performer.totalDistanceKm} km
                      </td>
                      <td className="py-2.5 px-2 text-right text-gray-600 dark:text-gray-400">
                        {performer.avgPace || '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right text-gray-600 dark:text-gray-400">
                        {performer.totalActivities}
                      </td>
                      <td className="py-2.5 px-2 text-right text-gray-600 dark:text-gray-400">
                        {performer.avgHeartrate || '-'}{performer.avgHeartrate ? ' bpm' : ''}
                      </td>
                      <td className="py-2.5 px-2 text-right text-gray-600 dark:text-gray-400">
                        {performer.totalElevation}m
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Comparison Panel */}
          {compareMode && selectedForCompare.length >= 2 && (() => {
            const compareColors = ['#8b5cf6', '#f59e0b', '#10b981'];
            const compared = selectedForCompare.map(id => sortedPerformers.find(p => p.id === id)).filter(Boolean);
            const comparisonMetrics = [
              { key: 'totalDistanceKm', label: 'Distancia (km)', format: v => `${v} km` },
              { key: 'totalActivities', label: 'Actividades', format: v => v },
              { key: 'totalElevation', label: 'Desnivel (m)', format: v => `${v}m` },
              { key: 'avgHeartrate', label: 'FC Media', format: v => v ? `${v} bpm` : '-' },
              { key: 'longestRunKm', label: 'Carrera más larga', format: v => `${v} km` },
            ];

            return (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700"
              >
                <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                  <FiUsers className="w-4 h-4 mr-2 text-purple-500" />
                  Comparativa
                </h4>

                {/* Comparison Bar Chart */}
                <div className="h-64 mb-6">
                  <Bar
                    data={{
                      labels: comparisonMetrics.map(m => m.label),
                      datasets: compared.map((athlete, i) => ({
                        label: athlete.name,
                        data: comparisonMetrics.map(m => parseFloat(athlete[m.key]) || 0),
                        backgroundColor: compareColors[i] + '99',
                        borderColor: compareColors[i],
                        borderWidth: 1,
                        borderRadius: 4,
                      })),
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'top',
                          labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 16,
                            font: { size: 12 },
                          },
                        },
                        tooltip: {
                          callbacks: {
                            label: (ctx) => {
                              const metric = comparisonMetrics[ctx.dataIndex];
                              return `${ctx.dataset.label}: ${metric.format(ctx.raw)}`;
                            },
                          },
                        },
                      },
                      scales: {
                        x: {
                          grid: { display: false },
                          ticks: { font: { size: 11 } },
                        },
                        y: {
                          beginAtZero: true,
                          grid: { color: 'rgba(156, 163, 175, 0.15)' },
                        },
                      },
                    }}
                  />
                </div>

                {/* Comparison Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Métrica</th>
                        {compared.map((a, i) => (
                          <th key={a.id} className="py-2 px-3 text-right text-xs font-medium" style={{ color: compareColors[i] }}>
                            {a.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ...comparisonMetrics,
                        { key: 'avgPace', label: 'Ritmo Medio', format: v => v || '-' },
                      ].map(metric => (
                        <tr key={metric.key} className="border-b border-gray-100 dark:border-gray-700/50">
                          <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{metric.label}</td>
                          {compared.map(a => (
                            <td key={a.id} className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">
                              {metric.format(a[metric.key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            );
          })()}
        </motion.div>
      )}

      {/* Best Performances (individual athlete mode) */}
      {selectedAthlete !== 'all' && currentMetrics && (currentMetrics.longestRun || currentMetrics.fastestPace) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          {currentMetrics.longestRun && (
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl p-4 sm:p-6 border-2 border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs sm:text-sm font-medium text-yellow-700 dark:text-yellow-400">
                  Carrera más larga
                </span>
                <FiTarget className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-yellow-700 dark:text-yellow-300 mb-1">
                {currentMetrics.longestRun.distanceKm} km
              </p>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                {currentMetrics.longestRun.name}
              </p>
            </div>
          )}
          {currentMetrics.fastestPace && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 sm:p-6 border-2 border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs sm:text-sm font-medium text-green-700 dark:text-green-400">
                  Ritmo más rápido
                </span>
                <FiZap className="w-5 h-5 text-green-600 flex-shrink-0" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-green-700 dark:text-green-300 mb-1">
                {currentMetrics.fastestPace.pace}
              </p>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                {currentMetrics.fastestPace.name}
              </p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default Metrics;

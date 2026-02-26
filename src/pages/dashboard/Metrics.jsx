import { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import {
  FiTrendingUp,
  FiActivity,
  FiTarget,
  FiAward,
  FiUsers,
  FiLoader,
  FiChevronUp,
  FiChevronDown,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiCalendar,
} from 'react-icons/fi';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import InfoTooltip from '../../components/common/InfoTooltip';
import useCoachMetrics from '../../hooks/useCoachMetrics';
import { toLocalDateStr } from '../../lib/dateUtils';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getWeekStart = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
};

const getWeekEnd = (weekStart) => {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d;
};

const formatWeekLabel = (weekStart) => {
  const ws = new Date(weekStart);
  const we = new Date(ws);
  we.setDate(we.getDate() + 6);
  return `${ws.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - ${we.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`;
};

// ─── Component ────────────────────────────────────────────────────────────────

const Metrics = () => {
  const { profile } = useAuth();
  const {
    athletes, loading, dateRange, setDateRange,
    sessionsByAthlete, pmcByAthlete, weeklyVolumeByAthlete,
  } = useCoachMetrics(profile?.id);

  // Ranking
  const [sortKey, setSortKey] = useState('totalSessions');
  const [sortDirection, setSortDirection] = useState('desc');
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState([]);

  // ─── Computed: Team Summary ───────────────────────────────────────────────

  const teamSummary = useMemo(() => {
    const totalAthletes = athletes.length;
    const allSessions = Object.values(sessionsByAthlete).flat();
    const totalSessions = allSessions.length;
    const completedSessions = allSessions.filter(s => s.status === 'completed').length;
    const completionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : null;

    // Weekly volume from daily_training_load
    const allLoads = Object.values(weeklyVolumeByAthlete).flat();
    const thisWeekStart = getWeekStart();
    const thisWeekStartStr = toLocalDateStr(thisWeekStart);
    const thisWeekEnd = getWeekEnd(thisWeekStart);
    const thisWeekEndStr = toLocalDateStr(thisWeekEnd);

    const thisWeekLoads = allLoads.filter(d => d.date >= thisWeekStartStr && d.date <= thisWeekEndStr);
    const weekKm = thisWeekLoads.reduce((sum, d) => sum + (d.total_distance_m || 0), 0) / 1000;

    // Average sessions per athlete per week
    const weeks = Math.max(1, parseInt(dateRange) / 7);
    const avgSessionsPerWeek = totalAthletes > 0 ? (totalSessions / totalAthletes / weeks).toFixed(1) : '0';

    return { totalAthletes, totalSessions, completedSessions, completionRate, weekKm, avgSessionsPerWeek };
  }, [athletes, sessionsByAthlete, weeklyVolumeByAthlete, dateRange]);

  // ─── Computed: Weekly Volume Chart (stacked by athlete) ───────────────────

  const weeklyVolumeChartData = useMemo(() => {
    if (athletes.length === 0) return null;

    const days = parseInt(dateRange);
    const weekCount = Math.max(1, Math.ceil(days / 7));
    const now = new Date();
    const weeks = [];

    for (let i = weekCount - 1; i >= 0; i--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - i * 7);
      const weekStart = getWeekStart(weekEnd);
      weeks.push({
        start: toLocalDateStr(weekStart),
        end: toLocalDateStr(getWeekEnd(weekStart)),
        label: formatWeekLabel(weekStart),
      });
    }

    const COLORS = [
      'rgba(59, 130, 246, 0.8)',
      'rgba(249, 115, 22, 0.8)',
      'rgba(34, 197, 94, 0.8)',
      'rgba(147, 51, 234, 0.8)',
      'rgba(236, 72, 153, 0.8)',
      'rgba(234, 179, 8, 0.8)',
      'rgba(20, 184, 166, 0.8)',
      'rgba(239, 68, 68, 0.8)',
      'rgba(107, 114, 128, 0.8)',
      'rgba(99, 102, 241, 0.8)',
    ];

    const datasets = athletes.map((athlete, idx) => {
      const loads = weeklyVolumeByAthlete[athlete.id] || [];
      const weeklyKm = weeks.map(w => {
        const weekLoads = loads.filter(d => d.date >= w.start && d.date <= w.end);
        return parseFloat((weekLoads.reduce((sum, d) => sum + (d.total_distance_m || 0), 0) / 1000).toFixed(1));
      });

      return {
        label: `${athlete.firstName} ${athlete.lastName}`,
        data: weeklyKm,
        backgroundColor: COLORS[idx % COLORS.length],
        borderRadius: 3,
      };
    });

    // Filter out athletes with 0 km in all weeks
    const activeDatasets = datasets.filter(ds => ds.data.some(v => v > 0));

    if (activeDatasets.length === 0) return null;

    return {
      labels: weeks.map(w => w.label),
      datasets: activeDatasets,
    };
  }, [athletes, weeklyVolumeByAthlete, dateRange]);

  // ─── Computed: Compliance per Athlete ─────────────────────────────────────

  const athleteCompliance = useMemo(() => {
    return athletes.map(a => {
      const sessions = sessionsByAthlete[a.id] || [];
      const total = sessions.length;
      const completed = sessions.filter(s => s.status === 'completed').length;
      const skipped = sessions.filter(s => s.status === 'skipped').length;
      const rate = total > 0 ? Math.round((completed / total) * 100) : null;
      return {
        id: a.id,
        name: `${a.firstName} ${a.lastName}`,
        profileImage: a.profileImage,
        total,
        completed,
        skipped,
        pending: total - completed - skipped,
        rate,
      };
    }).sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
  }, [athletes, sessionsByAthlete]);

  // ─── Computed: Alerts ─────────────────────────────────────────────────────

  const alerts = useMemo(() => {
    const items = [];

    athletes.forEach(a => {
      const sessions = sessionsByAthlete[a.id] || [];
      const name = `${a.firstName} ${a.lastName}`;

      // Low compliance alert (<50%)
      const total = sessions.length;
      const completed = sessions.filter(s => s.status === 'completed').length;
      if (total >= 3 && (completed / total) < 0.5) {
        items.push({
          type: 'warning',
          athleteId: a.id,
          name,
          message: `Cumplimiento bajo: ${Math.round((completed / total) * 100)}% (${completed}/${total} sesiones)`,
        });
      }

      // No recent activity: check daily_training_load
      const loads = weeklyVolumeByAthlete[a.id] || [];
      if (loads.length > 0) {
        const lastLoadDate = loads[loads.length - 1]?.date;
        if (lastLoadDate) {
          const daysSince = Math.floor((new Date() - new Date(lastLoadDate + 'T12:00:00')) / (1000 * 60 * 60 * 24));
          if (daysSince > 7) {
            items.push({
              type: 'inactive',
              athleteId: a.id,
              name,
              message: `Sin actividad registrada desde hace ${daysSince} días`,
            });
          }
        }
      } else if (parseInt(dateRange) >= 14) {
        items.push({
          type: 'inactive',
          athleteId: a.id,
          name,
          message: 'Sin actividad registrada en el periodo',
        });
      }

      // Volume drop >30% (this week vs previous)
      if (loads.length > 0) {
        const thisWeekStart = getWeekStart();
        const prevWeekStart = new Date(thisWeekStart);
        prevWeekStart.setDate(prevWeekStart.getDate() - 7);

        const thisWeekStr = toLocalDateStr(thisWeekStart);
        const thisWeekEndStr = toLocalDateStr(getWeekEnd(thisWeekStart));
        const prevWeekStr = toLocalDateStr(prevWeekStart);
        const prevWeekEndStr = toLocalDateStr(getWeekEnd(prevWeekStart));

        const thisWeekKm = loads
          .filter(d => d.date >= thisWeekStr && d.date <= thisWeekEndStr)
          .reduce((sum, d) => sum + (d.total_distance_m || 0), 0) / 1000;
        const prevWeekKm = loads
          .filter(d => d.date >= prevWeekStr && d.date <= prevWeekEndStr)
          .reduce((sum, d) => sum + (d.total_distance_m || 0), 0) / 1000;

        if (prevWeekKm > 5 && thisWeekKm < prevWeekKm * 0.7) {
          const drop = Math.round((1 - thisWeekKm / prevWeekKm) * 100);
          items.push({
            type: 'volume_drop',
            athleteId: a.id,
            name,
            message: `Bajada de volumen: -${drop}% esta semana (${thisWeekKm.toFixed(0)} vs ${prevWeekKm.toFixed(0)} km)`,
          });
        }
      }

      // High ramp rate from PMC
      const pmc = pmcByAthlete[a.id];
      if (pmc?.ramp_rate && pmc.ramp_rate > 1.5) {
        items.push({
          type: 'overload',
          athleteId: a.id,
          name,
          message: `Incremento de carga elevado (ramp rate: ${pmc.ramp_rate.toFixed(1)})`,
        });
      }
    });

    return items;
  }, [athletes, sessionsByAthlete, weeklyVolumeByAthlete, pmcByAthlete, dateRange]);

  // ─── Computed: Ranking ────────────────────────────────────────────────────

  const ranking = useMemo(() => {
    return athletes.map(a => {
      const sessions = sessionsByAthlete[a.id] || [];
      const loads = weeklyVolumeByAthlete[a.id] || [];
      const totalKm = loads.reduce((sum, d) => sum + (d.total_distance_m || 0), 0) / 1000;
      const totalTime = loads.reduce((sum, d) => sum + (d.total_duration_s || 0), 0);
      const totalTss = loads.reduce((sum, d) => sum + (d.tss || 0), 0);
      const totalSessions = sessions.length;
      const completedSessions = sessions.filter(s => s.status === 'completed').length;
      const complianceRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : null;
      const pmc = pmcByAthlete[a.id];

      return {
        id: a.id,
        name: `${a.firstName} ${a.lastName}`,
        profileImage: a.profileImage,
        totalKm: parseFloat(totalKm.toFixed(1)),
        totalTime,
        totalTimeFormatted: totalTime > 0 ? `${Math.floor(totalTime / 3600)}h ${Math.round((totalTime % 3600) / 60)}m` : '-',
        totalSessions,
        completedSessions,
        complianceRate,
        totalTss: Math.round(totalTss),
        ctl: pmc?.ctl ? Math.round(pmc.ctl) : null,
        tsb: pmc?.tsb ? Math.round(pmc.tsb) : null,
      };
    });
  }, [athletes, sessionsByAthlete, weeklyVolumeByAthlete, pmcByAthlete]);

  const sortedRanking = useMemo(() => {
    return [...ranking].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [ranking, sortKey, sortDirection]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const toggleCompareAthlete = (id) => {
    setSelectedForCompare(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  // ─── Chart Options ────────────────────────────────────────────────────────

  const volumeChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 11 } },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} km`,
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8, font: { size: 10 } },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: { color: 'rgba(156, 163, 175, 0.1)' },
        title: { display: true, text: 'km' },
      },
    },
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FiLoader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Cargando métricas del equipo...</p>
        </div>
      </div>
    );
  }

  if (athletes.length === 0) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Panel del Equipo
          </h1>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 sm:p-12 text-center shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiUsers className="w-10 h-10 text-blue-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
            Añade atletas para ver métricas
          </h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Cuando tus atletas completen entrenamientos, podrás ver las métricas y progresión del equipo aquí.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">
            Panel del Equipo
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Visión general del rendimiento y cumplimiento de tus atletas
          </p>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="7">Últimos 7 días</option>
          <option value="30">Últimos 30 días</option>
          <option value="90">Últimos 3 meses</option>
          <option value="180">Últimos 6 meses</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 sm:p-5 text-white shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium opacity-90">Atletas</span>
            <FiUsers className="w-4 h-4 opacity-75" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold">{teamSummary.totalAthletes}</p>
          <p className="text-xs opacity-75 mt-1">activos</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 sm:p-5 text-white shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium opacity-90">Cumplimiento</span>
            <FiTarget className="w-4 h-4 opacity-75" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold">
            {teamSummary.completionRate != null ? `${teamSummary.completionRate}%` : '-'}
          </p>
          <p className="text-xs opacity-75 mt-1">{teamSummary.completedSessions}/{teamSummary.totalSessions} sesiones</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 sm:p-5 text-white shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium opacity-90">Vol. semana</span>
            <FiTrendingUp className="w-4 h-4 opacity-75" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold">{teamSummary.weekKm.toFixed(0)}</p>
          <p className="text-xs opacity-75 mt-1">km del equipo</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 sm:p-5 text-white shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium opacity-90">Media semanal</span>
            <FiCalendar className="w-4 h-4 opacity-75" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold">{teamSummary.avgSessionsPerWeek}</p>
          <p className="text-xs opacity-75 mt-1">sesiones/atleta</p>
        </motion.div>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-6 sm:mb-8"
        >
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <FiAlertTriangle className="w-5 h-5 mr-2 text-amber-500 flex-shrink-0" />
            Alertas del Equipo
            <InfoTooltip text="Avisos automáticos sobre bajadas de volumen (>30%), cumplimiento bajo (<50%), inactividad prolongada o incrementos bruscos de carga." />
          </h3>
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div
                key={`${alert.athleteId}-${alert.type}-${i}`}
                className={`flex items-start gap-3 p-3 rounded-lg text-sm ${
                  alert.type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' :
                  alert.type === 'overload' ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' :
                  alert.type === 'volume_drop' ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800' :
                  'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                }`}
              >
                <div className={`mt-0.5 flex-shrink-0 ${
                  alert.type === 'warning' ? 'text-amber-500' :
                  alert.type === 'overload' ? 'text-red-500' :
                  alert.type === 'volume_drop' ? 'text-orange-500' :
                  'text-gray-400'
                }`}>
                  {alert.type === 'inactive' ? <FiClock className="w-4 h-4" /> : <FiAlertTriangle className="w-4 h-4" />}
                </div>
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">{alert.name}</span>
                  <span className="text-gray-600 dark:text-gray-400 ml-1">— {alert.message}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {/* Weekly Volume by Athlete (stacked bar) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6"
        >
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <FiTrendingUp className="w-5 h-5 mr-2 text-orange-500 flex-shrink-0" />
            Volumen Semanal por Atleta (km)
            <InfoTooltip text="Kilómetros semanales de cada atleta apilados. Permite comparar la distribución de volumen del equipo y detectar desequilibrios." />
          </h3>
          <div className="h-64 sm:h-80">
            {weeklyVolumeChartData ? (
              <Bar data={weeklyVolumeChartData} options={volumeChartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                <div className="text-center">
                  <FiActivity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sin datos de carga en este periodo</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Compliance per Athlete */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6"
        >
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <FiCheckCircle className="w-5 h-5 mr-2 text-green-500 flex-shrink-0" />
            Cumplimiento por Atleta
            <InfoTooltip text="Porcentaje de sesiones planificadas que cada atleta ha completado en el periodo seleccionado. Verde >80%, amarillo 50-80%, rojo <50%." />
          </h3>
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {athleteCompliance.map((a) => (
              <div key={a.id} className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate w-28 sm:w-36 flex-shrink-0">
                  {a.name}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-5 relative overflow-hidden">
                    {a.rate != null ? (
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          a.rate >= 80 ? 'bg-green-500' :
                          a.rate >= 50 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${Math.max(a.rate, 2)}%` }}
                      />
                    ) : null}
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700 dark:text-gray-200">
                      {a.rate != null ? `${a.rate}%` : 'Sin sesiones'}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 w-16 text-right flex-shrink-0">
                  {a.completed}/{a.total}
                </span>
              </div>
            ))}
            {athleteCompliance.length === 0 && (
              <div className="text-center text-gray-400 dark:text-gray-500 py-8">
                <FiTarget className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Sin sesiones planificadas</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Ranking */}
      {sortedRanking.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center">
              <FiAward className="w-5 h-5 mr-2 text-yellow-500 flex-shrink-0" />
              Ranking de Atletas
              <InfoTooltip text="Clasificación basada en datos de carga de entrenamiento (Supabase). Ordena por cualquier columna. CTL = fitness crónico, TSB = equilibrio agudo (positivo = fresco, negativo = fatiga)." />
            </h3>
            {sortedRanking.length >= 2 && (
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

          {/* Mobile: cards */}
          <div className="sm:hidden space-y-2">
            {sortedRanking.map((athlete, index) => {
              const isSelected = selectedForCompare.includes(athlete.id);
              const medalClass = index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-800' :
                'bg-gradient-to-br from-blue-500 to-purple-600';
              return (
                <div
                  key={athlete.id}
                  onClick={compareMode ? () => toggleCompareAthlete(athlete.id) : undefined}
                  className={`rounded-xl border p-3 transition-colors ${
                    isSelected
                      ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700'
                      : 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700'
                  } ${compareMode ? 'cursor-pointer' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    {compareMode && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        disabled={!isSelected && selectedForCompare.length >= 3}
                        className="w-4 h-4 rounded border-gray-300 text-purple-600 flex-shrink-0"
                      />
                    )}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 ${medalClass}`}>
                      {index + 1}
                    </div>
                    <p className="font-semibold text-gray-900 dark:text-white flex-1 truncate">{athlete.name}</p>
                    {athlete.complianceRate != null && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        athlete.complianceRate >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                        athlete.complianceRate >= 50 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      }`}>
                        {athlete.complianceRate}%
                      </span>
                    )}
                  </div>
                  <div className="mt-2.5 grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">Km</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{athlete.totalKm}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">Tiempo</p>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{athlete.totalTimeFormatted || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">Sesiones</p>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{athlete.completedSessions}/{athlete.totalSessions}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">TSS</p>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{athlete.totalTss || '-'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  {compareMode && <th className="py-2 px-1 w-8" />}
                  <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 w-8">#</th>
                  <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Atleta</th>
                  {[
                    { key: 'totalKm', label: 'Km' },
                    { key: 'totalTimeFormatted', label: 'Tiempo', sortable: false },
                    { key: 'totalSessions', label: 'Sesiones' },
                    { key: 'complianceRate', label: 'Cumpl.' },
                    { key: 'totalTss', label: 'TSS' },
                    { key: 'ctl', label: 'CTL' },
                    { key: 'tsb', label: 'TSB' },
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={col.sortable !== false ? () => handleSort(col.key) : undefined}
                      className={`py-2 px-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap select-none ${
                        col.sortable !== false ? 'cursor-pointer hover:text-gray-700 dark:hover:text-gray-200' : ''
                      }`}
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
                {sortedRanking.map((athlete, index) => {
                  const isSelected = selectedForCompare.includes(athlete.id);
                  return (
                    <tr
                      key={athlete.id}
                      className={`border-b border-gray-100 dark:border-gray-700/50 transition-colors ${
                        isSelected ? 'bg-purple-50 dark:bg-purple-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                      }`}
                    >
                      {compareMode && (
                        <td className="py-2.5 px-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCompareAthlete(athlete.id)}
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
                          {athlete.name}
                        </p>
                      </td>
                      <td className="py-2.5 px-2 text-right font-semibold text-gray-900 dark:text-white">
                        {athlete.totalKm} km
                      </td>
                      <td className="py-2.5 px-2 text-right text-gray-600 dark:text-gray-400">
                        {athlete.totalTimeFormatted}
                      </td>
                      <td className="py-2.5 px-2 text-right text-gray-600 dark:text-gray-400">
                        {athlete.completedSessions}/{athlete.totalSessions}
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        {athlete.complianceRate != null ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            athlete.complianceRate >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                            athlete.complianceRate >= 50 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          }`}>
                            {athlete.complianceRate}%
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right text-gray-600 dark:text-gray-400">
                        {athlete.totalTss || '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right text-gray-600 dark:text-gray-400">
                        {athlete.ctl ?? '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        {athlete.tsb != null ? (
                          <span className={`text-xs font-medium ${
                            athlete.tsb > 10 ? 'text-green-600 dark:text-green-400' :
                            athlete.tsb > -10 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {athlete.tsb > 0 ? '+' : ''}{athlete.tsb}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
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
            const compared = selectedForCompare.map(id => sortedRanking.find(a => a.id === id)).filter(Boolean);
            const comparisonMetrics = [
              { key: 'totalKm', label: 'Distancia (km)', format: v => `${v} km` },
              { key: 'totalSessions', label: 'Sesiones planificadas', format: v => v },
              { key: 'completedSessions', label: 'Sesiones completadas', format: v => v },
              { key: 'complianceRate', label: 'Cumplimiento', format: v => v != null ? `${v}%` : '-' },
              { key: 'totalTss', label: 'TSS acumulado', format: v => v || '-' },
              { key: 'ctl', label: 'CTL (Fitness)', format: v => v ?? '-' },
              { key: 'tsb', label: 'TSB (Frescura)', format: v => v != null ? (v > 0 ? `+${v}` : `${v}`) : '-' },
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
                      labels: comparisonMetrics.filter(m => typeof compared[0]?.[m.key] === 'number').map(m => m.label),
                      datasets: compared.map((athlete, i) => ({
                        label: athlete.name,
                        data: comparisonMetrics.filter(m => typeof compared[0]?.[m.key] === 'number').map(m => parseFloat(athlete[m.key]) || 0),
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
                          labels: { usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 12 } },
                        },
                      },
                      scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                        y: { beginAtZero: true, grid: { color: 'rgba(156, 163, 175, 0.15)' } },
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
                      {comparisonMetrics.map(metric => (
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
    </div>
  );
};

export default Metrics;

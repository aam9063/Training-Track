import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Line } from 'react-chartjs-2';
import { FiTrendingUp, FiLoader, FiInfo } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { getDailyTrainingLoad, recalculateTrainingLoad, getCurrentPMCStatus } from '../../services/trainingLoadService';
import { getTsbZone, getAcwrZone, calculateAcwr } from '../../lib/trainingMetrics';
import { toLocalDateStr } from '../../lib/dateUtils';
import InfoTooltip from '../common/InfoTooltip';

const PERIOD_OPTIONS = [
  { value: '8weeks', label: '8 semanas', days: 56 },
  { value: '12weeks', label: '12 semanas', days: 84 },
  { value: '6months', label: '6 meses', days: 180 },
  { value: '1year', label: '1 año', days: 365 },
];

export default function PMCChart({ activities, athleteProfile, athleteId: propAthleteId }) {
  const { user, profile } = useAuth();
  const athleteId = propAthleteId || profile?.id || user?.id;
  const [loadData, setLoadData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [period, setPeriod] = useState('12weeks');
  const [currentStatus, setCurrentStatus] = useState(null);

  const selectedPeriod = PERIOD_OPTIONS.find(p => p.value === period);

  useEffect(() => {
    const fetchLoad = async () => {
      if (!athleteId) return;
      setLoading(true);
      try {
        const endDate = toLocalDateStr(new Date());
        const startDateObj = new Date();
        startDateObj.setDate(startDateObj.getDate() - selectedPeriod.days);
        const startDate = toLocalDateStr(startDateObj);

        const [data, status] = await Promise.all([
          getDailyTrainingLoad(athleteId, startDate, endDate),
          getCurrentPMCStatus(athleteId),
        ]);

        setLoadData(data);
        setCurrentStatus(status);
      } catch (err) {
        console.error('Error fetching training load:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLoad();
  }, [athleteId, period, selectedPeriod.days]);

  const handleRecalculate = async () => {
    if (!activities || !athleteId) return;
    setRecalculating(true);
    try {
      const records = await recalculateTrainingLoad(athleteId, activities, athleteProfile);
      if (records.length > 0) {
        // Refresh data
        const endDate = toLocalDateStr(new Date());
        const startDateObj = new Date();
        startDateObj.setDate(startDateObj.getDate() - selectedPeriod.days);
        const [data, status] = await Promise.all([
          getDailyTrainingLoad(athleteId, toLocalDateStr(startDateObj), endDate),
          getCurrentPMCStatus(athleteId),
        ]);
        setLoadData(data);
        setCurrentStatus(status);
      }
    } catch (err) {
      console.error('Error recalculating:', err);
    } finally {
      setRecalculating(false);
    }
  };

  const chartData = useMemo(() => {
    if (!loadData || loadData.length === 0) return null;

    return {
      labels: loadData.map(d => {
        const date = new Date(d.date + 'T12:00:00');
        return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
      }),
      datasets: [
        {
          label: 'CTL (Fitness)',
          data: loadData.map(d => d.ctl),
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: 'ATL (Fatiga)',
          data: loadData.map(d => d.atl),
          borderColor: '#EF4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: 'TSB (Forma)',
          data: loadData.map(d => d.tsb),
          borderColor: '#10B981',
          backgroundColor: (ctx) => {
            const value = ctx.raw;
            if (value === undefined) return 'rgba(16, 185, 129, 0.1)';
            return value >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
          },
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: 'TSS diario',
          data: loadData.map(d => d.tss),
          borderColor: 'rgba(156, 163, 175, 0.5)',
          backgroundColor: 'rgba(156, 163, 175, 0.3)',
          type: 'bar',
          yAxisID: 'tss',
          barPercentage: 0.8,
        },
      ],
    };
  }, [loadData]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 15,
          font: { size: 11 },
          color: '#9CA3AF',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleColor: '#F9FAFB',
        bodyColor: '#D1D5DB',
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (ctx) => {
            const val = Math.round(ctx.raw * 10) / 10;
            return ` ${ctx.dataset.label}: ${val}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxTicksLimit: 12, color: '#9CA3AF', font: { size: 10 } },
      },
      y: {
        grid: { color: 'rgba(156, 163, 175, 0.1)' },
        ticks: { color: '#9CA3AF', font: { size: 10 } },
      },
      tss: {
        position: 'right',
        grid: { display: false },
        ticks: { color: '#9CA3AF', font: { size: 10 } },
        title: { display: true, text: 'TSS', color: '#9CA3AF' },
      },
    },
  };

  const tsbZone = currentStatus ? getTsbZone(currentStatus.tsb) : null;
  const acwr = currentStatus ? calculateAcwr(currentStatus.atl, currentStatus.ctl) : null;
  const acwrZone = acwr ? getAcwrZone(acwr) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-ath-surface rounded-xl border border-ath-border p-4"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <FiTrendingUp className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <h3 className="text-base sm:text-lg font-semibold text-ath-text-primary flex items-center">
            <span className="hidden sm:inline">Curva de Rendimiento (PMC)</span>
            <span className="sm:hidden">PMC</span>
            <InfoTooltip text="Gráfico de gestión del rendimiento. CTL (azul) = fitness acumulado. ATL (rojo) = fatiga reciente. TSB = forma actual (CTL − ATL). Un TSB positivo indica frescura; negativo indica fatiga acumulada." />
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="text-xs px-2 py-1 rounded-lg border border-ath-border bg-ath-surface text-ath-text-secondary"
          >
            {PERIOD_OPTIONS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          {activities && activities.length > 0 && (
            <button
              onClick={handleRecalculate}
              disabled={recalculating}
              className="text-xs px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50"
            >
              {recalculating ? 'Calculando...' : 'Recalcular'}
            </button>
          )}
        </div>
      </div>

      {/* Status Cards */}
      {currentStatus && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">CTL (Fitness)</p>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{Math.round(currentStatus.ctl)}</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">ATL (Fatiga)</p>
            <p className="text-xl font-bold text-red-700 dark:text-red-300">{Math.round(currentStatus.atl)}</p>
          </div>
          <div className="rounded-lg p-3 text-center" style={{ backgroundColor: tsbZone ? `${tsbZone.color}15` : '#F3F4F6' }}>
            <p className="text-xs font-medium" style={{ color: tsbZone?.color || '#6B7280' }}>TSB (Forma)</p>
            <p className="text-xl font-bold" style={{ color: tsbZone?.color || '#374151' }}>{Math.round(currentStatus.tsb)}</p>
            <p className="text-[10px] mt-0.5" style={{ color: tsbZone?.color || '#6B7280' }}>{tsbZone?.label}</p>
          </div>
          <div className="rounded-lg p-3 text-center" style={{ backgroundColor: acwrZone ? `${acwrZone.color}15` : '#F3F4F6' }}>
            <p className="text-xs font-medium" style={{ color: acwrZone?.color || '#6B7280' }}>ACWR</p>
            <p className="text-xl font-bold" style={{ color: acwrZone?.color || '#374151' }}>{acwr?.toFixed(2) || '--'}</p>
            <p className="text-[10px] mt-0.5" style={{ color: acwrZone?.color || '#6B7280' }}>{acwrZone?.label}</p>
          </div>
        </div>
      )}

      {/* Chart */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <FiLoader className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : chartData ? (
        <div className="h-72">
          <Line data={chartData} options={chartOptions} />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-48 text-ath-text-muted">
          <FiInfo className="w-8 h-8 mb-2" />
          <p className="text-sm">No hay datos de carga de entrenamiento</p>
          {activities && activities.length > 0 && (
            <button
              onClick={handleRecalculate}
              disabled={recalculating}
              className="mt-3 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Calcular desde actividades de Strava
            </button>
          )}
        </div>
      )}

      {/* TSB Guidelines info */}
      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-ath-text-muted">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Listo para competir (TSB +15 a +25)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Entrenamiento productivo (TSB -10 a -30)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Sobrecarga (TSB &lt; -30)</span>
      </div>
    </motion.div>
  );
}

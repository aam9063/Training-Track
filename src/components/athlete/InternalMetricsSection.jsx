import { motion } from 'framer-motion';
import { Bar, Line } from 'react-chartjs-2';
import {
  FiActivity,
  FiCheckCircle,
  FiClock,
  FiLoader,
  FiMapPin,
  FiTrendingUp,
  FiZap,
} from 'react-icons/fi';
import { formatDecimalPace } from '../../lib/formatters';
import { CHART_COLORS } from '../../lib/chartColors';

/**
 * Displays progression metrics derived from completed training_sessions.
 * Shown for all athletes (independent and coached), with or without Strava.
 *
 * Props are passed explicitly — no shared closure with the parent page.
 */
const InternalMetricsSection = ({
  weeklyKm,
  weeklyRpe,
  weeklyPace,
  completionRate,
  hasData,
  loading,
}) => {
  const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: CHART_COLORS.axisTick, font: { size: 10 } } },
      y: {
        beginAtZero: true,
        grid: { color: CHART_COLORS.grid },
        ticks: { color: CHART_COLORS.axisTick, font: { size: 10 } },
      },
    },
  };

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
          {completionRate && completionRate.total > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 bg-ath-surface rounded-2xl border border-ath-border p-4"
            >
              <div className="flex-shrink-0 w-14 h-14 relative">
                <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
                  <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor" strokeWidth="6" className="text-ath-inset" />
                  <circle
                    cx="28"
                    cy="28"
                    r="22"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                {weeklyKm.some((w) => w.km > 0) ? (
                  <Bar
                    data={{
                      labels: weeklyKm.map((w) => w.label),
                      datasets: [{
                        label: 'km',
                        data: weeklyKm.map((w) => w.km),
                        backgroundColor: CHART_COLORS.fitnessBar,
                        borderRadius: 4,
                        barPercentage: 0.7,
                      }],
                    }}
                    options={{
                      ...commonChartOptions,
                      scales: {
                        ...commonChartOptions.scales,
                        y: {
                          ...commonChartOptions.scales.y,
                          title: { display: true, text: 'km', color: CHART_COLORS.axisTick, font: { size: 10 } },
                        },
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
                {weeklyRpe.some((w) => w.avgRpe !== null && w.avgRpe !== undefined) ? (
                  <Line
                    data={{
                      labels: weeklyRpe.map((w) => w.label),
                      datasets: [{
                        label: 'RPE medio',
                        data: weeklyRpe.map((w) => w.avgRpe),
                        borderColor: CHART_COLORS.cycling,
                        backgroundColor: CHART_COLORS.cyclingFill,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: CHART_COLORS.cycling,
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
                          title: { display: true, text: 'RPE (1-10)', color: CHART_COLORS.axisTick, font: { size: 10 } },
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

          {weeklyPace.some((w) => w.avgPace !== null && w.avgPace !== undefined) && (
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
                    labels: weeklyPace.map((w) => w.label),
                    datasets: [{
                      label: 'min/km',
                      data: weeklyPace.map((w) => w.avgPace),
                      borderColor: CHART_COLORS.swimming,
                      backgroundColor: CHART_COLORS.swimmingFill,
                      fill: true,
                      tension: 0.4,
                      pointRadius: 4,
                      pointBackgroundColor: CHART_COLORS.swimming,
                      spanGaps: true,
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => (ctx.parsed.y !== null && ctx.parsed.y !== undefined ? `${formatDecimalPace(ctx.parsed.y)} min/km` : '–'),
                        },
                      },
                    },
                    scales: {
                      x: { grid: { display: false }, ticks: { color: CHART_COLORS.axisTick, font: { size: 10 } } },
                      y: {
                        reverse: true,
                        grid: { color: CHART_COLORS.grid },
                        ticks: {
                          color: CHART_COLORS.axisTick,
                          font: { size: 10 },
                          callback: (v) => formatDecimalPace(v),
                        },
                        title: { display: true, text: 'min/km', color: CHART_COLORS.axisTick, font: { size: 10 } },
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

export default InternalMetricsSection;

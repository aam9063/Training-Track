import { useEffect, useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { FiLoader, FiTrendingUp } from 'react-icons/fi';
import { getWeeklyLoadSeries } from '../../../services/metricsAnalyticsService';
import { MetricAIAnalyzer } from '../MetricAIAnalyzer';
import InfoTooltip from '../../common/InfoTooltip';

export default function SufferScoreChart({ athleteId, athleteContext, weeks = 12 }) {
  const [state, setState] = useState({ loading: true, series: [], error: null });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!athleteId) return;
      setState((p) => ({ ...p, loading: true, error: null }));
      const { data, error } = await getWeeklyLoadSeries(athleteId, weeks);
      if (cancelled) return;
      if (error) {
        setState({ loading: false, series: [], error: error.message });
        return;
      }
      setState({ loading: false, series: data || [], error: null });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [athleteId, weeks]);

  const hasData = state.series.length > 0;

  const chartData = useMemo(() => ({
    labels: state.series.map((r) => r.week),
    datasets: [
      {
        label: 'Suffer Score',
        data: state.series.map((r) => r.total_suffer),
        backgroundColor: 'rgba(239, 68, 68, 0.75)',
        borderRadius: 6,
      },
    ],
  }), [state.series]);

  const aiData = useMemo(() => ({ series: state.series, weeks }), [state.series, weeks]);

  return (
    <div className="bg-white dark:bg-ath-elevated rounded-2xl border border-ath-border p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FiTrendingUp className="w-5 h-5 text-red-500 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h3 className="text-base font-bold text-ath-text-primary truncate">
                Suffer Score semanal
              </h3>
              <InfoTooltip text="Puntuación de carga basada en tiempo en zonas de FC. Valores altos indican sesiones muy exigentes; tendencias ascendentes sostenidas pueden indicar sobreentrenamiento." />
            </div>
            <p className="text-[11px] text-ath-text-muted">Últimas {weeks} semanas</p>
          </div>
        </div>
        <MetricAIAnalyzer
          chartType="weekly_load"
          data={aiData}
          athleteContext={athleteContext}
          compact
          title="Análisis de Suffer Score semanal"
          disabled={!hasData}
        />
      </div>

      <div className="h-[280px]">
        {state.loading ? (
          <div className="flex items-center justify-center h-full text-ath-text-muted">
            <FiLoader className="w-6 h-6 animate-spin" />
          </div>
        ) : !hasData ? (
          <div className="flex items-center justify-center h-full text-xs text-ath-text-muted text-center px-6">
            Sin datos de esfuerzo en este periodo.
          </div>
        ) : (
          <Bar
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx) => `Suffer: ${ctx.parsed.y}`,
                  },
                },
              },
              scales: {
                y: { beginAtZero: true },
                x: { ticks: { maxTicksLimit: 6 } },
              },
            }}
          />
        )}
      </div>
    </div>
  );
}

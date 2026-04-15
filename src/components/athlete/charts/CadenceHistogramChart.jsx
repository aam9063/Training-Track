import { useEffect, useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { FiLoader, FiActivity } from 'react-icons/fi';
import { getCadenceDistribution } from '../../../services/metricsAnalyticsService';
import InfoTooltip from '../../common/InfoTooltip';

export default function CadenceHistogramChart({ athleteId, weeks = 8 }) {
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!athleteId) return;
      setState((p) => ({ ...p, loading: true, error: null }));
      const { data, error } = await getCadenceDistribution(athleteId, weeks);
      if (cancelled) return;
      if (error) {
        setState({ loading: false, data: null, error: error.message });
        return;
      }
      setState({ loading: false, data, error: null });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [athleteId, weeks]);

  const hasData = Boolean(state.data?.valid_samples && state.data.valid_samples > 0);

  const chartData = useMemo(() => {
    const buckets = state.data?.buckets || [];
    return {
      labels: buckets.map((b) => b.label),
      datasets: [
        {
          label: '% del tiempo',
          data: buckets.map((b) => b.pct),
          backgroundColor: '#06b6d4',
          borderRadius: 6,
        },
      ],
    };
  }, [state.data]);

  return (
    <div className="bg-white dark:bg-ath-elevated rounded-2xl border border-ath-border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <FiActivity className="w-5 h-5 text-cyan-500 shrink-0" />
        <div>
          <div className="flex items-center gap-1">
            <h3 className="text-base font-bold text-ath-text-primary">
              Distribución de cadencia
            </h3>
            <InfoTooltip text="Distribución de pasos por minuto (ppm). Rango óptimo: 170-180 ppm para la mayoría de corredores." />
          </div>
          <p className="text-[11px] text-ath-text-muted">
            Últimas {weeks} semanas · spm
            {hasData ? ` · media ${state.data.mean_spm}` : ''}
          </p>
        </div>
      </div>

      <div className="h-[280px]">
        {state.loading ? (
          <div className="flex items-center justify-center h-full text-ath-text-muted">
            <FiLoader className="w-6 h-6 animate-spin" />
          </div>
        ) : !hasData ? (
          <div className="flex items-center justify-center h-full text-xs text-ath-text-muted text-center px-6">
            Sin datos de cadencia en este periodo.
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
                    label: (ctx) => `${ctx.parsed.y}%`,
                  },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: { callback: (v) => `${v}%` },
                },
              },
            }}
          />
        )}
      </div>
    </div>
  );
}

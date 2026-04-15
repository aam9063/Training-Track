import { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { FiLoader, FiTrendingUp } from 'react-icons/fi';
import { getVdotProgression } from '../../../services/metricsAnalyticsService';
import MetricAIAnalyzer from '../MetricAIAnalyzer';
import InfoTooltip from '../../common/InfoTooltip';

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const formatDateShort = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]}`;
};

export default function VdotProgressionChart({ athleteId, athleteContext }) {
  const [state, setState] = useState({ loading: true, series: [], error: null });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!athleteId) return;
      setState((p) => ({ ...p, loading: true, error: null }));
      const { data, error } = await getVdotProgression(athleteId);
      if (cancelled) return;
      if (error) {
        setState({ loading: false, series: [], error: error.message });
        return;
      }
      setState({ loading: false, series: data?.series || [], error: null });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  const hasData = state.series.length >= 2;

  const chartData = useMemo(() => ({
    labels: state.series.map((p) => p.date),
    datasets: [
      {
        label: 'VDOT',
        data: state.series.map((p) => p.vdot),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
      },
    ],
  }), [state.series]);

  const aiData = useMemo(() => ({ series: state.series }), [state.series]);

  return (
    <div className="bg-white dark:bg-ath-elevated rounded-2xl border border-ath-border p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FiTrendingUp className="w-5 h-5 text-purple-500 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h3 className="text-base font-bold text-ath-text-primary truncate">
                Progresión VDOT
              </h3>
              <InfoTooltip text="Tu índice VDOT (Daniels) semanal basado en tus mejores esfuerzos. Valores crecientes indican mejora de forma." />
            </div>
            <p className="text-[11px] text-ath-text-muted">Mejor VDOT por semana</p>
          </div>
        </div>
        <MetricAIAnalyzer
          chartType="vdot_progression"
          data={aiData}
          athleteContext={athleteContext}
          compact
          title="Análisis de progresión VDOT"
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
            Necesitas al menos 2 récords para ver tu progresión VDOT.
          </div>
        ) : (
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    title: (items) => {
                      const d = items?.[0]?.label;
                      if (!d) return '';
                      const date = new Date(d);
                      return date.toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      });
                    },
                    label: (ctx) => `VDOT ${ctx.parsed.y}`,
                  },
                },
              },
              scales: {
                x: {
                  ticks: {
                    maxTicksLimit: 6,
                    callback(value) {
                      return formatDateShort(this.getLabelForValue(value));
                    },
                  },
                },
                y: { beginAtZero: false },
              },
            }}
          />
        )}
      </div>
    </div>
  );
}

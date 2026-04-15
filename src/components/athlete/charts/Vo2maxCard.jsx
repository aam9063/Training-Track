import { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { FiHeart, FiLoader } from 'react-icons/fi';
import { getVo2maxEstimate } from '../../../services/metricsAnalyticsService';
import InfoTooltip from '../../common/InfoTooltip';

const METHOD_LABELS = {
  uth: 'Uth-Sørensen',
  vdot: 'Derivado de VDOT',
};

export default function Vo2maxCard({ athleteId }) {
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!athleteId) return;
      setState((p) => ({ ...p, loading: true, error: null }));
      const { data, error } = await getVo2maxEstimate(athleteId);
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
  }, [athleteId]);

  const chartData = useMemo(() => {
    const trend = state.data?.trend || [];
    if (trend.length < 2) return null;
    return {
      labels: trend.map((p) => p.date),
      datasets: [
        {
          data: trend.map((p) => p.value),
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.15)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    };
  }, [state.data]);

  return (
    <div className="bg-white dark:bg-ath-elevated rounded-2xl border border-ath-border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <FiHeart className="w-5 h-5 text-ath-accent shrink-0" />
        <h3 className="text-base font-bold text-ath-text-primary">VO2max estimado</h3>
        <InfoTooltip text="Estimación de tu consumo máximo de oxígeno (ml/kg/min) a partir de FC máxima y reposo. Referencia: 40-50 amateur, 60+ élite." />
      </div>

      {state.loading ? (
        <div className="flex items-center justify-center h-[140px] text-ath-text-muted">
          <FiLoader className="w-6 h-6 animate-spin" />
        </div>
      ) : state.error ? (
        <div className="flex items-center justify-center h-[140px] text-xs text-red-500 text-center px-4">
          {state.error}
        </div>
      ) : !state.data ? (
        <div className="flex items-center justify-center h-[140px] text-xs text-ath-text-muted text-center px-4">
          Necesitamos FC máxima y de reposo en tu perfil, o un récord reciente (1K+), para estimar tu VO2max.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-ath-text-primary">
              {state.data.vo2max}
            </span>
            <span className="text-sm text-ath-text-secondary">ml/kg/min</span>
          </div>
          <p className="text-[11px] text-ath-text-muted">
            Método: {METHOD_LABELS[state.data.method] || state.data.method}
          </p>
          <div className="h-[100px]">
            {chartData ? (
              <Line
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false }, tooltip: { enabled: true } },
                  scales: {
                    x: { display: false },
                    y: { display: false, beginAtZero: false },
                  },
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-[11px] text-ath-text-muted">
                Sin tendencia suficiente.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

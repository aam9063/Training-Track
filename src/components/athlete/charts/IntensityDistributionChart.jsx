import { useEffect, useMemo, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { FiActivity, FiLoader } from 'react-icons/fi';
import { getIntensityDistribution } from '../../../services/metricsAnalyticsService';

const LABEL_STYLES = {
  polarizado: {
    label: 'Polarizado',
    description: 'Mucho Z1-Z2 y algo de Z4-Z5, poco Z3. Ideal para fondo.',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  piramidal: {
    label: 'Piramidal',
    description: 'Base amplia con Z3 dominante sobre Z4-Z5. Apto para umbral.',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  otro: {
    label: 'Mixto',
    description: 'Distribución sin un patrón claro. Revisa tu foco.',
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
};

export default function IntensityDistributionChart({ athleteId, weeks = 4 }) {
  const [state, setState] = useState({ loading: true, hasZones: false, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!athleteId) return;
      setState((p) => ({ ...p, loading: true, error: null }));
      const { data, error } = await getIntensityDistribution(athleteId, weeks);
      if (cancelled) return;
      if (error) {
        setState({ loading: false, hasZones: false, data: null, error: error.message });
        return;
      }
      setState({
        loading: false,
        hasZones: Boolean(data?.hasZones),
        data: data || null,
        error: null,
      });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [athleteId, weeks]);

  const chartData = useMemo(() => {
    const d = state.data;
    if (!d) return null;
    return {
      labels: ['Z1-Z2 (baja)', 'Z3 (media)', 'Z4-Z5 (alta)'],
      datasets: [
        {
          data: [d.z12_pct, d.z3_pct, d.z45_pct],
          backgroundColor: ['#22c55e', '#eab308', '#ef4444'],
          borderWidth: 0,
        },
      ],
    };
  }, [state.data]);

  const hasData = Boolean(state.hasZones && chartData);
  const style = state.data?.label ? LABEL_STYLES[state.data.label] : null;

  return (
    <div className="bg-white dark:bg-ath-elevated rounded-2xl border border-ath-border p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <FiActivity className="w-5 h-5 text-ath-accent shrink-0" />
          <div className="min-w-0">
            <h3 className="text-base font-bold text-ath-text-primary truncate">
              Distribución de intensidad
            </h3>
            <p className="text-[11px] text-ath-text-muted">Últimas {weeks} semanas</p>
          </div>
        </div>
      </div>

      <div className="h-[280px] flex flex-col">
        {state.loading ? (
          <div className="flex items-center justify-center flex-1 text-ath-text-muted">
            <FiLoader className="w-6 h-6 animate-spin" />
          </div>
        ) : !state.hasZones ? (
          <div className="flex items-center justify-center flex-1 text-xs text-ath-text-muted text-center px-6">
            Configura tus zonas de FC para calcular la distribución.
          </div>
        ) : !hasData ? (
          <div className="flex items-center justify-center flex-1 text-xs text-ath-text-muted text-center px-6">
            Aún no hay datos de FC en este periodo.
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0">
              <Doughnut
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
                    tooltip: {
                      callbacks: {
                        label: (ctx) => `${ctx.label}: ${ctx.parsed}%`,
                      },
                    },
                  },
                  cutout: '60%',
                }}
              />
            </div>
            {style && (
              <div className={`mt-3 rounded-xl px-3 py-2 text-center ${style.color}`}>
                <p className="text-sm font-bold">{style.label}</p>
                <p className="text-[11px] opacity-90">{style.description}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

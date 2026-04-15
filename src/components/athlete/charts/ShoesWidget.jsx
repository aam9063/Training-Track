import { useEffect, useState } from 'react';
import { FiLoader, FiAlertTriangle } from 'react-icons/fi';
import { GiRunningShoe } from 'react-icons/gi';
import { getShoes } from '../../../services/metricsAnalyticsService';

const RECOMMENDED_MAX_KM = 800;
const WARNING_KM = 650;

const colorFor = (km) => {
  if (km >= RECOMMENDED_MAX_KM) return 'bg-red-500';
  if (km >= WARNING_KM) return 'bg-amber-500';
  return 'bg-emerald-500';
};

const statusFor = (km) => {
  if (km >= RECOMMENDED_MAX_KM) return { label: 'Reemplazar', tone: 'text-red-600 dark:text-red-400' };
  if (km >= WARNING_KM) return { label: 'Cerca del límite', tone: 'text-amber-600 dark:text-amber-400' };
  return { label: 'En buen estado', tone: 'text-emerald-600 dark:text-emerald-400' };
};

export default function ShoesWidget({ athleteId }) {
  const [state, setState] = useState({ loading: true, shoes: [], error: null });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!athleteId) return;
      setState((p) => ({ ...p, loading: true, error: null }));
      const { data, error } = await getShoes(athleteId);
      if (cancelled) return;
      if (error) {
        setState({ loading: false, shoes: [], error: error.message });
        return;
      }
      setState({ loading: false, shoes: data || [], error: null });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  const hasData = state.shoes.length > 0;

  return (
    <div className="bg-white dark:bg-ath-elevated rounded-2xl border border-ath-border p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <GiRunningShoe className="w-5 h-5 text-ath-accent shrink-0" />
          <div className="min-w-0">
            <h3 className="text-base font-bold text-ath-text-primary truncate">
              Material: zapatillas
            </h3>
            <p className="text-[11px] text-ath-text-muted">Km por par</p>
          </div>
        </div>
      </div>

      <div className="min-h-[280px]">
        {state.loading ? (
          <div className="flex items-center justify-center h-[240px] text-ath-text-muted">
            <FiLoader className="w-6 h-6 animate-spin" />
          </div>
        ) : state.error ? (
          <div className="flex items-center justify-center h-[240px] text-xs text-red-500 text-center px-4">
            {state.error}
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center h-[240px] text-center gap-2 px-6">
            <GiRunningShoe className="w-10 h-10 text-ath-text-muted" />
            <p className="text-xs text-ath-text-muted max-w-xs">
              Registra tus zapatillas en Strava para ver su uso y recibir alertas de reemplazo.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {state.shoes.map((shoe) => {
              const pct = Math.min(100, Math.round((shoe.distance_km / RECOMMENDED_MAX_KM) * 100));
              const status = statusFor(shoe.distance_km);
              return (
                <li key={shoe.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-ath-text-primary truncate">
                        {shoe.name}
                      </span>
                      {!shoe.active && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-ath-inset text-ath-text-muted shrink-0">
                          retiradas
                        </span>
                      )}
                      {shoe.primary && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-ath-accent-surface text-ath-accent shrink-0">
                          principal
                        </span>
                      )}
                    </div>
                    <span className="font-semibold text-ath-text-primary shrink-0">
                      {shoe.distance_km} km
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-ath-inset overflow-hidden">
                    <div
                      className={`h-full ${colorFor(shoe.distance_km)} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className={`flex items-center gap-1 text-[11px] ${status.tone}`}>
                    {shoe.distance_km >= WARNING_KM && (
                      <FiAlertTriangle className="w-3 h-3" />
                    )}
                    {status.label}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { FiLoader, FiZap } from 'react-icons/fi';
import { getPaceZones } from '../../../services/metricsAnalyticsService';
import InfoTooltip from '../../common/InfoTooltip';

const ZONE_COLORS = {
  Z1: '#3b82f6',
  Z2: '#22c55e',
  Z3: '#eab308',
  Z4: '#f97316',
  Z5: '#ef4444',
};

const secondsToLabel = (sec) => {
  if (!Number.isFinite(sec) || sec <= 0) return '0m';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

export default function PaceZonesChart({ athleteId, weeks = 4 }) {
  const [state, setState] = useState({ loading: true, zones: [], zonesSource: 'default', error: null });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!athleteId) return;
      setState((p) => ({ ...p, loading: true, error: null }));
      const { data, error } = await getPaceZones(athleteId, weeks);
      if (cancelled) return;
      if (error) {
        setState({ loading: false, zones: [], zonesSource: 'default', error: error.message });
        return;
      }
      setState({
        loading: false,
        zones: data?.zones || [],
        zonesSource: data?.zonesSource || 'default',
        error: null,
      });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [athleteId, weeks]);

  const total = state.zones.reduce((s, z) => s + (z.seconds || 0), 0);
  const hasData = total > 0;

  const chartData = useMemo(() => ({
    labels: state.zones.map((z) => `${z.zone} ${z.label}`),
    datasets: [
      {
        label: '% del tiempo',
        data: state.zones.map((z) => z.pct),
        backgroundColor: state.zones.map((z) => ZONE_COLORS[z.zone]),
        borderRadius: 6,
      },
    ],
  }), [state.zones]);

  return (
    <div className="bg-white dark:bg-ath-elevated rounded-2xl border border-ath-border p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FiZap className="w-5 h-5 text-ath-accent shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h3 className="text-base font-bold text-ath-text-primary truncate">
                Zonas de pace
              </h3>
              <InfoTooltip text="Tus ritmos por zona (Fácil, Maratón, Umbral, Intervalo, Repetición) calculados a partir de tu VDOT actual." />
            </div>
            <p className="text-[11px] text-ath-text-muted">
              Últimas {weeks} semanas
              {state.zonesSource === 'default' ? ' · zonas por defecto' : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="h-[280px]">
        {state.loading ? (
          <div className="flex items-center justify-center h-full text-ath-text-muted">
            <FiLoader className="w-6 h-6 animate-spin" />
          </div>
        ) : !hasData ? (
          <div className="flex items-center justify-center h-full text-xs text-ath-text-muted text-center px-6">
            Sin datos de pace en este periodo.
          </div>
        ) : (
          <Bar
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              indexAxis: 'y',
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      const z = state.zones[ctx.dataIndex];
                      return `${ctx.parsed.x}% · ${secondsToLabel(z?.seconds || 0)}`;
                    },
                  },
                },
              },
              scales: {
                x: {
                  beginAtZero: true,
                  max: 100,
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

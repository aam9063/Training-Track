import { useEffect, useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { FiHeart, FiLoader } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { getTimeInZoneAggregate } from '../../../services/metricsAnalyticsService';
import { MetricAIAnalyzer } from '../MetricAIAnalyzer';

const ZONE_COLORS = {
  1: '#3b82f6',
  2: '#22c55e',
  3: '#eab308',
  4: '#f97316',
  5: '#ef4444',
};

const ZONE_LABELS = {
  1: 'Z1 Recuperación',
  2: 'Z2 Aeróbico',
  3: 'Z3 Tempo',
  4: 'Z4 Umbral',
  5: 'Z5 VO2max',
};

const secondsToLabel = (sec) => {
  if (!Number.isFinite(sec) || sec <= 0) return '0m';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

export default function TimeInZoneChart({ athleteId, athleteContext, weeks = 4 }) {
  const [state, setState] = useState({ loading: true, hasZones: false, zones: [], error: null });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!athleteId) return;
      setState((p) => ({ ...p, loading: true, error: null }));
      const { data, error } = await getTimeInZoneAggregate(athleteId, weeks);
      if (cancelled) return;
      if (error) {
        setState({ loading: false, hasZones: false, zones: [], error: error.message });
        return;
      }
      setState({
        loading: false,
        hasZones: Boolean(data?.hasZones),
        zones: data?.zones || [],
        error: null,
      });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [athleteId, weeks]);

  const chartData = useMemo(() => ({
    labels: state.zones.map((z) => ZONE_LABELS[z.zone]),
    datasets: [
      {
        label: '% del tiempo',
        data: state.zones.map((z) => z.pct),
        backgroundColor: state.zones.map((z) => ZONE_COLORS[z.zone]),
        borderRadius: 6,
      },
    ],
  }), [state.zones]);

  const totalSeconds = state.zones.reduce((s, z) => s + z.seconds, 0);
  const hasData = state.hasZones && totalSeconds > 0;

  const aiData = useMemo(() => ({
    zones: state.zones,
    weeks,
  }), [state.zones, weeks]);

  return (
    <div className="bg-white dark:bg-ath-elevated rounded-2xl border border-ath-border p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <FiHeart className="w-5 h-5 text-red-500 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-base font-bold text-ath-text-primary truncate">
              Tiempo por zonas
            </h3>
            <p className="text-[11px] text-ath-text-muted">Últimas {weeks} semanas</p>
          </div>
        </div>
        <MetricAIAnalyzer
          chartType="time_in_zone"
          data={aiData}
          athleteContext={athleteContext}
          compact
          title="Análisis de tiempo en zonas"
          disabled={!hasData}
        />
      </div>

      <div className="h-[280px]">
        {state.loading ? (
          <div className="flex items-center justify-center h-full text-ath-text-muted">
            <FiLoader className="w-6 h-6 animate-spin" />
          </div>
        ) : !state.hasZones ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-4">
            <p className="text-xs text-ath-text-muted max-w-xs">
              Configura tus zonas de frecuencia cardíaca en Strava (o sincroniza tu cuenta) para desbloquear este análisis.
            </p>
            <Link
              to="/athlete/profile#frecuencia-cardiaca"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ath-accent-surface text-ath-accent text-xs font-semibold hover:bg-ath-accent hover:text-ath-on-accent transition-colors"
            >
              Configurar zonas
            </Link>
          </div>
        ) : !hasData ? (
          <div className="flex items-center justify-center h-full text-xs text-ath-text-muted text-center px-6">
            Aún no hay datos de frecuencia cardíaca en este periodo.
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
                      const zone = state.zones[ctx.dataIndex];
                      return `${ctx.parsed.x}% · ${secondsToLabel(zone?.seconds || 0)}`;
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

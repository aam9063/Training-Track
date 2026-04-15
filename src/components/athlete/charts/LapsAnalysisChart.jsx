import { useEffect, useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { FiLoader, FiRepeat, FiRefreshCw } from 'react-icons/fi';
import { getLapsForActivity } from '../../../services/metricsAnalyticsService';
import { fetchActivityDetailById } from '../../../services/stravaSyncService';
import InfoTooltip from '../../common/InfoTooltip';

const formatPace = (sec) => {
  if (!Number.isFinite(sec) || sec <= 0) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const formatTime = (sec) => {
  if (!Number.isFinite(sec) || sec <= 0) return '--';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const labelTone = (label) => {
  if (label === 'Excelente') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
  if (label === 'Buena') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
  return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
};

export default function LapsAnalysisChart({ activityId }) {
  const [state, setState] = useState({
    loading: false,
    laps: [],
    cv: 0,
    label: 'Irregular',
    error: null,
  });

  const [backfill, setBackfill] = useState({ running: false, error: null, attempted: false });

  const loadLaps = async (signal) => {
    if (!activityId) {
      setState({ loading: false, laps: [], cv: 0, label: 'Irregular', error: null });
      return;
    }
    setState((p) => ({ ...p, loading: true, error: null }));
    const { data, error } = await getLapsForActivity(activityId);
    if (signal?.cancelled) return;
    if (error) {
      setState({ loading: false, laps: [], cv: 0, label: 'Irregular', error: error.message });
      return;
    }
    setState({
      loading: false,
      laps: data?.laps || [],
      cv: data?.consistency_cv_pct || 0,
      label: data?.consistency_label || 'Irregular',
      error: null,
    });
  };

  useEffect(() => {
    const signal = { cancelled: false };
    loadLaps(signal);
    setBackfill({ running: false, error: null, attempted: false });
    return () => {
      signal.cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]);

  const handleBackfill = async () => {
    if (!activityId || backfill.running) return;
    setBackfill({ running: true, error: null, attempted: false });
    const { data, error } = await fetchActivityDetailById(activityId);
    if (error) {
      setBackfill({ running: false, error: error.message || 'Error al actualizar', attempted: true });
      return;
    }
    setBackfill({ running: false, error: null, attempted: true });
    if (data?.hasLaps) {
      await loadLaps();
    }
  };

  const hasData = state.laps.length >= 2;

  const chartData = useMemo(() => ({
    labels: state.laps.map((l) => `L${l.lap_index}`),
    datasets: [
      {
        label: 'Pace (s/km)',
        data: state.laps.map((l) => l.pace),
        backgroundColor: '#8b5cf6',
        borderRadius: 4,
      },
    ],
  }), [state.laps]);

  return (
    <div className="bg-white dark:bg-ath-elevated rounded-2xl border border-ath-border p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FiRepeat className="w-5 h-5 text-purple-500 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h3 className="text-base font-bold text-ath-text-primary truncate">
                Intervalos / Laps
              </h3>
              <InfoTooltip text="Consistencia entre intervalos detectados. Un coeficiente de variación <3% indica ritmo muy estable." />
            </div>
            <p className="text-[11px] text-ath-text-muted">
              {hasData ? `CV ${state.cv}%` : 'Consistencia entre laps'}
            </p>
          </div>
        </div>
        {hasData && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${labelTone(state.label)}`}>
            {state.label}
          </span>
        )}
      </div>

      {!activityId ? (
        <div className="flex items-center justify-center h-[200px] text-xs text-ath-text-muted text-center px-6">
          Selecciona una actividad para verla en detalle.
        </div>
      ) : state.loading ? (
        <div className="flex items-center justify-center h-[200px] text-ath-text-muted">
          <FiLoader className="w-6 h-6 animate-spin" />
        </div>
      ) : state.error ? (
        <div className="flex items-center justify-center h-[200px] text-xs text-red-500 text-center px-6">
          {state.error}
        </div>
      ) : !hasData ? (
        <div className="flex flex-col items-center justify-center h-[200px] gap-3 px-6 text-center">
          {backfill.attempted && !backfill.error ? (
            <p className="text-xs text-ath-text-muted">
              Strava no proporcionó intervalos para esta actividad.
            </p>
          ) : (
            <>
              <p className="text-xs text-ath-text-muted">
                Actividad sin intervalos detectados.
              </p>
              <button
                type="button"
                onClick={handleBackfill}
                disabled={backfill.running}
                className="inline-flex items-center gap-2 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {backfill.running ? (
                  <FiLoader className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FiRefreshCw className="w-3.5 h-3.5" />
                )}
                {backfill.running ? 'Actualizando…' : 'Actualizar detalles'}
              </button>
              {backfill.error && (
                <p className="text-[11px] text-red-500">{backfill.error}</p>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-ath-text-muted">
                <tr>
                  <th className="py-1 pr-3 font-medium">Lap</th>
                  <th className="py-1 pr-3 font-medium">Tiempo</th>
                  <th className="py-1 pr-3 font-medium">Dist.</th>
                  <th className="py-1 pr-3 font-medium">Pace</th>
                  <th className="py-1 font-medium">FC</th>
                </tr>
              </thead>
              <tbody className="text-ath-text-primary">
                {state.laps.map((l) => (
                  <tr key={l.lap_index} className="border-t border-ath-border/60">
                    <td className="py-1.5 pr-3 font-semibold">L{l.lap_index}</td>
                    <td className="py-1.5 pr-3">{formatTime(l.time)}</td>
                    <td className="py-1.5 pr-3">{(Number(l.distance) / 1000).toFixed(2)} km</td>
                    <td className="py-1.5 pr-3">{formatPace(l.pace)}/km</td>
                    <td className="py-1.5">{l.hr ? `${l.hr} bpm` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="h-[200px]">
            <Bar
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => `Pace: ${formatPace(ctx.parsed.y)}/km`,
                    },
                  },
                },
                scales: {
                  y: {
                    reverse: true,
                    ticks: { callback: (v) => formatPace(v) },
                  },
                },
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

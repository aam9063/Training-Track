import { useEffect, useMemo, useState } from 'react';
import { FiGrid, FiLoader } from 'react-icons/fi';
import { getWeeklyLoadHeatmap } from '../../../services/metricsAnalyticsService';
import InfoTooltip from '../../common/InfoTooltip';

const DOW_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const CELL = 22;

const colorForScore = (score, max) => {
  if (!score || score <= 0) return '#f3f4f6';
  const ratio = max > 0 ? Math.min(1, score / max) : 0;
  if (ratio < 0.2) return '#dbeafe';
  if (ratio < 0.4) return '#93c5fd';
  if (ratio < 0.6) return '#60a5fa';
  if (ratio < 0.8) return '#3b82f6';
  return '#1d4ed8';
};

export default function WeeklyHeatmapChart({ athleteId, weeks = 12 }) {
  const [state, setState] = useState({ loading: true, weeks: [], error: null });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!athleteId) return;
      setState((p) => ({ ...p, loading: true, error: null }));
      const { data, error } = await getWeeklyLoadHeatmap(athleteId, weeks);
      if (cancelled) return;
      if (error) {
        setState({ loading: false, weeks: [], error: error.message });
        return;
      }
      setState({ loading: false, weeks: data?.weeks || [], error: null });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [athleteId, weeks]);

  const maxScore = useMemo(() => {
    let max = 0;
    state.weeks.forEach((w) => {
      (w.days || []).forEach((d) => {
        if (d.score > max) max = d.score;
      });
    });
    return max;
  }, [state.weeks]);

  const hasData = state.weeks.some((w) => w.days.some((d) => d.score > 0));

  const width = (state.weeks.length || 1) * CELL;

  return (
    <div className="bg-white dark:bg-ath-elevated rounded-2xl border border-ath-border p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FiGrid className="w-5 h-5 text-ath-accent shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h3 className="text-base font-bold text-ath-text-primary truncate">
                Mapa de calor semanal
              </h3>
              <InfoTooltip text="Distribución de carga por día de la semana. Permite detectar si concentras todo el volumen en pocos días." />
            </div>
            <p className="text-[11px] text-ath-text-muted">Últimas {weeks} semanas</p>
          </div>
        </div>
      </div>

      {state.loading ? (
        <div className="flex items-center justify-center h-[220px] text-ath-text-muted">
          <FiLoader className="w-6 h-6 animate-spin" />
        </div>
      ) : state.error ? (
        <div className="flex items-center justify-center h-[220px] text-xs text-red-500 text-center px-4">
          {state.error}
        </div>
      ) : !hasData ? (
        <div className="flex items-center justify-center h-[220px] text-xs text-ath-text-muted text-center px-4">
          Sin datos suficientes en este periodo.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex gap-1 items-start">
            <div className="flex flex-col gap-1 pt-1">
              {DOW_LABELS.map((l) => (
                <div
                  key={l}
                  className="h-5 w-5 flex items-center justify-center text-[10px] text-ath-text-muted"
                >
                  {l}
                </div>
              ))}
            </div>
            <svg width={width} height={7 * CELL + 2} role="img" aria-label="Mapa de calor">
              {state.weeks.map((w, colIdx) =>
                (w.days || []).map((day) => (
                  <rect
                    key={`${w.week_start}-${day.dow}`}
                    x={colIdx * CELL}
                    y={day.dow * CELL + 2}
                    width={CELL - 2}
                    height={CELL - 2}
                    rx={3}
                    fill={colorForScore(day.score, maxScore)}
                  >
                    <title>
                      {`Semana de ${w.week_start} — ${day.score} (${day.source === 'distance' ? 'km' : 'suffer'})`}
                    </title>
                  </rect>
                ))
              )}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

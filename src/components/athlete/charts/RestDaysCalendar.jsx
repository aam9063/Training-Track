import { useEffect, useMemo, useState } from 'react';
import { FiCalendar, FiLoader } from 'react-icons/fi';
import { getRestVsActiveDays } from '../../../services/metricsAnalyticsService';
import InfoTooltip from '../../common/InfoTooltip';

const DOW_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function RestDaysCalendar({ athleteId, weeks = 8 }) {
  const [state, setState] = useState({ loading: true, days: [], error: null });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!athleteId) return;
      setState((p) => ({ ...p, loading: true, error: null }));
      const { data, error } = await getRestVsActiveDays(athleteId, weeks);
      if (cancelled) return;
      if (error) {
        setState({ loading: false, days: [], error: error.message });
        return;
      }
      setState({ loading: false, days: data?.days || [], error: null });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [athleteId, weeks]);

  const summary = useMemo(() => {
    const active = state.days.filter((d) => d.active).length;
    const rest = state.days.length - active;
    return { active, rest };
  }, [state.days]);

  // Arrange into 7 x N grid (rows = dow Mon..Sun, cols = weeks)
  const grid = useMemo(() => {
    if (state.days.length === 0) return [];
    const rows = Array.from({ length: 7 }, () => []);
    state.days.forEach((d) => {
      const date = new Date(d.date);
      const dow = date.getDay() === 0 ? 6 : date.getDay() - 1;
      rows[dow].push(d);
    });
    return rows;
  }, [state.days]);

  const cols = grid[0]?.length || weeks;

  return (
    <div className="bg-white dark:bg-ath-elevated rounded-2xl border border-ath-border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <FiCalendar className="w-5 h-5 text-ath-accent shrink-0" />
        <div>
          <div className="flex items-center gap-1">
            <h3 className="text-base font-bold text-ath-text-primary">
              Días descanso vs activos
            </h3>
            <InfoTooltip text="Calendario de días activos vs descanso. Un patrón saludable incluye 1-2 días de descanso completo por semana." />
          </div>
          <p className="text-[11px] text-ath-text-muted">Últimas {weeks} semanas</p>
        </div>
      </div>

      {state.loading ? (
        <div className="flex items-center justify-center h-[200px] text-ath-text-muted">
          <FiLoader className="w-6 h-6 animate-spin" />
        </div>
      ) : state.error ? (
        <div className="flex items-center justify-center h-[200px] text-xs text-red-500 text-center px-4">
          {state.error}
        </div>
      ) : state.days.length === 0 ? (
        <div className="flex items-center justify-center h-[200px] text-xs text-ath-text-muted text-center px-4">
          Sin datos de actividad aún.
        </div>
      ) : (
        <>
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
              <svg
                width={cols * 22}
                height={7 * 22 + 2}
                role="img"
                aria-label="Calendario de descanso"
              >
                {grid.map((row, rowIdx) =>
                  row.map((day, colIdx) => (
                    <rect
                      key={day.date}
                      x={colIdx * 22}
                      y={rowIdx * 22 + 2}
                      width={20}
                      height={20}
                      rx={4}
                      fill={day.active ? '#10b981' : '#e5e7eb'}
                      className="transition-colors"
                    >
                      <title>
                        {`${day.date} — ${day.active ? 'Entrenamiento' : 'Descanso'}`}
                      </title>
                    </rect>
                  ))
                )}
              </svg>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-ath-text-secondary">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500" />
              {summary.active} activos
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-gray-300" />
              {summary.rest} descanso
            </div>
          </div>
        </>
      )}
    </div>
  );
}

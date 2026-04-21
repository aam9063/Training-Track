import { useEffect, useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { FiLoader, FiMap, FiRefreshCw } from 'react-icons/fi';
import { getSplitsForActivity } from '../../../services/metricsAnalyticsService';
import { fetchActivityDetailById } from '../../../services/stravaSyncService';
import { MetricAIAnalyzer } from '../MetricAIAnalyzer';
import InfoTooltip from '../../common/InfoTooltip';

const formatPace = (sec) => {
  if (!Number.isFinite(sec) || sec <= 0) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

export default function SplitsComparisonChart({ activityId, athleteContext, hideAI = false }) {
  const [state, setState] = useState({ loading: false, splits: [], error: null });
  const [backfill, setBackfill] = useState({ running: false, error: null, attempted: false });

  const loadSplits = async (signal) => {
    if (!activityId) {
      setState({ loading: false, splits: [], error: null });
      return;
    }
    setState({ loading: true, splits: [], error: null });
    const { data, error } = await getSplitsForActivity(activityId);
    if (signal?.cancelled) return;
    if (error) {
      setState({ loading: false, splits: [], error: error.message });
      return;
    }
    setState({ loading: false, splits: data?.splits || [], error: null });
  };

  useEffect(() => {
    const signal = { cancelled: false };
    loadSplits(signal);
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
    if (data?.hasSplits) {
      await loadSplits();
    }
  };

  const hasData = state.splits.length > 0;

  const chartData = useMemo(() => {
    if (!hasData) return null;
    const maxPace = Math.max(...state.splits.map((s) => s.pace_sec_per_km || 0));
    const colorFor = (pace) => {
      if (!pace || maxPace <= 0) return '#94a3b8';
      const ratio = pace / maxPace;
      if (ratio < 0.85) return '#22c55e';
      if (ratio < 0.95) return '#eab308';
      return '#ef4444';
    };
    return {
      labels: state.splits.map((s) => `K${s.km}`),
      datasets: [
        {
          type: 'bar',
          label: 'Pace (s/km)',
          data: state.splits.map((s) => s.pace_sec_per_km || 0),
          backgroundColor: state.splits.map((s) => colorFor(s.pace_sec_per_km)),
          borderRadius: 4,
          yAxisID: 'y',
          order: 2,
        },
        {
          type: 'line',
          label: 'FC (bpm)',
          data: state.splits.map((s) => s.hr),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          tension: 0.3,
          pointRadius: 3,
          borderWidth: 2,
          yAxisID: 'y1',
          order: 1,
        },
      ],
    };
  }, [hasData, state.splits]);

  const aiData = useMemo(() => {
    const splits = state.splits || [];
    const kmCount = splits.length;

    // Reject >30km on client too — edge function also rejects, but this saves a round-trip.
    if (kmCount === 0) {
      return { km_count: 0, samples: [] };
    }

    // Pre-compute aggregates so the model only interprets, doesn't calculate.
    const paces = splits
      .map((s) => Number(s.pace_sec_per_km))
      .filter((p) => Number.isFinite(p) && p > 0);
    const hrs = splits
      .map((s) => Number(s.hr))
      .filter((h) => Number.isFinite(h) && h > 0);

    const paceAvg = paces.length
      ? Math.round(paces.reduce((a, b) => a + b, 0) / paces.length)
      : null;
    const paceMin = paces.length ? Math.round(Math.min(...paces)) : null;
    const paceMax = paces.length ? Math.round(Math.max(...paces)) : null;
    // Coefficient of variation as percentage (pace variability).
    let paceCvPct = null;
    if (paces.length > 1 && paceAvg) {
      const variance =
        paces.reduce((acc, p) => acc + (p - paceAvg) ** 2, 0) / paces.length;
      const sd = Math.sqrt(variance);
      paceCvPct = Math.round((sd / paceAvg) * 1000) / 10; // 1 decimal
    }

    const hrAvg = hrs.length
      ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length)
      : null;
    const hrMax = hrs.length ? Math.max(...hrs) : null;

    // Positive split: second-half average pace slower (higher sec/km) than first-half.
    let isPositiveSplit = null;
    if (paces.length >= 2) {
      const mid = Math.floor(paces.length / 2);
      const first = paces.slice(0, mid);
      const second = paces.slice(mid);
      if (first.length && second.length) {
        const avgA = first.reduce((a, b) => a + b, 0) / first.length;
        const avgB = second.reduce((a, b) => a + b, 0) / second.length;
        isPositiveSplit = avgB > avgA;
      }
    }

    // Build compact samples array: max 12. If more, take first 3 + last 3 + 6 equispaced middle.
    const tagged = (arr, tag) =>
      arr.map((s) => ({
        k: s.km,
        p: Math.round(Number(s.pace_sec_per_km) || 0),
        h: Number.isFinite(s.hr) ? Math.round(Number(s.hr)) : null,
        t: tag,
      }));

    let samples;
    if (kmCount <= 12) {
      // Tag first/last explicitly, everything else middle.
      samples = splits.map((s, i) => {
        let tag = 'middle';
        if (i < 3 && kmCount > 6) tag = 'first';
        else if (i >= kmCount - 3 && kmCount > 6) tag = 'last';
        return {
          k: s.km,
          p: Math.round(Number(s.pace_sec_per_km) || 0),
          h: Number.isFinite(s.hr) ? Math.round(Number(s.hr)) : null,
          t: tag,
        };
      });
    } else {
      const first = tagged(splits.slice(0, 3), 'first');
      const last = tagged(splits.slice(-3), 'last');
      // 6 equispaced points from the middle region [3 .. kmCount-3).
      const midStart = 3;
      const midEnd = kmCount - 3;
      const midRange = midEnd - midStart;
      const middle = [];
      const midCount = Math.min(6, Math.max(0, midRange));
      for (let i = 0; i < midCount; i++) {
        const idx = midStart + Math.round((i * (midRange - 1)) / Math.max(1, midCount - 1));
        middle.push(splits[idx]);
      }
      samples = [...first, ...tagged(middle, 'middle'), ...last];
    }

    return {
      km_count: kmCount,
      pace_avg_sec: paceAvg,
      pace_min_sec: paceMin,
      pace_max_sec: paceMax,
      pace_cv_pct: paceCvPct,
      hr_avg_bpm: hrAvg,
      hr_max_bpm: hrMax,
      is_positive_split: isPositiveSplit,
      samples,
    };
  }, [state.splits]);

  return (
    <div className="bg-white dark:bg-ath-elevated rounded-2xl border border-ath-border p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FiMap className="w-5 h-5 text-ath-accent shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h3 className="text-base font-bold text-ath-text-primary truncate">
                Splits comparativos
              </h3>
              <InfoTooltip text="Ritmo y FC de cada km. Consistencia baja indica desgaste; ritmo aumentando al final = positive split." />
            </div>
            <p className="text-[11px] text-ath-text-muted">Pace y FC por km</p>
          </div>
        </div>
        {!hideAI && (
          <MetricAIAnalyzer
            chartType="splits_comparison"
            data={aiData}
            athleteContext={athleteContext}
            compact
            title="Análisis de splits"
            disabled={!hasData}
          />
        )}
      </div>

      <div className="h-[280px]">
        {!activityId ? (
          <div className="flex items-center justify-center h-full text-xs text-ath-text-muted text-center px-6">
            Selecciona una actividad para verla en detalle.
          </div>
        ) : state.loading ? (
          <div className="flex items-center justify-center h-full text-ath-text-muted">
            <FiLoader className="w-6 h-6 animate-spin" />
          </div>
        ) : state.error ? (
          <div className="flex items-center justify-center h-full text-xs text-red-500 text-center px-6">
            {state.error}
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
            {backfill.attempted && !backfill.error ? (
              <p className="text-xs text-ath-text-muted">
                Strava no proporcionó splits detallados para esta actividad.
              </p>
            ) : (
              <>
                <p className="text-xs text-ath-text-muted">
                  Sin splits detallados.
                </p>
                <button
                  type="button"
                  onClick={handleBackfill}
                  disabled={backfill.running}
                  className="inline-flex items-center gap-2 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-ath-accent/10 text-ath-accent hover:bg-ath-accent/20 disabled:opacity-60 disabled:cursor-not-allowed transition"
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
          <Bar
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 10 } },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      if (ctx.dataset.label?.startsWith('Pace')) {
                        return `Pace: ${formatPace(ctx.parsed.y)}/km`;
                      }
                      return `FC: ${ctx.parsed.y} bpm`;
                    },
                  },
                },
              },
              scales: {
                y: {
                  type: 'linear',
                  position: 'left',
                  reverse: true,
                  ticks: { callback: (v) => formatPace(v) },
                },
                y1: {
                  type: 'linear',
                  position: 'right',
                  grid: { drawOnChartArea: false },
                  ticks: { callback: (v) => `${v} bpm` },
                },
              },
            }}
          />
        )}
      </div>
    </div>
  );
}

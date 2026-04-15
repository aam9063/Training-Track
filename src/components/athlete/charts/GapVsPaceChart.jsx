import { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { FiLoader, FiTrendingUp } from 'react-icons/fi';
import { supabase } from '../../../lib/supabase';
import { fetchStreamsForActivity } from '../../../services/stravaSyncService';
import { getGapForActivity } from '../../../services/metricsAnalyticsService';
import { downsampleStream } from '../../../lib/trainingMetrics';
import MetricAIAnalyzer from '../MetricAIAnalyzer';
import InfoTooltip from '../../common/InfoTooltip';

const formatPace = (sec) => {
  if (!Number.isFinite(sec) || sec <= 0) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const avgFinite = (arr) => {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  let sum = 0;
  let count = 0;
  for (const v of arr) {
    if (Number.isFinite(v)) {
      sum += v;
      count += 1;
    }
  }
  return count > 0 ? sum / count : null;
};

export default function GapVsPaceChart({ activityId, athleteContext }) {
  const [state, setState] = useState({ loading: false, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!activityId) {
        setState({ loading: false, data: null, error: null });
        return;
      }
      setState({ loading: true, data: null, error: null });

      const { data: act } = await supabase
        .from('strava_activities')
        .select('has_streams')
        .eq('id', activityId)
        .maybeSingle();

      if (cancelled) return;

      if (act && !act.has_streams) {
        const { error: fetchErr } = await fetchStreamsForActivity(activityId);
        if (cancelled) return;
        if (fetchErr) {
          setState({ loading: false, data: null, error: 'No se pudieron cargar los streams' });
          return;
        }
      }

      const { data, error } = await getGapForActivity(activityId);
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
  }, [activityId]);

  const hasData = Boolean(state.data && state.data.pace_real?.length > 0);

  const chartData = useMemo(() => {
    if (!hasData) return null;
    const real = downsampleStream(state.data.pace_real, 300);
    const gap = downsampleStream(state.data.pace_gap, 300);
    const labels = real.map((_, idx) => idx);
    return {
      labels,
      datasets: [
        {
          label: 'Pace real',
          data: real,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.15)',
          tension: 0.2,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: 'GAP',
          data: gap,
          borderColor: '#f97316',
          backgroundColor: 'rgba(249, 115, 22, 0.15)',
          tension: 0.2,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    };
  }, [hasData, state.data]);

  const aiData = useMemo(() => {
    if (!hasData) return { samples: 0 };
    const real = state.data.pace_real || [];
    const gap = state.data.pace_gap || [];
    const paceRealAvg = Math.round(avgFinite(real) ?? 0);
    const paceGapAvg = Math.round(avgFinite(gap) ?? 0);
    const avgDelta = Number.isFinite(state.data.avg_delta_sec)
      ? Math.round(state.data.avg_delta_sec)
      : paceGapAvg - paceRealAvg;
    const elevationGain = Number.isFinite(state.data.elevation_gain_m)
      ? Math.round(state.data.elevation_gain_m)
      : null;
    return {
      pace_real_avg_sec: paceRealAvg,
      gap_avg_sec: paceGapAvg,
      avg_delta_sec: avgDelta,
      elevation_gain_m: elevationGain,
      samples: real.length,
    };
  }, [hasData, state.data]);

  return (
    <div className="bg-white dark:bg-ath-elevated rounded-2xl border border-ath-border p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FiTrendingUp className="w-5 h-5 text-orange-500 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h3 className="text-base font-bold text-ath-text-primary truncate">GAP vs Pace real</h3>
              <InfoTooltip text="Comparación de tu ritmo real contra el ritmo ajustado por pendiente (GAP). La diferencia muestra cuánto te afecta el desnivel." />
            </div>
            <p className="text-[11px] text-ath-text-muted">
              {hasData
                ? `Δ medio ${formatPace(Math.abs(state.data.avg_delta_sec))}`
                : 'Pace ajustado por pendiente'}
            </p>
          </div>
        </div>
        <MetricAIAnalyzer
          chartType="gap_vs_pace"
          data={aiData}
          athleteContext={athleteContext}
          compact
          title="Análisis GAP vs Pace real"
          disabled={!hasData}
        />
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
          <div className="flex items-center justify-center h-full text-xs text-ath-text-muted text-center px-6">
            Sin datos de pendiente — GAP no disponible.
          </div>
        ) : (
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 10 } },
                tooltip: {
                  callbacks: {
                    label: (ctx) => `${ctx.dataset.label}: ${formatPace(ctx.parsed.y)}/km`,
                  },
                },
              },
              scales: {
                x: { ticks: { display: false } },
                y: {
                  reverse: true,
                  ticks: { callback: (v) => formatPace(v) },
                },
              },
            }}
          />
        )}
      </div>
    </div>
  );
}

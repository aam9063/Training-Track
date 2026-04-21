import { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { FiLoader, FiMapPin } from 'react-icons/fi';
import { supabase } from '../../../lib/supabase';
import { fetchStreamsForActivity } from '../../../services/stravaSyncService';
import { downsampleStream } from '../../../lib/trainingMetrics';
import { filterStravaActivityId, isUuid } from '../../../lib/stravaIdUtils';
import InfoTooltip from '../../common/InfoTooltip';

const ZONE_COLORS = {
  1: '#3b82f6',
  2: '#22c55e',
  3: '#eab308',
  4: '#f97316',
  5: '#ef4444',
  0: '#94a3b8',
};

const classifyZone = (hr, zones) => {
  if (!zones) return 0;
  for (let i = 0; i < zones.length; i += 1) {
    const z = zones[i];
    if (hr <= z.max && hr > z.min) return z.zone;
  }
  return 0;
};

export default function ElevationProfileChart({ activityId }) {
  const [state, setState] = useState({ loading: false, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!activityId) {
        setState({ loading: false, data: null, error: null });
        return;
      }
      setState({ loading: true, data: null, error: null });

      // Check has_streams — resolve the row by UUID (id) or bigint (strava_id)
      // so callers that mistakenly pass the Strava bigint don't hit 400s.
      const { data: act } = await filterStravaActivityId(
        supabase.from('strava_activities').select('has_streams, athlete_id, id'),
        activityId
      ).maybeSingle();

      if (cancelled) return;

      // `strava_activity_streams.activity_id` is UUID → always use the row's
      // internal id (even if the caller handed us the Strava bigint).
      const streamsActivityId = act?.id || (isUuid(activityId) ? activityId : null);

      if (act && !act.has_streams) {
        const { error: fetchErr } = await fetchStreamsForActivity(streamsActivityId);
        if (cancelled) return;
        if (fetchErr) {
          setState({
            loading: false,
            data: null,
            error: 'No se pudieron cargar los streams',
          });
          return;
        }
      }

      if (!streamsActivityId) {
        setState({ loading: false, data: null, error: 'Actividad no encontrada' });
        return;
      }

      const { data: stream, error: streamErr } = await supabase
        .from('strava_activity_streams')
        .select('altitude, distance, heartrate')
        .eq('activity_id', streamsActivityId)
        .maybeSingle();

      if (cancelled) return;
      if (streamErr) {
        setState({ loading: false, data: null, error: streamErr.message });
        return;
      }

      // Get HR zones
      let zones = null;
      if (act?.athlete_id) {
        const { data: zonesData } = await supabase
          .from('athlete_hr_zones')
          .select('zones')
          .eq('athlete_id', act.athlete_id)
          .maybeSingle();
        if (Array.isArray(zonesData?.zones) && zonesData.zones.length >= 5) {
          zones = zonesData.zones
            .map((z) => ({
              zone: Number(z.zone) || 0,
              min: Number(z.min) || 0,
              max: Number(z.max) || 9999,
            }))
            .sort((a, b) => a.zone - b.zone);
        }
      }

      if (cancelled) return;
      setState({
        loading: false,
        data: {
          distance: downsampleStream(stream?.distance || [], 300),
          altitude: downsampleStream(stream?.altitude || [], 300),
          heartrate: downsampleStream(stream?.heartrate || [], 300),
          zones,
        },
        error: null,
      });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [activityId]);

  const hasData = Boolean(
    state.data && state.data.altitude?.length > 0 && state.data.distance?.length > 0
  );
  const hasHr = Boolean(state.data?.heartrate?.length > 0 && state.data?.zones);

  const chartData = useMemo(() => {
    if (!hasData) return null;
    const labels = state.data.distance.map((d) => ((Number(d) || 0) / 1000).toFixed(1));
    return {
      labels,
      datasets: [
        {
          label: 'Altitud (m)',
          data: state.data.altitude,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          fill: true,
          tension: 0.2,
          pointRadius: 0,
          borderWidth: 2,
          segment: hasHr
            ? {
                borderColor: (ctx) => {
                  const i1 = ctx.p1DataIndex;
                  const hr = Number(state.data.heartrate[i1]);
                  if (!Number.isFinite(hr) || hr <= 0) return ZONE_COLORS[0];
                  const zone = classifyZone(hr, state.data.zones);
                  return ZONE_COLORS[zone] || ZONE_COLORS[0];
                },
              }
            : undefined,
        },
      ],
    };
  }, [hasData, hasHr, state.data]);

  return (
    <div className="bg-white dark:bg-ath-elevated rounded-2xl border border-ath-border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <FiMapPin className="w-5 h-5 text-emerald-500 shrink-0" />
        <div>
          <div className="flex items-center gap-1">
            <h3 className="text-base font-bold text-ath-text-primary">
              Perfil de elevación
            </h3>
            <InfoTooltip text="Altimetría de la actividad seleccionada, coloreado por zona de FC si hay datos." />
          </div>
          <p className="text-[11px] text-ath-text-muted">
            {hasHr ? 'Coloreado por zona de FC' : 'Sin HR — color uniforme'}
          </p>
        </div>
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
            Sin datos de elevación para esta actividad.
          </div>
        ) : (
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                x: {
                  ticks: {
                    maxTicksLimit: 6,
                    callback(v) {
                      const lab = this.getLabelForValue(v);
                      return `${lab} km`;
                    },
                  },
                },
                y: { ticks: { callback: (v) => `${v} m` } },
              },
            }}
          />
        )}
      </div>
    </div>
  );
}

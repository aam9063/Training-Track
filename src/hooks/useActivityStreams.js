import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { fetchStreamsForActivity } from '../services/stravaSyncService';

/**
 * Hook to load Strava activity streams (HR, pace, altitude, cadence, temp…)
 * from `strava_activity_streams`. If no row exists and the caller passes
 * their own `athleteId`, the hook will try to trigger the
 * `strava-fetch-streams` edge function once to backfill the cache, then
 * re-query.
 *
 * @param {string|null} activityId - Internal UUID from `strava_activities.id`
 *   (NOT the Strava bigint `strava_id`). This value is used both to query
 *   `strava_activity_streams.activity_id` (uuid FK) and as the payload for
 *   the `strava-fetch-streams` edge function, which resolves the real
 *   Strava id internally.
 * @param {{ athleteId?: string, canBackfill?: boolean }} [opts]
 * @returns {{streams:Object|null, loading:boolean, error:Object|null, refetch:Function}}
 */
export default function useActivityStreams(activityId, opts = {}) {
  const { athleteId = null, canBackfill = true } = opts;
  const [streams, setStreams] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!activityId) {
        setStreams(null);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      setStreams(null);

      const selectCols =
        'time, distance, velocity_smooth, heartrate, cadence, altitude, grade_smooth, temp, moving';

      const queryStream = async () => {
        const { data, error: qErr } = await supabase
          .from('strava_activity_streams')
          .select(selectCols)
          .eq('activity_id', activityId)
          .maybeSingle();
        return { data, error: qErr };
      };

      // 1. First read
      let { data, error: qErr } = await queryStream();
      if (cancelled) return;

      // 2. Backfill if no row found
      if (!qErr && !data && canBackfill && athleteId) {
        const { error: fetchErr } = await fetchStreamsForActivity(activityId);
        if (cancelled) return;
        if (fetchErr) {
          setLoading(false);
          setError({
            code: fetchErr.code === 'unauthenticated' ? 'unauthorized' : 'no_streams',
            message: fetchErr.message || 'No se pudieron cargar los streams',
          });
          return;
        }
        // 3. Re-query after backfill
        ({ data, error: qErr } = await queryStream());
        if (cancelled) return;
      }

      if (qErr) {
        setLoading(false);
        setError({ code: 'query_error', message: qErr.message });
        return;
      }

      if (!data) {
        setLoading(false);
        setError({ code: 'no_streams', message: 'No hay streams para esta actividad' });
        return;
      }

      const toArr = (v) => (Array.isArray(v) ? v : null);

      setStreams({
        time: toArr(data.time),
        distance: toArr(data.distance),
        heartrate: toArr(data.heartrate),
        cadence: toArr(data.cadence),
        altitude: toArr(data.altitude),
        velocity_smooth: toArr(data.velocity_smooth),
        grade_smooth: toArr(data.grade_smooth),
        temp: toArr(data.temp),
        moving: toArr(data.moving),
      });
      setLoading(false);
      setError(null);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [activityId, athleteId, canBackfill, reloadKey]);

  return { streams, loading, error, refetch };
}

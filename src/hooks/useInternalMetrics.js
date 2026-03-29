import { useState, useEffect, useCallback, useMemo } from 'react';
import { toLocalDateStr } from '../lib/dateUtils';
import { showError } from '../lib/toast';
import {
  getWeeklyKm,
  getRpeTrend,
  getPaceTrend,
  getPersonalBests,
  getCompletionRate,
} from '../services/metricsService';

/**
 * Builds an array of N weekly buckets (oldest first) with a label.
 * Returns [{ label, weekStart, weekEnd }, ...]
 */
const buildWeekBuckets = (weeks) => {
  const buckets = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const end = new Date();
    end.setDate(end.getDate() - w * 7);
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    buckets.push({
      label: w === 0 ? 'Esta sem.' : start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      weekStart: toLocalDateStr(start),
      weekEnd: toLocalDateStr(end),
    });
  }
  return buckets;
};

/**
 * Aggregate completed sessions into weekly km totals.
 * Prefers actual_distance_km (manual completion). When strava_activity_id is set,
 * the distance stored in actual_distance_km is already the Strava-preferred value
 * (set by the Strava webhook / sync service), so no extra deduplication is needed here.
 */
const aggregateWeeklyKm = (sessions, buckets) =>
  buckets.map(({ label, weekStart, weekEnd }) => {
    const km = sessions
      .filter(s => s.scheduled_date >= weekStart && s.scheduled_date <= weekEnd)
      .reduce((sum, s) => sum + (s.actual_distance_km ?? 0), 0);
    return { label, km: parseFloat(km.toFixed(2)) };
  });

/**
 * Aggregate RPE data into weekly averages.
 */
const aggregateWeeklyRpe = (sessions, buckets) =>
  buckets.map(({ label, weekStart, weekEnd }) => {
    const weekSessions = sessions.filter(
      s => s.scheduled_date >= weekStart && s.scheduled_date <= weekEnd && s.rpe != null
    );
    const avgRpe =
      weekSessions.length > 0
        ? parseFloat(
            (weekSessions.reduce((sum, s) => sum + s.rpe, 0) / weekSessions.length).toFixed(1)
          )
        : null;
    return { label, avgRpe };
  });

/**
 * Aggregate pace data (min/km) from sessions that have both distance and time.
 */
const aggregateWeeklyPace = (sessions, buckets) =>
  buckets.map(({ label, weekStart, weekEnd }) => {
    const weekSessions = sessions.filter(
      s =>
        s.scheduled_date >= weekStart &&
        s.scheduled_date <= weekEnd &&
        s.actual_distance_km > 0 &&
        s.actual_time_minutes > 0
    );
    let avgPace = null;
    if (weekSessions.length > 0) {
      const totalKm = weekSessions.reduce((sum, s) => sum + s.actual_distance_km, 0);
      const totalMin = weekSessions.reduce((sum, s) => sum + s.actual_time_minutes, 0);
      avgPace = totalKm > 0 ? parseFloat((totalMin / totalKm).toFixed(2)) : null;
    }
    return { label, avgPace };
  });

/**
 * Custom hook that loads all internal (non-Strava) progression metrics for an athlete.
 *
 * @param {string|null} userId
 * @param {number} weeks - number of past weeks to analyse (default 8)
 * @returns {{
 *   loading: boolean,
 *   weeklyKm: Array<{label: string, km: number}>,
 *   weeklyRpe: Array<{label: string, avgRpe: number|null}>,
 *   weeklyPace: Array<{label: string, avgPace: number|null}>,
 *   personalBests: Object|null,
 *   completionRate: { completed: number, total: number, pct: number }|null,
 *   hasData: boolean,
 * }}
 */
export default function useInternalMetrics(userId, weeks = 8) {
  const [loading, setLoading] = useState(false);
  const [rawKmSessions, setRawKmSessions] = useState([]);
  const [rawRpeSessions, setRawRpeSessions] = useState([]);
  const [rawPaceSessions, setRawPaceSessions] = useState([]);
  const [personalBests, setPersonalBests] = useState(null);
  const [completionRate, setCompletionRate] = useState(null);

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [kmRes, rpeRes, paceRes, pbRes, crRes] = await Promise.all([
        getWeeklyKm(userId, weeks),
        getRpeTrend(userId, weeks),
        getPaceTrend(userId, weeks),
        getPersonalBests(userId),
        getCompletionRate(userId, null),
      ]);

      if (kmRes.error) showError('Error al cargar los kilómetros semanales');
      else setRawKmSessions(kmRes.data);

      if (rpeRes.error) showError('Error al cargar la tendencia de RPE');
      else setRawRpeSessions(rpeRes.data);

      if (paceRes.error) showError('Error al cargar la tendencia de ritmo');
      else setRawPaceSessions(paceRes.data);

      if (!pbRes.error) setPersonalBests(pbRes.data);
      if (!crRes.error) setCompletionRate(crRes.data);
    } finally {
      setLoading(false);
    }
  }, [userId, weeks]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const buckets = useMemo(() => buildWeekBuckets(weeks), [weeks]);

  const weeklyKm = useMemo(
    () => aggregateWeeklyKm(rawKmSessions, buckets),
    [rawKmSessions, buckets]
  );

  const weeklyRpe = useMemo(
    () => aggregateWeeklyRpe(rawRpeSessions, buckets),
    [rawRpeSessions, buckets]
  );

  const weeklyPace = useMemo(
    () => aggregateWeeklyPace(rawPaceSessions, buckets),
    [rawPaceSessions, buckets]
  );

  const hasData = rawKmSessions.length > 0 || rawRpeSessions.length > 0;

  return {
    loading,
    weeklyKm,
    weeklyRpe,
    weeklyPace,
    personalBests,
    completionRate,
    hasData,
  };
}

import { useMemo } from 'react';

const CYCLING_TYPES = ['Ride', 'VirtualRide'];
const SWIM_TYPES = ['Swim'];
const GYM_TYPES = ['WeightTraining', 'Workout', 'CrossFit', 'Yoga'];

/**
 * Pure hook that aggregates raw activities into per-sport weekly charts
 * (cycling, swimming, gym). Returns an object keyed by sport, empty when the
 * sport has no activities.
 */
export default function useSportCharts(rawActivities) {
  return useMemo(() => {
    if (!rawActivities?.length) return {};

    const now = new Date();

    const buildWeeklyData = (filterFn, metricFn) => {
      const weeks = [];
      for (let w = 7; w >= 0; w -= 1) {
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() - w * 7);
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);

        const weekActs = rawActivities.filter((a) => {
          if (!filterFn(a)) return false;
          const d = new Date(a.start_date_local);
          return d >= weekStart && d <= weekEnd;
        });

        const wLabel = w === 0
          ? 'Esta sem.'
          : weekStart.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        weeks.push({
          label: wLabel,
          ...metricFn(weekActs),
        });
      }
      return weeks;
    };

    const result = {};

    const cyclingActs = rawActivities.filter((a) => CYCLING_TYPES.includes(a.type));
    if (cyclingActs.length > 0) {
      const weeklyKm = buildWeeklyData(
        (a) => CYCLING_TYPES.includes(a.type),
        (acts) => ({
          km: +(acts.reduce((s, a) => s + (a.distance || 0), 0) / 1000).toFixed(1),
          elevation: Math.round(acts.reduce((s, a) => s + (a.total_elevation_gain || 0), 0)),
          avgSpeed: acts.length > 0
            ? +((acts.reduce((s, a) => s + (a.average_speed || 0), 0) / acts.length) * 3.6).toFixed(1)
            : 0,
          count: acts.length,
        }),
      );

      const hrActs = cyclingActs.filter((a) => a.average_heartrate);
      result.cycling = {
        weeklyKm,
        totalKm: +(cyclingActs.reduce((s, a) => s + (a.distance || 0), 0) / 1000).toFixed(1),
        totalElevation: Math.round(cyclingActs.reduce((s, a) => s + (a.total_elevation_gain || 0), 0)),
        avgSpeed: +((cyclingActs.reduce((s, a) => s + (a.average_speed || 0), 0) / cyclingActs.length) * 3.6).toFixed(1),
        avgHR: hrActs.length > 0
          ? Math.round(hrActs.reduce((s, a) => s + a.average_heartrate, 0) / hrActs.length)
          : null,
        count: cyclingActs.length,
      };
    }

    const swimActs = rawActivities.filter((a) => SWIM_TYPES.includes(a.type));
    if (swimActs.length > 0) {
      const weeklyMeters = buildWeeklyData(
        (a) => SWIM_TYPES.includes(a.type),
        (acts) => ({
          meters: Math.round(acts.reduce((s, a) => s + (a.distance || 0), 0)),
          avgPace100m: acts.length > 0 ? (() => {
            const totalDist = acts.reduce((s, a) => s + (a.distance || 0), 0);
            const totalTime = acts.reduce((s, a) => s + (a.moving_time || 0), 0);
            if (totalDist === 0) return 0;
            return Math.round(totalTime / (totalDist / 100));
          })() : 0,
          count: acts.length,
        }),
      );

      result.swimming = {
        weeklyMeters,
        totalMeters: Math.round(swimActs.reduce((s, a) => s + (a.distance || 0), 0)),
        avgPace100m: (() => {
          const d = swimActs.reduce((s, a) => s + (a.distance || 0), 0);
          const t = swimActs.reduce((s, a) => s + (a.moving_time || 0), 0);
          if (d === 0) return '-';
          const secs = Math.round(t / (d / 100));
          return `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`;
        })(),
        count: swimActs.length,
      };
    }

    const gymActs = rawActivities.filter((a) => GYM_TYPES.includes(a.type));
    if (gymActs.length > 0) {
      const weeklyGym = buildWeeklyData(
        (a) => GYM_TYPES.includes(a.type),
        (acts) => ({
          sessions: acts.length,
          totalMinutes: Math.round(acts.reduce((s, a) => s + (a.moving_time || 0), 0) / 60),
        }),
      );

      result.gym = {
        weeklyGym,
        totalSessions: gymActs.length,
        avgDurationMin: Math.round(gymActs.reduce((s, a) => s + (a.moving_time || 0), 0) / 60 / gymActs.length),
        totalMinutes: Math.round(gymActs.reduce((s, a) => s + (a.moving_time || 0), 0) / 60),
        count: gymActs.length,
      };
    }

    return result;
  }, [rawActivities]);
}

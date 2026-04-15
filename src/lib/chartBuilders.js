/**
 * Chart.js dataset builders for athlete metrics.
 *
 * These helpers perform the raw-data → Chart.js `data` object transformation
 * so page components stay focused on layout. Colour tokens come from
 * `chartColors.js` to keep literals out of component files.
 */

import { CHART_COLORS } from './chartColors';

/**
 * Build weekly running-kilometres line-chart data from cached Strava metrics.
 *
 * @param {{weeklyStats?: Array<{weekNumber: string|number, distanceKm: string|number}>}} stravaMetrics
 * @returns {{labels: Array, datasets: Array}}
 */
export const buildWeeklyChartData = (stravaMetrics) => {
  if (!stravaMetrics?.weeklyStats?.length) {
    return {
      labels: [],
      datasets: [{
        data: [],
        borderColor: CHART_COLORS.cycling,
        backgroundColor: CHART_COLORS.cyclingFill,
        fill: true,
        tension: 0.4,
      }],
    };
  }

  const reversed = [...stravaMetrics.weeklyStats].reverse();
  return {
    labels: reversed.map((w) => w.weekNumber),
    datasets: [{
      label: 'Kilómetros',
      data: reversed.map((w) => parseFloat(w.distanceKm)),
      borderColor: CHART_COLORS.cycling,
      backgroundColor: CHART_COLORS.cyclingFill,
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: CHART_COLORS.cycling,
    }],
  };
};

/**
 * Build average-speed scatter-chart data (Garmin-style: one point per
 * running activity) from raw Strava activities.
 *
 * @param {Array<{type: string, average_speed: number, start_date_local: string}>} rawActivities
 * @returns {{labels: Array<string>, datasets: Array, avgSpeed: number}}
 */
export const buildAverageSpeedData = (rawActivities) => {
  if (!rawActivities?.length) {
    return { labels: [], datasets: [], avgSpeed: 0 };
  }

  const runningActivities = rawActivities
    .filter((a) => ['Run', 'TrailRun', 'VirtualRun'].includes(a.type))
    .filter((a) => a.average_speed > 0)
    .sort((a, b) => new Date(a.start_date_local) - new Date(b.start_date_local));

  if (runningActivities.length === 0) {
    return { labels: [], datasets: [], avgSpeed: 0 };
  }

  const speedsKmh = runningActivities.map((a) => (a.average_speed * 3.6).toFixed(1));
  const avgSpeed = (
    speedsKmh.reduce((sum, s) => sum + parseFloat(s), 0) / speedsKmh.length
  ).toFixed(1);

  const labels = runningActivities.map((a) => {
    const date = new Date(a.start_date_local);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  });

  return {
    labels,
    datasets: [{
      label: 'Velocidad (km/h)',
      data: speedsKmh.map((s) => parseFloat(s)),
      borderColor: 'transparent',
      backgroundColor: CHART_COLORS.fitnessSolid,
      pointRadius: 6,
      pointHoverRadius: 8,
      showLine: false,
      type: 'scatter',
    }],
    avgSpeed: parseFloat(avgSpeed),
  };
};

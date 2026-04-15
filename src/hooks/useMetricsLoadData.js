import { useMemo } from 'react';
import { getDailyLoads, calculateLoadMetrics } from '../services/aiReportService';
import { CHART_COLORS } from '../lib/chartColors';

/**
 * Pure hook that computes training-load metrics (ACWR, weekly buckets, per-bar
 * colours) from a list of raw Strava activities. No fetching performed.
 */
export default function useMetricsLoadData(rawActivities) {
  return useMemo(() => {
    if (!rawActivities || rawActivities.length === 0) return null;

    const metrics = calculateLoadMetrics(rawActivities);
    const daily56 = getDailyLoads(rawActivities, 56);

    const weeklyLoads = [];
    for (let w = 7; w >= 0; w -= 1) {
      const startIdx = w * 7;
      const weekSlice = daily56.slice(startIdx, startIdx + 7);
      const weekKm = weekSlice.reduce((s, v) => s + v, 0);
      const wStart = new Date();
      wStart.setDate(wStart.getDate() - w * 7 - wStart.getDay() + 1);
      weeklyLoads.push({
        weekIndex: 7 - w,
        km: +weekKm.toFixed(1),
        label: w === 0 ? 'Esta sem.' : wStart.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      });
    }

    const weeklyLoadsWithAcwr = weeklyLoads.map((week, idx) => {
      if (idx < 4) {
        return { ...week, acwr: null, color: CHART_COLORS.warningBar };
      }
      const acute = week.km;
      const chronic = (weeklyLoads[idx - 1].km + weeklyLoads[idx - 2].km
        + weeklyLoads[idx - 3].km + weeklyLoads[idx - 4].km) / 4;
      const weekAcwr = chronic > 0 ? +(acute / chronic).toFixed(2) : 0;
      let color;
      if (weekAcwr < 0.8) color = CHART_COLORS.fitnessBar;
      else if (weekAcwr <= 1.3) color = CHART_COLORS.successBar;
      else if (weekAcwr <= 1.5) color = CHART_COLORS.warningBar;
      else color = CHART_COLORS.fatigueBar;
      return { ...week, acwr: weekAcwr, color };
    });

    return {
      acuteLoad: metrics.acuteLoad,
      chronicLoadWeekly: metrics.chronicLoadWeekly,
      acwr: metrics.acwr,
      weeklyLoads: weeklyLoadsWithAcwr,
    };
  }, [rawActivities]);
}

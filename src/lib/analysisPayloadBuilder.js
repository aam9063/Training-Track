/**
 * Builders for the AI-analysis payloads exposed to the athlete Metrics page.
 *
 * These pure helpers take the output of the metrics services (best efforts,
 * time-in-zone, intensity, shoes, weekly load) and produce the compact
 * payload that `AiAnalysisPanel` / Edge-Functions consume.
 */

/**
 * Reduce a list of best-effort rows to one record per distance key,
 * keeping the fastest time.
 *
 * @param {Array<{distance_key: string, elapsed_time_sec: number, activity_date: string}>} rows
 * @returns {Array<{distance: string, best_time_sec: number, best_time_date: string}>}
 */
export const summarizeBestEfforts = (rows) => {
  const byKey = new Map();
  (rows || []).forEach((r) => {
    const cur = byKey.get(r.distance_key);
    if (!cur || r.elapsed_time_sec < cur.best_time_sec) {
      byKey.set(r.distance_key, {
        distance: r.distance_key,
        best_time_sec: r.elapsed_time_sec,
        best_time_date: r.activity_date,
      });
    }
  });
  return Array.from(byKey.values());
};

/**
 * Build the full metrics-analysis payload sent to the AI analyzer.
 * All inputs are already resolved (services + hooks invoked by the caller).
 *
 * @param {object} args
 * @param {object} args.timeInZone   - output of getTimeInZoneAggregate(...).data
 * @param {object} args.intensity    - output of getIntensityDistribution(...).data
 * @param {Array}  args.shoes        - output of getShoes(...).data
 * @param {Array}  args.bestEfforts  - output of getBestEffortsEvolution(...).data
 * @param {Array}  args.weeklyLoad   - output of getWeeklyLoadSeries(...).data
 * @param {number} [args.weeks=4]    - analysis window in weeks
 * @returns {object} payload object shaped for AiAnalysisPanel
 */
export const buildMetricsAnalysisPayload = ({
  timeInZone,
  intensity,
  shoes,
  bestEfforts,
  weeklyLoad,
  weeks = 4,
}) => ({
  time_in_zone: timeInZone?.hasZones
    ? { zones: timeInZone.zones, weeks }
    : null,
  intensity: intensity?.hasZones
    ? {
        z12_pct: intensity.z12_pct,
        z3_pct: intensity.z3_pct,
        z45_pct: intensity.z45_pct,
        label: intensity.label,
        weeks,
      }
    : null,
  shoes: {
    shoes: (shoes || []).slice(0, 6).map((s) => ({
      name: s.name,
      distance_km: s.distance_km,
      active: s.active,
    })),
  },
  best_efforts_summary: { personal_bests: summarizeBestEfforts(bestEfforts) },
  weekly_load: { series: weeklyLoad || [] },
});

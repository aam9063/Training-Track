# Proposal: metrics-deep-views

## Why

Athletes want to understand their training, not just log it. The current `Metrics.jsx` page offers only basic charts (total distance, weekly load), which feels like a thin Strava clone. With the `strava-deep-ingestion` change providing streams, splits, laps, zones, best efforts and gear in the DB, we can now unlock pro-grade analytics that make TrainingTrack feel like a real performance tool — not a glorified calendar.

This change is **UI + derived analytics only**. All data sources already exist in the DB after `strava-deep-ingestion`. No new backend work required.

## What changes

### New charts in `src/pages/athlete/Metrics.jsx` (shared by coached + independent athletes)

- **Récords personales (best_efforts)** — PRs evolution over time for 1K, 5K, 10K, half marathon, marathon. Highlights new PRs.
- **Time in zone** — stacked bar chart, % of time per HR zone over last N weeks.
- **Distribución de intensidad** — polarized vs pyramidal view (zones 1-2 / 3 / 4-5) with auto-labelling of the training pattern.
- **Evolución fitness (TSB)** — existing chart, but now using `suffer_score` from Strava for more accurate CTL/ATL/TSB values.
- **Shoes / Material** — widget with kilometrage per shoe and alerts at 600 km (warning) and 800 km (replace).

### New per-activity detail view

- HR + pace over time (streams, dual-axis chart).
- Auto-detected laps with per-lap stats (distance, avg pace, avg HR).
- Splits per km with HR zone color coding.
- **Cardiac drift** metric (Pa:HR decoupling: first half vs second half).
- **GAP** (grade-adjusted pace) from `velocity_smooth` + `grade_smooth`.

## Affected modules

- `src/pages/athlete/Metrics.jsx` — add new chart components
- NEW `src/components/athlete/charts/BestEffortsChart.jsx`
- NEW `src/components/athlete/charts/TimeInZoneChart.jsx`
- NEW `src/components/athlete/charts/IntensityDistributionChart.jsx`
- NEW `src/components/athlete/charts/ShoesWidget.jsx`
- NEW `src/pages/athlete/ActivityDetail.jsx`
- NEW `src/services/metricsAnalyticsService.js` — derive metrics from streams (cardiac drift, GAP, time-in-zone aggregations, best-efforts evolution)
- `src/lib/trainingMetrics.js` — extend with stream-based calculations (downsample util, zone bucketing)
- `src/App.jsx` — add route `/athlete/activity/:activityId` and `/dashboard/athletes/:athleteId/activities/:activityId`

## Dependencies

- **Requires `strava-deep-ingestion`** to be applied first (provides `strava_activity_streams`, `strava_activity_splits`, `strava_activity_laps`, `strava_activity_best_efforts`, `athlete_hr_zones`, `athlete_gear`).

## Risks

Low — all frontend work, reading already-cached data. Main risk is Chart.js perf with large datasets (1 sample/second over a 2-hour activity = ~7200 points). Mitigation: downsample streams to ~500 points for display using a simple decimation util.

## Rollback

Revert components + services. No DB changes.

## Success criteria

- Athlete opens `/athlete/metrics` → sees at least 5 new charts (best efforts, time in zone, intensity distribution, updated TSB, shoes widget).
- Athlete clicks on an activity card → navigates to activity detail, sees HR + pace over time, splits, laps, cardiac drift, GAP.
- Empty states rendered correctly when data is missing (no streams, no zones, no gear).
- Metrics page renders in < 2s with 20 recent activities worth of streams.

## Next phase

`sdd-spec` → `sdd-design` → `sdd-tasks` (short design — UI work).

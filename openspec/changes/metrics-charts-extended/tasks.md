# Tasks: metrics-charts-extended

Total: 28 tasks across 5 phases. All file paths are absolute from the repo root (`Frontend/`).

## Phase 1: Service + lib extensions

- [x] 1.1 Extend `src/lib/trainingMetrics.js` with `DANIELS_VDOT_TABLE`, `vdotFromRace(distanceM, timeSec)`, `vo2maxUth(maxHr, restHr)`, `vo2maxFromVdot(vdot)`, `bucketCadence(samples)`, `paceZonesFromThreshold`, `paceZonesFromVdot`, `coefficientOfVariation`, `consistencyLabel`. Change `downsampleStream` default target from 500 to 300.
  - **Depends on:** none.
  - **Acceptance:** unit-style manual checks with known inputs (Riegel/Daniels sample times produce expected VDOT ±0.5).

- [x] 1.2 Add `getCadenceDistribution(athleteId, weeks)` to `src/services/metricsAnalyticsService.js`. Handles doubling for one-leg cadence values (< 110) before bucketing.
  - **Depends on:** 1.1 (uses `bucketCadence`).

- [x] 1.3 Add `getWeeklyLoadHeatmap(athleteId, weeks)` to `src/services/metricsAnalyticsService.js`. Falls back to distance-based buckets when `suffer_score` is null.
  - **Depends on:** none.

- [x] 1.4 Add `getVdotProgression(athleteId, range)` reading from `strava_activities.best_efforts`, picking the max VDOT per date when multiple efforts exist.
  - **Depends on:** 1.1 (uses `vdotFromRace`).

- [x] 1.5 Add `getGapForActivity(activityUuid)` — reads `velocity_smooth` + `grade_smooth` + `distance` streams, computes GAP series, returns `{ distance, paceReal, paceGap, avgDeltaSec }`.
  - **Depends on:** none.

- [x] 1.6 Add `getSplitsForActivity(activityUuid)` — parses `strava_activities.splits_metric` into normalized rows.
  - **Depends on:** none.

- [x] 1.7 Add `getLapsForActivity(activityUuid)` — parses `strava_activities.laps`, computes `cvPace` and `consistencyLabel`.
  - **Depends on:** 1.1 (uses CV helpers).

- [x] 1.8 Add `getVo2maxEstimate(athleteId)` — Uth when max/rest HR available, fallback to VDOT derivation, fallback to `null` with method flag. Includes 3-month sparkline.
  - **Depends on:** 1.1, 1.4.

- [x] 1.9 Add `getPaceZones(athleteId, weeks)` — zones from threshold pace, else from VDOT, else defaults. Reads `velocity_smooth` streams and buckets them per week.
  - **Depends on:** 1.1.

- [x] 1.10 Add `getRestVsActiveDays(athleteId, weeks)` — boolean grid with counts.
  - **Depends on:** none.

- [x] 1.11 Add `getRecentActivitiesForSelector(athleteId, limit = 30)` — returns sorted activity rows with `has_streams` flag for the `ActivitySelector`.
  - **Depends on:** none.

- [x] 1.12 Manual smoke test of each new service function in dev against a real athlete (verify shapes, empty cases).
  - **Depends on:** 1.2–1.11.

## Phase 2: Helper components

- [x] 2.1 Create `src/components/athlete/ActivitySelector.jsx` — dropdown of recent 30 activities. On change, if `has_streams = false`, invoke the existing `strava-fetch-streams` Edge Function and show a pending state on dependent charts.
  - **Depends on:** 1.11.
  - **Acceptance:** scenarios 35–37 in `spec.md`.

- [x] 2.2 Create `src/components/athlete/DateRangeSelector.jsx` + `MetricsRangeContext` provider (or Zustand slice) with session-storage persistence. Exposes `range` and `setRange`.
  - **Depends on:** none.
  - **Acceptance:** scenarios 38–39.

## Phase 3: New chart components

- [x] 3.1 `src/components/athlete/charts/Vo2maxCard.jsx` — KPI card with 3-month sparkline. Handles Uth / default-rest / VDOT-fallback / empty states.
  - **Depends on:** 1.8.
  - **Acceptance:** scenarios 21–24.

- [x] 3.2 `src/components/athlete/charts/SufferScoreChart.jsx` — weekly bar chart, 4-week rolling-avg trend indicator.
  - **Depends on:** 1.3 (reuses heatmap data) or new slim fetch.
  - **Acceptance:** scenarios 25–26.

- [x] 3.3 `src/components/athlete/charts/RestDaysCalendar.jsx` — custom SVG 7×8 grid with training/rest coloring + counts summary.
  - **Depends on:** 1.10.
  - **Acceptance:** scenarios 27–28.

- [x] 3.4 `src/components/athlete/charts/WeeklyHeatmapChart.jsx` — custom SVG 7×12 grid with 5-step color scale + native `<title>` tooltips.
  - **Depends on:** 1.3.
  - **Acceptance:** scenarios 8–10.

- [x] 3.5 `src/components/athlete/charts/PaceZonesChart.jsx` — stacked bar per week, `ath-z1..z5` colors, shows "Zonas por defecto" badge when fallback.
  - **Depends on:** 1.9.
  - **Acceptance:** scenarios 29–31.

- [x] 3.6 `src/components/athlete/charts/CadenceHistogramChart.jsx` — histogram bars with % tooltip.
  - **Depends on:** 1.2.
  - **Acceptance:** scenarios 5–7.

- [x] 3.7 `src/components/athlete/charts/GapVsPaceChart.jsx` — dual-line chart with avg-delta summary. Reacts to `ActivitySelector`.
  - **Depends on:** 1.5, 2.1.
  - **Acceptance:** scenarios 14–16.

- [x] 3.8 `src/components/athlete/charts/VdotProgressionChart.jsx` — line chart with tooltip showing distance + time + VDOT.
  - **Depends on:** 1.4.
  - **Acceptance:** scenarios 11–13.

- [x] 3.9 `src/components/athlete/charts/ElevationProfileChart.jsx` — line chart with `segment.borderColor` callback driven by HR zones. Handles no-HR and no-streams states.
  - **Depends on:** 2.1.
  - **Acceptance:** scenarios 1–4.

- [x] 3.10 `src/components/athlete/charts/SplitsComparisonChart.jsx` — pace bars + HR line overlay, quartile coloring.
  - **Depends on:** 1.6, 2.1.
  - **Acceptance:** scenarios 17–18.

- [x] 3.11 `src/components/athlete/charts/LapsAnalysisChart.jsx` — table + bar chart + consistency badge.
  - **Depends on:** 1.7, 2.1.
  - **Acceptance:** scenarios 19–20.

## Phase 4: Redesign BestEffortsChart + restructure Metrics page

- [x] 4.1 Redesign `src/components/athlete/charts/BestEffortsChart.jsx`: short date labels (Spanish `"10 mar"`), max 6 visible x-labels (Chart.js `ticks.maxTicksLimit: 6` + autoskip), internal range selector (1m/3m/6m/1y/all), tooltip with full date + time + delta vs previous PR.
  - **Depends on:** 2.2 (consumes global range if provided, else falls back to internal).
  - **Acceptance:** scenarios 32–34.

- [x] 4.2 Restructure `src/pages/athlete/Metrics.jsx` into 7 collapsible sections in the order: Resumen → Carga y forma → Intensidad → Técnica → Récords y progresión → Actividad detallada → Material. Mount all new components, wire `DateRangeSelector` at the top, wire `ActivitySelector` inside the Actividad section and share its value with the 3 per-activity charts via local state.
  - **Depends on:** all Phase 2 + Phase 3 + 4.1.
  - **Acceptance:** scenarios 40–42 + 46 (coach parity).

- [ ] 4.3 Wrap service calls in React Query hooks with `staleTime: 60_000` keyed on `[athleteId, range]` (or `activityId`). Prevents refetch storms when sections re-mount. (Deferred: project does not use React Query; components fetch on mount with cleanup flags — matches pattern of existing charts.)
  - **Depends on:** 4.2.
  - **Acceptance:** scenario 45.

## Phase 5: Testing, lint & build

- [ ] 5.1 Verify empty states for every chart using test athletes missing streams / cadence / HR / best_efforts / suffer_score / velocity_smooth. Match Spanish copy exactly as per the design's empty state table.
  - **Depends on:** Phase 3 + 4.
  - **Acceptance:** all empty-state scenarios in `spec.md`.

- [ ] 5.2 Cross-check derived metrics for 2–3 sample activities against Strava UI values (splits, laps, time-in-zone, VDOT approximation).
  - **Depends on:** Phase 3 + 4.

- [ ] 5.3 Performance profile: `/athlete/metrics` interactive < 2.5 s with 30 activities (Chrome DevTools Performance, mid-range laptop baseline).
  - **Depends on:** 4.2, 4.3.
  - **Acceptance:** scenario 43.

- [x] 5.4 Run lint + production build (`npm run lint` + `npm run build`). Fix any warnings introduced.
  - **Depends on:** Phase 3 + 4.

- [ ] 5.5 Smoke test the coached-athlete flow: coach opens an athlete's Metrics view and confirms all sections render with that athlete's data and respect RLS.
  - **Depends on:** 4.2.
  - **Acceptance:** scenario 46.

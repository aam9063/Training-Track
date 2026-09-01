# Proposal: metrics-charts-extended

## Why

The current athlete `Metrics.jsx` page (shared by coached and independent athletes) shows only basic KPIs plus a handful of charts introduced by `metrics-deep-views` (Best Efforts, Time in Zone, Intensity Distribution, Shoes). Users compare us with Garmin Connect and Strava Premium and expect pro-grade visual analytics: elevation profiles with HR overlay, cadence histograms, training heatmaps, VDOT/VO2max progression, GAP vs real pace, split and lap analysis, pace zones, and rest-vs-active calendars.

The **backend already contains all the data** (streams, splits, laps, best efforts, suffer_score, HR zones, gear) after `strava-deep-ingestion`. What is missing is a consistent, well-organized UI layer that surfaces these analytics and makes the page feel harmonious instead of a random pile of charts.

Additionally, the existing `BestEffortsChart` ("Evolución de marcas") has a critical usability bug: raw ISO timestamps overlap on the x-axis, there is no time-range filter, and the tooltip lacks delta vs previous PR. It needs redesigning alongside the new additions.

This change is **UI + client-side derivations only**. No DB migrations, no new Edge Functions.

## What changes

### 11 new charts (all in `src/pages/athlete/Metrics.jsx`)

1. **Perfil de elevación por actividad** — line chart, elevation vs distance, line color segmented by HR zone (requires streams of a selected activity).
2. **Distribución de cadencia** — histogram, cadence buckets (≤160, 160–170, 170–180, 180–190, ≥190 spm), y = % of time, aggregated over last 8 weeks of activities.
3. **Mapa de calor semanal** — heatmap 7×12 weeks: x = week, y = day of week, cell intensity = training load (suffer_score or distance).
4. **Progresión VDOT/eFTP** — line chart, x = date, y = VDOT estimated from `best_efforts` times using Riegel + Daniels VDOT tables.
5. **GAP vs Pace real** — for a selected activity, two series: actual pace and grade-adjusted pace over distance.
6. **Splits comparativos** — bar chart per km with pace + HR (dual series) from `splits_metric` JSONB.
7. **Laps / intervalos** — table + bar chart of auto-detected laps with consistency score (CV of pace).
8. **VO2max estimado** — single KPI card with small trend sparkline. Uth formula with VDOT fallback.
9. **Suffer Score agregado** — weekly bar chart summing `suffer_score` per week over last 12 weeks.
10. **Días descanso vs activos** — calendar-like 7×8 grid, green = training, gray = rest, showing training pattern of the last 8 weeks.
11. **Zonas de PACE** — stacked bar chart (similar to Time in Zone) but with pace buckets instead of HR (for athletes without HR monitor).

### Redesign of existing `BestEffortsChart`

- Short date format (e.g. `"10 mar"`, `"16 mar"`).
- Max 6 labels on the x-axis (rest deferred to tooltip).
- Time range selector (1m / 3m / 6m / 1y / all).
- Tooltip with full date + time + delta vs previous PR.

### Page reorganization — harmonious section structure

The `Metrics.jsx` page becomes 7 collapsible sections, each with a header and a consistent grid layout:

1. **Resumen** — existing KPIs + `Vo2maxCard` + VDOT current value.
2. **Carga y forma** — existing TSB chart + `SufferScoreChart` + `RestDaysCalendar` + `WeeklyHeatmapChart`.
3. **Intensidad** — existing `TimeInZoneChart` + `PaceZonesChart` + existing `IntensityDistributionChart`.
4. **Técnica** — `CadenceHistogramChart` + `GapVsPaceChart` (uses activity selector).
5. **Récords y progresión** — redesigned `BestEffortsChart` + `VdotProgressionChart`.
6. **Actividad detallada** — `ActivitySelector` → `ElevationProfileChart` + `SplitsComparisonChart` + `LapsAnalysisChart`.
7. **Material** — existing `ShoesWidget`.

A global `DateRangeSelector` (1m / 3m / 6m / 1y / all) sits above the sections and drives the range of range-aware charts.

## Affected modules

- `src/pages/athlete/Metrics.jsx` — restructured into collapsible sections, new components wired in.
- NEW `src/components/athlete/charts/ElevationProfileChart.jsx`
- NEW `src/components/athlete/charts/CadenceHistogramChart.jsx`
- NEW `src/components/athlete/charts/WeeklyHeatmapChart.jsx`
- NEW `src/components/athlete/charts/VdotProgressionChart.jsx`
- NEW `src/components/athlete/charts/GapVsPaceChart.jsx`
- NEW `src/components/athlete/charts/SplitsComparisonChart.jsx`
- NEW `src/components/athlete/charts/LapsAnalysisChart.jsx`
- NEW `src/components/athlete/charts/Vo2maxCard.jsx`
- NEW `src/components/athlete/charts/SufferScoreChart.jsx`
- NEW `src/components/athlete/charts/RestDaysCalendar.jsx`
- NEW `src/components/athlete/charts/PaceZonesChart.jsx`
- NEW `src/components/athlete/ActivitySelector.jsx`
- NEW `src/components/athlete/DateRangeSelector.jsx`
- MODIFIED `src/components/athlete/charts/BestEffortsChart.jsx` — redesigned date labels, range selector, tooltip.
- EXTENDED `src/services/metricsAnalyticsService.js` — 10 new exports (see design.md).
- EXTENDED `src/lib/trainingMetrics.js` — VDOT tables and formulas, cadence bucketing, CV calc, pace zone bucketing.

## Dependencies

- **Requires `metrics-deep-views`** (provides `metricsAnalyticsService.js` base and first-wave charts).
- **Requires `strava-deep-ingestion`** (provides streams, splits, laps, best efforts, zones, gear).
- Edge Function `strava-fetch-streams` is invoked on demand when a selected activity has `has_streams = false`. This function already exists; no changes needed.

## Risks

Low — frontend only, consuming cached data.

- **Chart.js perf with streams**: mitigated by downsampling to max 300 points (ADR 3).
- **Rate limits** when fetching streams on demand: mitigated by limiting the activity selector to the 30 most recent activities (ADR 2) and caching results in React Query.
- **Bundle size**: no new chart lib (heatmap via custom SVG, ADR 4); VDOT tables are small hardcoded JS (ADR 5).

## Rollback

Revert components + service + lib extensions. No DB changes.

## Success criteria

- Athlete opens `/athlete/metrics` → sees 7 organized sections with all 11 new charts + redesigned Best Efforts.
- `ActivitySelector` (limited to last 30 activities) loads streams on demand when needed.
- Redesigned Best Efforts shows short date labels, range selector works, tooltip includes full date + delta.
- Page renders in < 2.5 s for an athlete with 30 activities (95th percentile, mid-range laptop).
- Empty states rendered correctly for athletes with missing streams / cadence / HR / suffer_score / best_efforts.
- Coached-athlete view (coach opening athlete's Metrics) shows the same layout and charts.

## Next phase

`sdd-spec` → `sdd-design` → `sdd-tasks` → `sdd-apply`.

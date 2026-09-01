# Design: metrics-charts-extended

Short design — UI work on top of already-ingested data and an existing analytics service. No DB changes, no new Edge Functions.

## Context

`metrics-deep-views` already shipped the foundation: `metricsAnalyticsService.js`, first-wave charts (`BestEffortsChart`, `TimeInZoneChart`, `IntensityDistributionChart`, `ShoesWidget`), and stream downsampling utilities. This change extends that foundation with:

- 10 new analytics functions in the same service.
- 11 new chart components + 2 helper components (`ActivitySelector`, `DateRangeSelector`).
- A redesign of `BestEffortsChart` (in place).
- A restructure of `Metrics.jsx` into 7 collapsible sections with a global date-range selector.

All data is already cached in Supabase tables after `strava-deep-ingestion`. New derivations run in the browser. When a selected activity lacks streams (`has_streams = false`), we call the existing `strava-fetch-streams` Edge Function on demand.

## Component architecture

```
Metrics.jsx
├── DateRangeSelector (global, drives range-aware charts)
│
├── Section "Resumen"
│   ├── existing KPIs
│   ├── Vo2maxCard({ athleteId })
│   └── VDOT current (derived inside Vo2maxCard or a small sibling)
│
├── Section "Carga y forma"
│   ├── existing TSBChart({ athleteId, range })
│   ├── SufferScoreChart({ athleteId, range })
│   ├── RestDaysCalendar({ athleteId, weeks: 8 })
│   └── WeeklyHeatmapChart({ athleteId, weeks: 12 })
│
├── Section "Intensidad"
│   ├── existing TimeInZoneChart({ athleteId, weeks: 4 })
│   ├── PaceZonesChart({ athleteId, weeks: 4 })
│   └── existing IntensityDistributionChart({ athleteId, weeks: 4 })
│
├── Section "Técnica"
│   ├── CadenceHistogramChart({ athleteId, weeks: 8 })
│   └── GapVsPaceChart({ activityId })  ← uses activity selector
│
├── Section "Récords y progresión"
│   ├── BestEffortsChart (redesigned) ({ athleteId, range })
│   └── VdotProgressionChart({ athleteId, range })
│
├── Section "Actividad detallada"
│   ├── ActivitySelector({ athleteId, value, onChange })
│   ├── ElevationProfileChart({ activityId })
│   ├── SplitsComparisonChart({ activityId })
│   └── LapsAnalysisChart({ activityId })
│
└── Section "Material"
    └── existing ShoesWidget({ athleteId })
```

Each chart is an independent component that:
1. Receives scalar props (`athleteId`, `activityId`, `range`, `weeks`).
2. Fetches its own data via `metricsAnalyticsService.js` (wrapped in React Query hooks).
3. Handles loading / empty / error states per the spec copy table.
4. Renders with Chart.js (reused dependency) — except the heatmap and rest calendar, rendered as custom SVG.

## Service surface (new exports in `metricsAnalyticsService.js`)

```js
getCadenceDistribution(athleteId, weeks = 8)
// → { buckets: [{ label, pctTime, minutes }], totalSamples }

getWeeklyLoadHeatmap(athleteId, weeks = 12)
// → [[{ date, load, source: 'suffer'|'distance' } x 7] x weeks]

getVdotProgression(athleteId, range = 'all')
// → [{ date, vdot, distance, timeSec }]

getGapForActivity(activityUuid)
// → { distance: number[], paceReal: number[], paceGap: number[], avgDeltaSec }

getSplitsForActivity(activityUuid)
// → [{ idx, distanceM, timeSec, paceSec, avgHr }]

getLapsForActivity(activityUuid)
// → { laps: [{ idx, distanceM, durationSec, paceSec, avgHr, elevGain }], cvPace, consistencyLabel }

getVo2maxEstimate(athleteId)
// → { value: number, method: 'uth'|'uth-default-rest'|'vdot-fallback', sparkline: [{date, value}] }

getPaceZones(athleteId, weeks = 4)
// → { zonesSource: 'threshold'|'vdot'|'default', weeks: [{ weekLabel, buckets: [pctZ1..Z5] }] }

getRestVsActiveDays(athleteId, weeks = 8)
// → { grid: [{ date, active: boolean }], trainingDays: number, restDays: number }

getRecentActivitiesForSelector(athleteId, limit = 30)
// → [{ id, strava_activity_id, name, start_date, distance_km, moving_time, has_streams }]
```

## `trainingMetrics.js` extensions

```js
// Daniels VDOT table (partial, distances 1000m/1500m/1mile/5K/10K/half/marathon)
export const DANIELS_VDOT_TABLE = { ... }

// Lookup: distance (m) + time (s) → VDOT
export function vdotFromRace(distanceM, timeSec) { ... }

// VO2max formulas
export function vo2maxUth(maxHr, restHr) { return 15 * (maxHr / restHr) }
export function vo2maxFromVdot(vdot)      { return vdot * 0.8 + 10.5 }

// Cadence bucketing (handles one-leg Strava values < 110 by doubling)
export function bucketCadence(samples) { ... }

// Pace zones from threshold or VDOT fallback
export function paceZonesFromThreshold(thresholdSecPerKm) { ... }
export function paceZonesFromVdot(vdot) { ... }

// Consistency score (CV = stdev / mean)
export function coefficientOfVariation(values) { ... }
export function consistencyLabel(cv) {
  if (cv < 0.05) return 'Excelente'
  if (cv < 0.10) return 'Buena'
  return 'Irregular'
}

// Downsample already exists; extend default target from 500 to 300.
```

## Elevation profile: HR-zone color segmentation

Chart.js supports per-segment line coloring via the `segment.borderColor` callback. For each segment between two points, pick the HR zone of the average HR in that interval and return the matching theme color (`ath-z1` … `ath-z5`). If HR stream absent, return a single neutral color.

## Heatmap & Rest calendar: custom SVG

Custom lightweight SVG grids, no chart-matrix plugin. 7 rows × N cols, each cell is a `<rect>` with fill from a color scale and `<title>` for native tooltip. Total markup for 7×12 = 84 rects — cheap.

## Global date range selector

Small Zustand-like store or a React Context (`MetricsRangeContext`) with `{ range: '1m'|'3m'|'6m'|'1y'|'all', setRange }`. Session-storage backed. Range-aware charts subscribe; fixed-window charts don't.

## ADRs

### ADR 1: All charts client-side from cached data

**Decision:** Keep every new derivation in the browser, extending `metricsAnalyticsService.js`.

**Why:** Continues the pattern set by `metrics-deep-views`. Data already lives in Supabase tables with RLS; computing in the client keeps iteration fast (no migrations per analytic tweak) and keeps Postgres load low. Downsampled payloads are small.

**Trade-off:** CPU cost on the client. Acceptable given typical dataset size (≤ 30 activities × ≤ 300 points displayed).

### ADR 2: Activity selector limited to 30 most recent activities

**Decision:** `ActivitySelector` shows only the 30 most recent activities.

**Why:** Older activities rarely have streams cached (Strava rate limit friendly — fetching streams for very old activities is wasteful). Keeps the dropdown usable.

**Trade-off:** Athletes cannot pick a very old activity for detailed analysis. Acceptable; they can extend coverage later by syncing streams in bulk.

### ADR 3: Downsample streams to max 300 points for display

**Decision:** Client displays decimated streams at ≤ 300 points.

**Why:** Chart.js line perf degrades visibly past ~500 points. 300 is a safe default for typical viewport widths (≤ 1200 px) and keeps line renderings crisp. The existing helper `downsampleStream` changes its default from 500 to 300.

**Trade-off:** Tiny loss of visual fidelity. Unnoticeable for line charts at typical sizes.

### ADR 4: Heatmap + Rest calendar via custom SVG (no chart-matrix plugin)

**Decision:** Render the weekly heatmap and the rest-days calendar as custom React SVG components.

**Why:** Installing `chartjs-chart-matrix` adds ~15 KB to the bundle for two charts. A 7×N grid of `<rect>` is trivial markup (< 50 lines each) and gives us full styling control with the `ath-*` color tokens.

**Trade-off:** We maintain the SVG code ourselves. Acceptable — the layout is very simple.

### ADR 5: VDOT tables hardcoded in JS

**Decision:** Embed Daniels' VDOT reference values as a static JS object in `trainingMetrics.js`.

**Why:** The table is tiny (≈ 30 rows × 7 cols = ~200 values), public, and doesn't change. Avoids a DB call per VDOT lookup. Distance-specific lookups are O(1).

**Trade-off:** If we want to tweak formulas per athlete (e.g. custom race calculator), we'd still extend this table. That's out of scope for this change.

### ADR 6: Redesign `BestEffortsChart` in place

**Decision:** Modify the existing component rather than create a v2.

**Why:** Only `Metrics.jsx` imports it today. The redesign is purely internal (label formatter, range selector state, tooltip callback) — API surface stays the same `{ athleteId }` (plus optional `range` prop driven by the global selector). No breaking change elsewhere.

## Empty state copy (Spanish — appended to the metrics-deep-views table)

| Chart | Empty copy |
|---|---|
| Elevation (no HR) | "Sin HR — color uniforme" |
| Elevation (no streams, fetch fail) | "No se pudieron cargar los streams" |
| Elevation / GAP / Splits / Laps (no activity) | "Selecciona una actividad para verla en detalle" |
| Cadence (no data) | "Sin datos de cadencia" |
| VDOT (insufficient data) | "Necesitas al menos 2 récords para ver tu progresión VDOT" |
| GAP (flat activity) | "Ruta prácticamente plana — GAP ≈ pace real" |
| GAP (no grade stream) | "Sin datos de pendiente" |
| Splits (missing) | "Sin splits detallados" |
| Laps (single lap) | "Actividad sin intervalos detectados" |
| VO2max (insufficient) | "Conecta Strava y completa tu perfil para estimar VO2max" |
| VO2max (no resting HR) | "Estimado (sin FC en reposo)" |
| VO2max (VDOT fallback) | "Derivado de VDOT" |
| Suffer Score (none in range) | "Sin datos de esfuerzo en este periodo" |
| Pace Zones (defaults) | "Zonas de pace por defecto" |
| Pace Zones (no velocity) | "Sin datos de pace" |

## Out of scope

- No DB migrations.
- No new Edge Functions.
- No new charting library (existing Chart.js + custom SVG).
- No export to PDF for the new charts.
- No mobile-only custom layout — sections collapse to a single column via existing Tailwind responsive classes.
- No AI narrative on top of these charts (that lives in `metrics-ai-analysis`).

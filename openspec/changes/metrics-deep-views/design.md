# Design: metrics-deep-views

Short design — this is UI work on top of already-ingested data. No DB changes.

## Context

All data is already in the DB after `strava-deep-ingestion`. This change consumes it to produce derived analytics rendered in Chart.js in the Metrics page and a new ActivityDetail page.

## Component architecture

Each chart is an **independent component** that:

1. Receives `{ athleteId, dateRange }` (or `{ activityId }` for detail charts) as props.
2. Fetches its own data via `metricsAnalyticsService.js`.
3. Handles its own loading / empty / error states.
4. Renders with Chart.js (same lib already used in the app — avoids a second charting dependency).

```
Metrics.jsx
├── BestEffortsChart({ athleteId })
├── TimeInZoneChart({ athleteId, weeks: 4 })
├── IntensityDistributionChart({ athleteId, weeks: 4 })
├── TSBChart({ athleteId, months: 6 })   ← existing, extended
└── ShoesWidget({ athleteId })

ActivityDetail.jsx
├── HRPaceChart({ activityId })
├── SplitsTable({ activityId })
├── LapsTable({ activityId })
├── CardiacDriftWidget({ activityId })
└── GAPChart({ activityId })
```

## `metricsAnalyticsService.js` surface

All client-side derivations — no new Edge Functions. Reads from cached tables.

```js
getBestEffortsEvolution(athleteId, distanceKey?)     // → strava_activities.best_efforts
getTimeInZone(athleteId, weeks = 4)                  // → streams.heartrate + athlete_hr_zones
getIntensityDistribution(athleteId, weeks = 4)       // reuses getTimeInZone, labels polarized/pyramidal
getShoes(athleteId)                                  // → athlete_gear
getCardiacDrift(activityId)                          // → streams, Pa:HR first-half vs second-half
getGradeAdjustedPace(activityId)                     // → velocity_smooth + grade_smooth
getActivityStreams(activityId)                       // → raw streams for rendering (downsampled)
getActivitySplits(activityId)                        // → strava_activity_splits
getActivityLaps(activityId)                          // → strava_activity_laps
```

Extensions to `src/lib/trainingMetrics.js`:

```js
downsampleStream(points, targetSize = 500)           // simple decimation for display
bucketByZone(samples, zones)                         // % time in each zone
classifyIntensity(zoneDistribution)                  // → "polarized" | "pyramidal" | "threshold"
```

## ADRs

### ADR 1: Compute analytics client-side, not in DB

**Decision:** Derive time-in-zone, intensity distribution, cardiac drift and GAP in the browser.

**Why:** Data is already cached in Supabase tables and served with RLS. Computing in the client means faster iteration (no migration per analytic tweak), simpler debugging, and avoids loading Postgres with aggregation queries. Payloads are small (downsampled streams ≤ 500 points).

**Trade-off:** Some CPU cost on the client. Acceptable given typical dataset size.

### ADR 2: Downsample streams to ~500 points for rendering

**Decision:** Before passing stream data to Chart.js, reduce to ~500 points via decimation (take every Nth sample).

**Why:** Chart.js performance degrades noticeably past ~1000 points, and 7200 points per activity (2h at 1Hz) is common. 500 points preserves visual fidelity for line charts at typical viewport widths. LTTB is preferable but plain decimation is the MVP.

### ADR 3: Reuse Chart.js instead of Recharts / Visx

**Decision:** Keep Chart.js as the single charting library.

**Why:** Already a dependency. Team knows it. Mixing charting libraries bloats the bundle. No new feature in this change requires Recharts specifically.

### ADR 4: Activity detail URL structure

- Athlete view: `/athlete/activity/:activityId`
- Coach view: `/dashboard/athletes/:athleteId/activities/:activityId`

Both routes render the **same `ActivityDetail.jsx` component**; the component reads the athlete context from route params (`athleteId` if present in URL, otherwise from `useAuth()`).

**Why:** Single component = single source of truth for the detail layout. Coach-specific actions (edit notes, link session) can be guarded by a role check inside the component.

## Empty state copy (Spanish)

| Chart | Empty copy |
|---|---|
| Best Efforts | "Aún no tienes récords personales" |
| Time in Zone | "Sin datos de pulsaciones" |
| Intensity Distribution (not enough data) | "Se necesitan al menos 4 semanas de datos" |
| Shoes (no Strava) | "Conecta Strava para ver tus zapatillas" |
| Shoes (Strava connected, no gear) | "Sin zapatillas registradas" |
| Activity detail (no streams) | "Análisis detallado no disponible" |

## Out of scope

- No new backend jobs.
- No ML-based insights (that is `metrics-ai-analysis`).
- No export to PDF (existing `pdfExport.js` untouched).

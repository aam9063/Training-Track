# Spec: metrics-charts-extended

## Capability: Extended pro-grade analytics in the athlete Metrics page

Adds 11 new charts + helper components (`ActivitySelector`, `DateRangeSelector`) + redesigned `BestEffortsChart`, all organized into 7 collapsible sections. All derivations are client-side from cached data (`strava_activities`, `strava_activity_streams`, `athlete_hr_zones`, `athlete_gear`).

---

## Requirement: Elevation profile chart (per activity)

The Metrics page MUST display the elevation profile of a selected activity with line color segmented by HR zone.

### Scenario 1: Activity with elevation and HR streams

- **GIVEN** the athlete has selected an activity in `ActivitySelector` that has streams `altitude`, `distance` and `heartrate`
- **WHEN** the Elevation Profile chart renders
- **THEN** the x-axis is distance in km, the y-axis is elevation in m, and the line color changes across segments following the HR zone at that point (Z1 green → Z5 red) using `athlete_hr_zones` thresholds

### Scenario 2: Activity without HR

- **GIVEN** the selected activity has `altitude` and `distance` but no `heartrate` stream
- **WHEN** the chart renders
- **THEN** the elevation line is drawn in the neutral theme color (`ath-*`) and a badge **"Sin HR — color uniforme"** is shown next to the chart title

### Scenario 3: Activity without streams (has_streams = false)

- **GIVEN** the selected activity row has `has_streams = false`
- **WHEN** the athlete selects it
- **THEN** the UI calls the `strava-fetch-streams` Edge Function, shows a loading indicator, and re-renders the chart when streams return. If the call fails, the chart area shows **"No se pudieron cargar los streams"** with a retry button.

### Scenario 4: No activity selected

- **GIVEN** no activity is currently selected in `ActivitySelector`
- **WHEN** the "Actividad detallada" section renders
- **THEN** the Elevation Profile, Splits and Laps charts show an inline empty state **"Selecciona una actividad para verla en detalle"**

---

## Requirement: Cadence histogram

The Metrics page MUST show a histogram of cadence distribution aggregated over recent weeks.

### Scenario 5: Athlete with cadence streams

- **GIVEN** the athlete has `cadence` streams on at least 4 activities in the last 8 weeks
- **WHEN** the Cadence Histogram renders
- **THEN** cadence samples are bucketed into (≤160, 160–170, 170–180, 180–190, ≥190 spm) and the y-axis shows % of total time in each bucket
- **AND** the chart tooltip for each bar shows the absolute minutes and % with one decimal

### Scenario 6: Cadence values are stored doubled (one-leg)

- **GIVEN** Strava cadence stream values < 110 (one-leg counts)
- **WHEN** the service aggregates them
- **THEN** each sample is doubled before bucketing (so a one-leg cadence of 90 becomes 180 spm)

### Scenario 7: No cadence data

- **GIVEN** the athlete has no activities with a `cadence` stream in the selected window
- **WHEN** the chart renders
- **THEN** it shows the empty state **"Sin datos de cadencia"**

---

## Requirement: Weekly training heatmap

The Metrics page MUST display a 7×12 heatmap where each cell represents a day colored by training load.

### Scenario 8: Athlete with recent training

- **GIVEN** the athlete has activities over the last 12 weeks, some with `suffer_score` populated
- **WHEN** the heatmap renders
- **THEN** rows represent days of week (Mon → Sun), columns represent weeks (oldest → current), and cell intensity maps to load using a 5-step green scale (rest / low / medium / high / very high)
- **AND** hovering a cell shows a tooltip with date, distance, suffer_score

### Scenario 9: Load source fallback

- **GIVEN** an activity has no `suffer_score` but has `distance_m`
- **WHEN** computing its daily load
- **THEN** the heatmap falls back to distance (km) as the intensity value, with its own 5-step bucket thresholds (< 3 km, 3–7, 7–12, 12–20, ≥ 20)

### Scenario 10: Empty week

- **GIVEN** no activities occurred in one of the 12 weeks
- **WHEN** the heatmap renders
- **THEN** that week's 7 cells are drawn in the neutral rest color (no errors)

---

## Requirement: VDOT progression

The Metrics page MUST show a line chart of estimated VDOT over time derived from `best_efforts`.

### Scenario 11: Athlete with multiple PRs across time

- **GIVEN** the athlete has `best_efforts` entries for 1K, 5K or 10K across at least 4 activities
- **WHEN** the VDOT Progression chart renders
- **THEN** for each best effort, VDOT is looked up in the hardcoded Daniels table (using the distance + time); chart x = activity start_date, y = VDOT
- **AND** tooltip shows distance, time, VDOT value

### Scenario 12: Riegel normalization

- **GIVEN** two PRs on the same date (1K and 5K)
- **WHEN** VDOT is computed for that date
- **THEN** the higher of the two VDOT values is used (best-of policy)

### Scenario 13: Not enough data

- **GIVEN** the athlete has fewer than 2 best_effort entries across all time
- **WHEN** the chart renders
- **THEN** it shows **"Necesitas al menos 2 récords para ver tu progresión VDOT"**

---

## Requirement: GAP vs real pace (per activity)

The Metrics page MUST display, for a selected activity, the real pace vs grade-adjusted pace.

### Scenario 14: Activity with velocity_smooth and grade_smooth

- **GIVEN** the selected activity has streams `velocity_smooth`, `grade_smooth`, `distance`
- **WHEN** the GAP chart renders
- **THEN** two line series are drawn: "Pace real" (from velocity_smooth) and "GAP" (adjusted using Minetti cost-of-running or Strava approximation), both in min/km against distance
- **AND** a summary label shows the average delta (e.g. **"GAP 3 s/km más rápido en promedio"**)

### Scenario 15: Flat activity

- **GIVEN** an activity whose `grade_smooth` absolute max is < 1%
- **WHEN** the chart renders
- **THEN** it still renders both lines, but the summary label reads **"Ruta prácticamente plana — GAP ≈ pace real"**

### Scenario 16: No grade stream

- **GIVEN** the selected activity lacks `grade_smooth`
- **WHEN** the section renders
- **THEN** only the "Pace real" line is shown plus a badge **"Sin datos de pendiente"**

---

## Requirement: Splits comparison (per activity)

The Metrics page MUST show, for a selected activity, a bar chart of pace + HR per km.

### Scenario 17: Activity with splits_metric

- **GIVEN** the selected activity has non-empty `splits_metric` JSONB
- **WHEN** the Splits Comparison chart renders
- **THEN** the x-axis shows km index (1, 2, …), left y-axis is pace (min/km, lower is faster) as bars, right y-axis is avg HR as a line overlay
- **AND** bar color is graded by pace quartile vs median (fastest split = accent, slowest = muted)

### Scenario 18: Missing splits

- **GIVEN** the selected activity has `splits_metric` null or empty
- **WHEN** the section renders
- **THEN** it shows **"Sin splits detallados"**

---

## Requirement: Laps analysis (per activity)

The Metrics page MUST show, for a selected activity, the auto-detected laps with a consistency score.

### Scenario 19: Activity with laps

- **GIVEN** the selected activity has non-empty `laps` JSONB with ≥ 2 entries
- **WHEN** the Laps Analysis component renders
- **THEN** a table lists each lap (index, distance, duration, avg pace, avg HR, elevation gain) AND a bar chart shows pace per lap; a consistency score is shown as the CV (stdev / mean) of pace: < 5% = **"Excelente"**, 5–10% = **"Buena"**, > 10% = **"Irregular"**

### Scenario 20: Single-lap activity

- **GIVEN** the selected activity has only 1 lap
- **WHEN** the component renders
- **THEN** it shows **"Actividad sin intervalos detectados"** instead of the consistency score

---

## Requirement: VO2max estimated

The Metrics page MUST show a `Vo2maxCard` KPI with a small trend sparkline.

### Scenario 21: Athlete with max HR and resting HR

- **GIVEN** the athlete profile contains `max_hr` and `resting_hr` values
- **WHEN** the card renders
- **THEN** VO2max is computed via Uth formula (`15 × max_hr / resting_hr`) and displayed with 1-decimal precision plus a 3-month sparkline of recent computations

### Scenario 22: No resting HR available

- **GIVEN** the athlete has `max_hr` but no `resting_hr`
- **WHEN** the card renders
- **THEN** VO2max defaults resting HR to 60 and a subtle note **"Estimado (sin FC en reposo)"** is shown

### Scenario 23: VDOT fallback

- **GIVEN** the athlete has no `max_hr` but has a computed VDOT ≥ 30
- **WHEN** the card renders
- **THEN** it computes `VO2max ≈ VDOT × 0.8 + 10.5` and shows **"Derivado de VDOT"**

### Scenario 24: Not enough data

- **GIVEN** the athlete has neither HR profile nor VDOT
- **WHEN** the card renders
- **THEN** it shows **"Conecta Strava y completa tu perfil para estimar VO2max"**

---

## Requirement: Weekly Suffer Score chart

The Metrics page MUST show a bar chart of weekly suffer_score totals.

### Scenario 25: Athlete with suffer_score history

- **GIVEN** the athlete has activities with `suffer_score` across the selected range (e.g. last 12 weeks)
- **WHEN** the chart renders
- **THEN** bars show the sum of suffer_score per ISO week; hover shows week label and total
- **AND** a small trend arrow shows if the current week is higher / lower / equal to the 4-week rolling avg

### Scenario 26: No suffer_score in range

- **GIVEN** no activity in the selected window has `suffer_score`
- **WHEN** the chart renders
- **THEN** it shows **"Sin datos de esfuerzo en este periodo"**

---

## Requirement: Rest days calendar

The Metrics page MUST show a 7×8 calendar where each cell indicates training vs rest.

### Scenario 27: Recent training pattern

- **GIVEN** the athlete has activities in the last 8 weeks
- **WHEN** the calendar renders
- **THEN** each of the 56 cells is green if the athlete had ≥ 1 activity that day, gray if rest; a summary shows "X días de entreno / Y días de descanso"

### Scenario 28: Entire week of rest

- **GIVEN** one week has zero activities
- **WHEN** the calendar renders
- **THEN** all 7 cells of that week are gray, no error is thrown

---

## Requirement: Pace zones chart

The Metrics page MUST show a stacked bar chart of % time spent in each pace zone over recent weeks.

### Scenario 29: Athlete with velocity_smooth streams

- **GIVEN** the athlete has `velocity_smooth` streams in the last 4 weeks
- **WHEN** the Pace Zones chart renders
- **THEN** samples are bucketed into 5 pace zones (based on athlete's threshold pace or defaults from VDOT) and a stacked bar per week shows their distribution

### Scenario 30: No threshold pace

- **GIVEN** the athlete has neither stored threshold pace nor VDOT
- **WHEN** the chart renders
- **THEN** default pace zones are used (Z1 > 6:00, Z2 5:30–6:00, Z3 5:00–5:30, Z4 4:30–5:00, Z5 < 4:30 min/km) and a badge **"Zonas de pace por defecto"** is shown

### Scenario 31: No velocity data

- **GIVEN** the athlete has no activities with `velocity_smooth` in the range
- **WHEN** the chart renders
- **THEN** it shows **"Sin datos de pace"**

---

## Requirement: Redesigned Best Efforts chart

The existing `BestEffortsChart` MUST be redesigned with readable date labels, a range selector, and a richer tooltip.

### Scenario 32: Short date labels with cap

- **GIVEN** the chart has 20 points across 6 months
- **WHEN** the chart renders
- **THEN** at most 6 labels are visible on the x-axis (auto-thinned), each in the Spanish short format **"10 mar"**, **"16 mar"**, etc.

### Scenario 33: Range selector

- **GIVEN** the chart has more than 1 year of data
- **WHEN** the athlete clicks the "3m" button in the chart range selector (1m / 3m / 6m / 1y / all)
- **THEN** only points within the last 3 months are plotted, the x-axis re-scales, and the selection persists for that chart (session scope)

### Scenario 34: Tooltip with delta

- **GIVEN** the athlete hovers a PR point
- **WHEN** the tooltip renders
- **THEN** it shows: full date (**"16 mar 2026"**), distance, time (mm:ss), and the delta vs previous PR at that distance (e.g. **"−00:12 vs anterior"** in green if faster, red if slower)

---

## Requirement: Activity selector

The Metrics page MUST include an `ActivitySelector` dropdown that drives per-activity charts.

### Scenario 35: Limited to recent 30

- **GIVEN** the athlete has 200 synced activities
- **WHEN** the selector opens
- **THEN** it shows only the 30 most recent, sorted desc by start date, each entry formatted as **"16 mar · 12,3 km · 58:12"**

### Scenario 36: Changing selection fires a fetch if needed

- **GIVEN** the athlete picks an activity with `has_streams = false`
- **WHEN** the selection changes
- **THEN** the app calls the `strava-fetch-streams` Edge Function in the background and shows a loading state on the dependent charts (Elevation, GAP, Splits, Laps)

### Scenario 37: Preselection

- **GIVEN** the athlete opens the Metrics page for the first time in a session
- **WHEN** the page loads
- **THEN** the selector preselects the most recent activity that has streams (or falls back to the most recent if none)

---

## Requirement: Date range selector (global)

The Metrics page MUST expose a global `DateRangeSelector` that drives range-aware charts.

### Scenario 38: Scope of effect

- **GIVEN** the athlete switches the global range from "3m" to "1y"
- **WHEN** range-aware charts re-render
- **THEN** Best Efforts, VDOT Progression, Suffer Score weekly, and Weekly Heatmap update to the new window
- **AND** charts that are inherently fixed-window (e.g. Time in Zone 4w, Rest Calendar 8w) are NOT affected

### Scenario 39: Persistence

- **GIVEN** the athlete changed the global range during the session
- **WHEN** the athlete navigates away and comes back to Metrics in the same session
- **THEN** the last selected range is remembered (session storage)

---

## Requirement: Page sections and layout

The Metrics page MUST be organized in 7 collapsible sections with consistent visual language.

### Scenario 40: Sections render in order

- **GIVEN** the athlete opens `/athlete/metrics`
- **WHEN** the page loads
- **THEN** sections appear in the order: Resumen → Carga y forma → Intensidad → Técnica → Récords y progresión → Actividad detallada → Material

### Scenario 41: Collapsible behavior

- **GIVEN** the athlete taps a section header
- **WHEN** the chevron is clicked
- **THEN** that section expands / collapses with a smooth transition; collapsed state persists for the session

### Scenario 42: Default open state

- **GIVEN** the athlete loads the page for the first time in a session
- **WHEN** sections initialize
- **THEN** all sections are expanded by default

---

## Requirement: Performance

### Scenario 43: Initial page load

- **GIVEN** the athlete has 30 synced activities (average case)
- **WHEN** they open `/athlete/metrics`
- **THEN** the page is interactive in < 2.5 s on a mid-range laptop (Chrome DevTools profile)

### Scenario 44: Stream downsampling

- **GIVEN** a stream of > 3000 points is to be displayed
- **WHEN** the chart component prepares the dataset
- **THEN** the helper `downsampleStream` reduces it to at most 300 points before passing to Chart.js

### Scenario 45: Data caching

- **GIVEN** the athlete switches between sections rapidly
- **WHEN** charts are re-mounted with the same inputs (athleteId + range)
- **THEN** data is served from React Query cache (staleTime ≥ 60 s) instead of refetching from Supabase

---

## Requirement: Coach view parity

The coach view of an athlete's Metrics page MUST render the same sections and charts.

### Scenario 46: Coach opens athlete metrics

- **GIVEN** a coach navigates to an athlete's Metrics view (`isIndependent = false`, athleteId provided)
- **WHEN** the page renders
- **THEN** the same 7 sections and all charts are visible, scoped to that athlete's data
- **AND** the page respects RLS (coach can only see athletes in their `coach_athlete_relationship`)

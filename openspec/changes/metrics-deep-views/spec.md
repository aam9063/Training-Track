# Spec: metrics-deep-views

## Capability: Deep metrics & analytics views for athletes

Derived analytics on top of Strava deep ingestion data (streams, splits, laps, best efforts, zones, gear), surfaced in `Metrics.jsx` and a new `ActivityDetail.jsx` page.

---

## Requirement: Best efforts chart

The Metrics page MUST display an evolution chart of personal records derived from `strava_activities.best_efforts`.

### Scenario 1: Athlete with PRs for multiple distances

- **GIVEN** an athlete with 5 synced activities containing `best_efforts` entries for 1K, 5K and 10K
- **WHEN** they open `/athlete/metrics`
- **THEN** the Best Efforts chart shows 3 distinct lines (one per distance present), each point representing a PR attempt over time

### Scenario 2: Athlete with no best efforts

- **GIVEN** an athlete whose activities contain no `best_efforts` data (walking activities, short runs)
- **WHEN** they open `/athlete/metrics`
- **THEN** the Best Efforts chart area shows the empty state **"Aún no tienes récords personales"**

### Scenario 3: New PR beats old

- **GIVEN** the athlete's most recent activity contains a `best_effort` for 5K that is faster than any previous 5K effort
- **WHEN** the chart renders
- **THEN** the newest point is highlighted (marker + badge) and the time delta vs previous best is shown

### Scenario 4: Distance filter

- **GIVEN** the Best Efforts chart shows 1K, 5K, 10K, half, marathon lines
- **WHEN** the athlete toggles the distance filter to only "5K"
- **THEN** the chart updates to show only the 5K line

---

## Requirement: Time in zone chart

The Metrics page MUST display a stacked bar chart of % time spent in each HR zone over the last N weeks, computed from `strava_activity_streams.heartrate`.

### Scenario 5: Athlete with HR streams and zones

- **GIVEN** an athlete with HR streams for the last 4 weeks and custom zones in `athlete_hr_zones`
- **WHEN** they open `/athlete/metrics`
- **THEN** the Time in Zone chart shows 4 bars (one per week), each stacked by zone (Z1–Z5), using the athlete's custom zone boundaries

### Scenario 6: Athlete with no HR data

- **GIVEN** an athlete with no HR stream data in the last 4 weeks
- **WHEN** they open `/athlete/metrics`
- **THEN** the chart area shows the empty state **"Sin datos de pulsaciones"**

### Scenario 7: Custom zones from Strava

- **GIVEN** the athlete has `athlete_hr_zones` rows synced from Strava
- **WHEN** time-in-zone is computed
- **THEN** the athlete's custom zone thresholds are used for bucketing

### Scenario 8: No zones synced, fallback

- **GIVEN** the athlete has HR streams but no `athlete_hr_zones` rows
- **WHEN** the chart renders
- **THEN** estimated zones are used (based on max HR = 220 − age, or a default) AND a small warning badge "Usando zonas estimadas" is displayed near the chart title

---

## Requirement: Intensity distribution chart

The Metrics page MUST display an intensity distribution classified as polarized, pyramidal or threshold-heavy.

### Scenario 9: Polarized athlete

- **GIVEN** the athlete has 80% of time in Z1–Z2 and 20% in Z4–Z5 over 4 weeks
- **WHEN** the chart renders
- **THEN** the label reads **"Entrenamiento polarizado ✓"** with a positive accent

### Scenario 10: Pyramidal athlete

- **GIVEN** the athlete has 60% of time in Z3 (threshold range) with the rest split across other zones
- **WHEN** the chart renders
- **THEN** the label reads **"Entrenamiento piramidal (más en zona umbral)"**

### Scenario 11: Not enough data

- **GIVEN** the athlete has fewer than 4 weeks of HR stream data
- **WHEN** the chart area renders
- **THEN** it shows **"Se necesitan al menos 4 semanas de datos"** instead of a classification

---

## Requirement: Fitness / TSB evolution with suffer_score

The existing TSB evolution chart MUST use Strava `suffer_score` when available for more accurate CTL/ATL/TSB computation.

### Scenario 12: Athlete with suffer_score

- **GIVEN** an athlete with `suffer_score` populated on recent activities
- **WHEN** the TSB chart renders over a 6-month window
- **THEN** CTL/ATL are computed from `suffer_score` (not from volume-based estimates) and TSB = CTL − ATL is plotted

### Scenario 13: Sparse data gap-fill

- **GIVEN** an athlete with suffer_score rows on only some days of the window
- **WHEN** CTL/ATL is computed
- **THEN** missing days are filled with `0` load before applying the exponential moving average

---

## Requirement: Shoes widget

The Metrics page MUST display a shoes widget showing kilometrage per shoe and wear-level alerts.

### Scenario 14: Athlete with multiple shoes

- **GIVEN** the athlete has 3 shoes in `athlete_gear` with distances 200 km, 450 km, 120 km
- **WHEN** the widget renders
- **THEN** all 3 shoes are listed with a progress bar scaled to 800 km, showing their current distance

### Scenario 15: Shoe nearing end of life

- **GIVEN** a shoe with `distance_km = 650`
- **WHEN** the widget renders
- **THEN** the shoe shows a yellow warning badge **"Considera renovar (vida útil ~800 km)"**

### Scenario 16: Shoe beyond life

- **GIVEN** a shoe with `distance_km = 900`
- **WHEN** the widget renders
- **THEN** the shoe shows a red alert **"Sustituir ya"**

### Scenario 17: No shoes synced

- **GIVEN** the athlete has no rows in `athlete_gear`
- **WHEN** the widget renders
- **THEN** it shows **"Conecta Strava para ver tus zapatillas"** (or if Strava is connected but no gear, shows a generic "Sin zapatillas registradas")

---

## Requirement: Activity detail view

The app MUST expose a per-activity detail view with stream-based analysis.

### Scenario 18: Navigation from card

- **GIVEN** the athlete is on the dashboard or Metrics page and sees an activity card
- **WHEN** they click on it
- **THEN** the app navigates to `/athlete/activity/:activityId` (or `/dashboard/athletes/:athleteId/activities/:activityId` for coach view)

### Scenario 19: HR + pace over time

- **GIVEN** the activity has `strava_activity_streams` with `heartrate` and `velocity_smooth`
- **WHEN** the detail page renders
- **THEN** a dual-axis chart shows HR (bpm) and pace (min/km) over time, with shared x-axis (seconds or distance)

### Scenario 20: Splits per km with zone coloring

- **GIVEN** the activity has `strava_activity_splits` rows
- **WHEN** the detail page renders
- **THEN** a splits table shows each split's distance, pace and avg HR, with the HR cell background color-coded by zone (Z1 green → Z5 red)

### Scenario 21: Laps table

- **GIVEN** the activity has `strava_activity_laps` rows
- **WHEN** the detail page renders
- **THEN** a laps table shows each lap's distance, duration, avg pace, avg HR, elevation gain

### Scenario 22: Cardiac drift

- **GIVEN** the activity has HR + pace streams with duration ≥ 30 min
- **WHEN** the detail page renders
- **THEN** the cardiac drift widget shows the Pa:HR decoupling %: < 5% → "Buena eficiencia aeróbica", 5–10% → "Eficiencia media", > 10% → "Fatiga o deshidratación posible"

### Scenario 23: Activity with no streams

- **GIVEN** the activity has no `strava_activity_streams` rows (manual activity, old sync)
- **WHEN** the detail page renders
- **THEN** the stream-dependent sections show **"Análisis detallado no disponible"** and only basic metadata (distance, duration, date) is shown

---

## Requirement: Performance

### Scenario 24: Metrics page load time

- **GIVEN** an athlete with streams for 20 recent activities
- **WHEN** they open `/athlete/metrics`
- **THEN** the page becomes interactive in < 2s on a mid-range laptop (measured with Chrome DevTools performance profile)

### Scenario 25: Stream downsampling

- **GIVEN** an activity stream with > 3600 sample points
- **WHEN** it is rendered in a chart
- **THEN** the service downsamples to ~500 points (LTTB or simple decimation) before passing to Chart.js

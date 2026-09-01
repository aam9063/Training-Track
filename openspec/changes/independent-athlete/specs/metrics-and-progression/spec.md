# Metrics & Progression Specification

## Purpose

Define internal progression metrics, Strava data integration, and personal bests tracking for independent athletes at `/athlete/metrics`.

## Requirements

### Requirement: Weekly Km Progression Chart

The metrics page MUST display a chart showing total weekly kilometers over the last 8 weeks. Data sources: `training_sessions.actual_distance_km` (manual) and `strava_activities` (if connected). The system MUST NOT double-count sessions that have both Strava and manual data.

#### Scenario: Weekly km chart with mixed data

- GIVEN an independent athlete with 4 weeks of manual completions and 4 weeks of Strava data
- WHEN they view the metrics page
- THEN a line/bar chart shows 8 weeks of weekly km totals
- AND Strava-linked sessions use Strava distance, not manual

#### Scenario: No data available

- GIVEN an independent athlete with no completed sessions
- WHEN they view the metrics page
- THEN the chart area shows an empty state: "Completa tus entrenamientos para ver tus metricas"

### Requirement: RPE Trend

The metrics page MUST show average RPE per week over the last 8 weeks as a line chart. This helps athletes track perceived effort trends.

#### Scenario: RPE trend display

- GIVEN 6 weeks of sessions with RPE data
- WHEN the athlete views RPE trend
- THEN a line chart shows weekly average RPE values

### Requirement: Pace Trend

For athletes with Strava connected, the metrics page SHOULD show average pace trend (min/km) per week. For manual-only athletes, pace SHOULD be derived from `actual_distance_km / actual_time_minutes` when both are available.

#### Scenario: Pace from Strava data

- GIVEN a Strava-connected athlete with 4 weeks of running activities
- WHEN they view pace trend
- THEN average weekly pace (min/km) is charted from Strava data

### Requirement: Personal Bests

The metrics page MUST display personal best times for standard distances (5K, 10K, Media Maraton, Maraton). Data sources: Strava activities and competition results (`competitions.actual_time_minutes`). Each PB MUST show the date it was achieved.

#### Scenario: PB from Strava activity

- GIVEN a Strava activity of type "Run" with distance 10.2km in 48 min
- WHEN the system evaluates PBs
- THEN the 10K PB is updated to 48 min if it is faster than the existing PB

#### Scenario: PB from competition result

- GIVEN a competition with distance=21.1km and actual_time=95 min
- WHEN the system evaluates PBs
- THEN the Media Maraton PB is set to 95 min (1h 35m)

### Requirement: Completion Rate

The metrics page MUST show a completion rate percentage: `(completed sessions / total planned sessions) * 100` for the current plan cycle. This SHOULD be displayed as a progress ring or percentage badge.

#### Scenario: Completion rate calculation

- GIVEN 12 planned sessions in the current 4-week plan and 9 completed
- WHEN the athlete views the completion rate
- THEN it displays "75%" with a visual indicator

### Requirement: Strava Deduplication

When both Strava data and manual completion exist for a session, the system MUST prefer Strava data for distance and time. Manual RPE and notes MUST be preserved regardless of Strava data.

#### Scenario: Strava overrides manual distance

- GIVEN a session manually completed with 10km, then Strava syncs 10.3km
- WHEN metrics are computed
- THEN the system uses 10.3km from Strava for distance calculations
- AND the manually entered RPE is still used for RPE metrics

# Exploration — strava-deep-ingestion

## Current state

### `strava-webhook` edge function
File: `supabase/functions/strava-webhook/index.ts`
- GET handler validates `hub.verify_token` against `STRAVA_WEBHOOK_VERIFY_TOKEN` (line 230-243).
- POST handler reads `aspect_type`, `object_type`, `object_id`, `owner_id`; only `object_type === "activity" && aspect_type === "create"` is processed (line 250-253). `update`, `delete`, and athlete `deauthorization` events are silently ACKed.
- `processNewActivity` (line 128): resolves athlete via `devices.strava_athlete_id = owner_id` + `device_type = "strava"` (line 132-137). Refreshes token (line 146). Fetches `GET /activities/{id}` full detail, then `mapActivityToRow` (line 26-53) upserts into `strava_activities`.
- Correlation algorithm (line 169-184): maps Strava `activity.type` → `training_type` enum via `mapStravaType` (running/gym/cross_training). Matches ONE `training_sessions` row by `athlete_id` + `scheduled_date = activity.start_date_local.split('T')[0]` + `training_type` + `status='planned'` + `strava_activity_id IS NULL`. Sets status='completed', `actual_duration_minutes`, `actual_distance_km`, `strava_activity_id` (line 194-203). Sends push (line 215-222).

### `strava_activities` schema (inferred — no migration in repo)
`supabase/migrations/` contains only `20260410090000_plan_selection_required*.sql` — no Strava migrations. Schema must be manually deployed. Columns used (from `mapActivityToRow` + `stravaCacheService.js`): `id`, `athlete_id`, `strava_id`, `name`, `sport_type`, `type`, `start_date`, `start_date_local`, `distance`, `moving_time`, `elapsed_time`, `total_elevation_gain`, `average_speed`, `max_speed`, `average_heartrate`, `max_heartrate`, `average_cadence`, `calories`, `suffer_score`, `has_heartrate`, `map_summary_polyline`, `kudos_count`, `achievement_count`, `best_efforts` (jsonb), `has_details` (bool). Unique: `(athlete_id, strava_id)`.

### Token exchange + backfill
No `strava-token-exchange/` folder in repo (referenced by frontend `stravaService.js:81` but deployed remotely only). Backfill happens from the FRONTEND (`stravaSyncService.js:57 fullHistoricalSync`), triggered manually from `src/pages/athlete/Devices.jsx:120` after OAuth. NOT automatic on connect.

### Frontend sync service — `src/services/stravaSyncService.js`
- `incrementalSync` (l.18): called by `useStravaMetrics.js:42` and `useStravaActivities.js:46` on hook load. Fetches activities after latest cached `start_date_local`.
- `fullHistoricalSync` (l.57): called from `Devices.jsx:120`, paginated 200/page, sleeps 15min every 180 pages.
- `syncActivityDetails` (l.93): only called from `Devices.jsx:128`. Fetches activity detail to populate `best_efforts` → writes `syncPersonalBests`, `updateAthleteVdot`, `persistRacePredictions`.
- All frontend calls hit Strava API directly with user's access token (not via edge function). Coaches use `strava-proxy` edge function for other athletes' data.

### UI consumers of `strava_activities`
- `useStravaMetrics.js` → `Metrics.jsx` (athlete): charts (ActivityTypeDistribution, weekly volume, pace trend, HR distribution), `TrainingZonesCard`, ACWR/PMC.
- `useStravaActivities.js` → `Dashboard.jsx` (athlete).
- `useCoachStravaData.js` → `AthleteMetricsView.jsx` (coach).
- `aiReportService.js:187` feeds DeepSeek prompts. `reportPdfExport.js`, `dataExport.js` export.

### HR zones handling
`generateHrZones(maxHR)` in `src/lib/trainingMetrics.js:422` computes 5 zones from % of max HR. `max_heart_rate` comes from `athletes.max_heart_rate`, which is UPDATED from `observedMaxHR` in `useStravaMetrics.js:108-117` (max `max_heartrate` across last 500 cached activities). NEVER fetched from Strava `/athlete/zones`. Fallback: user-entered in `AthleteProfile.jsx:1038` or Conconi test (`conconiService.js`).

### Gear / shoes
Zero matches for `gear_id`, `/gear/`, `strava.*gear` in `src/` or `supabase/functions/`. Feature does not exist.

### Streams / splits / laps
Not fetched. Not stored. Only `best_efforts` jsonb is persisted.

## Gaps identified

- `strava-webhook/index.ts:250-253` ignores `update`, `delete`, and `deauthorize` events — stale data and orphan tokens.
- No `strava_activity_streams` table — no HR/velocity/altitude time-series for drift/GAP/zone-time charts.
- `strava_activities` lacks `splits_metric`, `laps`, `gear_id`, `has_streams` columns.
- No `athlete_hr_zones` table — zones guessed via % maxHR rather than Strava `/athlete/zones`.
- No `gear` / `athlete_shoes` table for kilometrage tracking.
- `mapActivityToRow` (webhook + cache) discards `splits_metric`, `laps`, `gear_id`, `pr_count`, `device_name`, `workout_type`, `description`, `photo_count`.
- Correlation (webhook l.173-184) matches ONLY on same local date + type — misses midnight-crossing activities and multi-session days.

## Touchpoints for this change

| Component | Action |
|-----------|--------|
| `supabase/functions/strava-webhook/index.ts` | Handle `update`/`delete`/`deauthorize`; enqueue stream fetch |
| `supabase/migrations/` (NEW) | Create `strava_activity_streams`, `athlete_hr_zones`, `athlete_gear`; add columns to `strava_activities` |
| `src/services/stravaSyncService.js` | Add `syncStreams`, `syncAthleteZones`, `syncGear` |
| `src/services/stravaCacheService.js` | Extend `mapActivityToRow` + new stream/gear helpers |
| `src/services/stravaService.js` | Add `/activities/{id}/streams`, `/athlete/zones`, `/gear/{id}` wrappers |
| `src/components/athlete/` (NEW) | `ActivityDetailView`, `HRDriftChart`, `ZoneTimeBar`, `ShoeKilometrage` |
| `src/pages/athlete/Metrics.jsx` | New charts (time-in-zone, PRs timeline) |
| `src/lib/trainingMetrics.js` | Prefer stored `athlete_hr_zones` over `generateHrZones` |
| `supabase/functions/strava-proxy/index.ts` | Whitelist `streams`, `zones`, `gear` endpoints |

## Open questions for the user

1. Streams can be 5-10 MB/activity — store full jsonb, downsampled (e.g. 1 point/sec), or in Storage as blob?
2. Backfill streams for all historical activities, or only new activities post-release?
3. Rate budget: 100/15min shared app-wide — hard-cap streams fetch per athlete per sync?
4. Shoe tracking scope: active shoes only, or full history incl. retired?
5. Handle `deauthorize` by deleting `devices` row + preserving `strava_activities` cache, or cascade-delete everything?

## Recommended next phase

`sdd-propose`

# Proposal — strava-deep-ingestion

## Why

The current Strava integration is summary-only. The `strava-webhook` edge function reacts **only to `activity:create`** events (see `supabase/functions/strava-webhook/index.ts:250-253`), and `mapActivityToRow` persists roughly 20% of the payload Strava returns: distance, moving time, average HR, average speed, total elevation gain, `best_efforts`. Everything else (`splits_metric`, `laps`, `gear_id`, `device_name`, `suffer_score`, `weighted_average_watts`, `workout_type`) is discarded.

This blocks the entire "deep analysis" roadmap of a running-focused platform:

- **Cardiac drift** (HR rises at constant pace) — requires per-second `heartrate` + `velocity_smooth` streams.
- **GAP (Grade Adjusted Pace)** — requires `altitude` + `grade_smooth` streams.
- **Time in HR zones** — requires `heartrate` stream AND the athlete's actual Strava zones (we currently *guess* zones from max HR in `src/lib/trainingMetrics.js:422`).
- **Splits / laps view** — already in the Strava response, we just throw them away.
- **PRs timeline** — `best_efforts` is persisted but underused because we never refresh on `update`.
- **Shoe kilometrage** — `gear_id` is discarded; no `athlete_gear` table exists.

Additionally, missing webhook events cause data corruption:

- `activity:update` ignored → user edits workout title/HR/distance on Strava, we never see it.
- `activity:delete` ignored → deleted activities remain "completed" in our UI forever; linked `training_sessions` stay marked done.
- `athlete:deauthorize` ignored → stale OAuth tokens remain in `devices`, webhook keeps trying to refresh, user thinks they disconnected.

This change ships **ingestion infrastructure only**. Deep-analysis UI (charts, cards, activity detail view) is deferred to a follow-up change (`metrics-deep-views`, to be created later) so this one stays focused and ship-safe.

## What changes

### New database objects

- **`strava_activity_streams`** table — time-series arrays (HR, velocity, altitude, grade, cadence, temperature, moving) keyed by `activity_id`. One row per activity, lazy-populated.
- **`athlete_hr_zones`** table — authoritative HR zones synced from Strava `/athlete/zones`, refreshed every 30 days. Fallback flag for athletes who haven't set custom zones.
- **`athlete_gear`** table — shoes and other gear, with rolling kilometrage.

### Extend `strava_activities`

Add columns: `splits_metric` (jsonb), `laps` (jsonb), `suffer_score` (int), `weighted_average_watts` (numeric), `workout_type` (int), `gear_id` (text), `device_name` (text), `has_streams` (bool), `deleted` (bool), `deleted_at` (timestamptz). (`best_efforts` already exists — see exploration.)

### Edge function changes

- **Extend `strava-webhook`**: handle `activity:update`, `activity:delete`, and `athlete:deauthorize` aspect types.
- **New `strava-fetch-streams`**: on-demand fetch of `/activities/{id}/streams` with key-list, caches into `strava_activity_streams`, flips `has_streams=true`. Called lazily from the frontend when an activity detail view opens for the first time.
- **Optional `strava-backfill`**: enqueues last 90 days of activities on first connect, throttled 1 req/s, respecting 80% of rate-limit headers.

### Frontend service layer

- `stravaSyncService.js`: add `fetchStreamsForActivity(activityId)`, `syncHrZones()`, `handleDeauthorize()`.
- New `stravaGearService.js`: CRUD-lite for shoes, updates kilometrage from activities.
- No UI changes in this change.

## Affected modules

| Module | Action |
|--------|--------|
| `supabase/functions/strava-webhook/index.ts` | Extend switch: update/delete/deauth |
| `supabase/functions/strava-fetch-streams/index.ts` | NEW |
| `supabase/functions/strava-backfill/index.ts` | NEW (optional) |
| `supabase/migrations/20260414_strava_deep_ingestion.sql` | NEW |
| `src/services/stravaSyncService.js` | Add stream + zones + deauth helpers |
| `src/services/stravaCacheService.js` | Extend `mapActivityToRow` with new columns |
| `src/services/stravaService.js` | Wrappers for `/streams`, `/zones`, `/gear/{id}` |
| `src/services/athleteDeviceService.js` | Optional: expose "disconnect" to mirror deauth |
| `supabase/functions/strava-proxy/index.ts` | Whitelist `streams`, `zones`, `gear` endpoints |

## RLS implications

All three new tables are per-athlete and carry sensitive physiological data. Policies:

- **`SELECT` own rows**: `athlete_id = (select auth.uid())`
- **`SELECT` by coach**: `EXISTS` on `coach_athlete_relationship` with `status='active'` and `coach_id = (select auth.uid())`
- **`ALL` for service_role**: webhook + edge functions write via service-role client.

Uses `(select auth.uid())` subquery pattern (per CLAUDE.md global rule) to let Postgres cache the auth call per query.

## Rollback plan

1. Drop new edge functions (`strava-fetch-streams`, `strava-backfill`) from Supabase.
2. Revert `strava-webhook/index.ts` to previous commit (handles `create` only).
3. Run **down migration** (see `design.md`) which:
   - DROPs `strava_activity_streams`, `athlete_hr_zones`, `athlete_gear`.
   - DROPs new columns from `strava_activities`.
4. Frontend changes are additive — revert `stravaSyncService.js`, `stravaCacheService.js` if deployed.
5. Data loss on rollback is limited to streams/zones/gear (re-fetchable from Strava).

## Risks

1. **Storage growth**: streams are 5–50 KB compressed JSON per activity. Back-of-envelope: 1000 athletes × 10 activities/week × 50 KB ≈ 500 MB/week. **Mitigation**: int[]/numeric[] arrays (Postgres TOAST-compresses by default), lazy fetch, prune streams for activities older than 2 years via cron.
2. **Rate limit during backfill**: Strava API is 100 req / 15 min / app-wide (shared). **Mitigation**: token-bucket at 1 req/s, read `X-RateLimit-Usage` / `X-RateLimit-Limit` response headers, stop at 80% saturation, resume after window reset.
3. **Webhook out-of-order events**: Strava does NOT guarantee ordering. A `delete` can land before the `create` it refers to. **Mitigation**: compare `event_time` to `strava_activities.updated_at`; discard if stale.
4. **Deauthorize semantics**: we must clear tokens but preserve historical activities (user may reconnect). **Mitigation**: null out `access_token`/`refresh_token` in `devices` but keep the row; mark activities with `detached=true` (see spec) without deletion.
5. **Strava API breaking changes**: low probability but non-zero. **Mitigation**: version responses via `has_streams` flag; re-fetch on demand if schema changes.
6. **Streams for non-GPS activities**: treadmill / manual entries have no streams. **Mitigation**: 404 → set `has_streams=false` permanently, skip retry.

## Success criteria

- New activity posted to Strava → within 10 s, `strava_activities` row has `has_streams=false`, webhook ACKed, `training_session` auto-correlated (unchanged behavior).
- Opening an activity detail view for the first time → `strava-fetch-streams` invoked → streams cached → subsequent opens < 500 ms.
- Athlete connects Strava → `/athlete/zones` synced within 5 s → `athlete_hr_zones` row exists.
- Athlete deauthorizes on Strava → webhook receives event → tokens cleared within 10 s → UI on next load shows "disconnected".
- Coach opens athlete's metrics → can read athlete's streams/zones/gear via RLS.
- Athlete A CANNOT read athlete B's streams (RLS verified by SQL test).

## Open questions (inherited from exploration — need decisions before `sdd-apply`)

These were flagged in `explore.md` and are carried forward:

1. **Stream storage density**: full resolution (1 sample/sec) vs. downsampled to 1 sample per 5 s? Current proposal: full resolution via int[]/numeric[] arrays. Decision needed if storage growth exceeds budget.
2. **Backfill scope**: streams for all historical activities or only new ones? Current proposal: 90 days on connect, lazy fetch beyond.
3. **Rate budget split**: hard cap per athlete per sync? Current proposal: 1 req/s global token-bucket shared across all backfills.
4. **Gear retention**: active only or full history? Current proposal: keep history, use `active` flag.
5. **Deauth data policy**: cascade-delete vs. preserve activities? Current proposal: preserve + mark detached.

## Next phase

`sdd-spec` and `sdd-design` in parallel, then `sdd-tasks`.

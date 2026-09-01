# Spec — strava-deep-ingestion

Scenarios use **RFC 2119** terms (MUST, SHOULD, MAY, MUST NOT). Given/When/Then format.

---

## Capability 1 — Webhook event handling

### Requirement 1.1 — Activity create (existing behavior preserved)

**Given** the Strava webhook receives `{object_type: "activity", aspect_type: "create", object_id: A, owner_id: O}`
**And** a row in `devices` exists WHERE `strava_athlete_id = O` AND `device_type = 'strava'`
**When** the webhook handler runs
**Then** it MUST fetch `GET /activities/{A}` with the athlete's refreshed token
**And** UPSERT the result into `strava_activities` (keyed by `(athlete_id, strava_id)`)
**And** set `has_streams = false`
**And** attempt correlation with a `training_sessions` row per existing algorithm (unchanged)
**And** ACK the webhook with 200 within 2 s (Strava's timeout).

### Requirement 1.2 — Activity update

**Given** the webhook receives `{object_type: "activity", aspect_type: "update", object_id: A, owner_id: O, event_time: T}`
**And** a row in `strava_activities` exists for that activity
**When** the handler runs
**Then** it MUST compare `T` to `strava_activities.updated_at`
**And** if `T <= updated_at` the handler MUST ignore the event (stale)
**And** otherwise it MUST fetch fresh `GET /activities/{A}`
**And** UPSERT preserving existing `has_streams` and `strava_activity_id` linkage in `training_sessions`
**And** update `updated_at = T`.

### Requirement 1.3 — Activity delete

**Given** the webhook receives `{aspect_type: "delete", object_id: A, owner_id: O}`
**When** the handler runs
**Then** it MUST set `strava_activities.deleted = true`, `deleted_at = now()` for that row
**And** it MUST set `training_sessions.strava_activity_id = NULL` WHERE `strava_activity_id = strava_activities.id`
**And** it MUST NOT hard-delete the row (preserves training session history and audit trail)
**And** the athlete's activity list queries MUST filter `deleted = false`.

### Requirement 1.4 — Athlete deauthorize

**Given** the webhook receives `{object_type: "athlete", aspect_type: "update", updates: {authorized: "false"}, owner_id: O}`
**When** the handler runs
**Then** it MUST set `access_token = NULL`, `refresh_token = NULL`, `expires_at = NULL` in `devices` WHERE `strava_athlete_id = O`
**And** it MUST NOT delete the `devices` row (user may reconnect)
**And** it SHOULD log the deauth event for audit
**And** subsequent calls from that athlete's frontend MUST surface a "Strava desconectado" state.

### Requirement 1.5 — Stale webhook event

**Given** a webhook event with `event_time = T_old`
**And** `T_old < strava_activities.updated_at` for that activity
**When** the handler processes it
**Then** it MUST ignore the event
**And** it MUST still ACK with HTTP 200 (Strava expects ACK regardless).

---

## Capability 2 — Stream fetching

### Requirement 2.1 — First open triggers fetch

**Given** the athlete opens an activity detail view
**And** `strava_activities.has_streams = false` for that activity
**When** the frontend mounts the view
**Then** it MUST invoke `strava-fetch-streams` with `{activity_id, athlete_id}`
**And** the edge function MUST call `GET /activities/{id}/streams` with `keys=time,distance,heartrate,cadence,velocity_smooth,altitude,grade_smooth,temp,moving&key_by_type=true`
**And** it MUST INSERT the result into `strava_activity_streams`
**And** it MUST UPDATE `strava_activities.has_streams = true`.

### Requirement 2.2 — Cached streams short-circuit

**Given** `strava_activities.has_streams = true`
**When** the athlete opens the activity detail view
**Then** the frontend MUST read streams from `strava_activity_streams` directly
**And** it MUST NOT call `strava-fetch-streams`
**And** the query SHOULD return in under 500 ms.

### Requirement 2.3 — Stream fetch failure

**Given** Strava `/streams` returns HTTP 5xx or a network error
**When** `strava-fetch-streams` handles it
**Then** it MUST NOT update `has_streams`
**And** it MUST return `{error: "fetch_failed"}` to the caller
**And** the frontend SHOULD display "No disponible" and MAY retry on next open.

### Requirement 2.4 — Activity has no streams

**Given** Strava `/streams` returns HTTP 404 (typical for manual entries / treadmill)
**When** `strava-fetch-streams` handles it
**Then** it MUST set `strava_activities.has_streams = false`
**And** it MUST also set a sentinel (e.g. insert a row with empty arrays and `source='none'`) so future calls short-circuit
**And** it MUST return `{error: "no_streams"}`.

### Requirement 2.5 — Stream payload size cap

**Given** a stream payload fetched from Strava
**When** stored in `strava_activity_streams`
**Then** the compressed row size MUST NOT exceed 500 KB
**And** if it does, the edge function MUST downsample to 1 sample per 5 s before storing.

---

## Capability 3 — HR zones sync

### Requirement 3.1 — Zones sync on connect

**Given** the athlete completes Strava OAuth via `strava-token-exchange`
**When** the frontend post-connect hook runs
**Then** it MUST call `syncHrZones()`
**And** that MUST call `GET /athlete/zones`
**And** UPSERT into `athlete_hr_zones` with `custom_zones`, `sensor_based`, `fetched_at = now()`
**And** the operation MUST complete within 5 s of OAuth return.

### Requirement 3.2 — Monthly zones refresh

**Given** `athlete_hr_zones.fetched_at < now() - interval '30 days'`
**When** the athlete opens any page that uses HR zones (athlete dashboard, metrics)
**Then** `syncHrZones()` SHOULD be invoked in the background (non-blocking)
**And** on success, `fetched_at` MUST be updated.

### Requirement 3.3 — Athlete without custom zones

**Given** Strava `/athlete/zones` returns HTTP 404 or an empty zones array
**When** `syncHrZones()` handles it
**Then** it MUST fall back to the computed zones from `generateHrZones(maxHR)` in `src/lib/trainingMetrics.js`
**And** it MUST store them with `custom_zones = false` and `source = 'estimated'`
**And** the UI MUST display an "estimated zones" indicator.

---

## Capability 4 — Gear (shoes)

### Requirement 4.1 — Record gear from activity

**Given** an activity has `gear_id = G`
**And** no row exists in `athlete_gear` WHERE `id = G`
**When** the webhook or streams handler processes it
**Then** it MUST fetch `GET /gear/{G}`
**And** INSERT `athlete_gear` with `id = G`, `athlete_id`, `name`, `brand_name`, `model_name`, `distance_meters`, `primary_gear`, `active = true`, `last_synced_at = now()`.

### Requirement 4.2 — Refresh gear kilometrage

**Given** a row in `athlete_gear` exists for gear `G`
**And** `last_synced_at < now() - interval '7 days'`
**When** the next activity for that athlete references gear `G`
**Then** the handler MUST re-fetch `GET /gear/{G}` and UPDATE `distance_meters` and `last_synced_at`.

### Requirement 4.3 — Gear deleted on Strava

**Given** a re-fetch of `/gear/{G}` returns HTTP 404
**When** the handler processes it
**Then** it MUST set `athlete_gear.active = false`
**And** it MUST NOT delete the row (preserves historical attribution).

---

## Capability 5 — Backfill

### Requirement 5.1 — Initial 90-day backfill

**Given** an athlete connects Strava for the first time (no prior row in `strava_activities` for that athlete)
**When** `strava-token-exchange` succeeds
**Then** the system MUST enqueue a backfill of activities with `start_date >= now() - interval '90 days'`
**And** each activity MUST be fetched via `GET /activities/{id}` (not list endpoint — need full detail)
**And** streams MUST NOT be backfilled (lazy only).

### Requirement 5.2 — Rate-limit throttle

**Given** a backfill job is running
**When** making requests to Strava
**Then** the function MUST NOT exceed 1 request/second
**And** it MUST read `X-RateLimit-Usage` and `X-RateLimit-Limit` headers after each call
**And** if usage exceeds 80% of the 15-minute limit, it MUST sleep until window reset.

### Requirement 5.3 — Interrupted backfill

**Given** a backfill is in progress
**And** tokens are revoked mid-run (401 response)
**When** the function detects the 401
**Then** it MUST pause the backfill and persist state (queue remainder OR mark job as `paused`)
**And** on next successful token refresh, it MUST resume from the last processed activity.

---

## Capability 6 — Row-Level Security

### Requirement 6.1 — Athlete isolation on streams

**Given** athlete A is authenticated with JWT
**When** athlete A runs `SELECT * FROM strava_activity_streams WHERE athlete_id = B`
**Then** the query MUST return zero rows (RLS blocks).

### Requirement 6.2 — Coach read access

**Given** coach C and athlete A have `coach_athlete_relationship` with `status = 'active'`
**And** athlete A has streams in `strava_activity_streams`
**When** coach C runs `SELECT * FROM strava_activity_streams WHERE athlete_id = A`
**Then** the query MUST return A's stream rows.

### Requirement 6.3 — Coach without relationship blocked

**Given** coach C and athlete A have NO `coach_athlete_relationship` OR its status is `'inactive'`
**When** coach C queries A's streams
**Then** the query MUST return zero rows.

### Requirement 6.4 — Service role full access

**Given** the webhook or edge function uses service_role key
**When** it INSERTs or UPDATEs any of `strava_activity_streams`, `athlete_hr_zones`, `athlete_gear`
**Then** the operation MUST succeed regardless of `auth.uid()`.

### Requirement 6.5 — Equivalent RLS on zones and gear

**Given** the `athlete_hr_zones` and `athlete_gear` tables
**Then** they MUST enforce the same three policies as `strava_activity_streams` (own-SELECT, coach-SELECT-via-relationship, service_role-ALL).

---

## Capability 7 — Performance

### Requirement 7.1 — Cached stream read latency

**Given** `has_streams = true`
**When** the frontend fetches `strava_activity_streams` by `activity_id`
**Then** the round-trip (Supabase client → PostgREST → Postgres → client) MUST complete in under 500 ms at p95.

### Requirement 7.2 — Stream row size bound

**Given** any row in `strava_activity_streams`
**Then** the serialized row size MUST NOT exceed 500 KB
**And** the migration MUST NOT create GIN/GiST indexes on the stream arrays (cost prohibitive).

### Requirement 7.3 — Webhook ACK latency

**Given** any inbound webhook POST
**When** the handler runs
**Then** it MUST ACK with HTTP 200 within 2 seconds
**And** heavy work (stream fetch, correlation) MAY be deferred to async background tasks.

---

## Out of scope (explicit)

- UI components (activity detail view, HR drift chart, zone time bar, shoe card) — deferred to `metrics-deep-views`.
- Changing the training-session correlation algorithm — tracked separately.
- Pruning streams older than 2 years — tracked as a follow-up cron job.
- Webhook event replay / dead-letter queue — out of scope unless reliability testing shows need.

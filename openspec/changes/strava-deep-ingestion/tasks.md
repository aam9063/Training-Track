# Tasks — strava-deep-ingestion

Grouped by phase. Each task carries: **files**, **acceptance criteria**, **depends on**, **risk**.

Legend: `[ ]` pending · `[x]` done · Risk: L / M / H

---

## Phase 1 — Database migration

### 1.1 [ ] Write migration SQL (up + down)
- **Files**:
  - `supabase/migrations/20260414090000_strava_deep_ingestion.sql` (UP)
  - `supabase/migrations/20260414090000_strava_deep_ingestion_down.sql` (DOWN)
- **Acceptance**:
  - Mirrors the SQL in `design.md` verbatim.
  - All `ALTER TABLE` uses `ADD COLUMN IF NOT EXISTS`.
  - All `CREATE TABLE` uses `IF NOT EXISTS`.
  - Every policy uses `(select auth.uid())` not `auth.uid()` (per CLAUDE.md rule).
  - Down SQL drops tables in reverse FK order.
- **Depends on**: none
- **Risk**: L

### 1.2 [ ] Apply migration to Supabase dev
- **Files**: n/a (executed via MCP `apply_migration`)
- **Acceptance**:
  - `SELECT column_name FROM information_schema.columns WHERE table_name='strava_activities'` includes `has_streams`, `splits_metric`, `laps`, `deleted`, `updated_at`, etc.
  - `\d strava_activity_streams` shows all typed array columns.
  - RLS enabled on all three new tables (`SELECT relrowsecurity FROM pg_class WHERE relname='strava_activity_streams'` returns `t`).
  - Three policies listed on each new table via `pg_policies`.
  - No advisor warnings from `get_advisors`.
- **Depends on**: 1.1
- **Risk**: M — production data exists; any migration error blocks webhook.

### 1.3 [ ] Verify RLS with test queries
- **Files**: `supabase/tests/strava-rls.sql` (NEW, optional) or inline in MCP session
- **Acceptance**:
  - As athlete A JWT: `SELECT FROM strava_activity_streams WHERE athlete_id != auth.uid()` returns 0 rows.
  - As coach JWT with active relationship: returns athlete's rows.
  - As coach JWT without relationship: returns 0 rows.
  - As service_role: returns all rows.
  - Same checks for `athlete_hr_zones` and `athlete_gear`.
- **Depends on**: 1.2
- **Risk**: M — RLS misconfig = data leak.

---

## Phase 2 — Edge functions

### 2.1 [ ] Extend `strava-webhook` for update/delete/deauth
- **Files**: `supabase/functions/strava-webhook/index.ts`
- **Acceptance**:
  - Dispatcher implemented via `switch(\`${object_type}:${aspect_type}\`)` per design.
  - `processActivityUpdate` compares `event_time <= updated_at` and ignores stale events.
  - `processActivityDelete` sets `deleted=true`, `deleted_at=now()`, nulls `training_sessions.strava_activity_id`.
  - `processDeauthorize` clears `access_token`, `refresh_token`, `expires_at` in `devices`.
  - Unknown `object_type:aspect_type` combinations still ACK 200.
  - Existing `processNewActivity` unchanged in behavior.
  - Structured log lines emitted per `design.md` observability list.
- **Depends on**: 1.2
- **Risk**: H — regressions break live webhook.

### 2.2 [ ] Create `strava-fetch-streams` edge function
- **Files**: `supabase/functions/strava-fetch-streams/index.ts` (NEW), `supabase/functions/strava-fetch-streams/deno.json`
- **Acceptance**:
  - Accepts POST `{activity_id: number, athlete_id: string}`.
  - Service-role OR athlete JWT (matching `athlete_id`) can invoke.
  - Early-returns `{ok:true, cached:true}` if `has_streams=true`.
  - Refreshes athlete token if expired.
  - Calls `/activities/{id}/streams?keys=...&key_by_type=true`.
  - Downsamples to 1/5s when any array > 3600 samples.
  - UPSERTs `strava_activity_streams`; UPDATEs `strava_activities.has_streams=true`.
  - 404 → sentinel row with `source='none'`, returns `{ok:false, reason:'no_streams'}`.
  - 429 → returns `{ok:false, reason:'rate_limited', retry_after}`.
  - Row size check: rejects if serialized > 500 KB after downsampling (unlikely but assert).
- **Depends on**: 1.2
- **Risk**: M — new function, rate-limit handling non-trivial.

### 2.3 [ ] End-to-end event tests
- **Files**: manual test script `scripts/test-strava-webhook.sh` (optional)
- **Acceptance**:
  - Post simulated `activity:create` → row appears with `has_streams=false`.
  - Post simulated `activity:update` with newer `event_time` → row updated.
  - Post simulated `activity:update` with older `event_time` → row NOT updated; log shows `stale_event`.
  - Post `activity:delete` → `deleted=true` and linked `training_session.strava_activity_id` nulled.
  - Post `athlete:update` with `updates.authorized=false` → tokens null in `devices`.
  - Call `strava-fetch-streams` with cached activity → `{cached:true}`.
  - Call with uncached activity → row inserted into streams table.
- **Depends on**: 2.1, 2.2
- **Risk**: L

### 2.4 [ ] (Optional) Create `strava-backfill` edge function
- **Files**: `supabase/functions/strava-backfill/index.ts` (NEW)
- **Acceptance**:
  - Accepts `{athlete_id, since_days?}`.
  - Lists activities in window, detail-fetches missing.
  - Throttles to 1 req/s via `await sleep(1000)`.
  - Reads `X-RateLimit-Usage` / `X-RateLimit-Limit`; sleeps until window reset at 80% saturation.
  - On 401, pauses and logs.
  - Idempotent: running twice produces no duplicate rows.
- **Depends on**: 2.1
- **Risk**: M — can be deferred to follow-up change if time is tight.

---

## Phase 3 — Frontend service layer

### 3.1 [ ] Add `fetchStreamsForActivity` to `stravaSyncService.js`
- **Files**: `src/services/stravaSyncService.js`
- **Acceptance**:
  - Exported function `fetchStreamsForActivity(activityId: number): Promise<{ok:boolean; cached?:boolean; reason?:string}>`.
  - Queries `strava_activity_streams` first; if row exists, returns `{ok:true, cached:true, data}`.
  - Otherwise invokes `supabase.functions.invoke('strava-fetch-streams', {body:{activity_id, athlete_id}})`.
  - Caches result in-memory for the session.
  - Handles `no_streams`, `rate_limited`, `unauthorized`, `upstream_error` distinctly.
- **Depends on**: 2.2
- **Risk**: L

### 3.2 [ ] Add `syncHrZones` to `stravaSyncService.js`
- **Files**: `src/services/stravaSyncService.js`, `src/services/stravaService.js`
- **Acceptance**:
  - `stravaService.getAthleteZones()` wraps `GET /athlete/zones` via user token.
  - `syncHrZones()` calls it, upserts `athlete_hr_zones` with `custom_zones`, `sensor_based`, `fetched_at`, `source='strava'`.
  - On 404 → falls back to `generateHrZones(maxHR)` and stores with `source='estimated'`.
  - Called from post-OAuth hook (modify `Devices.jsx:120` area) AND from athlete dashboard mount when `fetched_at < now() - 30d`.
- **Depends on**: 1.2
- **Risk**: L

### 3.3 [ ] Create `stravaGearService.js`
- **Files**: `src/services/stravaGearService.js` (NEW), `src/services/stravaService.js`
- **Acceptance**:
  - `stravaService.getGear(id)` wraps `GET /gear/{id}`.
  - `syncGearFromActivity(activity)`: if `activity.gear_id` set and no row in `athlete_gear` OR `last_synced_at > 7d`, fetch + upsert.
  - `listAthleteGear(athleteId)`: SELECT active + inactive, sorted by `distance_meters` desc.
  - On 404 → `active=false`.
- **Depends on**: 1.2, 3.1 or independent
- **Risk**: L

### 3.4 [ ] Wire deauth handler to clear local state
- **Files**: `src/services/stravaSyncService.js`, `src/services/athleteDeviceService.js`
- **Acceptance**:
  - `handleDeauthorize()` called explicitly from Settings/Devices UI "Disconnect Strava" button.
  - Clears tokens in `devices` (service-role via edge function; NOT frontend).
  - UI re-renders "Conectar Strava" state.
  - Note: webhook-driven deauth (external revoke on Strava's site) is handled server-side; this is the in-app counterpart.
- **Depends on**: 2.1
- **Risk**: L

### 3.5 [ ] Extend `stravaCacheService.mapActivityToRow`
- **Files**: `src/services/stravaCacheService.js`
- **Acceptance**:
  - `mapActivityToRow` now reads and writes `splits_metric`, `laps`, `suffer_score`, `weighted_average_watts`, `workout_type`, `gear_id`, `device_name` if present on the Strava payload.
  - Existing fields unchanged.
  - Does NOT touch `has_streams` / `deleted` / `deleted_at` (webhook/edge-fn only).
- **Depends on**: 1.2
- **Risk**: L

---

## Phase 4 — Testing

### 4.1 [ ] Manual webhook scenario tests
- **Files**: n/a
- **Acceptance**: All six event types (`create` / `update` fresh / `update` stale / `delete` / `deauth` / unknown) produce the correct DB state per spec scenarios 1.1–1.5.
- **Depends on**: 2.1, 2.3
- **Risk**: M

### 4.2 [ ] Verify stream fetch end-to-end from UI
- **Files**: manual in browser devtools
- **Acceptance**:
  - First open of an activity detail view: network shows call to `strava-fetch-streams`; subsequent row in `strava_activity_streams`.
  - Second open: no call; data loaded from Postgres in < 500 ms.
  - Activity with no GPS (manual entry): shows "No disponible" gracefully.
- **Depends on**: 2.2, 3.1
- **Risk**: L

### 4.3 [ ] Verify RLS per spec scenarios 6.1–6.5
- **Files**: SQL queries via Supabase dashboard
- **Acceptance**: matches requirement 6.1 through 6.5 exactly.
- **Depends on**: 1.3
- **Risk**: M — must not regress after any later migration.

### 4.4 [ ] Rate-limit handling test for backfill (if 2.4 shipped)
- **Files**: n/a
- **Acceptance**: simulate a high-usage window (mock `X-RateLimit-Usage: 85,800`) → backfill pauses.
- **Depends on**: 2.4
- **Risk**: M

---

## Phase 5 — Deployment

### 5.1 [ ] Deploy migration to production
- **Files**: `supabase/migrations/20260414090000_strava_deep_ingestion.sql`
- **Acceptance**:
  - Migration applied during a low-traffic window.
  - `get_advisors` returns no new errors / warnings.
  - Smoke SQL: `SELECT has_streams, deleted FROM strava_activities LIMIT 1` succeeds.
- **Depends on**: 1.2 (dev applied), 1.3 (RLS verified)
- **Risk**: H — production DB.

### 5.2 [ ] Deploy edge functions to production
- **Files**: `supabase/functions/strava-webhook`, `supabase/functions/strava-fetch-streams`, optionally `supabase/functions/strava-backfill`
- **Acceptance**:
  - Deploy order: webhook first, then fetch-streams.
  - Existing webhook subscription continues to receive events (no re-subscribe required).
  - Logs show `strava.webhook.received` entries.
- **Depends on**: 5.1, 2.1, 2.2
- **Risk**: H — live webhook.

### 5.3 [ ] Monitor logs for 24 h
- **Files**: n/a
- **Acceptance**:
  - No `strava.webhook.*` error logs exceed 1% of total events.
  - No RLS denial spikes (could indicate mis-auth'd requests from frontend).
  - `strava.streams.fetch_failed` rate < 5% of attempts (non-404 failures).
  - Storage growth (via `pg_total_relation_size('strava_activity_streams')`) stays below projected envelope.
- **Depends on**: 5.1, 5.2
- **Risk**: M

### 5.4 [ ] Frontend deployment
- **Files**: Vercel auto-deploy on merge to `dev` then `master`.
- **Acceptance**:
  - Feature behind no flag (additive); service functions available on first page load post-deploy.
  - No console errors on athlete dashboard / metrics pages.
- **Depends on**: 5.2, 3.x tasks
- **Risk**: L

---

## Task count summary

- Phase 1: 3 tasks
- Phase 2: 4 tasks (one optional)
- Phase 3: 5 tasks
- Phase 4: 4 tasks
- Phase 5: 4 tasks

**Total: 20 tasks (19 required + 1 optional)**

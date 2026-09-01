# Design — strava-deep-ingestion

## Architecture overview

```
+----------------+        webhook POST         +---------------------+
|  Strava API    | --------------------------> |  strava-webhook     |
|  (events:      |                             |  (edge function)    |
|   create,      |                             |                     |
|   update,      |   <-- fetch detail -------  |  switch(aspect):    |
|   delete,      |   /activities/{id}          |   create -> upsert  |
|   deauth)      |   /gear/{id}                |   update -> upsert  |
+----------------+                             |   delete -> softdel |
                                               |   deauth -> clear   |
                                               +----------+----------+
                                                          |
                                                          v (service_role)
                                               +---------------------+
                                               |  Postgres           |
                                               |  strava_activities  |
                                               |  athlete_hr_zones   |
                                               |  athlete_gear       |
                                               |  strava_activity_   |
                                               |    streams          |
                                               +----------+----------+
                                                          ^
                                          lazy SELECT     |
+----------------+   fetch on first open   +-------------+----------+
|  Frontend      | ----------------------> |  strava-fetch-streams  |
|  ActivityView  |                         |  (edge function)       |
|                | <-- streams via PostgREST +-------------+----------+
+----------------+                                       |
                                                          | GET /streams
                                                          v
                                               +---------------------+
                                               |  Strava API         |
                                               +---------------------+

Backfill (optional):
  OAuth complete -> enqueue -> strava-backfill (cron/fn) -> /activities list -> detail fetch loop (1 req/s)
```

---

## Data model

### Migration SQL — UP

File path: `supabase/migrations/20260414090000_strava_deep_ingestion.sql`

```sql
BEGIN;

-- =========================================================================
-- 1. Extend strava_activities
-- =========================================================================
ALTER TABLE public.strava_activities
  ADD COLUMN IF NOT EXISTS splits_metric jsonb,
  ADD COLUMN IF NOT EXISTS laps jsonb,
  ADD COLUMN IF NOT EXISTS suffer_score integer,
  ADD COLUMN IF NOT EXISTS weighted_average_watts numeric,
  ADD COLUMN IF NOT EXISTS workout_type integer,
  ADD COLUMN IF NOT EXISTS gear_id text,
  ADD COLUMN IF NOT EXISTS device_name text,
  ADD COLUMN IF NOT EXISTS has_streams boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- best_efforts, has_details, has_heartrate already exist (per exploration).

CREATE INDEX IF NOT EXISTS idx_strava_activities_has_streams
  ON public.strava_activities (athlete_id, has_streams)
  WHERE deleted = false;

CREATE INDEX IF NOT EXISTS idx_strava_activities_not_deleted
  ON public.strava_activities (athlete_id, start_date_local DESC)
  WHERE deleted = false;

-- =========================================================================
-- 2. strava_activity_streams (time-series)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.strava_activity_streams (
  activity_id      bigint PRIMARY KEY,
  athlete_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  time             integer[],
  distance         numeric[],
  velocity_smooth  numeric[],
  heartrate        integer[],
  cadence          integer[],
  altitude         numeric[],
  grade_smooth     numeric[],
  temp             integer[],
  moving           boolean[],
  fetched_at       timestamptz NOT NULL DEFAULT now(),
  source           text NOT NULL DEFAULT 'strava',
  -- FK to strava_activities.id (NOT strava_id) is intentional:
  -- activity_id here == strava_activities.id
  CONSTRAINT fk_streams_activity
    FOREIGN KEY (activity_id) REFERENCES public.strava_activities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_strava_streams_athlete
  ON public.strava_activity_streams (athlete_id);

ALTER TABLE public.strava_activity_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY streams_select_own ON public.strava_activity_streams
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = athlete_id);

CREATE POLICY streams_select_coach ON public.strava_activity_streams
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_athlete_relationship car
    WHERE car.athlete_id = strava_activity_streams.athlete_id
      AND car.coach_id   = (select auth.uid())
      AND car.status     = 'active'
  ));

CREATE POLICY streams_service_all ON public.strava_activity_streams
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =========================================================================
-- 3. athlete_hr_zones
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.athlete_hr_zones (
  athlete_id    uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  zones         jsonb NOT NULL,      -- [{zone:1,min:X,max:Y,name:"Recovery"}, ...]
  custom_zones  boolean NOT NULL DEFAULT false,
  sensor_based  boolean NOT NULL DEFAULT false,
  fetched_at    timestamptz NOT NULL DEFAULT now(),
  source        text NOT NULL DEFAULT 'strava'  -- 'strava' | 'estimated' | 'manual'
);

ALTER TABLE public.athlete_hr_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY hrzones_select_own ON public.athlete_hr_zones
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = athlete_id);

CREATE POLICY hrzones_select_coach ON public.athlete_hr_zones
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_athlete_relationship car
    WHERE car.athlete_id = athlete_hr_zones.athlete_id
      AND car.coach_id   = (select auth.uid())
      AND car.status     = 'active'
  ));

CREATE POLICY hrzones_service_all ON public.athlete_hr_zones
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =========================================================================
-- 4. athlete_gear
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.athlete_gear (
  id                text PRIMARY KEY,    -- Strava gear_id (e.g., "g1234567")
  athlete_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name              text,
  brand_name        text,
  model_name        text,
  distance_meters   numeric NOT NULL DEFAULT 0,
  active            boolean NOT NULL DEFAULT true,
  primary_gear      boolean NOT NULL DEFAULT false,
  last_synced_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gear_athlete
  ON public.athlete_gear (athlete_id, active);

ALTER TABLE public.athlete_gear ENABLE ROW LEVEL SECURITY;

CREATE POLICY gear_select_own ON public.athlete_gear
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = athlete_id);

CREATE POLICY gear_select_coach ON public.athlete_gear
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_athlete_relationship car
    WHERE car.athlete_id = athlete_gear.athlete_id
      AND car.coach_id   = (select auth.uid())
      AND car.status     = 'active'
  ));

CREATE POLICY gear_service_all ON public.athlete_gear
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMIT;
```

### Migration SQL — DOWN (rollback)

File path: `supabase/migrations/20260414090000_strava_deep_ingestion_down.sql`

```sql
BEGIN;

DROP TABLE IF EXISTS public.athlete_gear CASCADE;
DROP TABLE IF EXISTS public.athlete_hr_zones CASCADE;
DROP TABLE IF EXISTS public.strava_activity_streams CASCADE;

DROP INDEX IF EXISTS public.idx_strava_activities_has_streams;
DROP INDEX IF EXISTS public.idx_strava_activities_not_deleted;

ALTER TABLE public.strava_activities
  DROP COLUMN IF EXISTS splits_metric,
  DROP COLUMN IF EXISTS laps,
  DROP COLUMN IF EXISTS suffer_score,
  DROP COLUMN IF EXISTS weighted_average_watts,
  DROP COLUMN IF EXISTS workout_type,
  DROP COLUMN IF EXISTS gear_id,
  DROP COLUMN IF EXISTS device_name,
  DROP COLUMN IF EXISTS has_streams,
  DROP COLUMN IF EXISTS deleted,
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS updated_at;

COMMIT;
```

---

## Edge function: `strava-fetch-streams`

**Path**: `supabase/functions/strava-fetch-streams/index.ts`

**Input** (POST JSON):
```ts
{ activity_id: number, athlete_id: string /* uuid */ }
```

**Auth**: either service-role (internal webhook callback) OR the athlete's JWT (RLS validates `auth.uid() === athlete_id`).

**Flow**:

1. Validate input.
2. Load `strava_activities.has_streams` for `activity_id`. If `true` → early return `{ok: true, cached: true}`.
3. Load the athlete's tokens from `devices`. Refresh if expired (reuse `refreshTokenIfNeeded` from webhook module).
4. `GET https://www.strava.com/api/v3/activities/{activity_id}/streams?keys=time,distance,heartrate,cadence,velocity_smooth,altitude,grade_smooth,temp,moving&key_by_type=true`.
5. Response is an object keyed by stream type: `{ time: { data: [...] }, heartrate: { data: [...] }, ... }`.
6. If any stream length > 3600 samples (over 1 hour at 1Hz), downsample to 1 per 5 s by array stride before storing.
7. UPSERT `strava_activity_streams` with arrays.
8. UPDATE `strava_activities SET has_streams = true WHERE id = activity_id`.
9. Return `{ok: true, cached: false, samples: N}`.

**Error handling**:
- 404 → set a sentinel row with empty arrays + `source='none'`, mark `has_streams=false` permanently (short-circuit). Return `{ok: false, reason: 'no_streams'}`.
- 429 / rate-limited → read `Retry-After` header, return `{ok: false, reason: 'rate_limited', retry_after: N}`.
- 401 → token refresh failed. Return `{ok: false, reason: 'unauthorized'}`.
- 5xx → return `{ok: false, reason: 'upstream_error'}`. Do NOT update `has_streams`.

**Deployment flag**: `verify_jwt: true` (requires authenticated caller; service_role bypasses).

---

## Edge function: `strava-webhook` (extension)

**Path**: `supabase/functions/strava-webhook/index.ts`

New `switch` structure inside the POST handler:

```ts
const { object_type, aspect_type, object_id, owner_id, event_time, updates } = body;

switch (`${object_type}:${aspect_type}`) {
  case 'activity:create':
    await processNewActivity(supabaseAdmin, object_id, owner_id);
    break;

  case 'activity:update':
    await processActivityUpdate(supabaseAdmin, object_id, owner_id, event_time);
    break;

  case 'activity:delete':
    await processActivityDelete(supabaseAdmin, object_id, owner_id);
    break;

  case 'athlete:update':
    if (updates?.authorized === 'false') {
      await processDeauthorize(supabaseAdmin, owner_id);
    }
    break;

  default:
    // Unknown event — ACK but log.
    break;
}

return new Response('ok', { status: 200 });
```

Each `processX` function MUST:
- Be idempotent.
- Log structured JSON for observability.
- Fail-soft on non-critical errors (log and return, not throw).

**`processActivityUpdate`**:
1. Load `strava_activities` row by `strava_id = object_id`.
2. If row missing → treat as `create` (fetch + upsert).
3. If `event_time <= updated_at` → ignore.
4. Fetch fresh detail, UPSERT, preserve `has_streams`.

**`processActivityDelete`**:
1. `UPDATE strava_activities SET deleted=true, deleted_at=now() WHERE strava_id = object_id AND athlete_id = resolvedAthleteId`.
2. `UPDATE training_sessions SET strava_activity_id = NULL WHERE strava_activity_id = (the internal id)`.
3. Do not touch streams (FK cascade-deletes if the whole row is deleted — but we soft-delete, so streams stay).

**`processDeauthorize`**:
1. `UPDATE devices SET access_token=NULL, refresh_token=NULL, expires_at=NULL WHERE strava_athlete_id = owner_id`.
2. Log to an `audit_log` table (optional future enhancement).

---

## Edge function: `strava-backfill` (optional)

**Path**: `supabase/functions/strava-backfill/index.ts`

Triggered by:
- Direct invoke from `strava-token-exchange` after first connect.
- Cron (optional) — not part of this change.

**Flow**:
1. `GET /athlete/activities?after={90_days_ago_unix}&per_page=200` — list.
2. For each activity not in `strava_activities`, fetch detail with 1 req/s throttle.
3. After each response, check `X-RateLimit-Usage`. If > 80% of 15-min limit → sleep until window reset.
4. Mark progress in memory (or `strava_backfill_jobs` table for restart tolerance — decision below).

---

## Architectural decisions (ADRs)

### ADR 1 — Stream storage: array columns vs. JSONB

**Decision**: Use typed array columns (`integer[]`, `numeric[]`, `boolean[]`).

**Rationale**:
- Postgres TOAST-compresses large arrays automatically.
- Typed arrays enforce schema (no accidental string-in-HR field).
- Smaller on-disk footprint than JSONB for numeric data (tested in Postgres docs).
- We do NOT need partial-key indexing on streams (always fetched whole).

**Rejected**: JSONB with `{"heartrate": [...], ...}`. Slightly more flexible but less efficient for this use case.

### ADR 2 — Lazy stream fetching

**Decision**: Fetch streams on demand (first activity detail open), not on webhook.

**Rationale**:
- Most activities are never deeply analyzed (dashboard only uses summary).
- Webhook must ACK in 2 s; stream fetch is extra API hop.
- Reduces pressure on Strava 100 req/15 min budget.
- User-perceived latency is acceptable (first-open < 3 s total, subsequent < 500 ms).

**Rejected**: Eager fetch in webhook. Would add 300–800 ms per event and burn rate budget.

### ADR 3 — Soft-delete for deleted activities

**Decision**: `deleted=true` flag, no hard delete.

**Rationale**:
- Linked `training_sessions` reference `strava_activity_id`; hard-delete would either cascade-null (data loss on completion stats) or FK-violate.
- Audit / debug (did this session really get deleted on Strava, or bug?).
- Easy to undelete if Strava re-creates on user-undo.

**Rejected**: Hard delete + cascade. Loses training history.

### ADR 4 — HR zones: sync at connect, monthly refresh

**Decision**: Sync on OAuth complete; refresh lazily if > 30 days old when any zone-using page opens.

**Rationale**:
- Zones change rarely (once-a-year at most for most athletes).
- Lazy refresh costs ~1 API call per athlete per 30 days.
- Avoids a cron job.

**Rejected**: Daily cron. Wastes rate budget.

### ADR 5 — Deauthorize: preserve activities, clear tokens

**Decision**: Null out tokens in `devices`, keep all activity / stream data.

**Rationale**:
- User may reconnect (very common — happens during token rotation).
- Activities are historical records; deleting them loses training history and breaks `training_sessions` linkage.
- GDPR: we retain under legitimate interest (training log); user can request deletion separately.

**Rejected**: Cascade-delete everything. User-hostile.

### ADR 6 — Webhook event ordering

**Decision**: Compare `event_time` to `updated_at`, discard stale.

**Rationale**:
- Strava documentation explicitly states events are NOT ordered.
- Simplest defense: monotonic timestamp check.

**Rejected**: Sequence numbers, distributed locks. Overkill.

---

## Deployment order

1. **Apply migration** (up SQL) — creates tables + columns + RLS policies.
2. **Deploy `strava-webhook` v2** — handles new event types. Must deploy AFTER migration or `deleted` column writes will fail.
3. **Deploy `strava-fetch-streams`** — new function, no upstream dependency.
4. **(Optional) Deploy `strava-backfill`** — only if we want automatic on-connect backfill; can defer.
5. **Frontend changes** — service-layer additions. Backward-compatible (feature flag off by default if needed).
6. **Monitor logs 24 h** — watch for webhook errors, stream fetch failures, RLS denials.

---

## Observability

Log the following structured events:

- `strava.webhook.received` — `{aspect_type, object_type, object_id, owner_id}`
- `strava.webhook.stale_event` — when `event_time <= updated_at`
- `strava.webhook.activity_upserted` — `{athlete_id, strava_id, action: 'created'|'updated'}`
- `strava.webhook.activity_softdeleted`
- `strava.webhook.deauthorized` — `{owner_id, devices_cleared: N}`
- `strava.streams.fetch_started` — `{activity_id, athlete_id}`
- `strava.streams.fetch_ok` — `{activity_id, samples, ms}`
- `strava.streams.fetch_failed` — `{activity_id, reason, status}`
- `strava.zones.synced` — `{athlete_id, custom_zones}`
- `strava.backfill.throttled` — `{usage_pct}`
- `strava.backfill.completed` — `{athlete_id, count, ms}`

---

## Security considerations

- Edge functions use `SUPABASE_SERVICE_ROLE_KEY` — never exposed to the frontend.
- `strava-fetch-streams` validates `athlete_id` from JWT claim when called by a user; service-role callers skip this.
- Stream arrays contain HR data → treat as PII. RLS enforced; no public read access.
- Webhook signature validation is currently via `hub.verify_token` (GET subscribe). POST events are NOT signed by Strava — we trust the source IP or the presence of a known `owner_id → devices` mapping. Out-of-scope but noted.

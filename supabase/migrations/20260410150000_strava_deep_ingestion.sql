-- =========================================================================
-- Migration: strava-deep-ingestion (UP)
-- Extends strava_activities with deep-ingestion columns and creates
-- strava_activity_streams, athlete_hr_zones and athlete_gear tables.
-- See: openspec/changes/strava-deep-ingestion/design.md
-- =========================================================================

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
  CONSTRAINT fk_streams_activity
    FOREIGN KEY (activity_id) REFERENCES public.strava_activities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_strava_streams_athlete
  ON public.strava_activity_streams (athlete_id);

ALTER TABLE public.strava_activity_streams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS streams_select_own ON public.strava_activity_streams;
CREATE POLICY streams_select_own ON public.strava_activity_streams
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = athlete_id);

DROP POLICY IF EXISTS streams_select_coach ON public.strava_activity_streams;
CREATE POLICY streams_select_coach ON public.strava_activity_streams
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_athlete_relationship car
    WHERE car.athlete_id = strava_activity_streams.athlete_id
      AND car.coach_id   = (select auth.uid())
      AND car.status     = 'active'
  ));

DROP POLICY IF EXISTS streams_service_all ON public.strava_activity_streams;
CREATE POLICY streams_service_all ON public.strava_activity_streams
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =========================================================================
-- 3. athlete_hr_zones
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.athlete_hr_zones (
  athlete_id    uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  zones         jsonb NOT NULL,
  custom_zones  boolean NOT NULL DEFAULT false,
  sensor_based  boolean NOT NULL DEFAULT false,
  fetched_at    timestamptz NOT NULL DEFAULT now(),
  source        text NOT NULL DEFAULT 'strava'
);

ALTER TABLE public.athlete_hr_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hrzones_select_own ON public.athlete_hr_zones;
CREATE POLICY hrzones_select_own ON public.athlete_hr_zones
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = athlete_id);

DROP POLICY IF EXISTS hrzones_select_coach ON public.athlete_hr_zones;
CREATE POLICY hrzones_select_coach ON public.athlete_hr_zones
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_athlete_relationship car
    WHERE car.athlete_id = athlete_hr_zones.athlete_id
      AND car.coach_id   = (select auth.uid())
      AND car.status     = 'active'
  ));

DROP POLICY IF EXISTS hrzones_service_all ON public.athlete_hr_zones;
CREATE POLICY hrzones_service_all ON public.athlete_hr_zones
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =========================================================================
-- 4. athlete_gear
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.athlete_gear (
  id                text PRIMARY KEY,
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

DROP POLICY IF EXISTS gear_select_own ON public.athlete_gear;
CREATE POLICY gear_select_own ON public.athlete_gear
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = athlete_id);

DROP POLICY IF EXISTS gear_select_coach ON public.athlete_gear;
CREATE POLICY gear_select_coach ON public.athlete_gear
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_athlete_relationship car
    WHERE car.athlete_id = athlete_gear.athlete_id
      AND car.coach_id   = (select auth.uid())
      AND car.status     = 'active'
  ));

DROP POLICY IF EXISTS gear_service_all ON public.athlete_gear;
CREATE POLICY gear_service_all ON public.athlete_gear
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMIT;

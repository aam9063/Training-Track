-- =========================================================================
-- Migration: daily_training_load_baseline (UP)
-- Idempotent restatement of the already-live daily_training_load table,
-- index and RLS policies (verified via live query — task 1.3), plus a
-- temporary `dtl_write_own` write policy so the still-live client write
-- path (src/services/trainingLoadService.js) keeps working during the
-- Slice 1/2 transition (dropped in Slice 3, migration
-- ..._daily_training_load_drop_client_write.sql).
-- See: openspec/changes/training-load-monitoring-agent/design.md
--      (Migration Plan #1)
-- =========================================================================

BEGIN;

-- =========================================================================
-- 1. Baseline table (idempotent — matches the live column list exactly,
--    task 1.3 verification)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.daily_training_load (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id         uuid NOT NULL,
  date               date NOT NULL,
  tss                numeric DEFAULT 0,
  ctl                numeric DEFAULT 0,
  atl                numeric DEFAULT 0,
  tsb                numeric DEFAULT 0,
  ramp_rate          numeric,
  intensity_factor   numeric,
  total_distance_m   integer,
  total_duration_s   integer,
  activity_count     integer DEFAULT 0,
  source             varchar DEFAULT 'strava',
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_training_load_athlete_date
  ON public.daily_training_load (athlete_id, date);

ALTER TABLE public.daily_training_load ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- 2. RLS — restatement of the 3 live policies (task 1.3), same names/quals
-- =========================================================================
DROP POLICY IF EXISTS daily_training_load_select ON public.daily_training_load;
CREATE POLICY daily_training_load_select ON public.daily_training_load
  FOR SELECT TO authenticated
  USING (
    (select auth.uid()) = athlete_id
    OR EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship car
      WHERE car.athlete_id = daily_training_load.athlete_id
        AND car.coach_id   = (select auth.uid())
        AND car.status     = 'active'
    )
  );

DROP POLICY IF EXISTS daily_training_load_insert ON public.daily_training_load;
CREATE POLICY daily_training_load_insert ON public.daily_training_load
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = athlete_id);

DROP POLICY IF EXISTS daily_training_load_update ON public.daily_training_load;
CREATE POLICY daily_training_load_update ON public.daily_training_load
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = athlete_id)
  WITH CHECK ((select auth.uid()) = athlete_id);

-- No explicit service_role policy — service_role bypasses RLS by default
-- (confirmed live, task 1.3). Declared here only as documentation.

-- =========================================================================
-- 3. Temporary client-write policy (dropped in Slice 3, migration
--    ..._daily_training_load_drop_client_write.sql, task 4.5).
--    daily_training_load_insert/_update above are already self-scoped
--    equivalently, but this is kept as a SEPARATE, clearly-named policy
--    pair so a future drop doesn't have to reason about whether it's safe
--    to remove the restated baseline policies too. Postgres CREATE POLICY
--    only accepts one command per policy, so "dtl_write_own" is realized
--    as two sibling policies (INSERT + UPDATE, no DELETE/SELECT expansion,
--    matching design.md's "temporary dtl_write_own INSERT/UPDATE policy"
--    exactly) — a future rollback/removal must drop both.
-- =========================================================================
DROP POLICY IF EXISTS dtl_write_own_insert ON public.daily_training_load;
CREATE POLICY dtl_write_own_insert ON public.daily_training_load
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = athlete_id);

DROP POLICY IF EXISTS dtl_write_own_update ON public.daily_training_load;
CREATE POLICY dtl_write_own_update ON public.daily_training_load
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = athlete_id)
  WITH CHECK ((select auth.uid()) = athlete_id);

COMMIT;

-- =========================================================================
-- Rollback: daily_training_load_drop_client_write (DOWN)
-- Reverses 20260831120000_daily_training_load_drop_client_write.sql by
-- restoring the exact `dtl_write_own_insert`/`dtl_write_own_update`
-- policy definitions from 20260819140000_daily_training_load_baseline.sql.
-- Only use this if a rollback of the frontend's write-path removal is
-- needed (e.g. an emergency revert to client-side writes).
-- =========================================================================

BEGIN;

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

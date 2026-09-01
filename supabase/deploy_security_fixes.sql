-- =============================================
-- DEPLOY SECURITY FIXES (Incremental)
-- Run in Supabase SQL Editor - production safe
-- Date: 2026-03-06
-- =============================================
-- This script only applies the DELTA changes.
-- It uses DROP POLICY IF EXISTS before CREATE to be idempotent.
-- Safe to run multiple times.
-- =============================================

-- =============================================
-- FIX 1: ai_reports - add missing DELETE policy
-- (deleteReport() in aiReportService.js was failing silently)
-- =============================================
DROP POLICY IF EXISTS "ai_reports_delete" ON public.ai_reports;
CREATE POLICY "ai_reports_delete" ON public.ai_reports
  FOR DELETE USING (
    athlete_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship car
      WHERE car.athlete_id = ai_reports.athlete_id
        AND car.coach_id = (SELECT auth.uid())
        AND car.status = 'active'
    )
  );

-- =============================================
-- FIX 2: activity_splits - add missing UPDATE policy
-- (upsert() needs INSERT + UPDATE; update on existing rows was failing)
-- =============================================
DROP POLICY IF EXISTS "activity_splits_update" ON public.activity_splits;
CREATE POLICY "activity_splits_update" ON public.activity_splits
  FOR UPDATE USING (
    athlete_id = (SELECT auth.uid())
  );

-- =============================================
-- FIX 3: race_predictions - add missing DELETE policy
-- (persistRacePredictions does delete-then-insert; delete was failing)
-- =============================================
DROP POLICY IF EXISTS "predictions_delete_own" ON public.race_predictions;
CREATE POLICY "predictions_delete_own"
  ON public.race_predictions FOR DELETE
  USING (athlete_id = (SELECT auth.uid()));

-- =============================================
-- FIX 4: competitions - fix auth.uid() -> (SELECT auth.uid())
-- and fix coach SELECT to use EXISTS with active relationship check
-- =============================================
DROP POLICY IF EXISTS "Coaches can view their athletes competitions" ON public.competitions;
CREATE POLICY "Coaches can view their athletes competitions"
  ON public.competitions FOR SELECT
  USING (
    coach_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship car
      WHERE car.athlete_id = competitions.athlete_id
        AND car.coach_id = (SELECT auth.uid())
        AND car.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Coaches can insert competitions for their athletes" ON public.competitions;
CREATE POLICY "Coaches can insert competitions for their athletes"
  ON public.competitions FOR INSERT
  WITH CHECK (
    coach_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship car
      WHERE car.athlete_id = competitions.athlete_id
        AND car.coach_id = (SELECT auth.uid())
        AND car.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Coaches can update their competitions" ON public.competitions;
CREATE POLICY "Coaches can update their competitions"
  ON public.competitions FOR UPDATE
  USING (coach_id = (SELECT auth.uid()))
  WITH CHECK (coach_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Coaches can delete their competitions" ON public.competitions;
CREATE POLICY "Coaches can delete their competitions"
  ON public.competitions FOR DELETE
  USING (coach_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Athletes can view their own competitions" ON public.competitions;
CREATE POLICY "Athletes can view their own competitions"
  ON public.competitions FOR SELECT
  USING (athlete_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Athletes can update their competition results" ON public.competitions;
CREATE POLICY "Athletes can update their competition results"
  ON public.competitions FOR UPDATE
  USING (athlete_id = (SELECT auth.uid()))
  WITH CHECK (athlete_id = (SELECT auth.uid()));

-- =============================================
-- FIX 5: devices_safe_view - safe view without tokens
-- (coaches use this instead of devices table directly)
-- =============================================
CREATE OR REPLACE VIEW public.devices_safe_view
WITH (security_invoker = true)
AS
SELECT
  id,
  athlete_id,
  device_type,
  strava_athlete_id,
  token_expires_at,
  created_at,
  updated_at
FROM public.devices;

COMMENT ON VIEW public.devices_safe_view IS
  'Safe view of devices table excluding access_token and refresh_token. Use this for coach-facing queries.';

-- =============================================
-- VERIFICATION
-- =============================================
DO $$
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE 'Security fixes applied successfully:';
  RAISE NOTICE '  1. ai_reports DELETE policy added';
  RAISE NOTICE '  2. activity_splits UPDATE policy added';
  RAISE NOTICE '  3. race_predictions DELETE policy added';
  RAISE NOTICE '  4. competitions policies fixed (SELECT auth.uid + active check)';
  RAISE NOTICE '  5. devices_safe_view created';
  RAISE NOTICE '=============================================';
END $$;

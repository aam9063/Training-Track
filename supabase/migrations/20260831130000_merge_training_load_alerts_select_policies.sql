-- Merges training_load_alerts_select_own + training_load_alerts_select_coach
-- into a single SELECT policy with an OR condition, matching this repo's
-- established pattern (see daily_training_load_select) and resolving the
-- Supabase advisor's "Multiple Permissive Policies" performance warning.
-- No security-semantics change — same two conditions, now evaluated once.

BEGIN;

DROP POLICY IF EXISTS training_load_alerts_select_own ON public.training_load_alerts;
DROP POLICY IF EXISTS training_load_alerts_select_coach ON public.training_load_alerts;

CREATE POLICY training_load_alerts_select ON public.training_load_alerts
  FOR SELECT TO authenticated
  USING (
    (select auth.uid()) = athlete_id
    OR EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship car
      WHERE car.athlete_id = training_load_alerts.athlete_id
        AND car.coach_id   = (select auth.uid())
        AND car.status     = 'active'
    )
  );

COMMIT;

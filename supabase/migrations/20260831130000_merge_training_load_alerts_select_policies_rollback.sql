-- Rollback for merge_training_load_alerts_select_policies. Restores the
-- original two-policy form.

BEGIN;

DROP POLICY IF EXISTS training_load_alerts_select ON public.training_load_alerts;

CREATE POLICY training_load_alerts_select_own ON public.training_load_alerts
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = athlete_id);

CREATE POLICY training_load_alerts_select_coach ON public.training_load_alerts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_athlete_relationship car
    WHERE car.athlete_id = training_load_alerts.athlete_id
      AND car.coach_id   = (select auth.uid())
      AND car.status     = 'active'
  ));

COMMIT;

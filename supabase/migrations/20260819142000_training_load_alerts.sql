-- =========================================================================
-- Migration: training_load_alerts (UP)
-- New table for the single 4-signal alert rulebook (acwr_zone, tsb_critical,
-- low_completion, high_rpe) + RLS + dedup index + the training_sessions
-- index the sweep/monitor will scan for the two session-derived signals.
-- See: openspec/changes/training-load-monitoring-agent/design.md
--      (Migration Plan #3, "CHECK constraint, not a Postgres ENUM type")
-- =========================================================================

BEGIN;

-- =========================================================================
-- 1. training_load_alerts
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.training_load_alerts (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id         uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  recipient_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  alert_type         text NOT NULL
    CHECK (alert_type IN ('acwr_zone', 'tsb_critical', 'low_completion', 'high_rpe')),
  severity           text NOT NULL
    CHECK (severity IN ('warning', 'critical')),
  metric_date        date NOT NULL,
  metrics            jsonb NOT NULL DEFAULT '{}'::jsonb,
  message_es         text NOT NULL,
  status             text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved')),
  episode_started_on date NOT NULL,
  last_seen_on       date NOT NULL,
  resolved_at        timestamptz,
  read_at            timestamptz,
  dismissed_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Dedup: at most one OPEN episode per (athlete_id, alert_type). Up to 4
-- concurrent open episodes per athlete (one per alert_type) are legitimate.
CREATE UNIQUE INDEX IF NOT EXISTS idx_training_load_alerts_open_dedup
  ON public.training_load_alerts (athlete_id, alert_type)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_training_load_alerts_recipient
  ON public.training_load_alerts (recipient_id, status);

ALTER TABLE public.training_load_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS training_load_alerts_select_own ON public.training_load_alerts;
CREATE POLICY training_load_alerts_select_own ON public.training_load_alerts
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = athlete_id);

DROP POLICY IF EXISTS training_load_alerts_select_coach ON public.training_load_alerts;
CREATE POLICY training_load_alerts_select_coach ON public.training_load_alerts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_athlete_relationship car
    WHERE car.athlete_id = training_load_alerts.athlete_id
      AND car.coach_id   = (select auth.uid())
      AND car.status     = 'active'
  ));

-- Lifecycle updates (read/dismissed) — self or active coach only.
DROP POLICY IF EXISTS training_load_alerts_update_own ON public.training_load_alerts;
CREATE POLICY training_load_alerts_update_own ON public.training_load_alerts
  FOR UPDATE TO authenticated
  USING (
    (select auth.uid()) = athlete_id
    OR EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship car
      WHERE car.athlete_id = training_load_alerts.athlete_id
        AND car.coach_id   = (select auth.uid())
        AND car.status     = 'active'
    )
  )
  WITH CHECK (
    (select auth.uid()) = athlete_id
    OR EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship car
      WHERE car.athlete_id = training_load_alerts.athlete_id
        AND car.coach_id   = (select auth.uid())
        AND car.status     = 'active'
    )
  );

DROP POLICY IF EXISTS training_load_alerts_service_all ON public.training_load_alerts;
CREATE POLICY training_load_alerts_service_all ON public.training_load_alerts
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =========================================================================
-- 2. training_sessions index — read path for low_completion/high_rpe
--    (task 1.4 verified this index does not yet exist; real create)
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_training_sessions_athlete_date
  ON public.training_sessions (athlete_id, scheduled_date);

COMMIT;

-- =========================================================================
-- Migration: athlete_engagement_alerts (UP)
-- New table for the single-type, severity-tiered engagement/churn-risk
-- alert (`engagement_silence`). Coach-facing only — see design.md's
-- "RLS is coach + service_role only — no self-select" decision and
-- specs/athlete-engagement-alerts/spec.md's "RLS Visibility" requirement:
-- the athlete themselves must never read their own churn-risk assessment
-- (confirmed by the user 2026-09-02, deviating from the original proposal
-- wording, which implied self-select).
-- See: openspec/changes/adherence-detection-agent/design.md
--      (Migration Plan #1, Interfaces / Contracts)
-- =========================================================================

BEGIN;

-- =========================================================================
-- 1. athlete_engagement_alerts
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.athlete_engagement_alerts (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id         uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  recipient_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  alert_type         text NOT NULL
    CHECK (alert_type IN ('engagement_silence')),
  severity           text NOT NULL
    CHECK (severity IN ('warning', 'danger')),
  status             text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved')),
  metric_date        date NOT NULL,
  silence_days       integer NOT NULL,
  -- {variant:'silence'|'never_started', lastSignalAt, lastSignalSource, plannedInWindow}
  metrics            jsonb NOT NULL DEFAULT '{}'::jsonb,
  message_es         text NOT NULL,
  episode_started_on date NOT NULL,
  last_seen_on       date NOT NULL,
  resolved_at        timestamptz,
  read_at            timestamptz,
  dismissed_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Dedup: at most one OPEN alert per (athlete_id, alert_type). Since this
-- capability has exactly one alert_type value, this caps each athlete at
-- exactly one open engagement alert at any time — the strongest possible
-- anti-noise guarantee.
CREATE UNIQUE INDEX IF NOT EXISTS idx_athlete_engagement_alerts_open_dedup
  ON public.athlete_engagement_alerts (athlete_id, alert_type)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_athlete_engagement_alerts_recipient
  ON public.athlete_engagement_alerts (recipient_id, status);

ALTER TABLE public.athlete_engagement_alerts ENABLE ROW LEVEL SECURITY;

-- Coach-only SELECT — deliberately NO self-select policy. A supervised
-- athlete must never read their own churn-risk row: TrainingLoadAlertFeed
-- (soon source-agnostic) renders unconditionally on the athlete's own
-- dashboard (src/pages/athlete/Dashboard.jsx:174-177, no isIndependent
-- gate on that block) — surfacing "Riesgo de abandono" there would
-- pre-empt the coach's intervention with the worst possible tone.
DROP POLICY IF EXISTS athlete_engagement_alerts_select_coach ON public.athlete_engagement_alerts;
CREATE POLICY athlete_engagement_alerts_select_coach ON public.athlete_engagement_alerts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_athlete_relationship car
    WHERE car.athlete_id = athlete_engagement_alerts.athlete_id
      AND car.coach_id   = (select auth.uid())
      AND car.status     = 'active'
  ));

-- Lifecycle updates (read/dismissed) — active coach only, no self-update.
DROP POLICY IF EXISTS athlete_engagement_alerts_update_coach ON public.athlete_engagement_alerts;
CREATE POLICY athlete_engagement_alerts_update_coach ON public.athlete_engagement_alerts
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_athlete_relationship car
    WHERE car.athlete_id = athlete_engagement_alerts.athlete_id
      AND car.coach_id   = (select auth.uid())
      AND car.status     = 'active'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.coach_athlete_relationship car
    WHERE car.athlete_id = athlete_engagement_alerts.athlete_id
      AND car.coach_id   = (select auth.uid())
      AND car.status     = 'active'
  ));

DROP POLICY IF EXISTS athlete_engagement_alerts_service_all ON public.athlete_engagement_alerts;
CREATE POLICY athlete_engagement_alerts_service_all ON public.athlete_engagement_alerts
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMIT;

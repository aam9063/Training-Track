-- =========================================================================
-- Migration: plan_adjustment_suggestions (UP)
-- New table for Agent 3's single-pending-per-athlete plan-adjustment
-- proposal, plus the upsert RPC that persists it. Mirrors
-- athlete_engagement_alerts / training_load_alerts exactly: CHECK over
-- ENUM, coach + service_role RLS only (no athlete self-select), a partial
-- unique dedup index, plpgsql over a LANGUAGE sql CTE for the upsert (this
-- repo has twice found the CTE form unreliable for read-old-value-then-
-- write — Agent 1's upsert_training_load_alert, Agent 2's
-- upsert_engagement_alert).
-- See: openspec/changes/continuous-planning-agent/design.md
--      (Migration Plan #1, Interfaces / Contracts —
--      plan_adjustment_suggestions)
-- =========================================================================

BEGIN;

-- =========================================================================
-- 1. plan_adjustment_suggestions
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.plan_adjustment_suggestions (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id           uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  coach_id             uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  triggering_alert_id  uuid NOT NULL REFERENCES public.training_load_alerts(id) ON DELETE CASCADE,
  finding_source       text NOT NULL
    CHECK (finding_source IN ('acwr_zone', 'tsb_critical', 'low_completion')),
  patch_type           text NOT NULL
    CHECK (patch_type IN ('deload_volume', 'insert_recovery', 'reduce_frequency')),
  -- {"sessions": {"<session_uuid>": {"<field>": <new value>, …}, …}}
  patch                jsonb NOT NULL,
  -- {"sessions": {"<session_uuid>": {scheduled_date,status,training_type,
  --   estimated_duration_minutes,title}, …}}  -- SNAPSHOT_FIELDS, no description
  snapshot             jsonb NOT NULL,
  -- Rule inputs, so the UI never recomputes to render.
  metrics              jsonb NOT NULL DEFAULT '{}'::jsonb,
  message_es           text NOT NULL,
  status               text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'superseded')),
  -- Set only alongside status='superseded' from a refused apply.
  refusal_reason       text,
  -- min(scheduled_date) over targets; drives date-based expiry.
  earliest_target_date date NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  decided_at           timestamptz,
  resolved_at          timestamptz,
  read_at              timestamptz,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- D3: one pending suggestion per athlete at any time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_adjustment_suggestions_pending_dedup
  ON public.plan_adjustment_suggestions (athlete_id)
  WHERE status = 'pending';

-- The reactive-expiry trigger's probe (migration 5).
CREATE INDEX IF NOT EXISTS idx_plan_adjustment_suggestions_alert_pending
  ON public.plan_adjustment_suggestions (triggering_alert_id)
  WHERE status = 'pending';

-- The coach feed query.
CREATE INDEX IF NOT EXISTS idx_plan_adjustment_suggestions_coach_status
  ON public.plan_adjustment_suggestions (coach_id, status);

ALTER TABLE public.plan_adjustment_suggestions ENABLE ROW LEVEL SECURITY;

-- Coach-only SELECT — deliberately NO self-select policy, same rationale
-- as athlete_engagement_alerts: src/pages/athlete/Dashboard.jsx renders
-- the (source-agnostic) alert feed unconditionally on the athlete's own
-- dashboard; a self-select policy would show an athlete "tu plan se va a
-- recortar" before their coach has decided anything (spec's "RLS
-- Visibility — Coach and Service Role Only" requirement).
--
-- coach_id is denormalized for push targeting, but RLS never trusts it —
-- both policies below re-check the live coach_athlete_relationship, so a
-- terminated coach loses access even though the column still names them.
DROP POLICY IF EXISTS plan_adjustment_suggestions_select_coach ON public.plan_adjustment_suggestions;
CREATE POLICY plan_adjustment_suggestions_select_coach ON public.plan_adjustment_suggestions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_athlete_relationship car
    WHERE car.athlete_id = plan_adjustment_suggestions.athlete_id
      AND car.coach_id   = (select auth.uid())
      AND car.status     = 'active'
  ));

-- Lifecycle updates (read_at, reject) — active coach only, no self-update.
-- Approval does NOT go through this policy: apply_plan_adjustment is
-- SECURITY DEFINER and writes as its function owner.
DROP POLICY IF EXISTS plan_adjustment_suggestions_update_coach ON public.plan_adjustment_suggestions;
CREATE POLICY plan_adjustment_suggestions_update_coach ON public.plan_adjustment_suggestions
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_athlete_relationship car
    WHERE car.athlete_id = plan_adjustment_suggestions.athlete_id
      AND car.coach_id   = (select auth.uid())
      AND car.status     = 'active'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.coach_athlete_relationship car
    WHERE car.athlete_id = plan_adjustment_suggestions.athlete_id
      AND car.coach_id   = (select auth.uid())
      AND car.status     = 'active'
  ));

DROP POLICY IF EXISTS plan_adjustment_suggestions_service_all ON public.plan_adjustment_suggestions;
CREATE POLICY plan_adjustment_suggestions_service_all ON public.plan_adjustment_suggestions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =========================================================================
-- 2. upsert_plan_adjustment_suggestion — bundled here (not itemized
--    separately in design's migration table) because it operates on the
--    table and partial unique index just created above. Marks any existing
--    pending row 'superseded' as its own statement, THEN inserts, in that
--    order — avoiding a partial-unique-index violation without needing a
--    single-statement CTE (the pitfall documented in the migration
--    header). Called exclusively from planning-agent with service_role.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.upsert_plan_adjustment_suggestion(
  p_athlete_id           uuid,
  p_coach_id             uuid,
  p_triggering_alert_id  uuid,
  p_finding_source       text,
  p_patch_type           text,
  p_patch                jsonb,
  p_snapshot             jsonb,
  p_metrics              jsonb,
  p_message_es           text,
  p_earliest_target_date date
)
RETURNS TABLE (
  suggestion_id  uuid,
  superseded_id  uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_superseded_id uuid;
  v_new_id        uuid;
BEGIN
  -- Statement 1: supersede any existing pending row for this athlete, as
  -- its own statement (never combined with the INSERT below in one CTE —
  -- see migration header).
  UPDATE public.plan_adjustment_suggestions
     SET status = 'superseded', resolved_at = now(), updated_at = now()
   WHERE athlete_id = p_athlete_id
     AND status = 'pending'
  RETURNING id INTO v_superseded_id;

  -- Statement 2: insert the new pending row. The partial unique index
  -- cannot be violated here because statement 1 already cleared any prior
  -- pending row in the same transaction.
  INSERT INTO public.plan_adjustment_suggestions (
    athlete_id, coach_id, triggering_alert_id, finding_source, patch_type,
    patch, snapshot, metrics, message_es, earliest_target_date
  )
  VALUES (
    p_athlete_id, p_coach_id, p_triggering_alert_id, p_finding_source, p_patch_type,
    p_patch, p_snapshot, p_metrics, p_message_es, p_earliest_target_date
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT v_new_id, v_superseded_id;
END;
$function$;

-- Backend-only: invoked exclusively from planning-agent with service_role.
REVOKE EXECUTE ON FUNCTION public.upsert_plan_adjustment_suggestion(
  uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb, text, date
) FROM PUBLIC, anon, authenticated;

COMMIT;

-- =========================================================================
-- Migration: planning_candidates_rpc (UP)
-- get_planning_candidates(...) — alert-driven candidate query for the daily
-- planning sweep (design's "Candidate selection is alert-driven, not
-- roster-driven" decision: a new RPC rather than reusing Agent 1's
-- get_athletes_needing_load_refresh or Agent 2's get_engagement_candidates,
-- neither of which selects "has an actionable open finding").
--
-- expire_stale_plan_adjustments(p_today) — date-based expiry companion.
-- Cannot be a trigger (no row write happens when a date passes) so it runs
-- once at the head of each sweep; the apply RPC's own
-- scheduled_date > p_today re-validation is the guard that actually
-- matters at apply time (migration 4).
--
-- Both SECURITY DEFINER, SET search_path pinned, REVOKE FROM
-- PUBLIC/anon/authenticated — backend-only, invoked exclusively from
-- planning-agent with service_role.
-- See: openspec/changes/continuous-planning-agent/design.md
--      (Migration Plan #3, Interfaces / Contracts — get_planning_candidates,
--      "Date-Based Expiry" Requirement in
--      specs/plan-adjustment-suggestions/spec.md)
-- =========================================================================

BEGIN;

-- =========================================================================
-- 1. get_planning_candidates
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_planning_candidates(
  p_today   date,
  p_limit   integer DEFAULT 100,
  p_offset  integer DEFAULT 0
)
RETURNS TABLE (
  athlete_id  uuid,
  coach_id    uuid,
  alert_id    uuid,
  alert_type  text,
  severity    text,
  metrics     jsonb,
  created_at  timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT tla.athlete_id, car.coach_id, tla.id AS alert_id,
         tla.alert_type, tla.severity, tla.metrics, tla.created_at
  FROM public.training_load_alerts tla
  JOIN public.coach_athlete_relationship car
    ON car.athlete_id = tla.athlete_id AND car.status = 'active'
  WHERE tla.status = 'open'
    AND tla.dismissed_at IS NULL
    AND tla.alert_type IN ('acwr_zone', 'tsb_critical', 'low_completion')
    AND NOT EXISTS (
      SELECT 1 FROM public.plan_adjustment_suggestions pas
      WHERE pas.athlete_id = tla.athlete_id AND pas.status = 'pending'
    )
  ORDER BY tla.athlete_id, tla.alert_type
  LIMIT p_limit OFFSET p_offset;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_planning_candidates(date, integer, integer)
  FROM PUBLIC, anon, authenticated;

-- =========================================================================
-- 2. expire_stale_plan_adjustments — date-based expiry. earliest_target_
--    date < p_today (strictly before "today"), not <=: a suggestion whose
--    earliest target session is still scheduled for today is handled by
--    the apply RPC's own scheduled_date > p_today re-validation
--    (drift/refusal path, migration 4), not this sweep-time expiry.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.expire_stale_plan_adjustments(p_today date)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  UPDATE public.plan_adjustment_suggestions
     SET status = 'expired', resolved_at = now(), updated_at = now()
   WHERE status = 'pending'
     AND earliest_target_date < p_today;
$function$;

REVOKE EXECUTE ON FUNCTION public.expire_stale_plan_adjustments(date)
  FROM PUBLIC, anon, authenticated;

COMMIT;

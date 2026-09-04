-- =========================================================================
-- Migration: engagement_sweep_rpc (UP)
-- get_engagement_candidates(...) — SECURITY DEFINER candidate query for the
-- daily engagement sweep. One round trip per page: four MAX() signal-of-
-- life probes + a planned-session count, per coach-supervised athlete past
-- warm-up. Follows the repo's existing SECURITY DEFINER RPC pattern
-- (search_path pinned, REVOKE FROM PUBLIC/anon/authenticated).
-- See: openspec/changes/adherence-detection-agent/design.md
--      (Migration Plan #2, Interfaces / Contracts —
--      get_engagement_candidates)
--
-- Candidate set is the INVERSE of Agent 1's get_athletes_needing_load_
-- refresh: gated on coach_athlete_relationship (active, past warm-up),
-- with NO activity-existence predicate and NO freshness predicate — every
-- supervised athlete past warm-up must be evaluated every day, because
-- excluding on recent-activity would exclude exactly the population being
-- hunted.
-- =========================================================================

BEGIN;

-- =========================================================================
-- 1. Supporting indexes (each IF NOT EXISTS). idx_training_sessions_
--    athlete_date already exists from Agent 1 (migration
--    20260819142000_training_load_alerts.sql) — no new index needed there.
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_wellness_log_athlete_date
  ON public.wellness_log (athlete_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_created
  ON public.chat_messages (sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_car_status_start_date
  ON public.coach_athlete_relationship (status, start_date);

-- =========================================================================
-- 2. get_engagement_candidates
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_engagement_candidates(
  p_today        date,
  p_warmup_days  integer,
  p_window_days  integer,
  p_limit        integer DEFAULT 200,
  p_offset       integer DEFAULT 0
)
RETURNS TABLE (
  athlete_id                 uuid,
  coach_id                   uuid,
  start_date                 date,
  last_session_completed_at  timestamptz,
  last_wellness_date         date,
  last_strava_at             timestamptz,
  last_athlete_message_at    timestamptz,
  planned_in_window          integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT car.athlete_id,
         car.coach_id,
         car.start_date,
         (SELECT max(ts.completed_at)     FROM public.training_sessions ts WHERE ts.athlete_id = car.athlete_id)      AS last_session_completed_at,
         (SELECT max(wl.date)             FROM public.wellness_log wl      WHERE wl.athlete_id = car.athlete_id)      AS last_wellness_date,
         (SELECT max(sa.start_date_local) FROM public.strava_activities sa WHERE sa.athlete_id = car.athlete_id
                                                                              AND sa.deleted = false)                 AS last_strava_at,
         (SELECT max(cm.created_at)       FROM public.chat_messages cm     WHERE cm.sender_id = car.athlete_id)       AS last_athlete_message_at,
         (SELECT count(*)::integer FROM public.training_sessions ts2
           WHERE ts2.athlete_id = car.athlete_id
             AND ts2.scheduled_date BETWEEN (p_today - p_window_days) AND p_today)                                   AS planned_in_window
  FROM public.coach_athlete_relationship car
  WHERE car.status = 'active'
    AND car.start_date IS NOT NULL
    AND car.start_date <= p_today - p_warmup_days
  ORDER BY car.athlete_id
  LIMIT p_limit OFFSET p_offset;
$function$;

-- Backend-only, mirroring get_athletes_needing_load_refresh's grant shape:
-- invoked exclusively from engagement-monitor with service_role, never
-- from the client.
REVOKE EXECUTE ON FUNCTION public.get_engagement_candidates(date, integer, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;

COMMIT;

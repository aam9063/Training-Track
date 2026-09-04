-- =========================================================================
-- Migration: engagement_reactive_resolve (UP)
-- resolve_engagement_alerts(uuid) + tg_resolve_engagement_alerts() +
-- three AFTER triggers on training_sessions / wellness_log / chat_messages.
--
-- Resolution must be CAUSED BY the signal, not CLAIMED BY the client: a
-- trigger cannot fire without an actual row write, unlike a client-callable
-- RPC (which would need SECURITY DEFINER since the athlete has no UPDATE
-- grant on this table, letting an athlete silently clear their own
-- churn-risk flag). resolve_engagement_alerts is therefore
-- REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated — it has NO
-- client-reachable entry point at all; it is invoked only by these
-- triggers and by a direct .rpc() call from strava-webhook (server-side,
-- next migration/task — see design.md's Decision: "Reactive resolve via
-- AFTER triggers, not a client-callable RPC").
--
-- strava_activities deliberately gets NO trigger here: the deep-ingestion
-- backfill bulk-inserts HISTORICAL activities, and a trigger would resolve
-- open alerts from months-old data — a correctness bug, not just cost.
--
-- Pre-existing triggers on these three tables (orchestrator-verified V1,
-- live query, project lusirdkixfliydimemre):
--   chat_messages.trg_push_chat_message (AFTER INSERT)
--   training_sessions.trg_notify_athlete_training_assigned (AFTER INSERT)
--   training_sessions.trg_notify_coach_training_completed (AFTER UPDATE)
--   wellness_log: zero triggers
-- Multiple AFTER triggers on the same table/event coexist fine in
-- Postgres — the triggers below are additive, not colliding or replacing
-- anything.
--
-- Idempotent/flood-safe by construction: this trigger only UPDATEs
-- `... WHERE status = 'open'` — no push, no notifications insert, no
-- fan-out. When nothing is open it is one probe of the partial unique
-- index and zero row writes (safety against the documented
-- trg_push_acwr_alert flood incident).
-- See: openspec/changes/adherence-detection-agent/design.md
--      (Migration Plan #4, "Reactive resolve" SQL)
-- =========================================================================

BEGIN;

-- =========================================================================
-- 1. resolve_engagement_alerts — no client-reachable entry point
-- =========================================================================
CREATE OR REPLACE FUNCTION public.resolve_engagement_alerts(p_athlete_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  UPDATE public.athlete_engagement_alerts
     SET status = 'resolved', resolved_at = now(), updated_at = now()
   WHERE athlete_id = p_athlete_id AND status = 'open';
$function$;

REVOKE EXECUTE ON FUNCTION public.resolve_engagement_alerts(uuid)
  FROM PUBLIC, anon, authenticated;

-- =========================================================================
-- 2. tg_resolve_engagement_alerts — shared trigger function, branches on
--    TG_TABLE_NAME because chat_messages keys on sender_id, the other two
--    on athlete_id.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.tg_resolve_engagement_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_athlete_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'chat_messages' THEN
    v_athlete_id := NEW.sender_id;
  ELSE
    v_athlete_id := NEW.athlete_id;
  END IF;

  PERFORM public.resolve_engagement_alerts(v_athlete_id);
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.tg_resolve_engagement_alerts()
  FROM PUBLIC, anon, authenticated;

-- =========================================================================
-- 3. Triggers — additive, do not replace any pre-existing trigger.
-- =========================================================================

-- Session completed. Only the transition INTO 'completed' resolves — not
-- 'skipped', matching design.md's explicit trigger table (the signal-of-
-- life MAX() query in get_engagement_candidates separately covers
-- completed_at regardless of how it got set; this trigger's WHEN guard is
-- deliberately narrower).
DROP TRIGGER IF EXISTS trg_resolve_engagement_on_session_completed ON public.training_sessions;
CREATE TRIGGER trg_resolve_engagement_on_session_completed
  AFTER UPDATE ON public.training_sessions
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION public.tg_resolve_engagement_alerts();

-- Wellness entry — row existence for a date IS the signal (wellness_log
-- has no status column, confirmed live, orchestrator V2).
DROP TRIGGER IF EXISTS trg_resolve_engagement_on_wellness ON public.wellness_log;
CREATE TRIGGER trg_resolve_engagement_on_wellness
  AFTER INSERT OR UPDATE ON public.wellness_log
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_resolve_engagement_alerts();

-- Athlete-sent chat message. sender_id = athlete_id is a valid athlete-sent
-- test because athletes.id IS users.id (schema.sql:102) — a coach-sent
-- message resolves nothing, because no alert row is ever keyed on the
-- coach's id.
DROP TRIGGER IF EXISTS trg_resolve_engagement_on_chat_message ON public.chat_messages;
CREATE TRIGGER trg_resolve_engagement_on_chat_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_resolve_engagement_alerts();

COMMIT;

-- =========================================================================
-- Rollback: engagement_reactive_resolve (DOWN)
-- Reverses 20260901103000_engagement_reactive_resolve.sql. Drops only the
-- three triggers and functions this migration created — does not touch
-- any pre-existing trigger on these tables (trg_push_chat_message,
-- trg_notify_athlete_training_assigned, trg_notify_coach_training_completed).
-- =========================================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_resolve_engagement_on_session_completed ON public.training_sessions;
DROP TRIGGER IF EXISTS trg_resolve_engagement_on_wellness ON public.wellness_log;
DROP TRIGGER IF EXISTS trg_resolve_engagement_on_chat_message ON public.chat_messages;

DROP FUNCTION IF EXISTS public.tg_resolve_engagement_alerts();
DROP FUNCTION IF EXISTS public.resolve_engagement_alerts(uuid);

COMMIT;

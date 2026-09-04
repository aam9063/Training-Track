-- Verification for engagement_reactive_resolve.
-- 1 row per check, OK / FAIL. Read-only, safe to re-run.

SELECT 'function.resolve_engagement_alerts.exists' AS check_name,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_proc
         WHERE proname = 'resolve_engagement_alerts'
           AND pronamespace = 'public'::regnamespace
       ) THEN 'OK' ELSE 'FAIL' END AS status
UNION ALL
SELECT 'function.resolve_engagement_alerts.revoked_from_authenticated',
       CASE WHEN NOT EXISTS (
         SELECT 1 FROM information_schema.role_routine_grants
         WHERE routine_schema = 'public'
           AND routine_name = 'resolve_engagement_alerts'
           AND grantee IN ('authenticated', 'anon', 'PUBLIC')
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'function.tg_resolve_engagement_alerts.exists',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_proc
         WHERE proname = 'tg_resolve_engagement_alerts'
           AND pronamespace = 'public'::regnamespace
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'trigger.training_sessions.exists',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.triggers
         WHERE event_object_schema = 'public'
           AND event_object_table = 'training_sessions'
           AND trigger_name = 'trg_resolve_engagement_on_session_completed'
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'trigger.wellness_log.exists',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.triggers
         WHERE event_object_schema = 'public'
           AND event_object_table = 'wellness_log'
           AND trigger_name = 'trg_resolve_engagement_on_wellness'
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'trigger.chat_messages.exists',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.triggers
         WHERE event_object_schema = 'public'
           AND event_object_table = 'chat_messages'
           AND trigger_name = 'trg_resolve_engagement_on_chat_message'
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
-- Pre-existing triggers must still be present (additive, not replaced).
SELECT 'trigger.pre_existing_not_removed',
       CASE WHEN (
         SELECT count(*) FROM information_schema.triggers
         WHERE event_object_schema = 'public'
           AND event_object_table IN ('training_sessions', 'chat_messages')
           AND trigger_name IN (
             'trg_push_chat_message',
             'trg_notify_athlete_training_assigned',
             'trg_notify_coach_training_completed'
           )
       ) = 3 THEN 'OK' ELSE 'FAIL' END;

-- Manual follow-up (documented, not automated here — requires a real
-- open alert row and real athlete_id, wrapped in its own transaction so a
-- test write can be rolled back):
--   BEGIN;
--     INSERT INTO public.athlete_engagement_alerts
--       (athlete_id, recipient_id, alert_type, severity, metric_date,
--        silence_days, message_es, episode_started_on, last_seen_on)
--     VALUES ('<athlete_id>', '<coach_id>', 'engagement_silence', 'warning',
--             CURRENT_DATE, 12, 'test', CURRENT_DATE, CURRENT_DATE);
--     INSERT INTO public.wellness_log (athlete_id, date, sleep_hours)
--     VALUES ('<athlete_id>', CURRENT_DATE, 7);
--     SELECT status FROM public.athlete_engagement_alerts
--       WHERE athlete_id = '<athlete_id>' ORDER BY created_at DESC LIMIT 1;
--     -- expect: 'resolved', with zero sweep runs
--   ROLLBACK;
--   -- As `authenticated`: SELECT resolve_engagement_alerts('<athlete_id>');
--   -- expect: ERROR - permission denied for function resolve_engagement_alerts

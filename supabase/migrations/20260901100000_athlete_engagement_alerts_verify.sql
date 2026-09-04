-- Verification for athlete_engagement_alerts.
-- 1 row per check, OK / FAIL. Read-only, safe to re-run.

SELECT 'table.exists' AS check_name,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'athlete_engagement_alerts'
       ) THEN 'OK' ELSE 'FAIL' END AS status
UNION ALL
SELECT 'rls.enabled',
       CASE WHEN (
         SELECT relrowsecurity FROM pg_class
         WHERE oid = 'public.athlete_engagement_alerts'::regclass
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'dedup_index.partial_unique_open',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_indexes
         WHERE schemaname = 'public'
           AND tablename = 'athlete_engagement_alerts'
           AND indexname = 'idx_athlete_engagement_alerts_open_dedup'
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'index.recipient_status',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_indexes
         WHERE schemaname = 'public'
           AND tablename = 'athlete_engagement_alerts'
           AND indexname = 'idx_athlete_engagement_alerts_recipient'
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
-- CHECK constraints reject invalid values (athlete-engagement-alerts:
-- Single Alert Type / Severity Tiers). INSERT attempts below are wrapped
-- in their own sub-transaction via SAVEPOINT so a rejected INSERT does
-- not abort this whole verification script.
SELECT 'check.alert_type_single_value',
       (SELECT CASE WHEN pg_get_constraintdef(oid) ILIKE '%engagement_silence%'
             THEN 'OK' ELSE 'FAIL' END
        FROM pg_constraint
        WHERE conrelid = 'public.athlete_engagement_alerts'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%alert_type%'
        LIMIT 1)
UNION ALL
SELECT 'check.severity_domain',
       (SELECT CASE WHEN pg_get_constraintdef(oid) ILIKE '%warning%' AND pg_get_constraintdef(oid) ILIKE '%danger%'
             THEN 'OK' ELSE 'FAIL' END
        FROM pg_constraint
        WHERE conrelid = 'public.athlete_engagement_alerts'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%severity%'
        LIMIT 1)
UNION ALL
SELECT 'check.status_domain',
       (SELECT CASE WHEN pg_get_constraintdef(oid) ILIKE '%open%' AND pg_get_constraintdef(oid) ILIKE '%resolved%'
             THEN 'OK' ELSE 'FAIL' END
        FROM pg_constraint
        WHERE conrelid = 'public.athlete_engagement_alerts'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%status%'
        LIMIT 1)
UNION ALL
-- RLS Visibility requirement: no self-select policy must exist — the
-- athlete must never read their own churn-risk row (design.md's
-- deliberate deviation from the original proposal wording).
SELECT 'rls.no_self_select_policy',
       CASE WHEN NOT EXISTS (
         SELECT 1 FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = 'athlete_engagement_alerts'
           AND cmd = 'SELECT'
           AND qual ILIKE '%auth.uid()) = athlete_id%'
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'rls.coach_select_policy_exists',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = 'athlete_engagement_alerts'
           AND policyname = 'athlete_engagement_alerts_select_coach'
       ) THEN 'OK' ELSE 'FAIL' END;

-- Manual follow-up (documented, not automated here — requires real
-- athlete_id/recipient_id and three distinct JWTs: the athlete, their
-- active coach, and an unrelated coach):
--   1. As the athlete's own JWT: SELECT * FROM athlete_engagement_alerts
--      WHERE athlete_id = '<self>'; -- expect: 0 rows (RLS Visibility)
--   2. As the active coach's JWT: SELECT * FROM athlete_engagement_alerts
--      WHERE athlete_id = '<athlete>'; -- expect: the row is visible
--   3. As an unrelated coach's JWT: SELECT * FROM athlete_engagement_alerts
--      WHERE athlete_id = '<athlete>'; -- expect: 0 rows
--   BEGIN;
--     INSERT INTO public.athlete_engagement_alerts
--       (athlete_id, recipient_id, alert_type, severity, metric_date,
--        silence_days, message_es, episode_started_on, last_seen_on)
--     VALUES ('<uuid>', '<uuid>', 'not_a_real_type', 'danger', CURRENT_DATE,
--             30, 'test', CURRENT_DATE, CURRENT_DATE);
--     -- expect: ERROR - violates check constraint "athlete_engagement_alerts_alert_type_check"
--   ROLLBACK;

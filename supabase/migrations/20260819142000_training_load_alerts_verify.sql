-- Verification for training_load_alerts.
-- 1 row per check, OK / FAIL. Read-only, safe to re-run.

SELECT 'table.exists' AS check_name,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'training_load_alerts'
       ) THEN 'OK' ELSE 'FAIL' END AS status
UNION ALL
SELECT 'rls.enabled',
       CASE WHEN (
         SELECT relrowsecurity FROM pg_class
         WHERE oid = 'public.training_load_alerts'::regclass
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'dedup_index.partial_unique_open',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_indexes
         WHERE schemaname = 'public'
           AND tablename = 'training_load_alerts'
           AND indexname = 'idx_training_load_alerts_open_dedup'
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'index.training_sessions_athlete_date',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_indexes
         WHERE schemaname = 'public'
           AND tablename = 'training_sessions'
           AND indexname = 'idx_training_sessions_athlete_date'
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
-- CHECK constraints reject invalid values (training-load-alerts: Alert
-- Type Taxonomy). These INSERT attempts are wrapped in their own
-- sub-transactions via SAVEPOINT so a rejected INSERT does not abort this
-- whole verification script.
SELECT 'check.alert_type_rejects_invalid',
       (SELECT CASE WHEN check_clause ILIKE '%acwr_zone%' AND check_clause ILIKE '%tsb_critical%'
                     AND check_clause ILIKE '%low_completion%' AND check_clause ILIKE '%high_rpe%'
             THEN 'OK' ELSE 'FAIL' END
        FROM information_schema.check_constraints
        WHERE constraint_schema = 'public'
          AND constraint_name IN (
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'public.training_load_alerts'::regclass
              AND contype = 'c'
              AND pg_get_constraintdef(oid) ILIKE '%alert_type%'
          )
        LIMIT 1)
UNION ALL
SELECT 'check.severity_domain',
       (SELECT CASE WHEN pg_get_constraintdef(oid) ILIKE '%warning%' AND pg_get_constraintdef(oid) ILIKE '%critical%'
             THEN 'OK' ELSE 'FAIL' END
        FROM pg_constraint
        WHERE conrelid = 'public.training_load_alerts'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%severity%'
        LIMIT 1)
UNION ALL
SELECT 'check.status_domain',
       (SELECT CASE WHEN pg_get_constraintdef(oid) ILIKE '%open%' AND pg_get_constraintdef(oid) ILIKE '%resolved%'
             THEN 'OK' ELSE 'FAIL' END
        FROM pg_constraint
        WHERE conrelid = 'public.training_load_alerts'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%status%'
        LIMIT 1);

-- Manual follow-up (documented, not automated here — requires a real
-- athlete_id/recipient_id and is destructive if not rolled back):
--   BEGIN;
--     INSERT INTO public.training_load_alerts
--       (athlete_id, recipient_id, alert_type, severity, metric_date,
--        message_es, episode_started_on, last_seen_on)
--     VALUES ('<uuid>', '<uuid>', 'not_a_real_type', 'critical', CURRENT_DATE,
--             'test', CURRENT_DATE, CURRENT_DATE);
--     -- expect: ERROR - violates check constraint "training_load_alerts_alert_type_check"
--   ROLLBACK;

-- Verification for daily_training_load_baseline.
-- 1 row per check, OK / FAIL. Safe to run any number of times (read-only).

SELECT 'table.exists' AS check_name,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'daily_training_load'
       ) THEN 'OK' ELSE 'FAIL' END AS status
UNION ALL
SELECT 'rls.enabled',
       CASE WHEN (
         SELECT relrowsecurity FROM pg_class
         WHERE oid = 'public.daily_training_load'::regclass
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'unique_index.athlete_date',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_indexes
         WHERE schemaname = 'public'
           AND tablename = 'daily_training_load'
           AND indexname = 'idx_daily_training_load_athlete_date'
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'policies.count',
       CASE WHEN (
         SELECT COUNT(*) FROM pg_policies
         WHERE schemaname = 'public' AND tablename = 'daily_training_load'
           AND policyname IN (
             'daily_training_load_select',
             'daily_training_load_insert',
             'daily_training_load_update',
             'dtl_write_own_insert',
             'dtl_write_own_update'
           )
       ) = 5 THEN 'OK' ELSE 'FAIL' END
UNION ALL
-- Self-select scenario (training-load-metrics: "Independent athlete self-select")
-- Expected TRUE: policy expression references (select auth.uid()) = athlete_id.
SELECT 'policy.select_self_scoped',
       CASE WHEN (
         SELECT qual FROM pg_policies
         WHERE schemaname = 'public' AND tablename = 'daily_training_load'
           AND policyname = 'daily_training_load_select'
       ) ILIKE '%auth.uid%athlete_id%'
       THEN 'OK' ELSE 'FAIL' END
UNION ALL
-- Coach-select scenario references an active coach_athlete_relationship.
SELECT 'policy.select_coach_active_scoped',
       CASE WHEN (
         SELECT qual FROM pg_policies
         WHERE schemaname = 'public' AND tablename = 'daily_training_load'
           AND policyname = 'daily_training_load_select'
       ) ILIKE '%coach_athlete_relationship%active%'
       THEN 'OK' ELSE 'FAIL' END;

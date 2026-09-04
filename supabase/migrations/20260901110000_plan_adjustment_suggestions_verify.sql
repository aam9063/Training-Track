-- Verification for plan_adjustment_suggestions.
-- 1 row per check, OK / FAIL. Read-only, safe to re-run.

SELECT 'table.exists' AS check_name,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'plan_adjustment_suggestions'
       ) THEN 'OK' ELSE 'FAIL' END AS status
UNION ALL
SELECT 'rls.enabled',
       CASE WHEN (
         SELECT relrowsecurity FROM pg_class
         WHERE oid = 'public.plan_adjustment_suggestions'::regclass
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'dedup_index.partial_unique_pending',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_indexes
         WHERE schemaname = 'public'
           AND tablename = 'plan_adjustment_suggestions'
           AND indexname = 'idx_plan_adjustment_suggestions_pending_dedup'
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'index.alert_pending',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_indexes
         WHERE schemaname = 'public'
           AND tablename = 'plan_adjustment_suggestions'
           AND indexname = 'idx_plan_adjustment_suggestions_alert_pending'
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'index.coach_status',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_indexes
         WHERE schemaname = 'public'
           AND tablename = 'plan_adjustment_suggestions'
           AND indexname = 'idx_plan_adjustment_suggestions_coach_status'
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
-- CHECK constraints reject invalid values (spec's "Suggestion Schema and
-- Statuses" requirement).
SELECT 'check.finding_source_domain',
       (SELECT CASE WHEN pg_get_constraintdef(oid) ILIKE '%acwr_zone%'
             AND pg_get_constraintdef(oid) ILIKE '%tsb_critical%'
             AND pg_get_constraintdef(oid) ILIKE '%low_completion%'
             THEN 'OK' ELSE 'FAIL' END
        FROM pg_constraint
        WHERE conrelid = 'public.plan_adjustment_suggestions'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%finding_source%'
        LIMIT 1)
UNION ALL
SELECT 'check.patch_type_domain',
       (SELECT CASE WHEN pg_get_constraintdef(oid) ILIKE '%deload_volume%'
             AND pg_get_constraintdef(oid) ILIKE '%insert_recovery%'
             AND pg_get_constraintdef(oid) ILIKE '%reduce_frequency%'
             THEN 'OK' ELSE 'FAIL' END
        FROM pg_constraint
        WHERE conrelid = 'public.plan_adjustment_suggestions'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%patch_type%'
        LIMIT 1)
UNION ALL
SELECT 'check.status_domain',
       (SELECT CASE WHEN pg_get_constraintdef(oid) ILIKE '%pending%'
             AND pg_get_constraintdef(oid) ILIKE '%approved%'
             AND pg_get_constraintdef(oid) ILIKE '%rejected%'
             AND pg_get_constraintdef(oid) ILIKE '%expired%'
             AND pg_get_constraintdef(oid) ILIKE '%superseded%'
             THEN 'OK' ELSE 'FAIL' END
        FROM pg_constraint
        WHERE conrelid = 'public.plan_adjustment_suggestions'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%status%'
          AND pg_get_constraintdef(oid) NOT ILIKE '%finding_source%'
          AND pg_get_constraintdef(oid) NOT ILIKE '%patch_type%'
        LIMIT 1)
UNION ALL
-- RLS Visibility requirement: no self-select policy must exist — the
-- athlete must never read their own suggestion row.
SELECT 'rls.no_self_select_policy',
       CASE WHEN NOT EXISTS (
         SELECT 1 FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = 'plan_adjustment_suggestions'
           AND cmd = 'SELECT'
           AND qual ILIKE '%auth.uid()) = athlete_id%'
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'rls.coach_select_policy_exists',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = 'plan_adjustment_suggestions'
           AND policyname = 'plan_adjustment_suggestions_select_coach'
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'rls.single_select_policy_no_advisor_warning',
       CASE WHEN (
         SELECT count(*) FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = 'plan_adjustment_suggestions'
           AND cmd = 'SELECT'
       ) = 1 THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'function.upsert_plan_adjustment_suggestion_exists',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'upsert_plan_adjustment_suggestion'
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'function.upsert_revoked_from_authenticated',
       CASE WHEN NOT EXISTS (
         SELECT 1 FROM information_schema.routine_privileges
         WHERE routine_schema = 'public'
           AND routine_name = 'upsert_plan_adjustment_suggestion'
           AND grantee = 'authenticated'
       ) THEN 'OK' ELSE 'FAIL' END;

-- Manual follow-up (documented, not automated here — requires real
-- athlete_id/coach_id/triggering_alert_id uuids and distinct JWTs):
--   1. As service_role, call upsert_plan_adjustment_suggestion(...) twice
--      for the same athlete_id -> expect: 1st insert returns
--      superseded_id=NULL, 2nd returns superseded_id = 1st's suggestion_id,
--      and exactly ONE row with status='pending' remains for that athlete.
--   2. As the athlete's own JWT: SELECT * FROM plan_adjustment_suggestions
--      WHERE athlete_id = '<self>'; -- expect: 0 rows.
--   3. As the active coach's JWT: same query -- expect: the row is visible.
--   4. As an unrelated coach's JWT: same query -- expect: 0 rows.

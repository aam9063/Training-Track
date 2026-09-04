-- Verification for weekly_ai_reports_masked_view (D9).
-- 1 row per check, OK / FAIL. Read-only, safe to re-run.
-- Static/metadata checks only -- the actual per-role masking behavior
-- (coach sees wide, athlete sees narrow, unrelated users see zero rows,
-- direct base-table reads are denied) requires simulated JWTs and is the
-- orchestrator's live-verification step, not reproducible here.

SELECT 'column.summary_athlete_safe_exists' AS check_name,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'weekly_ai_reports'
           AND column_name = 'summary_athlete_safe'
       ) THEN 'OK' ELSE 'FAIL' END AS status
UNION ALL
SELECT 'rls.force_enabled',
       CASE WHEN (
         SELECT relforcerowsecurity FROM pg_class
         WHERE oid = 'public.weekly_ai_reports'::regclass
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'grant.authenticated_select_revoked_on_base_table',
       CASE WHEN NOT EXISTS (
         SELECT 1 FROM information_schema.role_table_grants
         WHERE table_schema = 'public' AND table_name = 'weekly_ai_reports'
           AND grantee = 'authenticated' AND privilege_type = 'SELECT'
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'grant.anon_select_revoked_on_base_table',
       CASE WHEN NOT EXISTS (
         SELECT 1 FROM information_schema.role_table_grants
         WHERE table_schema = 'public' AND table_name = 'weekly_ai_reports'
           AND grantee = 'anon' AND privilege_type = 'SELECT'
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'grant.service_role_select_untouched',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.role_table_grants
         WHERE table_schema = 'public' AND table_name = 'weekly_ai_reports'
           AND grantee = 'service_role' AND privilege_type = 'SELECT'
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'view.exists',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.views
         WHERE table_schema = 'public' AND table_name = 'weekly_ai_reports_for_role'
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'view.does_not_expose_raw_athlete_safe_columns',
       CASE WHEN NOT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'weekly_ai_reports_for_role'
           AND column_name IN ('ai_analysis_athlete_safe', 'summary_athlete_safe')
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'grant.authenticated_select_on_view',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.role_table_grants
         WHERE table_schema = 'public' AND table_name = 'weekly_ai_reports_for_role'
           AND grantee = 'authenticated' AND privilege_type = 'SELECT'
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'grant.anon_select_on_view_absent',
       CASE WHEN NOT EXISTS (
         SELECT 1 FROM information_schema.role_table_grants
         WHERE table_schema = 'public' AND table_name = 'weekly_ai_reports_for_role'
           AND grantee = 'anon' AND privilege_type = 'SELECT'
       ) THEN 'OK' ELSE 'FAIL' END;

-- Manual follow-up (documented, not automated here -- requires a real
-- report row and TWO distinct JWTs: the report's own coach and the
-- report's own athlete, plus a THIRD unrelated JWT):
--   1. As the report's own coach JWT:
--        SELECT ai_analysis, summary FROM weekly_ai_reports_for_role
--        WHERE id = '<report_id>';
--      -- expect: the WIDE ai_analysis/summary (matches the base table's
--      -- own ai_analysis/summary for this row)
--   2. As the report's own athlete JWT (same query):
--      -- expect: the NARROW ai_analysis_athlete_safe/summary_athlete_safe
--      -- content, returned under the ai_analysis/summary names -- never
--      -- any engagement_alerts / plan_adjustments content
--   3. As an unrelated coach or athlete JWT (same query):
--      -- expect: 0 rows
--   4. As the athlete JWT, directly against the BASE table:
--        SELECT ai_analysis FROM weekly_ai_reports WHERE id = '<report_id>';
--      -- expect: permission denied (42501) -- NOT the wide content, NOT
--      -- zero rows with a 200 -- this is what the REVOKE actually fixes
--      -- versus Phase 6's app-layer-only attempt

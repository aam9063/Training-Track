-- Verification for weekly_ai_reports_masking_rpc (D10).
-- 1 row per check, OK / FAIL. Read-only, safe to re-run.
-- Static/metadata checks only -- the actual per-role masking/row-visibility
-- behavior (coach sees wide, athlete sees narrow, unrelated users see zero
-- rows, direct base-table reads are still denied) requires simulated JWTs
-- and is the orchestrator's live-verification step, not reproducible here.

SELECT 'function.get_weekly_ai_reports_exists' AS check_name,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'get_weekly_ai_reports'
       ) THEN 'OK' ELSE 'FAIL' END AS status
UNION ALL
SELECT 'function.is_security_definer',
       CASE WHEN (
         SELECT p.prosecdef FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'get_weekly_ai_reports'
         LIMIT 1
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'grant.authenticated_can_execute',
       CASE WHEN has_function_privilege('authenticated', 'public.get_weekly_ai_reports(uuid, uuid, date, text)', 'EXECUTE')
       THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'grant.anon_cannot_execute',
       CASE WHEN NOT has_function_privilege('anon', 'public.get_weekly_ai_reports(uuid, uuid, date, text)', 'EXECUTE')
       THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'view.weekly_ai_reports_for_role_dropped',
       CASE WHEN NOT EXISTS (
         SELECT 1 FROM information_schema.views
         WHERE table_schema = 'public' AND table_name = 'weekly_ai_reports_for_role'
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
-- Sanity re-check that 20260903130000's grants/RLS are still intact (this
-- migration must not have disturbed them):
SELECT 'grant.authenticated_select_still_revoked_on_base_table',
       CASE WHEN NOT EXISTS (
         SELECT 1 FROM information_schema.role_table_grants
         WHERE table_schema = 'public' AND table_name = 'weekly_ai_reports'
           AND grantee = 'authenticated' AND privilege_type = 'SELECT'
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'rls.force_still_enabled',
       CASE WHEN (
         SELECT relforcerowsecurity FROM pg_class
         WHERE oid = 'public.weekly_ai_reports'::regclass
       ) THEN 'OK' ELSE 'FAIL' END;

-- Manual follow-up (documented, not automated here -- requires a real
-- report row and THREE distinct JWTs: the report's own coach, the report's
-- own athlete, and an unrelated user):
--   1. As the report's own coach JWT:
--        SELECT ai_analysis, summary FROM get_weekly_ai_reports()
--        WHERE id = '<report_id>';  -- (or filter via p_coach_id)
--      -- expect: the WIDE ai_analysis/summary (matches the base table's
--      -- own ai_analysis/summary for this row)
--   2. As the report's own athlete JWT (p_athlete_id = self):
--      -- expect: the NARROW ai_analysis_athlete_safe/summary_athlete_safe
--      -- content, returned under the ai_analysis/summary names
--   3. As an unrelated coach or athlete JWT:
--      -- expect: 0 rows
--   4. As the athlete JWT, directly against the BASE table:
--        SELECT ai_analysis FROM weekly_ai_reports WHERE id = '<report_id>';
--      -- expect: permission denied (42501) -- unchanged from 20260903130000,
--      -- re-confirmed here since this migration is the one that actually
--      -- fixes the row-visibility mechanism the earlier view got wrong

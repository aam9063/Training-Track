-- =========================================================================
-- Migration: weekly_ai_reports_masking_rpc (UP)
-- Communication-agent D10 (Phase 8): fixes a CRITICAL flaw in the migration
-- this file supersedes (20260903130000_weekly_ai_reports_masked_view.sql,
-- already LIVE in production, applied before this flaw was discovered).
--
-- THE FLAW (live-tested by the orchestrator in production, rolled-back
-- transactions, real simulated JWTs, 2026-09-03): 20260903130000's design
-- assumed `ALTER TABLE weekly_ai_reports FORCE ROW LEVEL SECURITY` would
-- make the masking view (owned by `postgres`, the table owner) respect
-- row-level filtering instead of bypassing it. That assumption is WRONG for
-- this project specifically: `SELECT rolname, rolbypassrls FROM pg_roles`
-- confirms `postgres` here has `rolbypassrls = true`. FORCE ROW LEVEL
-- SECURITY does NOT override an explicit BYPASSRLS role attribute — this is
-- documented, intended Postgres behavior, not a bug in Postgres or in
-- 20260903130000's SQL. The practical consequence: `weekly_ai_reports_for_role`
-- returned EVERY row to EVERY caller holding SELECT on it, completely
-- bypassing row-level filtering (though its column-masking CASE expressions
-- were themselves correct — the row-visibility mechanism was the only
-- broken part).
--
-- A `security_invoker = true` fix was also tried and confirmed to fail
-- DIFFERENTLY: it requires the CALLING role to hold direct SELECT on the
-- base table, which 20260903130000's own `REVOKE SELECT ... FROM
-- authenticated` (correct, and unchanged by this migration) makes
-- impossible. Dead end.
--
-- THE FIX (live-verified by the orchestrator, rolled-back transactions, 3
-- real scenarios, 2026-09-03): a SECURITY DEFINER function with the
-- row-filter written EXPLICITLY in its own WHERE clause —
-- `WHERE ((select auth.uid()) = athlete_id OR (select auth.uid()) =
-- coach_id)` — inside the function body. This works regardless of the
-- definer's BYPASSRLS status, because the filter is literal SQL evaluated
-- by the function itself, not something that depends on RLS policies being
-- "applied" to the definer at all. Confirmed live: (a) a coach querying for
-- their own athlete's report gets the WIDE ai_analysis/summary; (b) that
-- SAME athlete querying their OWN report gets the NARROW *_athlete_safe
-- content; (c) an unrelated user gets ZERO rows; (d) direct base-table
-- access as `authenticated` is still denied (20260903130000's REVOKE
-- already covers this and is untouched by this migration).
--
-- REUSABLE LESSON for this project (not specific to this table): a masking
-- VIEW's correctness depends entirely on whether the view owner carries
-- BYPASSRLS. `FORCE ROW LEVEL SECURITY` on the base table is NOT sufficient
-- to guarantee row-scoping through a view if the view owner is a
-- BYPASSRLS role (true for `postgres` in this project, confirmed via
-- pg_roles) — always verify `rolbypassrls` for the actual role that will
-- own the view/migration-created objects before relying on FORCE ROW LEVEL
-- SECURITY for column-masking-via-view designs in this project. A
-- SECURITY DEFINER function with an explicit WHERE-clause row-filter is not
-- subject to this failure mode at all, and is the safer default pattern for
-- any future per-row-masked read surface here.
--
-- STATE THIS MIGRATION FINDS ITSELF IN: 20260903130000 is ALREADY LIVE.
-- `weekly_ai_reports` already has `ai_analysis_athlete_safe`/
-- `summary_athlete_safe` columns, FORCE ROW LEVEL SECURITY, and
-- `authenticated`/`anon` SELECT already revoked on the base table — all
-- correct, all untouched by this migration. The flawed view
-- `weekly_ai_reports_for_role` also exists live; the orchestrator has
-- already run `REVOKE SELECT ON weekly_ai_reports_for_role FROM
-- authenticated` to neutralize it pre-emptively (nothing in deployed code
-- queried it directly from a browser session, so there has been no
-- real-world exposure window). This migration's job: replace the view with
-- the function, then drop the neutralized-but-still-broken view so it is
-- not left as a trap for a future migration to accidentally re-grant.
--
-- See: openspec/changes/communication-agent/proposal.md (D10)
--      openspec/changes/communication-agent/design.md (D10)
--      openspec/changes/communication-agent/specs/weekly-report-synthesis/
--        spec.md ("The Athlete-Safe Guarantee Is Enforced at the Database
--        Layer" — mechanism generalized, no longer names the view)
-- =========================================================================

BEGIN;

-- 1. The masked, row-filtered read surface. LANGUAGE sql (not plpgsql):
--    this is a single SELECT with no branching/looping logic, matching the
--    house convention of using the simplest LANGUAGE that fits (contrast
--    with apply_plan_adjustment, which needs plpgsql for its multi-statement
--    read-then-write flow). STABLE: pure read, no side effects, safe to be
--    called via GET and to have its result set further filtered/ordered/
--    limited by PostgREST query parameters exactly like a table or view.
--
--    Optional filter parameters (p_coach_id, p_athlete_id, p_week_start,
--    p_status) mirror the real .eq() filters this table's actual callers
--    use today (aiReportService.js's getCoachWeeklyReports/
--    getCoachReportWeeks, src/pages/athlete/MyReports.jsx) — no invented
--    parameter that nothing calls.
--
--    Column list and %TYPE references mirror 20260903130000's view exactly
--    (same column set, same CASE-masking logic for ai_analysis/summary);
--    %TYPE avoids hand-guessing types for a table whose CREATE TABLE this
--    repo does not track (same undocumented-schema history noted in
--    20260903130000's own header).
CREATE OR REPLACE FUNCTION public.get_weekly_ai_reports(
  p_coach_id   uuid DEFAULT NULL,
  p_athlete_id uuid DEFAULT NULL,
  p_week_start date DEFAULT NULL,
  p_status     text DEFAULT NULL
)
RETURNS TABLE (
  id               public.weekly_ai_reports.id%TYPE,
  coach_id         public.weekly_ai_reports.coach_id%TYPE,
  athlete_id       public.weekly_ai_reports.athlete_id%TYPE,
  week_start       public.weekly_ai_reports.week_start%TYPE,
  week_end         public.weekly_ai_reports.week_end%TYPE,
  alert_level      public.weekly_ai_reports.alert_level%TYPE,
  sessions_planned public.weekly_ai_reports.sessions_planned%TYPE,
  sessions_done    public.weekly_ai_reports.sessions_done%TYPE,
  planned_km       public.weekly_ai_reports.planned_km%TYPE,
  actual_km        public.weekly_ai_reports.actual_km%TYPE,
  acwr             public.weekly_ai_reports.acwr%TYPE,
  tsb              public.weekly_ai_reports.tsb%TYPE,
  avg_rpe          public.weekly_ai_reports.avg_rpe%TYPE,
  internal_load    public.weekly_ai_reports.internal_load%TYPE,
  status           public.weekly_ai_reports.status%TYPE,
  error_message    public.weekly_ai_reports.error_message%TYPE,
  report_data      public.weekly_ai_reports.report_data%TYPE,
  created_at       public.weekly_ai_reports.created_at%TYPE,
  ai_analysis      public.weekly_ai_reports.ai_analysis%TYPE,
  summary          public.weekly_ai_reports.summary%TYPE
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $function$
  SELECT
    w.id, w.coach_id, w.athlete_id, w.week_start, w.week_end, w.alert_level,
    w.sessions_planned, w.sessions_done, w.planned_km, w.actual_km, w.acwr,
    w.tsb, w.avg_rpe, w.internal_load, w.status, w.error_message,
    w.report_data, w.created_at,
    -- Row-visibility AND column-masking, both explicit in this function's
    -- own SQL — never dependent on RLS being "applied" to the definer.
    CASE WHEN (select auth.uid()) = w.coach_id THEN w.ai_analysis
         ELSE w.ai_analysis_athlete_safe END AS ai_analysis,
    CASE WHEN (select auth.uid()) = w.coach_id THEN w.summary
         ELSE w.summary_athlete_safe END AS summary
  FROM public.weekly_ai_reports w
  WHERE ( (select auth.uid()) = w.athlete_id OR (select auth.uid()) = w.coach_id )
    AND (p_coach_id   IS NULL OR w.coach_id   = p_coach_id)
    AND (p_athlete_id IS NULL OR w.athlete_id = p_athlete_id)
    AND (p_week_start IS NULL OR w.week_start = p_week_start)
    AND (p_status     IS NULL OR w.status     = p_status);
$function$;

COMMENT ON FUNCTION public.get_weekly_ai_reports(uuid, uuid, date, text) IS
  'Row-filtered, column-masked read surface for weekly_ai_reports '
  '(communication-agent D10, replacing the broken masking view from '
  '20260903130000). Row visibility and ai_analysis/summary masking are both '
  'explicit SQL in this function body -- deliberately not delegated to RLS '
  'being applied through a view, which this project''s postgres role '
  '(rolbypassrls=true) does not honor via FORCE ROW LEVEL SECURITY. Callers: '
  'aiReportService.js (coach reads), src/pages/athlete/MyReports.jsx '
  '(athlete reads).';

REVOKE ALL ON FUNCTION public.get_weekly_ai_reports(uuid, uuid, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_weekly_ai_reports(uuid, uuid, date, text) TO authenticated;

-- 2. Clean up the broken view. Nothing in deployed frontend code queries it
--    any more as of this same batch (src/services/aiReportService.js,
--    src/pages/athlete/MyReports.jsx both switch to the RPC above). Leaving
--    a known-broken, already-neutralized view around is a trap for a future
--    migration to accidentally re-grant SELECT on.
DROP VIEW IF EXISTS public.weekly_ai_reports_for_role;

COMMIT;

-- =========================================================================
-- Rollback: weekly_ai_reports_masking_rpc (DOWN)
-- Reverses 20260903140000_weekly_ai_reports_masking_rpc.sql ONLY — it does
-- NOT reverse 20260903130000 (FORCE ROW LEVEL SECURITY, the REVOKE on the
-- base table, or the *_athlete_safe columns all stay; that migration has
-- its own rollback file for that).
--
-- Deliberately self-contained: rolling back JUST this migration must not
-- leave the product in a broken (fail-closed-to-nobody) state where
-- neither the function NOR base-table SELECT is available to
-- `authenticated`/`anon` — that would 0-row every coach and athlete report
-- read the moment this rollback runs, independent of whether
-- 20260903130000's own rollback is ever applied. So this file also
-- re-GRANTs SELECT on the base table to authenticated/anon, restoring the
-- exact grant 20260903130000_weekly_ai_reports_masked_view_rollback.sql
-- itself restores — matching that file's own rollback intent so either
-- rollback, run alone, gets the product back to a working (if not
-- database-enforced-masked) read path rather than a broken one.
--
-- Re-opens the exposure 20260903130000/20260903140000 exist to close:
-- authenticated/anon regain unrestricted column-level SELECT on
-- weekly_ai_reports.ai_analysis/summary directly, same as pre-D9. Do not
-- run this while the frontend still calls .rpc('get_weekly_ai_reports', ...)
-- without also reverting src/services/aiReportService.js and
-- src/pages/athlete/MyReports.jsx back to a base-table/view read.
-- =========================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.get_weekly_ai_reports(uuid, uuid, date, text);

-- Defensive: drop the view too, in case it was ever recreated after this
-- migration's UP script dropped it.
DROP VIEW IF EXISTS public.weekly_ai_reports_for_role;

-- Restore direct base-table read access — see header note above.
GRANT SELECT ON public.weekly_ai_reports TO authenticated;
GRANT SELECT ON public.weekly_ai_reports TO anon;

COMMIT;

-- =========================================================================
-- Rollback: weekly_ai_reports_masked_view (DOWN)
-- Reverses 20260903130000_weekly_ai_reports_masked_view.sql.
--
-- Restores today's live-but-broken state — D9's whole point is that this
-- state is a privacy hole. Rolling back REOPENS it: after this rollback,
-- `authenticated`/`anon` regain unrestricted column-level SELECT on
-- weekly_ai_reports.ai_analysis/summary again. Do not roll this back while
-- WEEKLY_REPORT_WIDE_CONTEXT_ENABLED=true is deployed unless you are also
-- reverting weekly-ai-reports/index.ts's widening and
-- src/pages/athlete/MyReports.jsx / src/lib/pdfExport.js /
-- src/services/aiReportService.js's switch to the view (Phase 7).
-- =========================================================================

BEGIN;

DROP VIEW IF EXISTS public.weekly_ai_reports_for_role;

-- Restore the pre-migration grant (the same one Supabase's schema-wide
-- bootstrap grant originally provided).
GRANT SELECT ON public.weekly_ai_reports TO authenticated;
GRANT SELECT ON public.weekly_ai_reports TO anon;

ALTER TABLE public.weekly_ai_reports NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.weekly_ai_reports
  DROP COLUMN IF EXISTS summary_athlete_safe;

COMMIT;

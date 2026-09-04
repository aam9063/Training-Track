-- =========================================================================
-- Rollback: weekly_ai_reports_athlete_safe_analysis (DOWN)
-- Reverses 20260903120000_weekly_ai_reports_athlete_safe_analysis.sql.
-- Additive, nullable column with no dependents — safe to drop. Dropping it
-- reverts MyReports.jsx's fallback path to always reading ai_analysis (the
-- wide-context leak this migration exists to close would reopen — do not
-- roll this back while WEEKLY_REPORT_WIDE_CONTEXT_ENABLED=true is deployed
-- without also reverting the reads in weekly-ai-reports/index.ts and
-- src/pages/athlete/MyReports.jsx).
-- =========================================================================

BEGIN;

ALTER TABLE public.weekly_ai_reports
  DROP COLUMN IF EXISTS ai_analysis_athlete_safe;

COMMIT;

-- =========================================================================
-- Migration: weekly_ai_reports_athlete_safe_analysis (UP)
-- Additive, nullable jsonb column carrying the athlete-safe view of a
-- weekly report's AI analysis, generated from a SEPARATE Gemini call whose
-- input never included athlete_engagement_alerts or plan_adjustment_
-- suggestions data.
--
-- Why this exists: weekly_ai_reports carries a pre-existing RLS SELECT
-- policy — (select auth.uid()) = athlete_id OR (select auth.uid()) =
-- coach_id — so an athlete can already read their own row, and
-- src/pages/athlete/MyReports.jsx is a live, shipped page that does exactly
-- that, rendering ai_analysis verbatim. communication-agent's wide-context
-- widening (D2/D3) writes cross-agent (Agent 2 / Agent 3) synthesis into
-- that SAME ai_analysis column, which would otherwise leak coach-facing
-- churn-risk / plan-adjustment narrative to the athlete themselves.
--
-- The fix is NOT an RLS change (the athlete's own-row read is legitimate
-- and predates this change) and NOT a prompt instruction telling Gemini to
-- omit content for this audience (an LLM is not a reliable enforcement
-- boundary for a privacy guarantee). It is a second, independent Gemini
-- call whose input never contains the two wide-context sources, persisted
-- to this new column. MyReports.jsx reads ai_analysis_athlete_safe, falling
-- back to ai_analysis only when null (WEEKLY_REPORT_WIDE_CONTEXT_ENABLED
-- =false runs and any historical row from before this fix, both already
-- narrow, never widened).
-- See: openspec/changes/communication-agent/proposal.md (D8)
--      openspec/changes/communication-agent/design.md
--        ("D8, amended post-Phase-5: the athlete-safe analysis is a SECOND
--        Gemini call over a NARROW input")
--      openspec/changes/communication-agent/specs/weekly-report-synthesis/
--        spec.md ("Athlete-Visible Analysis Never Includes Wide-Context
--        Signals")
-- =========================================================================

BEGIN;

ALTER TABLE public.weekly_ai_reports
  ADD COLUMN IF NOT EXISTS ai_analysis_athlete_safe jsonb;

COMMIT;

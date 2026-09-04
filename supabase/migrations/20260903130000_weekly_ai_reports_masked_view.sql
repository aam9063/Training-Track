-- =========================================================================
-- Migration: weekly_ai_reports_masked_view (UP)
-- Communication-agent D9 (Phase 7): closes a CRITICAL privacy hole Phase 6
-- (ai_analysis_athlete_safe) did not actually close.
--
-- THE FINDING (confirmed live by the orchestrator via
-- information_schema.column_privileges against production, 2026-09-03):
-- Postgres RLS is ROW-level, not COLUMN-level. weekly_ai_reports' existing
-- RLS SELECT policy — (select auth.uid()) = athlete_id OR
-- (select auth.uid()) = coach_id, supabase/add_missing_rls_policies.sql:
-- 193-202 — only controls WHICH ROWS an athlete can see. Once their own
-- row is visible under that policy, Supabase's default schema-wide grant
-- (GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon, set at
-- project bootstrap — not tracked in this repo's migrations) lets the
-- athlete SELECT any COLUMN of that row directly via PostgREST, e.g.
-- GET /rest/v1/weekly_ai_reports?select=ai_analysis,summary — completely
-- bypassing whichever column src/pages/athlete/MyReports.jsx (Phase 6's
-- app-layer fix) chooses to query. The orchestrator's live query found
-- BOTH `authenticated` AND `anon` hold unrestricted SELECT on every column
-- of weekly_ai_reports, including the wide, coach-facing `ai_analysis` and
-- `summary` columns, with zero column-level REVOKE anywhere in this
-- codebase before this migration. `anon` having any access at all is
-- strictly worse than `authenticated` having it and is closed by the same
-- fix.
--
-- Phase 6's ai_analysis_athlete_safe / this migration's summary_athlete_safe
-- columns only ever changed what the APP chooses to query — never what the
-- DATABASE permits the athlete to read directly. This migration is the
-- actual enforcement point: an app-layer query convention alone can never
-- satisfy a privacy guarantee. (D9, superseding D8/Phase 6's implicit
-- "app-layer fallback is sufficient" framing.)
--
-- THE FIX (user-confirmed, non-negotiable): the standard Postgres/Supabase
-- pattern for masking specific columns per-row based on the querying user,
-- since Postgres has no native column-level RLS —
--   1. Add `summary_athlete_safe text` (this migration) — the narrow,
--      athlete-safe Gemini call's own `.resumen` IS the athlete-safe
--      summary; free, no third Gemini call (weekly-ai-reports/index.ts).
--   2. `ALTER TABLE ... FORCE ROW LEVEL SECURITY` — see "VIEW SECURITY
--      SEMANTICS" below; the load-bearing statement that keeps the view
--      row-scoped instead of accidentally exposing every athlete's row to
--      every caller.
--   3. `REVOKE SELECT` on the base table from `authenticated` AND `anon`
--      (service_role is untouched — the Edge Function writes/reads via
--      service_role and must be unaffected).
--   4. A new view, weekly_ai_reports_for_role, exposing every existing
--      column EXCEPT it aliases ai_analysis/summary via
--      `CASE WHEN (select auth.uid()) = coach_id THEN <wide> ELSE
--      <athlete_safe> END` — so MyReports.jsx / AIReports.jsx /
--      aiReportService.js can query ai_analysis/summary on the VIEW with
--      ZERO app-layer branching and transparently get the correctly-masked
--      value. The raw ai_analysis_athlete_safe / summary_athlete_safe
--      columns are NOT exposed by the view at all — no reason for any
--      client to see both the wide and narrow value side by side.
--   5. `GRANT SELECT` on the view to `authenticated` only — NOT `anon`;
--      no anonymous read of this table should ever be possible.
--
-- VIEW SECURITY SEMANTICS — ASSUMPTION, FLAGGED FOR LIVE VERIFICATION:
-- sdd-apply has no live Supabase MCP access and cannot inspect this
-- project's actual role/ownership graph. The design below assumes the
-- Supabase-standard setup:
--   - The migration-running role (commonly `postgres` in Supabase Cloud)
--     is NOT a true Postgres superuser and does NOT carry the BYPASSRLS
--     role attribute (only `service_role` does in the default Supabase
--     bootstrap) — so it IS subject to `FORCE ROW LEVEL SECURITY`.
--   - `auth.uid()` resolves from a per-request session GUC
--     (`request.jwt.claims`) that PostgREST sets from the CALLING user's
--     JWT, regardless of which SQL role is actually executing the query.
--     The view's CASE expression therefore correctly reflects the real
--     querying user's identity even though the view itself is NOT
--     `security_invoker` (see below) — auth.uid() is session-context-based,
--     not execution-role-based.
--   - The view is created WITHOUT `security_invoker = true` (Postgres 15+ /
--     Supabase's default is security_invoker = false, the "classic" view).
--     This is REQUIRED, not incidental: it is what lets the view satisfy
--     the object-level SELECT privilege check against weekly_ai_reports
--     using the VIEW OWNER's grant, even though `authenticated` no longer
--     holds SELECT on the base table (step 3). If this view were
--     `security_invoker = true`, the calling role would need its OWN
--     SELECT grant on the base table for the query to even parse — which
--     would defeat step 3 entirely.
--   - Row-level filtering (WHICH rows are visible at all) still comes from
--     the pre-existing, UNCHANGED RLS SELECT policy on the base table
--     (athlete_id = auth.uid() OR coach_id = auth.uid()). Because the view
--     owner is presumed to be the table owner, and table owners bypass RLS
--     by default, `FORCE ROW LEVEL SECURITY` (step 2) is what re-applies
--     that policy to the view owner's own underlying query — without it,
--     the view would silently return EVERY row to EVERY caller holding
--     SELECT on the view: a far worse regression than the hole this
--     migration closes.
-- The orchestrator's live-verification step (this project's established
-- practice for every RLS-sensitive change this session) MUST confirm, with
-- simulated coach and athlete JWTs, before this migration is applied for
-- real:
--   (a) a coach querying the view for their own athlete's row sees the WIDE
--       ai_analysis/summary;
--   (b) that SAME athlete querying the view for their OWN row sees the
--       NARROW (*_athlete_safe) content under the ai_analysis/summary
--       names, never the wide content;
--   (c) an unrelated coach or an unrelated athlete querying the view for
--       this row sees ZERO rows (row-level filtering still holds — i.e.
--       FORCE ROW LEVEL SECURITY actually took effect and the view is not
--       silently leaking every row to everyone);
--   (d) a direct REST call against the BASE table
--       (`/rest/v1/weekly_ai_reports?select=ai_analysis`) as either JWT
--       returns a permission error or zero columns, NOT data — this is
--       what the REVOKE actually fixes versus Phase 6's app-layer-only
--       attempt.
--
-- See: openspec/changes/communication-agent/proposal.md (D9)
--      openspec/changes/communication-agent/design.md
--        ("D9: the athlete-safe analysis must be enforced at the
--        database, not the app layer")
--      openspec/changes/communication-agent/specs/weekly-report-synthesis/
--        spec.md ("Athlete-Visible Analysis Never Includes Wide-Context
--        Signals", strengthened)
-- =========================================================================

BEGIN;

-- 1. summary_athlete_safe — additive, nullable. Same free-extraction
--    rationale as ai_analysis_athlete_safe (Phase 6): the narrow
--    athlete-safe Gemini call's own .resumen field IS the athlete-safe
--    summary text — no third Gemini call, just persisting a field that
--    call's response already contains.
ALTER TABLE public.weekly_ai_reports
  ADD COLUMN IF NOT EXISTS summary_athlete_safe text;

-- 2. Force RLS to apply even to the table/view owner. Load-bearing — see
--    "VIEW SECURITY SEMANTICS" above.
ALTER TABLE public.weekly_ai_reports FORCE ROW LEVEL SECURITY;

-- 3. Close the column-level hole: the pre-existing schema-wide grant let
--    ANY authenticated (or even anon) caller SELECT ai_analysis/summary
--    directly on the base table, bypassing RLS's row-scoping entirely for
--    column content (RLS is row-level only). No frontend code, and no
--    other Edge Function, queries the base table as `authenticated` or
--    `anon` today — weekly-ai-reports/index.ts and athlete-ai-chat/
--    index.ts both use the service_role client, which keeps its existing
--    grant untouched — confirmed by grep across this repo before writing
--    this migration.
REVOKE SELECT ON public.weekly_ai_reports FROM authenticated;
REVOKE SELECT ON public.weekly_ai_reports FROM anon;

-- 4. The masking view. Every existing column is passed through unchanged
--    except ai_analysis/summary, which are aliased via CASE to the
--    athlete-safe columns for anyone who is not the report's own coach.
--    ai_analysis_athlete_safe / summary_athlete_safe themselves are NOT
--    exposed by this view — no client needs to see both values.
--
--    Column list note: this repo does not track weekly_ai_reports' own
--    CREATE TABLE (created outside migrations — same undocumented-schema
--    history as several other tables in this project; see this project's
--    documented supabase/* gitignore history). The column list below is
--    the UNION of every column referenced by every known reader/writer of
--    this table in this repo (weekly-ai-reports/index.ts's upsert + update
--    calls, aiReportService.js, MyReports.jsx, athlete-ai-chat/index.ts),
--    plus the two athlete-safe columns added by Phase 6 and this
--    migration. If the live table has additional columns not listed here,
--    this view will simply omit them from the masked read surface (a safe
--    failure direction, not a security gap) — but the orchestrator should
--    confirm this list is complete against the live schema before
--    applying.
CREATE OR REPLACE VIEW public.weekly_ai_reports_for_role
AS
SELECT
  id,
  coach_id,
  athlete_id,
  week_start,
  week_end,
  alert_level,
  sessions_planned,
  sessions_done,
  planned_km,
  actual_km,
  acwr,
  tsb,
  avg_rpe,
  internal_load,
  status,
  error_message,
  report_data,
  created_at,
  CASE
    WHEN (select auth.uid()) = coach_id THEN ai_analysis
    ELSE ai_analysis_athlete_safe
  END AS ai_analysis,
  CASE
    WHEN (select auth.uid()) = coach_id THEN summary
    ELSE summary_athlete_safe
  END AS summary
FROM public.weekly_ai_reports;

COMMENT ON VIEW public.weekly_ai_reports_for_role IS
  'Column-masked read surface for weekly_ai_reports (communication-agent D9). '
  'ai_analysis/summary resolve to the wide, coach-facing value only when the '
  'querying user is the report''s own coach; otherwise they resolve to the '
  'narrow *_athlete_safe value. Postgres has no native column-level RLS -- '
  'this view plus REVOKE SELECT on the base table (see this migration) is '
  'the enforcement point. Query this view, never the base table, from any '
  'authenticated (non-service-role) context.';

-- 5. Grant the view to authenticated only. No anonymous read of this
--    table should ever be possible.
GRANT SELECT ON public.weekly_ai_reports_for_role TO authenticated;

COMMIT;

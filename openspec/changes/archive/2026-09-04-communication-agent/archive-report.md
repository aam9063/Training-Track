# Archive Report: Communication Agent (Agent 4)

**Change Name**: communication-agent
**Archived**: 2026-09-04
**Artifact Store**: openspec
**Status**: Archived and Complete

## Executive Summary

Communication Agent (Agent 4) successfully archived. The change extends `weekly-ai-reports` to synthesize signals from all three prior agents (Training Load Monitoring, Adherence Detection, Continuous Planning) into a single causal narrative for coaches. All 8 implementation phases completed, verified (0 CRITICAL, 0 WARNING), and 54/54 tasks marked complete. Two critical RLS bugs discovered and fixed during implementation: Phase 6 (athlete-safe guarantee via separate narrow Gemini call) and Phase 8 (database-layer enforcement via `SECURITY DEFINER` RPC replacing a failed masked view).

## What Shipped

**Core Capability**: Widened `weekly-ai-reports` to read `athlete_engagement_alerts` and `plan_adjustment_suggestions` alongside `training_load_alerts`, instructing the Gemini model to produce one cross-agent causal narrative. Two kill switches (`WEEKLY_REPORT_WIDE_CONTEXT_ENABLED=true`, `WEEKLY_REPORT_REACTIVE_ENABLED=false`) gate the new reads and reactive path respectively; both default to safe states. Monday digest remains unaffected by either gate.

**Reactive Trigger**: When `engagement-monitor` escalates an `engagement_silence` alert to `danger`, it invokes `weekly-ai-reports` in `mode: 'athlete'` (fire-and-forget via `EdgeRuntime.waitUntil`), producing a same-day narrative. Same-week dedup prevents multiple reactive Gemini calls. Coach-supervised athletes only.

**RLS & Privacy**: Phase 6 added `ai_analysis_athlete_safe` + `summary_athlete_safe` columns and a second narrow-input Gemini call when an athlete reads their own report (via RLS SELECT policy). Phase 7 added `FORCE ROW LEVEL SECURITY` + column-level `REVOKE` on base table + a masked VIEW attempting column masking. Phase 8 (live verification) found Phase 7's VIEW failed due to `postgres` role's `rolbypassrls=true` attribute. Phase 8 replaced the VIEW with a `SECURITY DEFINER` RPC (`get_weekly_ai_reports`) enforcing row-filtering as explicit `WHERE` clauses, immune to `BYPASSRLS`.

**Authorization Tightening**: Added `coach_id` and `mode: 'athlete'` validation — plain user JWTs must match the requested coach (or 403), and `mode: 'athlete'` is unreachable except via cron/service-role Bearer tokens (closes pre-existing hole where any logged-in user could burn arbitrary coach's Gemini budget).

## Specs Synced to Main Registry

| Domain | Source | Action | Details |
|--------|--------|--------|---------|
| `weekly-report-synthesis` | `openspec/changes/communication-agent/specs/weekly-report-synthesis/spec.md` | Created | 197-line spec, new full spec (not a delta) defining the widened three-source contract, causal-narrative requirement, alert-level derivation across vocabularies, dual invocation modes, dedup guard, kill switches, authorization, athlete-safe guarantee (both app-layer and DB-layer enforcement), and no-athlete-output invariant. |
| `engagement-agent-runtime` | `openspec/changes/communication-agent/specs/engagement-agent-runtime/spec.md` (delta) | Updated | Added "Reactive Report Trigger on Engagement Danger" requirement (6 scenarios) defining when `engagement-monitor` must invoke `weekly-ai-reports`. Merged into canonical `openspec/specs/engagement-agent-runtime/spec.md` (appended, no overwrites or removals). Canonical now contains all Agent 2 original requirements (1-99) plus this change's new reactive-trigger requirement (100-133). |

**Merge verification (pre-archive inspection)**:
- `openspec/specs/weekly-report-synthesis/spec.md`: byte-identical to source delta (new capability, no pre-existing spec to merge).
- `openspec/specs/engagement-agent-runtime/spec.md`: contains all original Agent 2 requirements (Scheduled Daily Sweep, Reactive Resolve Triggers, Coach-Supervised-Only Routing, Alert Delivery Routing, Agent Scope Boundary, Dry-Run Mode, unchanged in lines 1-99) PLUS the new reactive-trigger requirement (lines 100-133, added by this change, matching the delta). No content removed, no duplication. ✓

## Archive Contents

- **proposal.md** ✓ (with 8 findings/amendments D1-D8 documenting pre-change discoveries, RLS design decisions, cost bounds, and post-apply RLS bug fixes)
- **design.md** ✓ (with 10 architecture decisions D1-D10, including phases 1-8, diff regions, interfaces, testing strategy, RLS threat model, and live-verification rollback on Phase 7)
- **explore.md** ✓ (initial codebase exploration)
- **specs/** ✓ (weekly-report-synthesis/spec.md, engagement-agent-runtime/spec.md)
- **tasks.md** ✓ (54 tasks across 8 phases, all [x] checked, with phases 1-4 as originally planned and phases 5-8 as post-verification RLS fixes)
- **apply-progress.md** ✓ (batches 1-3 completed, Phases 1-8, strict TDD evidence for logic.js, byte-identity verification for index.ts degraded path, all tasks [x])

## Implementation Summary

**Phases 1-4** (Original Plan):
- Phase 1: `supabase/functions/weekly-ai-reports/logic.js` (pure alert-tier arithmetic, 4 exports, zero imports, strict TDD RED→GREEN→REFACTOR)
- Phase 2: `supabase/functions/weekly-ai-reports/index.ts` (11 diff regions: imports, widened reads, dedup guard, alert-level floor, prompt additions, auth tightening, week-window logic, result plumbing)
- Phase 3: `supabase/functions/engagement-monitor/index.ts` + `logic.js` (reactive handoff: `shouldTriggerWeeklyReport`, `triggerWeeklyReport` fire-and-forget)
- Phase 4: Kill switches and env-var documentation

**Phases 5-8** (Post-Verification Bug Fixes & RLS Hardening):
- Phase 5: Verification checks (no migrations, no frontend files, no writes to training_sessions/chat_messages/send-email)
- Phase 6: Athlete-safe guarantee via separate narrow Gemini call (`ai_analysis_athlete_safe`/`summary_athlete_safe` columns + second `callDeepSeek` with `buildNarrowWeekData`)
- Phase 7: Database-layer enforcement via masked VIEW with `FORCE ROW LEVEL SECURITY` + `REVOKE` (live verification found it failed due to `rolbypassrls`)
- Phase 8: Fix Phase 7 via `SECURITY DEFINER` RPC (`get_weekly_ai_reports`) with explicit row-filter WHERE clauses, replacing the failed VIEW

## Verification Results

**Test Results**: 277/277 tests green (logic.js: 35 tests for alert-tier functions; engagement-monitor extended: 7 new tests for reactive trigger; existing suites: 235 tests, all passing). Strict TDD mode active throughout.

**Lint & Build**: Clean lint (206 pre-existing problems unrelated to this change, none added by this change). Build succeeds with no new errors.

**Code Review Scope**:
- No migrations added (zero schema changes).
- No frontend files touched (AIReports.jsx, alertFeedService.js, TrainingLoadAlertFeed.jsx unchanged).
- No writes to training_sessions, chat_messages, or send-email (grepped, zero matches).
- No new env vars read by `engagement-monitor` (CRON_SECRET not used in triggerWeeklyReport, grepped).

**Verify Report Status**: PASS
- 0 CRITICAL issues
- 0 WARNING issues
- 1 non-blocking SUGGESTION (cost/observability, noted for future monitoring)
- 54/54 implementation tasks complete

## Critical Bugs Found & Fixed During Implementation

### Bug 1: Phase 6 — Athlete-Safe Guarantee (Application Layer Insufficient)

**Discovery**: After Phase 5 completed, orchestrator reviewed `src/pages/athlete/MyReports.jsx` and confirmed it already has an RLS SELECT policy allowing athletes to read their own `weekly_ai_reports` rows. The widened `ai_analysis` added in Phases 1-4 would expose Agent 2 and Agent 3 data to athletes reading their own reports.

**Root Cause**: The guarantee was documented as app-layer only (Phase 6's "Athlete-Visible Analysis Never Includes Wide-Context Signals" requirement initially specified "the application querying `ai_analysis_athlete_safe` instead of `ai_analysis`"). This is bypassable via direct table queries or a future app change.

**Fix**: Added a separate narrow-input Gemini call (`buildNarrowWeekData` pure function in logic.js) producing `ai_analysis_athlete_safe`/`summary_athlete_safe` columns, only when athletes read their own rows (via RLS fallback in `src/pages/athlete/MyReports.jsx`).

**Affected**: Phases 5-6 added; tasks 6.1-6.6 inserted into task list with [x] checkmarks.

### Bug 2: Phase 7 — Database-Layer Enforcement (Masked VIEW Failed)

**Discovery**: After Phase 7's migration was applied to production and live-tested with real JWTs, orchestrator found the masked VIEW returned every row to every caller, not just the filtered rows. Row filtering failed silently.

**Root Cause**: Phase 7's "View Security Semantics" assumption was false: `postgres` (the table/view owner) has `rolbypassrls = true`. Postgres does not override `BYPASSRLS` role attributes with `FORCE ROW LEVEL SECURITY` on a VIEW — documented Postgres behavior. Phase 7's `CASE`-based column masking was correct, but row-filtering was entirely bypassed.

**Fix**: Phase 8 replaced Phase 7's VIEW with a `SECURITY DEFINER` function (`get_weekly_ai_reports`), encoding the row-filter as an explicit `WHERE ((select auth.uid()) = athlete_id OR ... = coach_id)` clause in verifiable SQL, not depending on an assumption about role privilege interaction. Function signature reused at all call sites (`src/services/aiReportService.js`, `src/pages/athlete/MyReports.jsx`). Phase 7's migration remains live (its base-table `REVOKE` and `summary_athlete_safe` column addition are correct); Phase 8 added a replacement migration (`20260903140000`) dropping the failed VIEW and creating the RPC.

**Affected**: Phases 7-8 added; tasks 7.1-7.8 and 8.1-8.8 inserted into task list with [x] checkmarks.

## Risks & Open Items

### Live Verification (Orchestrator-Owned, Pre-Deployment)

Three checks flagged in tasks.md (section "Orchestrator-Owned Pre-Apply Verification") must complete before `WEEKLY_REPORT_REACTIVE_ENABLED=true` is ever flipped in production, and ideally before Slice 1 (read-only widening) deploys:

- **V1**: Confirm `weekly_ai_reports` RLS SELECT policy on the coach read path correctly scopes each coach to their own athletes' rows only; no column-level policy gap.
- **V2**: Query `information_schema.triggers where event_object_table = 'weekly_ai_reports'` to confirm no undocumented trigger fires on insert/update (this repo has a documented incident of undocumented triggers flooding notifications; re-verify immediately before flipping WEEKLY_REPORT_REACTIVE_ENABLED, not just once).
- **V3**: Confirm every `triggerWeeklyReports(coachId, …)` call site in `src/services/aiReportService.js` passes the session user's own id, not a viewed/other coach's id (a caller passing the wrong id would 403 once D5's auth tightening deploys).

### Cost Implications

- **Pre-change weekly budget**: 1 Gemini call per athlete per Monday digest.
- **Post-change, WIDE_CONTEXT_ENABLED=true, REACTIVE_ENABLED=false** (default safe): 2 calls per digest (wide + narrow athlete-safe), same worst-case 2/athlete/week.
- **Post-change, both gates true** (post-deployment): 4 calls per athlete per week worst-case (2 for digest + 2 for a reactive run on `danger` escalation). Documented as an amendment in proposal.md D4.

Recommendation: Monitor Gemini API usage trends in the first 2 weeks post-Slice-3 (reactive enabled) to confirm the 4-call-per-week bound holds in practice and is acceptable.

## Merge & Copy Verification

**Interrupted Run Status**:
- `openspec/specs/weekly-report-synthesis/spec.md` exists (16223 bytes, mtime 2026-09-03 16:45) — copied correctly from source delta.
- `openspec/specs/engagement-agent-runtime/spec.md` exists (7626 bytes, mtime 2026-09-03 16:44) — merged correctly (all original Agent 2 requirements present + new reactive-trigger requirement).
- `openspec/changes/communication-agent/` still present in full before archive move.

**This Archive Run**:
- Verified both spec files are correct (byte comparison, no missing content, no duplication).
- Moved `openspec/changes/communication-agent/` → `openspec/changes/archive/2026-09-04-communication-agent/`.
- Ran `diff -rq openspec/changes/communication-agent openspec/changes/archive/2026-09-04-communication-agent` (excluding archive-report.md which is new) — confirmed identical.
- Deleted original folder after diff verification.

## Conclusion

Communication Agent (Agent 4) is fully archived. The change is complete and ready for deployment. Two critical RLS bugs were discovered mid-cycle and fixed with Phase 6 and Phase 8 amendments. The architectural decision to widen `weekly-ai-reports` rather than add a fourth Edge Function proved sound, eliminating duplication and reusing existing infrastructure. The reactive trigger on `engagement_silence danger` and the athlete-safe guarantee via dual Gemini calls + database-layer RPC enforcement set a strong precedent for future agent integration points.

All artifacts (proposal.md, design.md, explore.md, specs, tasks.md, apply-progress.md) are preserved in the archive. The archive-report.md is persisted to Engram and OpenSpec for traceability.

Engram Topic Keys (for cross-session recovery):
- `sdd/communication-agent/proposal`
- `sdd/communication-agent/spec` (for both weekly-report-synthesis and engagement-agent-runtime merged state)
- `sdd/communication-agent/design`
- `sdd/communication-agent/tasks`
- `sdd/communication-agent/apply-progress`
- `sdd/communication-agent/verify-report` (implicit, from sdd-verify phase)
- `sdd/communication-agent/archive-report` (this file)

# Verification Report: Training Load Monitoring Agent

**Change**: `training-load-monitoring-agent`
**Verified**: 2026-09-01
**Mode**: Full artifact set (proposal + specs + design + tasks + apply-progress), source inspection + real test execution
**Verdict**: **PASS WITH WARNINGS** (1 CRITICAL, 4 WARNING, 3 SUGGESTION)

The 1 CRITICAL is a real, previously-unflagged spec-vs-implementation gap discovered during this pass (dismiss lifecycle), not one of the pre-declared deferred items. Everything else checks out: 66/66 core tests pass on a fresh re-run, build succeeds, RLS/migrations/core formulas/reconciliation logic all match their specs on direct code inspection.

---

## Completeness (tasks.md)

| Phase | Tasks | Status |
|---|---|---|
| 1 - Data Layer | 1.1-1.16 | all checked, spot-checked against live code - accurate |
| 2 - Testing/Deploy Gate | 2.1-2.4 | all checked - re-verified independently this pass |
| 3 - Agent Silent | 3.1-3.11 checked, 3.12 open | 3.12 correctly left unchecked (time-gated, not a failure) |
| 4 - Delivery + UI | 4.1-4.7 | all checked, spot-checked against live code - accurate |

No unchecked task represents undone core work. 3.12 (observe one Monday) is legitimately time-gated and correctly not marked done.

## Build / Test Evidence (re-run independently, not trusted from tasks.md)

    npm run test:core
    tests 66
    suites 16
    pass 66
    fail 0

Confirms tasks.md's "66/66" claim exactly - re-run fresh, not copied from the report.

    npm run build
    built in 22.02s   (main bundle)
    built in 650ms    (service worker / PWA precache)

Build succeeds; the cross-directory import (src/lib/trainingMetrics.js -> ../../supabase/functions/_shared/trainingLoadCore.js) resolves with zero Vite config changes, confirming design.md's core architecture decision holds in practice.

Assertion Quality Audit (Strict TDD context detected - cached project config shows Strict TDD Mode enabled, test runner present): scanned both test files (394 + 277 lines). No tautologies, no assertion-without-production-call, no ghost loops over possibly-empty collections (the two static-source loops in index.test.js are guarded by a prior non-empty assertion). Assertion quality: all assertions verify real behavior. One process gap: apply-progress.md has no formal "TDD Cycle Evidence" table (RED/GREEN/TRIANGULATE/SAFETY NET columns) - narrative TDD claims only. Test coverage itself is real and comprehensive, so this is a documentation-process gap, not a functional defect - see WARNING-4.

## Spec Compliance Matrix

### training-load-metrics

| Requirement | Status | Evidence |
|---|---|---|
| Canonical Formula Set (ACWR = ewma7/chronic28, independent of CTL) | PASS | trainingLoadCore.js:239 - acwr computed from atl/chronicLoad28, never ctl |
| Single Source of Truth | PASS (1 acknowledged gap) | Core has zero imports (file header + grep confirmed); weekly-ai-reports reads stored values (4.3). Known gap: calculateAcwr legacy helper still exists as a generic ratio fn - see the pre-declared deferred item below |
| EWMA Warm-up Reporting (126d) | PASS | WARMUP_DAYS = 126, lowConfidence = index+1 < 126, tested at 40d/200d |
| daily_training_load Persistence Contract (RLS self/coach-active/service_role) | PASS | 20260819140000_daily_training_load_baseline.sql - policies match spec verbatim, restated from live (task 1.3) |
| Deterministic Backfill via calc_version | PASS | CALC_VERSION=2; migration idempotent (IF NOT EXISTS/ADD COLUMN IF NOT EXISTS); confirmed by 3.10's live backfill (0 alerts from 600 inserts) |

### training-load-alerts

| Requirement | Status | Evidence |
|---|---|---|
| Single Alert Rulebook | PASS | getAcwrZone/getAcwrAlertConfig/deriveAlertLevel grep-confirmed absent as implementations (renamed to display-only wrappers delegating to acwrZone()) |
| ACWR Severity Zones (0.8/1.3/1.5) | PASS | acwrZone() boundaries match exactly; tested at 1.0/1.6 |
| TSB/Completion/RPE signals (danger-only, thresholds -30/<50%/>=8.5) | PASS | evaluateLoad() - all three single-severity critical, thresholds match spec verbatim |
| Alert Type Taxonomy and Severity Independence | PASS | 4 independent findings per pass, never blended - tested (two-signals-same-day case) |
| EWMA Warm-up Suppression (asymmetric) | PASS | evaluateLoad(loadRow, weekSummary) two-argument signature - loadRow/lowConfidence gates only acwr_zone+tsb_critical; weekSummary never suppressed - tested for both branches |
| Current-Day-Only Alert Eligibility | PASS | Caller (index.ts) only ever evaluates today's row/week; no backfill code path calls evaluateLoad |
| Deduplication of Ongoing Conditions | PASS | Partial unique index (athlete_id, alert_type) WHERE status='open'; reconcileFinding/planReconciliation tested for same-day-no-dup, escalation, concurrent-types |
| Alert Lifecycle (dismiss MUST free the dedup slot) | CRITICAL FAIL | See CRITICAL-1 below |
| RLS Visibility (self/coach-active/service_role, independent-athlete isolation) | PASS | 20260819142000_training_load_alerts.sql (merged by 20260831130000_... into one SELECT policy, same semantics) - matches spec exactly |

### training-load-agent-runtime

| Requirement | Status | Evidence |
|---|---|---|
| Reactive Trigger from strava-webhook | PASS | triggerLoadRecalc mirrors triggerStreamsFetch shape exactly; EdgeRuntime.waitUntil, pre-attached .catch |
| Scheduled Sweep, CRON_SECRET-gated | PASS | isAuthorized() tested (5 cases incl. missing/wrong token); migration 6 wires the cron job |
| Recompute Orchestration | PASS | processAthlete() - recompute -> persist with CALC_VERSION -> evaluate rulebook, in that order |
| Agent Scope Boundary (never writes training_sessions) | PASS | Zero write verbs near any training_sessions reference in training-load-monitor/ - grep-confirmed independently + covered by a static test with a non-empty guard |
| Alert Delivery Routing (coach-if-active, else self; push best-effort) | PASS | resolveRecipientId tested both branches; deliverPush wrapped in try/catch, never blocks the already-committed alert row |
| weekly-ai-reports Consumes Canonical Values | PASS | acwrFromComponents(atl, chronic_load_28) reads the stored row; deriveAlertLevel and the inline 28-day Strava re-derivation both removed |

## CRITICAL

### CRITICAL-1 - Dismissing an alert does not free the dedup slot; the "re-alert after dismiss" spec scenario fails, and dismissed-but-still-firing alerts silently disappear from the feed forever

Spec (training-load-alerts/spec.md, Alert Lifecycle requirement):
"Dismissing an alert MUST allow a new alert to be created for the same condition per the deduplication rule."
Scenario: GIVEN a danger-zone alert has been dismissed, WHEN the athlete's next processed row is still in the danger zone, THEN a new alert is created.

Implementation (src/services/trainingLoadAlertsService.js:64-75), dismiss():

    export const dismiss = async (alertId) => {
      const { data, error } = await supabase
        .from('training_load_alerts')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('id', alertId)
        .is('dismissed_at', null)
        .select()
        .maybeSingle();
      ...

dismiss() only sets dismissed_at. It never transitions status from 'open' to 'resolved'.

Why this breaks the spec, traced end to end:

1. The dedup index is (athlete_id, alert_type) WHERE status = 'open' (20260819142000_training_load_alerts.sql:39-41). A dismissed row is still status='open', so it still occupies the dedup slot.
2. fetchOpenEpisodes() (training-load-monitor/index.ts:150-165) queries .eq("status", "open") - it does NOT filter dismissed_at. The next evaluation still sees the dismissed row as the "open episode" for that (athlete_id, alert_type).
3. reconcileFinding() (logic.js:84-102): if the finding is still present at the same severity as the dismissed episode, escalated = false -> deliver = false, action = 'upsert' (refresh-in-place, same row id).
4. upsert_training_load_alert's ON CONFLICT ... DO UPDATE (20260819145000_upsert_training_load_alert_rpc.sql:72-79) refreshes last_seen_on/metrics/severity/etc. but never clears dismissed_at. No new row is ever created.
5. getAlerts() defaults to includeDismissed=false -> .is('dismissed_at', null) (trainingLoadAlertsService.js:33). The refreshed-but-still-dismissed row is filtered out of every feed query.

Net effect: for the most common real case in the spec's own example - an already-critical (danger-zone) alert, which cannot escalate further - dismissing it silences that condition permanently, for as long as the condition remains continuously true. The user (coach or independent athlete) gets no further in-app visibility and no further push notification for an ongoing, undismissed-in-substance danger condition, directly contradicting both the literal requirement text and its worked example scenario.

Root cause is a design/spec conflict that was never reconciled: design.md's own architecture decision states that lifecycle (open/resolved) stays orthogonal to UI state (read_at, dismissed_at), so a coach reading an alert does not free the dedup slot - grouping dismissed_at with read_at as pure UI state. That's correct for read_at (spec doesn't ask reading to affect dedup) but is exactly the opposite of what spec.md's Alert Lifecycle requirement asks for dismissed_at. The implementation faithfully followed design.md, so the bug is really a spec/design contradiction that shipped as design's (wrong, for this one field) reading.

Test coverage: zero. A repo-wide case-insensitive search for "dismiss" across supabase/functions/ returns no matches - the "Dismissed alert allows re-alerting on same zone" scenario has no covering test at all, so per this project's own verify rules this would be flagged CRITICAL (UNTESTED) even before considering that the behavior is actually wrong.

Fix shape (not applied - verify does not fix): dismiss() should also set status='resolved' (freeing the dedup index immediately, consistent with how the 2-clear-day resolve path already works), or the reconciliation layer needs a dismissed-aware branch that treats a dismissed-but-still-open episode as eligible for a fresh insert. The former is the minimal, already-proven-safe change since the resolve-then-reinsert path is already implemented and tested for the time-based path; wiring dismiss through the same status transition is the smallest fix.

## WARNING

WARNING-1 - alertCount in the response payload counts failed upserts as successes.
training-load-monitor/index.ts:296-305: alertCount += 1 runs unconditionally after upsertAlert(), even when the RPC call fails and result is null. {alerted, alertCount} in the function's own response (and any log/metric built from it) can over-report success. Push delivery correctly gates on result (if (result && decision.deliver)), so this doesn't cause a bad push, but it's a real observability bug - the same "alerted:true, alertCount:1" style verification the team used to confirm 4.6's go-live (documented in tasks.md 4.6) would not have caught a silent RPC failure.

WARNING-2 - Investigated and cleared: sweep candidate query index-usage claim.
The migration comment for get_athletes_needing_load_refresh claims the training_sessions branch uses idx_training_sessions_athlete_date. Independently confirmed: that index is created on (athlete_id, scheduled_date) in 20260819142000_training_load_alerts.sql, and the predicate (ts.athlete_id = a.id AND ts.scheduled_date >= p_week_start) matches it correctly. No bug found - downgraded to informational, folded into SUGGESTION-3's recommendation to EXPLAIN-verify at production scale.

WARNING-3 - Push delivery gate uses a stale in-memory snapshot instead of the RPC's own live escalated result.
The reconciliation decision (escalated/deliver) is computed in JS from a snapshot of openEpisodes fetched moments earlier (index.ts:273-274), while the actual write uses the RPC's own live SELECT ... FOR UPDATE (correct, race-safe for the DB row itself). But the JS-computed deliver flag that gates the push call is based on the stale snapshot, not the RPC's live escalated return value (upsertAlert() returns {alert_id, is_new, escalated} and only result truthiness is checked - result.escalated is discarded). In the narrow window where the reactive webhook trigger and the daily sweep race for the same athlete on the same day, a push could be sent (or withheld) based on a decision already superseded by a concurrent write. Low likelihood, not spec-violating on its own (no scenario in agent-runtime spec covers this race), but the RPC's own escalated return value would be a strictly more correct delivery gate than the pre-fetch snapshot.

WARNING-4 - No formal TDD Cycle Evidence table in apply-progress.md, despite cached project config showing Strict TDD Mode enabled.
strict-tdd-verify.md requires a RED/GREEN/TRIANGULATE/SAFETY NET table per task when Strict TDD is active; apply-progress.md has narrative-only TDD claims (e.g., "written test-first" for acwrFromComponents). The underlying test coverage is real, comprehensive, and independently re-verified as passing (66/66) in this pass - this is a process/documentation gap, not a functional defect, but it means TDD cycle order (red-before-green) cannot be formally audited from the artifact alone for tasks outside the one narratively described.

## SUGGESTION

SUGGESTION-1 - The pre-declared, user-accepted deferred item (PMCChart.jsx's manual "Recalcular" button still writes via a 4th, separate calculator in trainingLoadService.js) is exactly as documented in tasks.md's Notes section - confirmed still true, still harmless (writes land at calc_version=1, overwritten by the next sweep/webhook pass). No new action needed; restating only to confirm this pass did not find it worse than described.

SUGGESTION-2 - 20260831130000_merge_training_load_alerts_select_policies.sql (a legitimate, no-semantic-change RLS-policy consolidation responding to a Supabase-advisor "Multiple Permissive Policies" warning) exists on disk and was applied to production, but is not referenced anywhere in tasks.md or apply-progress.md. Not a defect - it's exactly what it says, and independently verified to preserve the same self-OR-active-coach semantics - but worth a one-line addition to tasks.md's Notes section so the migration list stays a complete, auditable trail before archive.

SUGGESTION-3 - Consider adding EXPLAIN ANALYZE verification in production for get_athletes_needing_load_refresh's two EXISTS branches once the athlete roster grows past the current small testing-phase dataset (5 athletes with real data) - the index-usage comments in the migration are plausible but unverified against a real query plan at any meaningful scale.

## Proposal Success Criteria - literal check against code (independent of tasks.md's own claims)

| Criterion | Verdict |
|---|---|
| Exactly one implementation of TSS/CTL/ATL/TSB/ACWR | Partial - core formulas: true. calculateAcwr (generic ratio helper) still exists in trainingMetrics.js, called from PMCChart.jsx/teamHealthService.js with chronic_load_28 ?? ctl fallback (fixed post-4.4, confirmed) and from PMCChart.jsx's manual recalc button via a fully separate calculator (deferred, documented, harmless). Not "exactly one" in the strictest literal sense, but functionally converged and explicitly acknowledged by the user - same known-deviation status as before this pass. |
| Exactly one alert rulebook | True - confirmed by grep, zero surviving getAcwrZone/getAcwrAlertConfig/deriveAlertLevel definitions. |
| daily_training_load fully described by versioned migration + RLS (coach/self/service_role) | True - confirmed by direct migration read. |
| New Strava activity updates the day's row with no human interaction | True - triggerLoadRecalc wired at all 3 call sites in strava-webhook. |
| Non-syncing athlete still gets swept | True (mechanism verified in code + orchestrator-confirmed live scheduling; actual Monday firing still pending per 3.12, not a code defect). |
| ACWR breach -> exactly one alert, correct visibility, no repeat while ongoing | True for the "no repeat while ongoing, undismissed" case. False for the dismiss-and-realert sub-case - see CRITICAL-1. |
| Backfill completes with zero alerts | True - confirmed live: 600 backfilled rows, 0 alert rows. |
| training_sessions never written by this change | True - confirmed by grep + a guarded static test. |
| Core module has zero Supabase/React/UI imports | True - confirmed by file header and the file's own import list (none). |

## What this pass did NOT independently re-verify (orchestrator-confirmed only, per the task's own scope)

- Live Supabase state: migrations actually applied, Edge Functions actually deployed, TRAINING_LOAD_ALERTS_ENABLED=true live, legacy trg_push_acwr_alert trigger actually dropped. All orchestrator-confirmed this session via direct MCP queries with recorded results in tasks.md; not re-queried here (no live Supabase access in this context).
- Actual pg_cron job firing (task 3.12) - inherently time-gated, correctly left open.

## Recommendation

Do not archive yet. CRITICAL-1 is a genuine, testable spec violation with a concrete, low-risk fix (make dismiss() also set status='resolved', reusing the already-proven resolve-then-reinsert path) and zero test coverage protecting against a regression. Recommend routing back to sdd-apply for a small, scoped fix plus a new test asserting "dismiss then next-day-same-condition creates a fresh open episode", then re-running sdd-verify before archive. All other findings (WARNING/SUGGESTION) are non-blocking and can be captured as follow-up notes at archive time if the user prefers to accept them as-is.

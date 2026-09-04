# Verification Report: Adherence Detection Agent (Agent 2)

**Change**: adherence-detection-agent
**Mode**: Full artifact set (proposal + design + 4 specs + tasks + apply-progress) verified for completeness, correctness, and coherence
**Verified**: 2026-09-01, fresh-context source inspection plus independent local test/build/lint execution (no live Supabase access this pass; migration/RPC/trigger live-verification results are orchestrator-confirmed per tasks.md and treated as authoritative per the brief)

## Verdict: PASS WITH WARNINGS

0 CRITICAL, 2 WARNING, 2 SUGGESTION. No blocking correctness defect found. Both warnings are pre-existing or scope-boundary issues, not regressions this change introduced, and neither breaks an enforceable spec Scenario as literally written.

## Completeness (Tasks)

26/26 tasks checked in tasks.md, corroborated against actual file contents, not trusted blindly.

- Phase 1 (core module): engagementCore.js exists, zero imports, matches design's gate order and constants exactly.
- Phase 2 (migrations): all 5 present on disk with rollback siblings; migrations 1 and 4 additionally have verify siblings, matching design's stated plan precisely.
- Phase 3 (Edge Function): engagement-monitor index.ts plus logic.js plus logic.test.js present, kill-switch, dry-run, and self-chaining logic all present and correctly wired.
- Phase 4 (reactive resolve wiring): strava-webhook index.ts's triggerEngagementResolve confirmed wired only inside processNewActivity, catch pre-attached before waitUntil exactly as documented.
- Phase 5 (UI): all 7 files created or modified as claimed; spot-checked against actual diffs, not just checkbox trust.
- Phase 6 (final verification): independently re-ran all four checks, see below.

No unchecked task found. No task-completion claim contradicted by the actual code.

## Independent Re-Verification (Phase 6, re-run fresh, not trusted from tasks.md)

| Check | Claimed | Independently confirmed |
|---|---|---|
| npm run test:core | 124/124 (apply's final claim) | 124/124, 28 suites, 0 fail, matches exactly |
| npm run build | succeeds | Succeeds, Vite plus PWA precache, no errors |
| npm run lint on touched files | zero new errors | Confirmed. Every flagged error in TeamHealthTable.jsx, TrainingLoadAlertFeed.jsx, AthleteProfile.jsx, athlete Dashboard.jsx is present verbatim in git show HEAD of the same file, i.e. pre-existing at the last commit, before this batch's uncommitted edits |
| "adherencia" grep | 4 total repo matches, 1 fixed by this change, 3 pre-existing out of scope | Confirmed. Repo-wide case-insensitive grep finds exactly the 3 named files (athlete-ai-chat/index.ts, weekly-ai-reports/index.ts, trainingLoadCore.js line 359) plus this change's own openspec artifacts, which legitimately discuss the retired term. Zero occurrences in any shipped src or supabase/functions code outside those 3 |

Note on the "124 vs 152" discrepancy flagged in the task brief: the final apply-progress.md (batch 3, authoritative) claims 124/124 consistently and that is what I independently reproduced. Whatever earlier batch reported 152 was evidently scoped differently, possibly a stale or partial run before package.json's test:core glob was updated in task 1.3. Not reproducible now and not a live discrepancy in the final state.

## Spec Compliance Matrix

### athlete-engagement-signals

| Requirement | Status | Evidence |
|---|---|---|
| Signal-of-Life Sources, 4 sources OR-blend | PASS | resolveLastSignal in engagementCore.js; unit tests cover each source alone, all-null, mixed formats |
| Missing Source Coverage Must Never Produce False Positive | PASS | Pure max over present values only, tested explicitly |
| Silence Day Computation | PASS | daysBetween, UTC-anchored, tested across month, year, DST boundaries |
| Warm-Up Exclusion, 21d, boundary inclusive | PASS | isPastWarmUp tested at 20d excluded and exactly 21d included; RPC's start_date <= today - warmup_days matches |
| Zero-Planned-Sessions Suppression | PASS | Gate 2 in evaluateEngagement, tested at 40 days silence with 0 planned |
| Never-Started Edge Case | PASS | Gate 3, anchored to start_date, always lands danger by construction, tested |
| Signal source parenthetical "session marked completed or skipped" | See WARNING 1 | The completed_at column is never populated when a session is marked skipped by the only production write path (weeklyTrainingService.js) |

### athlete-engagement-alerts

| Requirement | Status | Evidence |
|---|---|---|
| Single Alert Type, Severity-Tiered | PASS | CHECK constraint restricts alert_type to engagement_silence, ALERT_TYPES const matches |
| Severity Tiers, 10d warning / 21d danger | PASS | tierFor, tested at 9/10/20/21 boundaries |
| Escalation Reuses Same Row and Redelivers | PASS | upsert_engagement_alert's ON CONFLICT WHERE status open, escalated computed via pre-write SELECT FOR UPDATE; live-tested by orchestrator, escalated true confirmed; shouldDeliverPush gates push on is_new or escalated |
| Danger-to-Warning De-escalation Unreachable | PASS by construction | silenceDays for an open alert cannot decrease between sweeps because any de-escalating signal resolves the row first |
| Never-Started Same Type, Distinct Copy | PASS | messageFor never_started/danger produces distinct Spanish copy, alert_type unchanged |
| Deduplication, at most one open alert | PASS | Partial unique index on (athlete_id, alert_type) WHERE status open, verified by _verify.sql |
| Reactive Resolve Lifecycle, all 4 sources, immediate | PASS | 3 AFTER triggers plus strava-webhook's direct rpc call; orchestrator live-tested a real wellness_log insert flipping a test alert to resolved |
| Coach-Sent Message Does Not Resolve | PASS | Trigger keys on NEW.sender_id, and athletes.id IS users.id makes sender_id = athlete_id a correct athlete-only test |
| Coach-Supervised Athletes Only | PASS | get_engagement_candidates sources exclusively from coach_athlete_relationship |
| RLS Visibility, no self-select | PASS, verified in depth below | |

### engagement-agent-runtime

| Requirement | Status | Evidence |
|---|---|---|
| Scheduled Daily Sweep, CRON_SECRET-gated | PASS | Migration 5's cron.schedule, isAuthorized in logic.js, tested |
| Unauthorized sweep rejected | PASS | Tested |
| Reactive Resolve Triggers, all 4 paths | PASS | See above |
| Strava resolves without blocking ingestion | PASS | EdgeRuntime.waitUntil, catch pre-attached before waitUntil, confirmed by direct code read |
| Coach-Supervised-Only Routing | PASS | Candidate query has no independent-athlete path at all |
| Alert Delivery Routing, in-app always, push best-effort | PASS | upsertAlert always runs for a real finding in non-dry-run; deliverPush wrapped in try/catch, called only after upsert succeeds |
| Agent Scope Boundary, no training_sessions writes | PASS | Grep-based automated test in logic.test.js passes; independently re-confirmed via manual grep, only 2 select reads in fetchSingleCandidate, zero writes |
| Dry-Run Mode | PASS | effectiveDryRun computed correctly; orchestrator live-tested, processed 2, alertCount 0, correctly suppressed zero_planned |

### training-load-alerts (delta)

| Requirement | Status | Evidence |
|---|---|---|
| low_completion label reads Cumplimiento semanal | PASS | TRAINING_LOAD_LABELS.low_completion in alertFeedService.js |
| low_completion never presented as engagement/churn risk | PASS on literal Scenario text | See WARNING 2 for the broader proposal-level gap this narrow spec wording leaves open |

## RLS Visibility, Deep Check (explicitly requested focus)

Read 20260901100000_athlete_engagement_alerts.sql directly. Confirmed:

- Exactly one SELECT policy (athlete_engagement_alerts_select_coach), scoped to an EXISTS clause requiring car.coach_id = auth.uid() and car.status active. No clause anywhere compares auth.uid() to athlete_id.
- UPDATE policy is the same coach-only shape for read/dismiss lifecycle actions, also no self-clause.
- service_role gets a separate FOR ALL policy.
- _verify.sql's rls.no_self_select_policy check explicitly asserts no policy's qual matches the self-select pattern, a regression guard, not just a one-time check.
- athleteEngagementAlertsService.js and alertFeedService.js both document and rely on RLS returning an empty array for a supervised athlete's own query; athlete/Dashboard.jsx renders the merged feed unconditionally, before the isIndependent branch, with an explicit comment explaining why no client-side role gate is needed.

This is the single most load-bearing correctness property in the whole change and it is implemented correctly, consistently, at both the DB and UI layers.

## Trigger Migration, Additive Check (explicitly requested focus)

Read 20260901103000_engagement_reactive_resolve.sql directly, cross-referenced against tasks.md's V1 finding (orchestrator-verified live pre-existing triggers: chat_messages.trg_push_chat_message, training_sessions.trg_notify_athlete_training_assigned, training_sessions.trg_notify_coach_training_completed; zero on wellness_log). Confirmed:

- All 3 new triggers use DROP TRIGGER IF EXISTS on their own new trigger names, an idempotent re-apply guard. None target or drop any of the 3 pre-existing trigger names.
- Multiple AFTER triggers per table/event are additive in Postgres by design; nothing here replaces or disables the pre-existing 3.
- strava_activities has zero trigger definitions anywhere in this migration, confirmed by absence, matching design's explicit "deliberately gets no trigger" callout. The live resolve path for Strava is exclusively the fire-and-forget rpc call from processNewActivity, confirmed not present in processActivityUpdate or processActivityDelete.

## dismiss() Regression Check (explicitly requested focus)

athleteEngagementAlertsService.js's dismiss() sets dismissed_at, status resolved, and resolved_at together. The exact fix from Agent 1's verify pass. Not reintroduced. Confirmed byte-for-byte parallel to trainingLoadAlertsService.js's already-fixed dismiss().

## Proposal Success Criteria, Literal Check

| # | Criterion | Status |
|---|---|---|
| 1 | 10-day silent supervised athlete produces exactly one warning alert, visible to coach only | TRUE |
| 2 | Escalation past 21d updates same row to danger, no second warning | TRUE |
| 3 | Any signal of life resolves without waiting for next sweep | TRUE |
| 4 | Under-21-day-supervised athlete never evaluated | TRUE |
| 5 | Zero-planned-sessions athlete never alerted | TRUE |
| 6 | Strava-less but consistently-training athlete never alerted | TRUE |
| 7 | No independent athlete ever receives or generates an alert | TRUE |
| 8 | "adherencia" appears in zero shipped strings, columns, or alert_type values | FALSE, see WARNING 2. trainingLoadCore.js line 359's low_completion message_es still contains "adherencia" and is a shipped, coach-visible string rendered by TrainingLoadAlertFeed.jsx |
| 9 | Coach sees one merged feed, not two | TRUE |
| 10 | training_sessions never written by this change | TRUE, grep-verified, automated test |
| 11 | engagementCore.js has zero imports | TRUE |
| 12 | Dry-run reviewed before delivery enabled | TRUE per orchestrator's live-tested record; whether ENGAGEMENT_ALERTS_ENABLED was subsequently flipped to true in production is outside this session's visibility, see SUGGESTION 2 |

11 of 12 fully true, 1 false as literally worded, see WARNING 2 for the reasoning split between spec-compliant and proposal-checklist-compliant.

## Design Coherence

Design.md's architecture matches the shipped code in every dimension spot-checked: RLS decision, trigger-vs-RPC decision, single-alert-type-two-tiers decision, inverted sweep-selection decision, migration plan order and file names, interfaces and contracts (constants, function signatures, RPC signature, table shape), UI feed generalization file list, rollout slices. No deviation found beyond the two already self-documented and explicitly resolved in tasks.md (the alert_type naming fix, and the RLS proposal-vs-design reconciliation), both of which are correctly reflected in the final code, not stale.

## CRITICAL Issues

None found.

## WARNING Issues

**W1 — Spec's "session marked completed or skipped" signal-source description does not match actual DB write-path behavior.**

specs/athlete-engagement-signals/spec.md's Signal-of-Life Sources requirement describes training_sessions.completed_at as covering "session marked completed or skipped." In the actual codebase, weeklyTrainingService.js's skip-a-session write path (status set to skipped, around lines 436-443) does not set completed_at, it remains whatever it was before, typically null. Consequently: get_engagement_candidates's MAX(completed_at) signal never reflects a skip event, and the reactive-resolve trigger on training_sessions (correctly, consistently) only fires when NEW.status equals completed, so a skip event does not resolve an open alert either. This is internally consistent, the RPC and the trigger agree on what completed_at actually contains, and it does not violate the OR-blend safety principle (a missing signal only produces a false negative, never a false positive). An athlete who explicitly skips a session but does nothing else will still eventually be correctly flagged once truly silent long enough. But the spec's own parenthetical is factually inaccurate about existing schema behavior, which this change inherited rather than introduced.

Recommendation: either correct the spec text to drop "or skipped" so it matches reality, or file a small follow-up to also set completed_at on skip, which is a product decision (does explicitly skipping count as engagement) outside this change's scope.

**W2 — Proposal Success Criterion 8 (adherencia in zero shipped strings) is not fully met; the enforceable spec text is narrower than the proposal's checklist, and apply's scoping decision is a defensible but incomplete reading.**

trainingLoadCore.js line 359's low_completion message_es, "Baja adherencia al plan esta semana. Revisa las sesiones pendientes.", is unchanged, still contains "adherencia," and is rendered to coaches via the merged feed's message body (TrainingLoadAlertFeed.jsx displays alert.messageEs verbatim).

Independent assessment of apply's own flagged reasoning (task 6.2's Deviations note): apply is correct that the enforceable spec Scenario text only constrains the label ("MUST read Cumplimiento semanal and MUST NOT read Adherencia") and that the second Scenario ("descriptions do not overlap in wording") is satisfied because the two tables' message bodies use disjoint vocabulary, neither engagement_silence message contains "adherencia" or a synonym. So spec-level compliance holds and leaving trainingLoadCore.js untouched does not violate any spec Scenario. However, the proposal's own Success Criteria checklist is worded more strictly ("zero shipped strings") and that broader claim is not met. This is a real, if minor, gap between what the proposal promised and what the spec later actually committed the team to deliver.

Recommendation: before archiving, either narrow proposal.md's criterion 8 to explicitly say "labels and columns," reconciling it with what design.md scoped, or file the one-line trainingLoadCore.js message fix plus a training-load-monitor redeploy as an explicit fast-follow task so the original promise is eventually honored. Not blocking, this is a terminology-hygiene loose end, not a functional defect.

## SUGGESTION Issues

**S1 — LastSessionBadge's tone equals danger fallback branch is currently unreachable dead code, by design.**

Confirmed: silenceDays between 10 and 20 inclusive can only ever pair with tone warning given engagementCore.js's tier boundaries (10 to warning, 21 to danger, no other transition path exists per the no-downgrade requirement). Apply's own note already flags this as deliberate defensive coding against future threshold changes. No action needed, noting it's confirmed correct and intentional, not an oversight.

**S2 — Cannot confirm from this session whether ENGAGEMENT_ALERTS_ENABLED has actually been flipped to true in production.**

Everything up through the mandatory dry-run review is orchestrator-confirmed and live-tested. Whether the kill switch was subsequently flipped on, making the agent actually deliver alerts rather than just log dry-run counts, is a deployment/ops fact outside this session's visibility (no live Supabase access). Recommend the orchestrator confirm this explicitly before considering the feature live in the product sense, since a bare deploy with the flag still at its default of false would leave the whole agent silently inert despite every other layer being correctly implemented and tested.

## Independent Deviation Assessment (per the task brief's explicit ask)

1. RLS self-select removal: confirmed correct, necessary, and fully implemented at both DB and UI layers. Not a failure.
2. alert_type naming fix (inactivity to engagement_silence): confirmed consistent everywhere, migration CHECK constraint, engagementCore.js's ALERT_TYPES, evaluateEngagement's returned alertType, both RPCs, all 3 triggers' implicit target, and the UI's engagement label map. No stray "inactivity" reference found anywhere in shipped code.
3. Task 6.2's "adherencia" grep scoping: see WARNING 2. Apply's reasoning is correct against the literal spec text but leaves a real gap against the proposal's broader checklist, flagged as WARNING rather than accepted silently, per the task brief's explicit request for independent judgment.
4. No test harness for src/services or src/components: confirmed still true (test:core's glob only covers supabase/functions), build plus lint substitution is a reasonable, previously-established pattern for this repo, not a new gap this change invented.

## Summary

This is a well-executed, carefully documented change. Every architecturally load-bearing decision (RLS visibility, trigger-vs-RPC resolve mechanism, single-type two-tier taxonomy, backfill-safety on strava_activities, dedup, escalation race-safety) is implemented exactly as designed and independently verified against the actual code, not just trusted from tasks.md's checkboxes. Both warnings are pre-existing conditions or narrowly-scoped terminology gaps that this change's own authors (design.md, apply's Deviations notes) already surfaced for review rather than hiding. Verify's job here was to independently judge those self-flagged items rather than rubber-stamp them, and the judgment is: neither rises to CRITICAL, both are legitimate WARNING-level loose ends worth a decision before or shortly after archive.

Recommended next step: sdd-archive is reasonable, no CRITICAL blocks it. Before or shortly after archiving, resolve W1 (spec text correction, cheap) and W2 (proposal checklist correction or a tracked fast-follow task) so the archived record doesn't silently carry an inaccurate claim forward.

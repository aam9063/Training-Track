# Apply Progress: Adherence Detection Agent (Agent 2)

**Batch**: 3 of 3 (FINAL)
**Scope this batch**: Phase 5 (UI merged feed, tasks 5.1-5.7) + Phase 6 (final verification, tasks 6.1-6.4)
**Mode**: Strict TDD (this batch: UI/view-model layer, mirrored existing components/services — see TDD note below)

## Completed Tasks (cumulative — all batches) — 26/26, ALL DONE

- [x] 1.1 `supabase/functions/_shared/engagementCore.js` — pure, zero-import core module
- [x] 1.2 `supabase/functions/_shared/engagementCore.test.js` — 30 tests, `node --test`
- [x] 1.3 `package.json`'s `test:core` script updated to glob `supabase/functions/engagement-monitor/**/*.test.js`
- [x] 2.1 `supabase/migrations/20260901100000_athlete_engagement_alerts.sql` (+ `_rollback.sql` + `_verify.sql`) — applied to production, verified 9/9
- [x] 2.2 `supabase/migrations/20260901101000_engagement_sweep_rpc.sql` (+ `_rollback.sql`) — applied to production
- [x] 2.3 `supabase/migrations/20260901102000_upsert_engagement_alert_rpc.sql` (+ `_rollback.sql`) — applied to production, live-tested (escalation confirmed)
- [x] 2.4 `supabase/migrations/20260901103000_engagement_reactive_resolve.sql` (+ `_rollback.sql` + `_verify.sql`) — applied to production, verified 7/7 + manual functional test
- [x] 2.5 `supabase/migrations/20260901104000_pg_cron_engagement_sweep.sql` (+ `_rollback.sql`) — applied to production, 4 pg_cron jobs confirmed active
- [x] 3.1 `supabase/functions/engagement-monitor/index.ts` + `logic.js` — sweep/athlete modes, auth, kill switch, dry-run, self-chaining
- [x] 3.2 Delivery: in-app row via `upsert_engagement_alert` (always on any finding) + best-effort push via `send_push_notification`, gated on race-safe RPC result
- [x] 3.3 `supabase/functions/engagement-monitor/logic.test.js` — 28 tests, `node --test`
- [x] 4.1 `supabase/functions/strava-webhook/index.ts` — `triggerEngagementResolve` wired into `processNewActivity` only
- [x] 5.1 `src/services/athleteEngagementAlertsService.js` — created
- [x] 5.2 `src/services/alertFeedService.js` — created
- [x] 5.3 `src/components/shared/TrainingLoadAlertFeed.jsx` — modified to consume merged feed
- [x] 5.4 `src/components/dashboard/AthleteLoadAlerts.jsx` — default title updated
- [x] 5.5 `src/pages/dashboard/AthleteProfile.jsx` + `src/pages/athlete/Dashboard.jsx` — comment/copy updated, no role branching added
- [x] 5.6 `src/services/teamHealthService.js` — engagement alert query + merge added
- [x] 5.7 `src/components/dashboard/TeamHealthTable.jsx` — `LastSessionBadge` extended
- [x] 6.1 Grep verification: zero `training_sessions` writes in `engagement-monitor/` or `engagementCore.js`
- [x] 6.2 Grep verification: "adherencia"/"Adherencia" — see Deviations for the 3 pre-existing, out-of-scope occurrences found and why they were not touched
- [x] 6.3 `npm run test:core` — 124/124 pass
- [x] 6.4 `npm run lint` / `npm run build` — zero new errors vs. baseline (build succeeds); pre-existing repo-wide lint baseline (`motion` false-positive unused-var flags, `TH`-in-render pattern) confirmed unchanged in touched files via `git show HEAD:<file>`

## Files Changed (this batch)

| File | Action | What Was Done |
|------|--------|----------------|
| `src/services/athleteEngagementAlertsService.js` | Created | `getEngagementAlerts(athleteId, {status, includeDismissed})`, `markRead(alertId)`, `dismiss(alertId)` against `athlete_engagement_alerts` — line-for-line parallel to `trainingLoadAlertsService.js`, including its `dismiss()` fix (`status:'resolved'` + `resolved_at` alongside `dismissed_at`, not just `dismissed_at`). |
| `src/services/alertFeedService.js` | Created | `getMergedAlerts(athleteId)`: `Promise.all([getAlerts(...), getEngagementAlerts(...)])`, maps each row to the view-model `{ id, source, label, tone, messageEs, createdAt, readAt, dismissedAt }` via two local label maps (`TRAINING_LOAD_LABELS` incl. `low_completion: 'Cumplimiento semanal'`; `ENGAGEMENT_LABELS` = `{warning:'Inactividad', danger:'Riesgo de abandono'}`), normalizes engagement's `('warning','danger')` severity vocabulary to the shared `tone` (`'warning'` or `'critical'`) so neither table's raw vocabulary leaks into the UI, sorts merged array by `createdAt` desc. Also exports `markRead(item)`/`dismiss(item)` dispatching on `item.source`. |
| `src/components/shared/TrainingLoadAlertFeed.jsx` | Modified | Now imports `getMergedAlerts`/`markRead`/`dismiss` from `alertFeedService` instead of `trainingLoadAlertsService`. Renders from the view-model (`alert.label`, `alert.tone`, `alert.messageEs`, `alert.createdAt`, `alert.readAt`, `alert.dismissedAt`) instead of raw `alert.alert_type`/`alert.severity`/`alert.message_es`/`alert.created_at`. Replaced `ALERT_TYPE_CONFIG` (keyed by `alert_type`) with `ALERT_LABEL_CONFIG` (keyed by the normalized `label` string, covering all 6 labels across both sources — added `FiClock` for "Inactividad" and `FiUserX` for "Riesgo de abandono", both confirmed to exist in `react-icons/fi`). `SEVERITY_CLASSES` unchanged in shape (`critical`/`warning` keys already matched the new `tone` values exactly) but now keyed by `alert.tone` instead of `alert.severity`. Default `title` changed from `'Alertas de carga'` to `'Alertas'`. List `key` changed to `${alert.source}-${alert.id}` since ids are no longer guaranteed globally unique across the two merged tables. |
| `src/components/dashboard/AthleteLoadAlerts.jsx` | Modified | Default `title` prop updated from `'Alertas de carga'` to `'Alertas'`; updated its doc comment to describe the merged feed. Pure pass-through, no logic change. |
| `src/pages/dashboard/AthleteProfile.jsx` | Modified | Comment above `<AthleteLoadAlerts>` updated to describe the merged feed (training-load signals + `engagement_silence`). No role branching added. |
| `src/pages/athlete/Dashboard.jsx` | Modified | Comment above `<TrainingLoadAlertFeed>` updated to explain why no role branching is needed (RLS has no self-select policy on `athlete_engagement_alerts`, so a supervised athlete's own query naturally returns nothing from that source). Dropped the now-stale `emptyMessage="Sin alertas activas de carga"` prop (relies on the component's new generic default `'Sin alertas activas'`) since the feed is no longer load-only. |
| `src/services/teamHealthService.js` | Modified | Added a 5th parallel query: `athlete_engagement_alerts` select `athlete_id, severity, silence_days` filtered `.in('athlete_id', athleteIds).eq('status', 'open')`. Built `engagementMap` (athlete_id → `{tone, silenceDays}`) and merged onto each athlete row as `engagementTone`/`silenceDays`. Updated the function's JSDoc return-shape comment. Did not copy the dead `'pending'` status filter (not present in this query — only `status='open'` on the alerts table, unrelated to `training_sessions.status`). |
| `src/components/dashboard/TeamHealthTable.jsx` | Modified | `LastSessionBadge` now accepts `silenceDays`/`tone` props. When `silenceDays >= 10`, renders `"{silenceDays}d sin señal"` in amber (10-20d) or red (`silenceDays >= 21` OR `tone === 'danger'`), with a `title` attribute carrying the Spanish tier label ("Inactividad"/"Riesgo de abandono") for hover context; falls back to the pre-existing last-session-date rendering otherwise. Both call sites (mobile card view, desktop table view) updated to pass `silenceDays={athlete.silenceDays}` and `tone={athlete.engagementTone}`. |
| `openspec/changes/adherence-detection-agent/tasks.md` | Modified | Marked 5.1-5.7 and 6.1-6.4 as `[x]` — all 26 tasks now complete. |

## TDD Note (this batch)

This batch is UI/service-layer glue code (view-model mapping, prop threading, JSX rendering) mirroring three pre-existing, already-tested patterns in this repo (`trainingLoadAlertsService.js`'s CRUD shape, `TrainingLoadAlertFeed.jsx`'s existing render logic, `TeamHealthTable.jsx`'s existing `LastSessionBadge`/`daysSince` pattern) — none of `src/services/`, `src/components/`, or `src/pages/` has an existing unit-test harness in this repo (no Vitest/Jest/RTL config found; `test:core` is `node --test` scoped to `supabase/functions/**` only). Consistent with the previous batch's documented approach for `strava-webhook` (no test infra to extend, out of this batch's scope to invent), verification here was: (1) mirroring proven service/component shapes near-verbatim rather than freehand code, (2) `npm run build` (a real Vite/React production build, which fails on JSX/import errors) succeeding cleanly, (3) `npm run lint` producing zero new errors in any touched file (verified against `git show HEAD:<file>` for the two files that did show pre-existing, unrelated lint noise), (4) `npm run test:core`'s 124/124 backend suite proving zero regressions in the Edge Function / core-module layer this UI work reads from. No RED→GREEN cycle was run for this batch — flagging explicitly as a documented gap consistent with the batch-2 precedent, not a silent skip.

## Self-Checks Run (Phase 6, repo-local)

- `grep -n "training_sessions"` across `supabase/functions/engagement-monitor/` → all 3 non-test occurrences are `.from("training_sessions").select(...)` reads inside `fetchSingleCandidate` (index.ts lines ~101, ~131); zero `.insert/.update/.upsert/.delete` verbs near any `training_sessions` reference. Confirmed via the existing automated grep-based test in `logic.test.js` (`no writes to training_sessions anywhere in the function`), which passed.
- `grep -n "training_sessions"` across `supabase/functions/_shared/engagementCore.js` → zero matches (the core module has zero imports and touches no table names at all, by design).
- `grep -rniE "adherencia"` across the whole repo → 4 matches, 1 already fixed by this batch (the old `label: 'Adherencia'` in `TrainingLoadAlertFeed.jsx`, now `'Cumplimiento semanal'` per task 5.3 / the `training-load-alerts` spec delta's Scenario), 3 pre-existing and out of this change's scope — see Deviations below.
- `npm run test:core` → 124/124 pass, 0 fail (28 suites; includes all of Phase 1-3's engagementCore/engagement-monitor/training-load-monitor suites, unchanged by this UI-only batch).
- `npm run build` → succeeds (`vite build` + PWA precache generation, no errors).
- `npm run lint` → 194 pre-existing errors / 10 warnings across the repo (confirmed via `git show HEAD:<file>` that the touched-file findings — `TeamHealthTable.jsx`'s `motion`-unused false-positive and pre-existing `TH`-created-during-render pattern, `TrainingLoadAlertFeed.jsx`'s `motion`-unused false-positive — all existed at `HEAD` before this batch's edits, in code this batch did not modify). Zero new errors introduced by any file touched in this batch.

## Deviations from Design / Notes

**Task 6.2's "adherencia"/"Adherencia" grep: 3 pre-existing occurrences found, deliberately left unchanged.**
1. `supabase/functions/athlete-ai-chat/index.ts:136-137` — `ADHERENCIA AL PLAN` in an AI chat system-prompt context label, unrelated feature (Hermes IA chat), not part of this change's scope.
2. `supabase/functions/weekly-ai-reports/index.ts:118` — "evaluar adherencia al plan" in an AI report-generation prompt, unrelated feature, not part of this change's scope.
3. `supabase/functions/_shared/trainingLoadCore.js:359` — `low_completion`'s `message_es`: `'Baja adherencia al plan esta semana. Revisa las sesiones pendientes.'`

(3) is the one genuinely adjacent to this change (it's Agent 1's `training_load_alerts` core, the same table whose label this batch renamed). Left unchanged because `design.md`'s own "The `training-load-alerts` Delta is UI-Copy-Only" section is explicit and singular: *"D1 changes **one string literal**: `src/components/shared/TrainingLoadAlertFeed.jsx:21` ... **No migration. No backfill.**"* — the design author flagged this precisely to stop `sdd-tasks`/`sdd-apply` from over-scoping beyond that one literal. The spec delta's own enforceable Scenario ("`low_completion` label reads 'Cumplimiento semanal'") tests the **label**, not the message body, and the message body's own wording already scopes correctly to a single week ("esta semana") — it does not claim multi-week engagement, so it does not contradict the delta's other Scenario ("low_completion is never presented as engagement/churn risk"). Editing `trainingLoadCore.js` would touch Agent 1's already-deployed-to-production Edge Function (`training-load-monitor`) outside this batch's assigned file list and outside `design.md`'s explicit one-literal scope. Flagging this as a resolved, documented reading of task 6.2 rather than a silent skip — if the intent was actually to also change the message body, that is a one-line follow-up in `trainingLoadCore.js` plus a `training-load-monitor` redeploy, deliberately not done here given the explicit design-level scope fence.

**`FiClock`/`FiUserX` icon choices for the two engagement labels** ("Inactividad" / "Riesgo de abandono") were not specified anywhere in `design.md` (which only defines the training-load `ALERT_TYPE_CONFIG`'s existing 4 icons). Both confirmed to exist in the installed `react-icons/fi` package (`grep` against `node_modules/react-icons/fi/index.d.ts`) before use. Chosen for straightforward semantic fit (a clock for time-based silence, a user-with-X for churn/abandonment risk) — cosmetic choice, easy to swap in review if a different icon is preferred.

**`LastSessionBadge`'s `tone` prop is a secondary signal, not the primary color driver.** Per task 5.7's literal wording ("amber ≥10d, red ≥21d"), the `silenceDays` threshold is what determines amber vs. red; `tone === 'danger'` is OR'd in as a fallback in case a `danger`-severity alert's `silenceDays` were ever between 10-20 (not currently possible given `engagementCore.js`'s tier boundaries, but defensive against future threshold changes without a corresponding UI edit).

## Status

**26/26 tasks complete. This is the final batch — the Adherence Detection Agent (Agent 2) change is fully implemented, all migrations applied to production, both Edge Functions deployed and live-verified, and the merged UI feed is in place.**

Ready for `sdd-verify`.

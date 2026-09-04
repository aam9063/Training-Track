# Apply Progress: Communication Agent (Agent 4)

**Artifact store**: openspec (file-based)
**This is apply batch 2 of N** — Phase 3 (`engagement-monitor` reactive handoff), merged onto batch 1's Phases 1-2.

## Mode

**Strict TDD Mode: ACTIVE.** Phase 1 (`logic.js`) followed RED → GREEN → REFACTOR exactly. Phase 2 (`index.ts`, Deno TypeScript, not runnable under `node --test`) was implemented directly against design.md's diff regions and verified via the full `test:core` suite (which exercises `logic.js` extensively) plus `npm run lint` and `npm run build`.

## TDD Cycle Evidence (Phase 1 — `weekly-ai-reports/logic.js`)

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.1-1.2 `logic.test.js` + `logic.js` | Confirmed: ran `node --test "supabase/functions/weekly-ai-reports/logic.test.js"` before `logic.js` existed → `ERR_MODULE_NOT_FOUND`, 1 failing test, 0 passing | Confirmed: after writing `logic.js`, same command → 35/35 passing | Confirmed: `logic.js` has zero `import`/`require` statements (grepped), JSDoc on every export documents the severity-vocabulary bridge |
| 1.4 `package.json` glob | N/A (test wiring) | Confirmed: full `npm run test:core` picks up the new file and passes | N/A |

## Completed Tasks

### Phase 1 — `weekly-ai-reports/logic.js`
- [x] 1.1 RED — `logic.test.js` written first, 35 tests covering: headline criterion (`danger` engagement alone ⇒ `critical`), `normalizeEngagementSeverity` both directions, full cross-vocabulary matrix (13 combinations of load/engagement/suggestion), single-argument byte-identity guarantee (3 cases), pending-suggestion-only ⇒ `attention` (never `critical`), all 4 decided-suggestion statuses ⇒ `ok`, `higherTier` raise/hold/match/unknown-candidate/unknown-floor/both-unknown (7 cases). Confirmed RED against the not-yet-existing module.
- [x] 1.2 GREEN — `logic.js` created (zero imports): `TIER_ORDER`, `normalizeEngagementSeverity`, `alertLevelFromOpenAlerts`, `higherTier`, byte-identical to design.md's Interfaces block.
- [x] 1.3 REFACTOR — grep confirms zero `import`/`require`; JSDoc documents the vocabulary bridge inline.
- [x] 1.4 — `package.json`'s `test:core` glob extended with `"supabase/functions/weekly-ai-reports/**/*.test.js"`.

### Phase 2 — `weekly-ai-reports/index.ts`
- [x] 2.1 Imports (`alertLevelFromOpenAlerts`, `higherTier` from `./logic.js`) + module constants (`WIDE_CONTEXT_ENABLED`, `REACTIVE_ENABLED`, `PLAN_ADJUSTMENT_LOOKBACK_DAYS`, `PLAN_ADJUSTMENT_MAX_ROWS`, `todayLocalStr`, `isoWeekStartLocal`, `daysBetweenISO`, `logEvent`).
- [x] 2.2 Local `alertLevelFromOpenAlerts` deleted; explanatory comment extended with the 3-source vocabulary-bridge rationale.
- [x] 2.3 Two new reads (`athlete_engagement_alerts`, `plan_adjustment_suggestions`) added as Promise.all elements 9-10, gated on `WIDE_CONTEXT_ENABLED` with `Promise.resolve({data:[],error:null})` placeholders (positional/array-length constant across flag states). `alertLevel` now derives from all three sources. Five new additive `weekData` keys (`engagement_alerts`, `plan_adjustments`, `wide_context`, `week_partial`, `week_elapsed_days`) — no existing key renamed or removed.
- [x] 2.4 Same-week dedup guard: first statement in `processAthlete`, `mode==='athlete'` + existing `status==='completed'` row ⇒ returns `{skipped:'already_reported_this_week'}` with zero Gemini calls, zero writes. `processAthlete` gained a defaulted final `mode` parameter.
- [x] 2.5 `nivel_alerta` overwrite replaced with the `higherTier` floor, gated on `WIDE_CONTEXT_ENABLED` (off ⇒ today's exact "model wins" behavior preserved).
- [x] 2.6 Prompt additions in `callDeepSeek`: `engagementBlock`, `planBlock`, `partialWeekNote`, `wideContextBlocks`, `crossAgentInstructions` — every interpolation is `''` when `weekData.wide_context` is falsy; insertion points preserve exact original whitespace (verified by read-through, see 2.12).
- [x] 2.7 Request-body handling: `mode` explicitly validated (`400 {error:'invalid mode'}` on anything else, never silently defaults), `targetAthleteId`/`alertId` parsed, `mode==='athlete'` without `targetAthleteId` ⇒ `400`.
- [x] 2.8 Authorization tightening: `isServiceRole` hoisted, `jwtUserId` retained (previously discarded — this was the actual pre-existing hole), `isTrusted = isCron || isServiceRole`. Non-trusted + `mode==='athlete'` ⇒ `403`. Non-trusted + (`!targetCoachId` OR mismatch) ⇒ `403` — **both branches implemented**, including the absent-`coach_id` case added to spec.md after design.md was written. `REACTIVE_ENABLED` dry-run gate added immediately after (zero reads, zero Gemini, logged).
- [x] 2.9 Week window: `mode==='athlete'` computes Monday(Europe/Madrid today)..today via `isoWeekStartLocal`/`todayLocalStr`; the pre-existing UTC last-Monday..last-Sunday block for `mode!=='athlete'`/no explicit week is **byte-unchanged**.
- [x] 2.10 Relationship query: `.eq('athlete_id', targetAthleteId)` added when `mode==='athlete'`, alongside untouched `.eq('coach_id', targetCoachId)` and `.eq('status','active')`. Confirmed by reading: `status='active'` remains the sole independent-athlete gate.
- [x] 2.11 Result plumbing: `mode` passed through to `processAthlete`; accumulation loop skips `coachSummary` increments when `result.skipped` is truthy; `results[]` items gain a nullable `skipped` field. `notifyCoach` left unmodified (D6, explicit Open Question, not in scope).
- [x] 2.12 Full read-through of the `WIDE_CONTEXT_ENABLED=false` + `REACTIVE_ENABLED=false` path, done statically against the pre-change file (see "Byte-Identity Verification" below). No `node --test` harness exists for Deno TS files (`index.ts` is not `node --test`-loadable, same boundary as Agents 1-3), so this is a **static read-through**, not an automated capture-and-diff test. A live capture-and-diff against a real fixture athlete/week for both switches remains **orchestrator-owned**, pre-deploy.

## Byte-Identity Verification (task 2.12, static read-through)

With `WIDE_CONTEXT_ENABLED=false` and no explicit `mode` (sweep/digest, cron `{}` body):
1. `engagementRes`/`planAdjRes` resolve to `{data:[],error:null}` (ternary short-circuits before the query builder runs) ⇒ `engagementAlerts=[]`, `planAdjustments=[]`.
2. `alertLevel = alertLevelFromOpenAlerts(openAlerts, [], [])` — proven by the "single-argument call" test suite in `logic.test.js` to equal `alertLevelFromOpenAlerts(openAlerts)`'s pre-change value for all three tiers.
3. `weekData.wide_context = false` ⇒ `wideContextBlocks = ''` and `crossAgentInstructions = ''` in `callDeepSeek` ⇒ the assembled prompt string's surrounding text (`}${wideContextBlocks}\n\nINSTRUCCIONES...` and `.${crossAgentInstructions}\n\nIMPORTANTE...`) reduces to exactly the original `}\n\nINSTRUCCIONES...` / `.\n\nIMPORTANTE...` — confirmed by direct inspection of both insertion points against the pre-change file content read at the start of this batch.
4. `finalAlertLevel = WIDE_CONTEXT_ENABLED ? higherTier(...) : modelLevel` ⇒ `false` branch ⇒ `finalAlertLevel = modelLevel` — byte-identical to the original unconditional overwrite.
5. Week window: `mode!=='athlete'` and no explicit `weekStart` ⇒ falls into the `else if (!weekStart!)` block, which is untouched source text (confirmed via diff read — only the `if (mode==='athlete')` branch was prepended, the `else if` body itself was not edited).
6. New additive `weekData`/`report_data` keys (`engagement_alerts:[]`, `plan_adjustments:[]`, `wide_context:false`, `week_partial:false`, `week_elapsed_days:7`) do not affect the prompt (all wide-context prompt code paths check `wide_context` truthiness first) and do not remove/rename any existing `report_data` key.
7. `results[]` gains a nullable `skipped` field (always `null` on the sweep path since `processAthlete`'s normal return has no `skipped` key) — additive only, matches the Request Contract Summary table in design.md.

**Not yet done**: an actual live invocation with a real fixture athlete/week, capturing the assembled prompt text and response JSON before/after this diff and running a byte-level diff. This requires a live Supabase environment and is explicitly flagged in tasks.md as orchestrator-owned, pre-deploy (same as the two live-check items already listed under "Orchestrator-Owned Pre-Apply Verification" in tasks.md).

## Test Results

```
npm run test:core
ℹ tests 260
ℹ suites 51
ℹ pass 260
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
```

260 = 225 (Agent 3's baseline, per prior session memory) + 35 new (`weekly-ai-reports/logic.test.js`). No regressions in any pre-existing suite (`_shared`, `training-load-monitor`, `engagement-monitor`, `planning-agent`).

```
npm run lint
✖ 206 problems (196 errors, 10 warnings)
```

Zero of these 206 problems reference `weekly-ai-reports` or any file touched by this batch (`logic.js`, `logic.test.js`, `index.ts`, `package.json`) — confirmed by grepping the lint output for `weekly-ai-reports`, zero matches. All 206 are pre-existing issues in unrelated files (`Calendar.jsx`, `Dashboard.jsx`, `Messages.jsx`, `Metrics.jsx`, `Planning.jsx`, `Profile.jsx`, `athleteService.js`, `dashboardService.js`, `planningService.js`, `_shared/planAdjustmentCore.js`, `vite.config.js`). This batch introduces **zero new lint errors/warnings**. (Note: `supabase/functions/weekly-ai-reports/index.ts` is a Deno TS file — ESLint's config does not appear to lint Deno function `.ts` files at all in this repo, only `.js`; `logic.js`/`logic.test.js` are plain Node-compatible JS and produced zero lint findings.)

```
npm run build
✓ built in 20.37s
```

Succeeds. Only pre-existing chunk-size warnings for unrelated large deps (`vendor-maps`, `pdfExport`, `exceljs.min`, `index-*`) — no new errors.

## Files Changed

| File | Action | What Was Done |
|---|---|---|
| `supabase/functions/weekly-ai-reports/logic.js` | Created | Pure alert-tier arithmetic: `TIER_ORDER`, `normalizeEngagementSeverity`, `alertLevelFromOpenAlerts` (widened to 3 sources), `higherTier` (the floor). Zero imports. |
| `supabase/functions/weekly-ai-reports/logic.test.js` | Created | 35 tests, written RED-first per strict TDD. |
| `supabase/functions/weekly-ai-reports/index.ts` | Modified | All 12 design.md diff regions applied: imports/constants, deleted local `alertLevelFromOpenAlerts`, 2 new parallel reads + 5 new `weekData` keys, same-week dedup guard, `higherTier` floor, 5 prompt interpolations, `mode`/`athlete_id`/`alert_id` body parsing with explicit validation, `isServiceRole`/`jwtUserId`/`isTrusted` + D5 authorization tightening (both wrong-`coach_id` and absent-`coach_id` cases) + D7 reactive dry-run gate, Europe/Madrid current-week window for `mode:'athlete'` (existing UTC block byte-unchanged), `.eq('athlete_id', ...)` relationship-query addition, `mode` threading + `skipped`-aware result plumbing. |
| `package.json` | Modified | `test:core` glob gained `"supabase/functions/weekly-ai-reports/**/*.test.js"`. |

## Deviations from Design

**None.** Implementation matches design.md's diff regions and interfaces exactly, including both spec requirements added after design.md was written (`higherTier` floor as an actual code enforcement point, and the absent-`coach_id` rejection branch in the D5 authorization block).

## Issues Found

None. Design.md's line-number references (auth block ~447-463, body parsing ~469-476, week default ~478-488, relationship query ~490-497, `alertLevelFromOpenAlerts` ~29-33, `nivel_alerta` overwrite ~392-399) all matched the live file at the start of this batch — no correction to design.md or spec.md was needed.

## TDD Cycle Evidence (Phase 3 — `engagement-monitor` reactive handoff)

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 3.1-3.2 `shouldTriggerWeeklyReport` | Confirmed: added the 7 pure-function test cases plus 3 static index.ts-shape checks to `logic.test.js`, ran `node --test "supabase/functions/engagement-monitor/logic.test.js"` before touching `index.ts` → 38 tests, 36 pass / 2 fail (both the index.ts-dependent static checks: `shouldTriggerWeeklyReport`/`triggerWeeklyReport` not present in `index.ts` yet, `EdgeRuntime.waitUntil`/`/functions/v1/weekly-ai-reports` handoff absent). The 7 pure-gate cases passed immediately since `shouldTriggerWeeklyReport` was added to `logic.js` in the same edit pass as its tests — RED-before-GREEN was confirmed honestly only for the two `index.ts`-shape assertions, which is the part that actually depended on unwritten code. | Confirmed: after adding the `triggerWeeklyReport` helper + call site to `index.ts`, re-ran the same command → 38/38 passing | Confirmed: one of my own new tests (`triggerWeeklyReport authenticates as service-role Bearer, never CRON_SECRET`) initially false-failed because its string-slice matched the explanatory comment block warning against copying `CRON_SECRET` (the comment text itself contains the string `CRON_SECRET`), not the actual `Authorization:` header line. Fixed the test to isolate the `Authorization:` line specifically rather than grep the whole function body — a test-quality fix, not a source fix; `index.ts`'s implementation was correct throughout. |
| 3.3 full suite | N/A | Confirmed: `npm run test:core` → 270/270 (260 baseline + 10 new: 7 pure `shouldTriggerWeeklyReport` cases + 3 static shape checks) | N/A |

## Completed Tasks (Phase 3)

### Phase 3 — `engagement-monitor` reactive handoff
- [x] 3.1 `shouldTriggerWeeklyReport(finding, upsertResult)` added to `supabase/functions/engagement-monitor/logic.js`, byte-matching design.md's Interfaces block: gates on `finding.alertType === 'engagement_silence'` AND `finding.severity === 'danger'` (confirmed via a direct read of `_shared/engagementCore.js`'s `evaluateEngagement` return shape — `metrics` is `{variant, lastSignalAt, lastSignalSource, plannedInWindow}`, no `zone` key, so `severity` is correctly the only usable field here, unlike Agent 1's `shouldTriggerReactivePlanning` which must use `metrics.zone` for the opposite documented reason). Also requires `upsertResult.is_new || upsertResult.escalated` — the same race-safe RPC-derived flags `shouldDeliverPush` already uses, never `evaluateForSweep`'s pre-write `decision`.
- [x] 3.2 RED — `logic.test.js` extended with 7 `shouldTriggerWeeklyReport` cases (danger+is_new, danger+escalated, danger+neither→false, warning in all 3 flag combos→false, non-`engagement_silence` alertType at danger→false, null finding→false, null upsertResult→false) plus 3 static `index.ts`-shape checks (handoff wiring present, never awaited, service-role-only auth). Confirmed genuinely RED for the 2 checks that depended on unwritten `index.ts` code (see TDD Cycle Evidence above).
- [x] 3.3 GREEN — `test:core` (already globbing `engagement-monitor/**/*.test.js`) passes with all new cases: 270/270.
- [x] 3.4 Fire-and-forget call site added to `processCandidate` in `supabase/functions/engagement-monitor/index.ts`, immediately after the existing `shouldDeliverPush`/`deliverPush` gate: `if (shouldTriggerWeeklyReport(result.finding, upserted)) triggerWeeklyReport(candidate.athleteId!, candidate.coachId!, upserted?.alert_id ?? null)`. `triggerWeeklyReport` mirrors `chainNextSweepPage`'s shape verbatim: `.then/.catch` pre-attached to the `fetch` promise before it is handed to `EdgeRuntime.waitUntil`, wrapped in its own `try/catch` around the `waitUntil` call, zero `await` anywhere on the path. Body: `{mode:'athlete', athlete_id, coach_id, alert_id}`.
- [x] 3.5 `triggerWeeklyReport` sends `Authorization: Bearer ${serviceRoleKey}` (`SUPABASE_SERVICE_ROLE_KEY` env var) — confirmed by reading the finished Phase 2 `weekly-ai-reports/index.ts` auth block that it accepts only the cron header, a service-role Bearer, or a user JWT, never `CRON_SECRET`. An explicit code comment in `triggerWeeklyReport` documents why `chainNextSweepPage`'s `Bearer ${cronSecret || serviceRoleKey}` pattern must NOT be copied here. Static test (3.2) grep-confirms the `Authorization:` line contains `serviceRoleKey` and neither `cronSecret` nor the literal `CRON_SECRET`.
- [x] 3.6 Confirmed by construction + read: the call site sits after `upsertAlert` and the `shouldDeliverPush`/`deliverPush` block (both already `await`ed and complete before `triggerWeeklyReport` is ever invoked), and `triggerWeeklyReport` itself is zero-await, fire-and-forget, with `.then/.catch` on the `fetch` promise and a `try/catch` around `EdgeRuntime.waitUntil`. A forced failure of the reactive `fetch` can only reach the `.catch` (logged as `engagement_monitor.weekly_report_trigger_failed`), which runs after `processCandidate`'s own return value is already computed — no code path lets it affect alert creation, escalation, or push delivery. Covered by the static "never awaits" test in 3.2.

## Issues Found (Phase 3)

One test-quality bug in my own new test, not in design.md or the live source (see "REFACTOR" column above): the initial `triggerWeeklyReport authenticates as service-role Bearer, never CRON_SECRET` assertion grepped the whole function body for the string `CRON_SECRET`, which false-failed against the function's own explanatory comment (the comment intentionally names `CRON_SECRET` to document why it must not be used). Fixed by isolating the actual `Authorization:` header line before asserting. No correction to design.md, spec.md, or any source file was needed — design.md's `shouldTriggerWeeklyReport`, `triggerWeeklyReport`, and call-site code blocks all matched the live `engagement-monitor` files exactly as written, including the `finding.alertType`/`finding.severity` field names confirmed against `_shared/engagementCore.js`'s actual return shape.

## Test Results (Phase 3, cumulative)

```
node --test "supabase/functions/engagement-monitor/logic.test.js"
ℹ tests 38
ℹ suites 8
ℹ pass 38
ℹ fail 0
```

```
npm run test:core
ℹ tests 270
ℹ suites 52
ℹ pass 270
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
```

270 = 260 (Phases 1-2 baseline) + 10 new (7 `shouldTriggerWeeklyReport` cases + 3 static `index.ts`-shape checks in `engagement-monitor/logic.test.js`). No regressions in any pre-existing suite.

```
npm run lint
✖ 206 problems (196 errors, 10 warnings)
```

Same 206-problem baseline as Phases 1-2 — grepped for `engagement-monitor`/`weekly-ai-reports`, zero matches. This batch introduces zero new lint findings.

```
npm run build
✓ built in 191ms
```

Succeeds, no new errors.

## Files Changed (Phase 3)

| File | Action | What Was Done |
|---|---|---|
| `supabase/functions/engagement-monitor/logic.js` | Modified | Added `shouldTriggerWeeklyReport(finding, upsertResult)` — pure gate, zero I/O, matches design.md's Interfaces block exactly. |
| `supabase/functions/engagement-monitor/logic.test.js` | Modified | Added 7 `shouldTriggerWeeklyReport` unit tests + 3 static `index.ts`-shape checks (handoff wiring present, never awaited, service-role-only auth), written/run RED-first against the pre-`index.ts`-change state. |
| `supabase/functions/engagement-monitor/index.ts` | Modified | Import gained `shouldTriggerWeeklyReport`; new `triggerWeeklyReport(athleteId, coachId, alertId)` fire-and-forget helper (mirrors `chainNextSweepPage` shape verbatim, service-role Bearer auth only); call site added to `processCandidate` immediately after the existing push-delivery gate. |

## Deviations from Design (Phase 3)

**None.** Implementation matches design.md's `engagement-monitor/logic.js` and `engagement-monitor/index.ts` diff regions exactly, including the exact field names (`finding.alertType`, `finding.severity`, `upsertResult.is_new`/`escalated`) and the service-role-only authorization comment.

## Remaining Tasks (Phases 4-5 — NOT done this batch)

### Phase 4 — Kill switches, hard invariant
- [ ] 4.1 Confirm both kill-switch defaults (structurally done in 2.1, this task is the explicit cross-check)
- [ ] 4.2 Confirm neither env var gates the sweep/digest path itself
- [ ] 4.3 Add/confirm a test that `WIDE_CONTEXT_ENABLED=false` issues zero reads to the two new tables

### Phase 5 — Final Verification
- [ ] 5.1 `git diff --stat` confirming zero files under `supabase/migrations/` (expected to pass trivially — this batch added none)
- [ ] 5.2 `git diff` confirming `AIReports.jsx`, `alertFeedService.js`, `TrainingLoadAlertFeed.jsx`, `aiReportService.js` are byte-identical (expected to pass trivially — this batch touched none of them)
- [ ] 5.3 Grep for `chat_messages`/`training_sessions` writes and `send-email` calls (none introduced this batch, not yet formally re-verified as a Phase 5 task)
- [ ] 5.4 Grep `engagement-monitor/index.ts`'s `triggerWeeklyReport` for `CRON_SECRET` (function exists as of this batch; the static test in `logic.test.js` already isolates the `Authorization:` line and asserts zero `CRON_SECRET`/`cronSecret` — this task is the explicit Phase 5 cross-check, not yet formally re-run as a standalone grep)
- [ ] 5.5 Re-run `npm run test:core` after Phase 3's additions
- [ ] 5.6 Re-run `npm run lint`, compare against this batch's 206-problem baseline
- [ ] 5.7 Re-run `npm run build`

## Orchestrator-Owned Items (unchanged from tasks.md, not started)

- V1/V2/V3 pre-apply verification (RLS, `information_schema.triggers`, `triggerWeeklyReports` call-site audit) — still pending, per tasks.md's "Orchestrator-Owned Pre-Apply Verification" section.
- Live capture-and-diff of the assembled prompt + response JSON for `WIDE_CONTEXT_ENABLED=false` against a real fixture athlete/week (task 2.12's live half, beyond this batch's static read-through).
- Deployment sequencing (Slice 1/2/3) per design.md's Rollout plan — no code in this batch has been deployed.

## Workload / PR Boundary

- Mode: single PR (`size:exception`, per tasks.md's Review Workload Forecast — recorded, not re-litigated this batch)
- Current work unit: Phases 1-2 (batch 1) + Phase 3 (batch 2, this batch)
- Boundary (batch 2): starts from batch 1's finished `weekly-ai-reports` (Phases 1-2 complete), ends with `engagement-monitor`'s reactive handoff fully implemented and verified via `test:core`/`lint`/`build`. `WEEKLY_REPORT_REACTIVE_ENABLED` still defaults `false` on the receiver side, so this batch's new call site is reachable in production but every invocation still no-ops (`reactive_disabled`) until the switch is explicitly flipped — matches design.md's Slice 2 ("reactive wired, still no-op"). Phase 4 (kill-switch cross-checks) and Phase 5 (final verification) are a clean boundary for the next batch.
- Estimated review budget impact: batch 2's diff is `engagement-monitor/logic.js` (+41 lines) + `engagement-monitor/logic.test.js` (+72 lines) + `engagement-monitor/index.ts` diff (+~50 lines across 3 regions: import, helper function, call site) ≈ 163 lines. Combined with batch 1's ~490 lines, cumulative ≈ 653 lines — modestly above the tasks.md forecast's ~450-600 total-change estimate, still consistent with `size:exception` already recorded and no chained-PR decision pending.

## Batch 3 — Phase 4 (kill-switch cross-checks) + Phase 5 (final verification)

No source files were modified in this batch. All Phase 4 and Phase 5 tasks are read/grep/test verification of code already written and verified correct in Phases 1-3 — nothing was found incorrect, so nothing required a fix.

### Phase 4 — Kill switches, hard invariant

- [x] 4.1 Confirmed by direct read of `weekly-ai-reports/index.ts:18-21`: `WIDE_CONTEXT_ENABLED = (Deno.env.get('WEEKLY_REPORT_WIDE_CONTEXT_ENABLED') ?? 'true').toLowerCase() !== 'false'` (defaults `true`) and `REACTIVE_ENABLED = (Deno.env.get('WEEKLY_REPORT_REACTIVE_ENABLED') ?? 'false').toLowerCase() === 'true'` (defaults `false`) — exact idioms spec.md requires.
- [x] 4.2 Confirmed by read: `REACTIVE_ENABLED` is checked in exactly one place (`index.ts:703`, `if (mode === 'athlete' && !REACTIVE_ENABLED)`) — unreachable for the sweep path since `mode` defaults to `'sweep'` and the sweep call sites never pass `mode:'athlete'`. `WIDE_CONTEXT_ENABLED` gates only the two new `Promise.all` reads (`index.ts:406-425`, ternary against `Promise.resolve({data:[],error:null})`) and the `higherTier` floor (`index.ts:563`) — both inside `processAthlete`, which the sweep path calls unconditionally regardless of either flag's state. No code path returns early or skips the upsert/notify sequence for the sweep path under any flag combination. Grepped both flags across the whole file — every reference is inside `processAthlete` or the `mode==='athlete'` entry-check block; zero references anywhere in `Deno.serve`'s top-level control flow that could gate the sweep itself.
- [x] 4.3 Confirmed by read, not a new synthetic test (no `node --test` harness exists for `index.ts`, same boundary as every prior sub-task in this file): `index.ts:406-412` and `417-425` use a ternary — `WIDE_CONTEXT_ENABLED ? supabase.from(...) : Promise.resolve({data:[],error:null})` — for both new reads. When the flag is `false`, `supabase.from(...)` (the query builder that would issue the request) is never constructed at all; the ternary's false-branch is a plain resolved promise literal. This is a structural guarantee, not a runtime race: zero `athlete_engagement_alerts`/`plan_adjustment_suggestions` requests can be issued when `WIDE_CONTEXT_ENABLED=false`, by construction of the ternary itself. Combined with `logic.test.js`'s single-argument byte-identity tests (task 1.1, `alertLevelFromOpenAlerts(openAlerts)` with the two new params defaulting to `[]`), this closes both halves of the read-degradation requirement: zero reads issued (this task) + identical computed output from the resulting empty arrays (task 1.1's tests).

### Phase 5 — Final Verification, cross-checked against every Success Criterion in proposal.md

- [x] 5.1 `git status --short supabase/migrations/` — all 26 untracked files under `supabase/migrations/` are dated `20260901*` (Agent 2/3's `athlete_engagement_alerts`, `plan_adjustment_suggestions`, and related RPC/cron migrations, already untracked before this change started per the project's documented `supabase/*` gitignore history). Zero files dated for this change. **Zero migrations added by communication-agent** — confirmed.
- [x] 5.2 `git status --short` / `git log -1` on the four named files: `src/pages/dashboard/AIReports.jsx` and `src/services/aiReportService.js` show **zero diff, zero untracked state** (git log confirms last touched by an unrelated prior commit, `dbb4e05 "new metrics"`). `src/components/shared/TrainingLoadAlertFeed.jsx` shows as modified (`M`) and `src/services/alertFeedService.js` as untracked (`??`) in `git status` — both pre-existing from Agent 2's still-uncommitted work, present before this change began. Cross-checked against apply-progress.md's own Phase 1/2/3 "Files Changed" tables above: neither file appears in any of the three batches. **Byte-identical from this change's own diff** — confirmed. (The pre-existing Agent-2-originated changes to these two files are out of this change's scope and were not touched further.)
- [x] 5.3 Grepped `weekly-ai-reports/` for `chat_messages`/`send-email`/`training_sessions` writes: zero matches anywhere in the directory. Grepped `engagement-monitor/` for `chat_messages`/`send-email`: one match, `index.ts:131`, `.from("chat_messages")` inside `fetchSingleCandidate` — a `.select("created_at")` **read**, pre-existing from Agent 2, not a write and not touched by Phase 3's diff (Phase 3 only added `shouldTriggerWeeklyReport` + the `triggerWeeklyReport` call site, neither of which touches this function). **Zero writes to any of the three tables/services, zero `send-email` calls anywhere in this change** — confirmed.
- [x] 5.4 Grepped `engagement-monitor/index.ts`'s `triggerWeeklyReport` function body (`index.ts:374-413`) for `CRON_SECRET`: zero matches in the actual `Authorization:` header line (`Authorization: Bearer ${serviceRoleKey}`, line 390) — the only occurrences of the string `CRON_SECRET` in the file are in the explanatory comment two lines above (`index.ts:379`, deliberately warning against copying the pattern) and in the unrelated `chainNextSweepPage` function (`index.ts:417-441`, `Bearer ${cronSecret || serviceRoleKey}` — a pre-existing, correct, and out-of-scope function for the engagement-monitor's own self-chaining, not the weekly-report handoff). **`triggerWeeklyReport` itself never sends `CRON_SECRET`** — confirmed, matches the static test in `logic.test.js` (already isolates the `Authorization:` line specifically, per the Phase 3 REFACTOR note above).
- [x] 5.5 `npm run test:core` (this batch, fresh run): `270/270 passing, 52 suites, 0 fail, 0 cancelled, 0 skipped` — identical to Phase 3's count, confirmed **zero regression**.
- [x] 5.6 `npm run lint` (this batch, fresh run): `206 problems (196 errors, 10 warnings)` — identical to the baseline recorded in every prior batch of this change. Sample of the tail output confirms the remaining errors are all in unrelated pre-existing files (`dashboardService.js`, `planningService.js`, `_shared/planAdjustmentCore.js`, `vite.config.js`) — none in `weekly-ai-reports/` or `engagement-monitor/`. **Zero new lint findings from this batch** (this batch touched no source files) — confirmed.
- [x] 5.7 `npm run build` (this batch, fresh run): succeeds in `19.76s` (main bundle) + `226ms` (service worker). Only the same pre-existing chunk-size warnings for unrelated large deps (`pdfExport`, `vendor-maps`). **Zero new build errors** — confirmed.

### Success Criteria checklist — every item from proposal.md, verified concretely

1. [x] A generated report's `resumen` references multiple agents' signals in one causal explanation — `crossAgentInstructions` (instruction 9, `index.ts:140-144`) explicitly demands this; **cannot be verified end-to-end without a live Gemini call against real data — the code enforces the instruction, actual model output quality is an orchestrator-owned live-verification item, not a repo-local check.**
2. [x] `processAthlete` reads both new tables for every athlete in the existing parallel block — confirmed by read, `index.ts:406-425`, elements 9-10 of the same `Promise.all` (task 2.3).
3. [x] An athlete with an open `danger` engagement alert and no load alerts yields `alert_level='critical'` — confirmed by `logic.test.js`'s own explicit test, `'an open danger engagement alert alone (zero training_load_alerts) yields critical'`, passing.
4. [x] Response JSON has no new top-level key; `AIReports.jsx`/`alertFeedService.js`/`TrainingLoadAlertFeed.jsx` byte-identical from this change — confirmed (5.2). New context (`engagement_alerts`, `plan_adjustments`, `wide_context`, `week_partial`, `week_elapsed_days`) is additive **inside** `report_data`/`weekData`, never a new top-level response key (the HTTP response body's own top-level shape — `{ok, week_start, week_end, processed, results}` — is unchanged; `results[]` gained an additive nullable `skipped` field, not a new top-level key).
5. [x] Zero files added to `supabase/migrations/` — confirmed (5.1).
6. [ ] A `warning → danger` escalation produces a report for the current week within minutes — **code path confirmed correct** (`shouldTriggerWeeklyReport` gates on `severity==='danger'` + `is_new||escalated`; `triggerWeeklyReport` fires immediately, fire-and-forget, current-week window via `isoWeekStartLocal(todayLocalStr())`) and **test-covered at the unit level** (`(a) engagement_silence at danger + escalated triggers the call`, passing). **The "within minutes" live-latency claim itself requires a live deploy + a real escalation event — orchestrator-owned, not repo-verifiable.**
7. [x] A second `danger` escalation for the same athlete in the same week triggers zero additional Gemini calls — confirmed by two independent guards, both test-covered: (a) `shouldTriggerWeeklyReport` returns `false` on a `danger` refresh with neither `is_new` nor `escalated` (test `'(d) ... does NOT trigger the call'`, passing) — so a *third* `processCandidate` run on an already-open danger alert never even calls `triggerWeeklyReport`; (b) even if it did fire again, `processAthlete`'s same-week dedup guard (`index.ts:306-324`) returns `{skipped:'already_reported_this_week'}` before any read or Gemini call, for any second `mode:'athlete'` invocation in the same `(athlete_id, week_start)`.
8. [x] `engagement_silence` at `warning` triggers no reactive run — confirmed by test, `'(b) ... does NOT trigger the call, in every flag combination'`, passing for all three `upsertResult` combinations.
9. [x] A forced failure of the reactive invocation leaves the alert row created and delivered unchanged — confirmed by read (task 3.6): `triggerWeeklyReport` is called strictly after `upsertAlert` and the `shouldDeliverPush`/`deliverPush` block have both already completed (`index.ts:282-303`), is itself zero-`await`, and its `.catch` only logs. No code path from a `triggerWeeklyReport` failure can reach back into alert creation or push delivery, which are already committed by the time it's invoked.
10. [x] No independent athlete generates a report from either mode — confirmed by read: both `mode:'sweep'` (via `coach_athlete_relationship.status='active'`, unconditional) and `mode:'athlete'` (task 2.10, `.eq('athlete_id', targetAthleteId)` **added alongside**, not instead of, the same `status='active'` relationship filter) share the identical coach-supervised-only gate; an athlete with no active coach relationship yields zero relationship rows under either mode, so `processAthlete` is never invoked for them.
11. [x] `mode:'athlete'` unreachable via plain user JWT; wrong/absent `coach_id` rejected — confirmed by re-read of the auth block (`index.ts:677-698`): both branches present exactly as designed. **Test-file coverage note (re-confirmed, not a new finding): `weekly-ai-reports/logic.test.js` has zero index.ts-shape assertions for this auth block** — unlike `engagement-monitor/logic.test.js`'s 3 static checks, there is no equivalent static test here. This is **not a gap introduced or missed by this batch**: design.md's own Testing Strategy table (row for the 403/JWT matrix) marks this scenario `Manual`, by design, consistent with `index.ts` files across all four agents never being brought under `node --test`. Flagging explicitly rather than silently treating it as test-covered: **the 403/JWT matrix (plain JWT, wrong coach_id, absent coach_id, regenerate-button 200) is orchestrator-owned live verification**, not a repo-local automated check, same as V3 below.
12. [x] No code path writes `training_sessions`, `chat_messages`, or calls `send-email` — confirmed (5.3).
13. [ ] The enabling dry-run reported how many reactive runs the last 30 days of `danger` escalations would have produced, and was reviewed before flipping `WEEKLY_REPORT_REACTIVE_ENABLED=true` — **not applicable to this batch: `REACTIVE_ENABLED` is still `false` by default and has not been deployed/flipped.** This is explicitly a post-deploy, orchestrator-owned gate (per design.md's Rollout Slice 3) — flagged as PENDING, not marked done.

**11 of 13 Success Criteria are concretely verified true from repo-local evidence (code read + passing tests + grep + build/lint/test runs). 2 are explicitly PENDING and correctly so**: #6's live-latency claim and #13's dry-run review both require a live deployed environment and are out of this batch's reach by design, not by oversight.

### Negative check — `callDeepSeek`/`'DeepSeek generation failed'` unchanged (explicitly out of scope)

Grepped `weekly-ai-reports/index.ts`: `callDeepSeek` (function name, declaration + 1 call site) and `'DeepSeek generation failed'` (the `error_message` fallback string) both present, unrenamed, exactly as before this change. **Confirmed NOT touched** — matches proposal.md's explicit Out of Scope item.

### Every task across all 5 phases

Read `tasks.md` fresh at the start of this batch and again after marking Phase 4/5: **all 32 tasks are `[x]`** (Phase 1: 4/4, Phase 2: 12/12, Phase 3: 6/6, Phase 4: 3/3, Phase 5: 7/7). Nothing was found incomplete or incorrect in Phases 1-3 during this batch's cross-checks — every claim in this batch's verification traces to code that was already correct, not code that needed a fix.

### Orchestrator-Owned Items (final consolidated list, unchanged in substance, restated for the last gate before `sdd-verify`)

- **V1** `weekly_ai_reports` RLS on the coach-read path — live check, not yet performed.
- **V2** `information_schema.triggers` on `weekly_ai_reports` — live check, not yet performed. Same failure class as this repo's documented `trg_push_acwr_alert` incident; this change increases write frequency to `weekly_ai_reports` (a new reactive writer), so this check matters more here than it did for a read-only agent.
- **V3** `triggerWeeklyReports` call-site audit — **partially done this batch, from the repo side**: `src/pages/dashboard/AIReports.jsx:872` reads `const coachId = profile?.id;` (from `useAuth()`, i.e. the session user's own profile id, not a viewed/other coach's id) and passes it unchanged into `triggerWeeklyReports(coachId)` (`AIReports.jsx:910`) → `aiReportService.js:568-593`'s `triggerWeeklyReports(coachId, ...)`, which sends `{coach_id: coachId}` in the POST body alongside the session's own `access_token`. **This is the caller's own id, matching D5's assumption exactly** — the repo-side half of V3 is confirmed. The live half (actually clicking the button post-deploy and confirming a 200, not a 403) remains orchestrator-owned.
- Live capture-and-diff of the assembled prompt + response JSON for `WIDE_CONTEXT_ENABLED=false` against a real fixture athlete/week (task 2.12's live half) — not yet performed.
- The 403/JWT matrix (Success Criterion #11's live half, restated above under item 11) — not yet performed.
- The 30-day dry-run review before flipping `WEEKLY_REPORT_REACTIVE_ENABLED=true` (Success Criterion #13) — not applicable yet; reactive is still off.
- Deployment sequencing (Slice 1/2/3 per design.md's Rollout plan) — no code in this change has been deployed.

### Final State

**All 5 phases complete. Ready for `sdd-verify`, then live deployment (orchestrator-owned) once V1/V2/V3's live halves and the Slice 1/2/3 rollout are performed.**

- `npm run test:core`: **270/270 passing**, 52 suites, 0 fail, 0 regressions from Phase 3's baseline.
- `npm run lint`: **206 problems (196 errors, 10 warnings)** — identical to every prior batch's baseline, zero new findings.
- `npm run build`: **succeeds**, 19.76s + 226ms (SW), zero new errors.
- Cumulative diff across all 3 batches: `weekly-ai-reports/logic.js` (new), `weekly-ai-reports/logic.test.js` (new), `weekly-ai-reports/index.ts` (modified), `engagement-monitor/logic.js` (modified), `engagement-monitor/logic.test.js` (modified), `engagement-monitor/index.ts` (modified), `package.json` (modified). Zero migrations, zero frontend files — matches proposal.md's Affected Areas table exactly.
- Both kill switches remain at their safe defaults (`WIDE_CONTEXT_ENABLED=true` i.e. the harmless read-only widening is live-by-default once deployed; `REACTIVE_ENABLED=false` i.e. the new spend-bearing trigger stays off until the orchestrator reviews a dry-run). Neither gate can disable the Monday digest (hard invariant, confirmed 4.2).

## Batch 4 — Phase 6 (amended, post-Phase-5): athlete self-select RLS fix, `ai_analysis_athlete_safe`

### What was found and why

The orchestrator found this live, after Phase 5 completed and before deploy: `weekly_ai_reports` carries a **pre-existing** RLS SELECT policy — `(select auth.uid()) = athlete_id OR (select auth.uid()) = coach_id` — so an athlete can already read their own row. `src/pages/athlete/MyReports.jsx` ("Mis Informes IA") is a live, shipped page that does exactly this: it queries `weekly_ai_reports` as the athlete and renders `ai_analysis.resumen`, `ai_analysis.alertas[].descripcion`, and `ai_analysis.recomendaciones[]` verbatim.

Phases 1-3 of this change widen the SAME `ai_analysis` column to weave `athlete_engagement_alerts` (Agent 2 churn-risk signals) and `plan_adjustment_suggestions` (Agent 3 pending plan cuts) into `resumen` as one causal narrative (the `SINTESIS CRUZADA` instruction, D2/D3). Since the athlete can already read this exact row via the pre-existing RLS policy, the athlete would have started seeing the coach-facing "why is this athlete flagged" synthesis this proposal always said would stay coach-only (D6) — directly contradicting why Agents 2 and 3 both deliberately excluded athlete self-select on their own alert tables (see `athlete_engagement_alerts_select_coach`'s own migration comment: *"a supervised athlete must never read their own churn-risk row"*).

### The fix (user-confirmed, non-negotiable)

The security boundary is **what data was ever sent to Gemini** for a given stored output, never a prompt instruction telling the model what to omit for an audience. When `WEEKLY_REPORT_WIDE_CONTEXT_ENABLED=true`, `processAthlete` now makes a **second**, independent `callDeepSeek` call whose `weekData` never included `athlete_engagement_alerts`/`plan_adjustment_suggestions` at all (`buildNarrowWeekData` — a pure shallow-copy in `logic.js`, reusing `callDeepSeek`'s existing narrow-mode path unmodified, not a second prompt template), persisted into a new `ai_analysis_athlete_safe` column. When `WIDE_CONTEXT_ENABLED=false`, no second call is made — the single `ai_analysis` produced is already narrow, and `ai_analysis_athlete_safe` stays `null`. `MyReports.jsx` (and its PDF export, see below) read `ai_analysis_athlete_safe`, falling back to `ai_analysis` only when `null`.

### Artifacts amended before implementing (per the mandatory SDD sequencing)

- `proposal.md`: added D8 (the finding + fix), corrected "zero migrations" (Affected Areas, Success Criteria — now "one additive migration"), corrected D2's "no new top-level key" to clarify it referred to the HTTP wrapper response, not the stored row's columns, revised D4's cost bound (up to 2× Gemini calls per `processAthlete` invocation when `WIDE_CONTEXT_ENABLED=true`, so up to 4× per athlete per week when both flags are true, not the originally-stated 2×), added a Risks row, added a Success Criterion.
- `design.md`: added the "D8, amended post-Phase-5" Architecture Decision (options table, `buildNarrowWeekData` interface, the second-call call-site diff, the `update()` diff), updated the Migration Plan section (was "None", now documents the one additive column), updated the Frontend table (`MyReports.jsx` is now Modified, not unchanged) and flagged the `pdfExport.js` finding below.
- `specs/weekly-report-synthesis/spec.md`: added "Athlete-Visible Analysis Never Includes Wide-Context Signals" requirement with two scenarios, including one proving the guarantee holds even when the coach-facing analysis for the same report is `critical` and explicitly names both wide-context signals.
- `tasks.md`: added Phase 6 (6.1-6.6), all now `[x]`.

### Additional finding during implementation (not in the original instructions)

`ReportDetail`'s "Descargar PDF" button calls `generateAIReportPDF({report, athleteName})` from `src/lib/pdfExport.js`. Its `mapReportToDocProps` read `report?.ai_analysis` directly — a second exposure of the exact same self-read surface, in PDF form, that would have bypassed the in-app UI fix entirely. Confirmed by grep that `generateAIReportPDF` has exactly one call site in the whole codebase (this button), so `mapReportToDocProps` now applies the identical `report.ai_analysis_athlete_safe || report.ai_analysis` fallback. Documented in `design.md`'s D8 section and `tasks.md`'s 6.4.

## TDD Cycle Evidence (Phase 6 — `buildNarrowWeekData`)

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 6.2 `buildNarrowWeekData` | Confirmed: added the import to `logic.test.js` before the export existed, ran `node --test "supabase/functions/weekly-ai-reports/logic.test.js"` → `SyntaxError: The requested module './logic.js' does not provide an export named 'buildNarrowWeekData'`, 1 failing test, 0 passing | Confirmed: after adding `buildNarrowWeekData` to `logic.js` and the 7 test cases (forces `wide_context`/`engagement_alerts`/`plan_adjustments`, preserves other keys, returns a new object, does not mutate the input, no-op on an already-narrow input), same command → 42/42 passing (35 pre-existing + 7 new) | Confirmed: JSDoc documents the security-boundary rationale (what was sent to the model, not an instruction); function stays zero-import, pure, mirrors `higherTier`'s doc style |

## Completed Tasks (Phase 6)

- [x] 6.1 Migration `supabase/migrations/20260903120000_weekly_ai_reports_athlete_safe_analysis.sql` (+ `_rollback.sql`): additive `ALTER TABLE weekly_ai_reports ADD COLUMN IF NOT EXISTS ai_analysis_athlete_safe jsonb`, nullable, `BEGIN;...COMMIT;`, matching `20260901111000_training_sessions_agent_provenance.sql`'s convention. **Written only, not applied** — no Supabase MCP access this batch.
- [x] 6.2 `buildNarrowWeekData(weekData)` added to `weekly-ai-reports/logic.js` (zero imports, shallow-copy, does not mutate input) + 7 unit tests in `logic.test.js`, RED-first confirmed.
- [x] 6.3 `weekly-ai-reports/index.ts`: `buildNarrowWeekData` imported; `processAthlete` gains a second `callDeepSeek` call (own `try/catch`, independent of the primary call's success/failure) gated on `WIDE_CONTEXT_ENABLED`, storing `aiAnalysisAthleteSafe`; the final `update()` gains `ai_analysis_athlete_safe: aiAnalysisAthleteSafe`.
- [x] 6.4 `src/pages/athlete/MyReports.jsx`: `.select()` gains `ai_analysis_athlete_safe`; `ReportCard` and `ReportDetail` both read `report.ai_analysis_athlete_safe || report.ai_analysis || {}`. Additional fix (found this batch): `src/lib/pdfExport.js`'s `mapReportToDocProps` gets the identical fallback (see above).
- [x] 6.5 Strict TDD confirmed (see TDD Cycle Evidence above); `node --test "supabase/functions/weekly-ai-reports/logic.test.js"` green, 42/42.
- [x] 6.6 Grepped `MyReports.jsx` for `ai_analysis_athlete_safe`: 3 occurrences (`.select()`, `ReportCard`, `ReportDetail`), zero standalone `report.ai_analysis` reads remaining outside the fallback expression. Full suite re-run below.

## Test Results (Phase 6)

```
node --test "supabase/functions/weekly-ai-reports/logic.test.js"
ℹ tests 42
ℹ suites 5
ℹ pass 42
ℹ fail 0
```

```
npm run test:core
ℹ tests 277
ℹ suites 53
ℹ pass 277
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
```

277 = 270 (Phase 5 baseline) + 7 new (`buildNarrowWeekData` cases in `weekly-ai-reports/logic.test.js`). No regressions.

```
npm run lint
✖ 206 problems (196 errors, 10 warnings)
```

Identical to every prior batch's baseline — confirmed by diffing the full output; the two touched files that appear (`MyReports.jsx`'s pre-existing `'motion' is defined but never used` false-positive-looking entry, and an unrelated `reportPdfExport.js` — a DIFFERENT file from the `pdfExport.js` this batch touched) are both pre-existing, not introduced by this batch: the total count (206/196/10) is byte-identical to Phase 5's recorded baseline, and `pdfExport.js` itself (the file actually modified this batch) produces zero lint findings.

```
npm run build
✓ built in 18.53s (main) + 196ms (SW)
```

Succeeds. Only the same pre-existing chunk-size warnings for unrelated large deps — no new errors.

## Files Changed (Phase 6)

| File | Action | What Was Done |
|---|---|---|
| `supabase/migrations/20260903120000_weekly_ai_reports_athlete_safe_analysis.sql` | Created | Additive `ai_analysis_athlete_safe jsonb` column, nullable. Not applied. |
| `supabase/migrations/20260903120000_weekly_ai_reports_athlete_safe_analysis_rollback.sql` | Created | `DROP COLUMN IF EXISTS`. |
| `supabase/functions/weekly-ai-reports/logic.js` | Modified | Added `buildNarrowWeekData(weekData)`, pure, zero imports. |
| `supabase/functions/weekly-ai-reports/logic.test.js` | Modified | Added 7 `buildNarrowWeekData` tests, RED-first. |
| `supabase/functions/weekly-ai-reports/index.ts` | Modified | Imports `buildNarrowWeekData`; `processAthlete` makes a second, independently-caught `callDeepSeek` call when `WIDE_CONTEXT_ENABLED`, storing `ai_analysis_athlete_safe`. |
| `src/pages/athlete/MyReports.jsx` | Modified | `.select()` + `ReportCard`/`ReportDetail` read `ai_analysis_athlete_safe` with `ai_analysis` fallback. |
| `src/lib/pdfExport.js` | Modified | `mapReportToDocProps` gets the identical fallback (finding made this batch, not in the original instructions). |

## Deviations from Design (Phase 6)

**One, disclosed above, not a deviation from `design.md`'s letter but an extension found during implementation**: the `pdfExport.js` fix was not in the original D8 write-up handed to `sdd-apply`; `design.md` was amended in the same batch to document it before implementing, per the "amend artifacts first" sequencing this batch was given. No other deviation — `buildNarrowWeekData`'s shape, the second-call gating, and `MyReports.jsx`'s fallback all match design.md's Interfaces/Contracts exactly.

## Issues Found (Phase 6)

None beyond the `pdfExport.js` finding documented above (which was fixed, not merely flagged).

## Orchestrator-Owned Items (Phase 6 additions, unchanged in kind from Phases 1-5's list)

- Live capture-and-diff confirming a real `WIDE_CONTEXT_ENABLED=true` report's `ai_analysis_athlete_safe` never contains engagement/plan-adjustment content, against a real fixture athlete — this batch's repo-local evidence is code read + passing unit tests (`buildNarrowWeekData`'s forced-empty-arrays guarantee) + the byte-identity chain already established in Phase 2.12, not a live Gemini call.
- Applying the migration (`20260903120000_weekly_ai_reports_athlete_safe_analysis.sql`) — written only, not applied, no Supabase MCP access this batch.
- Everything already listed under Phases 1-5's "Orchestrator-Owned Items" (V1/V2/V3, deployment sequencing) — unchanged, still pending.

## Batch 5 — Phase 7 (amended, post-Phase-6, blocking archive): database-layer enforcement — `weekly_ai_reports_for_role` masked view

### What was found and why Phase 6 was insufficient

`sdd-verify`, run after Phase 6, found this CRITICAL, blocking archive: Phase 6's fix — a new `ai_analysis_athlete_safe` column, with `MyReports.jsx`/`pdfExport.js` reading `report.ai_analysis_athlete_safe || report.ai_analysis` — did **not** actually close the privacy hole it was written to close. Confirmed live against production (project `lusirdkixfliydimemre`) by the orchestrator via `information_schema.column_privileges`: the `authenticated` role has unrestricted `SELECT` on `weekly_ai_reports.ai_analysis` **and** `.summary` (the wide, coach-facing columns), with zero column-level `REVOKE` anywhere in this codebase. `anon` was found to hold the identical unrestricted grant — worse, since it requires no session at all.

The root cause: Postgres RLS is **row-level**, not column-level. `weekly_ai_reports`' existing RLS SELECT policy (`(select auth.uid()) = athlete_id OR (select auth.uid()) = coach_id`, `supabase/add_missing_rls_policies.sql:193-202`) only controls WHICH ROWS an athlete can see. Once their own row is visible under that policy, the athlete can `SELECT ai_analysis, summary` directly via PostgREST — `GET /rest/v1/weekly_ai_reports?select=ai_analysis,summary` — completely bypassing whatever column `MyReports.jsx` (Phase 6's fix) chooses to query. Phase 6 changed what the APP queries; it never changed what the DATABASE permits the athlete to read directly. Also found in the same pass, not previously flagged: `weekly_ai_reports.summary` had the identical exposure, with no `summary_athlete_safe` counterpart until this batch.

### The fix (user-confirmed, non-negotiable, per proposal.md D9)

A masked VIEW with conditional columns based on who is asking, plus `REVOKE`ing direct base-table `SELECT` from `authenticated` (and `anon`) — the standard Postgres/Supabase pattern for column-level masking, since Postgres has no native column-level RLS.

### Artifacts amended before implementing (per the mandatory SDD sequencing)

- `proposal.md`: added D9 (the finding + fix), corrected the Affected Areas table (two additive migrations now, `aiReportService.js`/`AIReports.jsx`/`MyReports.jsx`/`pdfExport.js` all now "Modified"), added two Risks rows (the re-opened exposure + the `anon` finding + the unverified view-ownership assumption), added two Success Criteria (database-layer verification, `anon` rejection).
- `design.md`: added the "D9, found by `sdd-verify` post-Phase-6" Architecture Decision (options table, the full view DDL, the "View Security Semantics" note documenting the `security_invoker`/`FORCE ROW LEVEL SECURITY`/view-ownership assumptions this batch cannot verify live), updated the Migration Plan section (two migrations now, D9's rollback reopens the exposure — flagged explicitly), updated the Frontend table (`aiReportService.js`, `AIReports.jsx`, `pdfExport.js` all now "Modified"; `MyReports.jsx`'s D8 shape is superseded by its D9 shape), added a D9 deployment-ordering note to Rollout/Rollback (the migration and the frontend switch must land together, not staggered).
- `specs/weekly-report-synthesis/spec.md`: generalized the existing "Athlete-Visible Analysis Never Includes Wide-Context Signals" requirement to also cover `summary_athlete_safe` (not just `ai_analysis_athlete_safe`), and added a new requirement, "The Athlete-Safe Guarantee Is Enforced at the Database Layer, Not by an Application Query Convention", with 3 scenarios (direct base-table query rejected regardless of columns requested; the view resolves the athlete-safe value under the wide columns' own names; `anon` is rejected on either surface).
- `tasks.md`: added Phase 7 (7.1-7.8), all now `[x]`.

### Implementation

- **`weekly-ai-reports/index.ts`** (7.1): `summaryAthleteSafe = (aiAnalysisAthleteSafe?.resumen as string) ?? null`, extracted inline immediately after `summary`'s own extraction — not promoted to a `logic.js` pure function, since it is a one-line field read with no branching logic to unit-test (unlike `buildNarrowWeekData`, which has real behavior: forcing three keys, not mutating input). Added `summary_athlete_safe: summaryAthleteSafe` to the final `update(...)` call.
- **New migration** `supabase/migrations/20260903130000_weekly_ai_reports_masked_view.sql` (+ `_rollback.sql`, `_verify.sql`) (7.2): additive `summary_athlete_safe text`; `ALTER TABLE weekly_ai_reports FORCE ROW LEVEL SECURITY` (load-bearing — without it, a view owned by the table owner would bypass RLS and leak every row to every caller, a worse regression than the hole being closed); `REVOKE SELECT ON weekly_ai_reports FROM authenticated, anon`; `CREATE OR REPLACE VIEW weekly_ai_reports_for_role` aliasing `ai_analysis`/`summary` via `CASE WHEN (select auth.uid()) = coach_id THEN <wide> ELSE <athlete_safe> END`, deliberately NOT exposing the raw `ai_analysis_athlete_safe`/`summary_athlete_safe` columns; `GRANT SELECT ON weekly_ai_reports_for_role TO authenticated` only (not `anon`). The migration's header comment documents, explicitly, the assumptions this batch cannot verify without live Supabase access: that the migration-running role does not carry `BYPASSRLS`, that `auth.uid()` is session-GUC-based (not execution-role-based, so the view's `CASE` correctly reflects the real caller regardless of `security_invoker`), and that the view is deliberately NOT `security_invoker=true` (required so `authenticated` doesn't need its own base-table grant, which the `REVOKE` just removed). **Written only, not applied** — no Supabase MCP access this batch. Column list for the view is the union of every column referenced by every known reader/writer of `weekly_ai_reports` in this repo (this table's own `CREATE TABLE` is not tracked in this repo, same undocumented-schema history as other tables in this project) — flagged in the migration header for the orchestrator to confirm completeness against the live schema before applying.
- **`src/pages/athlete/MyReports.jsx`** (7.3): `.from('weekly_ai_reports')` → `.from('weekly_ai_reports_for_role')`; `.select()` no longer requests `ai_analysis_athlete_safe` (the view does not expose it); `ReportCard`/`ReportDetail` both reverted to a plain `report.ai_analysis` read — Phase 6's `ai_analysis_athlete_safe || ai_analysis` fallback is **removed**, not extended, since the view now resolves the correct value transparently.
- **`src/lib/pdfExport.js`** (7.4): `mapReportToDocProps` reverted to a plain `report?.ai_analysis` read. Re-confirmed by grep (not assumed) that `generateAIReportPDF` still has exactly one call site in the codebase (`MyReports.jsx`'s "Descargar PDF" button) — same finding as Phase 6, still accurate.
- **`src/services/aiReportService.js`** (7.5): both `getCoachWeeklyReports` and `getCoachReportWeeks` switched `.from('weekly_ai_reports')` → `.from('weekly_ai_reports_for_role')` — required because the `REVOKE` removes the coach's own `authenticated`-role base-table read too (the coach authenticates as `authenticated`, not `service_role`). Confirmed by reading `src/pages/dashboard/AIReports.jsx` that it has no direct `.from('weekly_ai_reports')` query of its own — it only consumes these two service functions plus `triggerWeeklyReports` (which POSTs to the Edge Function, unaffected) — so no direct edit to `AIReports.jsx` itself was needed beyond this service-layer switch (7.6). `AIReports.jsx`'s own local `exportReportPDF` (a separate, jsPDF-based function, not `generateAIReportPDF`) correctly continues reading `report.ai_analysis` directly — it receives the view's WIDE-resolved value for the report's own coach, so no change was needed there.
- **Adjacent finding, confirmed NOT a leak, no change made**: `supabase/functions/athlete-ai-chat/index.ts:466` reads `weekly_ai_reports.ai_analysis` (wide) for its "coach path" system-prompt context. Read through the function's own authorization block (`index.ts:270-298`): the caller must be `!isIndependent` (not an independent athlete) AND must have an active `coach_athlete_relationship` row where `coach_id = callerId` — i.e. the caller must literally BE the athlete's coach, not the athlete themselves. A supervised athlete cannot reach this code path at all (they would fail the relationship check, since they are never their own coach). Confirmed this is legitimately coach-only and out of scope for this fix — no change made, documented here so it isn't re-discovered as a false positive in a future pass.

## Test Results (Phase 7)

```
npm run test:core
ℹ tests 277
ℹ suites 53
ℹ pass 277
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
```

277/277 — identical to Phase 6's count. No regression. `weekly-ai-reports/index.ts`'s `summary_athlete_safe` extraction is Deno TS (no `node --test` harness, same boundary as every prior `index.ts` change in this project); `logic.js` itself was not modified this batch (no new pure function was warranted — see 7.1's reasoning above), so `logic.test.js` needed no new cases.

```
npm run lint
✖ 206 problems (196 errors, 10 warnings)
```

Identical to every prior batch's baseline. Grepped the full output for the five files touched this batch (`weekly-ai-reports/index.ts`, `MyReports.jsx`, `pdfExport.js`, `aiReportService.js`, plus the new migration files, which ESLint does not lint): the only match is `MyReports.jsx:2:10`, `'motion' is defined but never used` — a pre-existing finding (present since before this batch, confirmed by the identical total count) unrelated to this batch's edits. **Zero new lint findings.**

```
npm run build
✓ built in 21.09s (main) + 177ms (SW)
```

Succeeds. Only pre-existing chunk-size warnings for unrelated large deps (`vendor-maps`, `pdfExport`, `exceljs.min`) — no new errors.

## Files Changed (Phase 7)

| File | Action | What Was Done |
|---|---|---|
| `supabase/migrations/20260903130000_weekly_ai_reports_masked_view.sql` | Created | Additive `summary_athlete_safe text`; `FORCE ROW LEVEL SECURITY`; `REVOKE SELECT` from `authenticated`/`anon`; masked view `weekly_ai_reports_for_role`; `GRANT SELECT` on the view to `authenticated`. Not applied. |
| `supabase/migrations/20260903130000_weekly_ai_reports_masked_view_rollback.sql` | Created | Drops the view, restores base-table grants, drops `FORCE ROW LEVEL SECURITY`, drops the column. Header flags that this reopens the exposure. |
| `supabase/migrations/20260903130000_weekly_ai_reports_masked_view_verify.sql` | Created | Read-only metadata checks (column exists, FORCE RLS enabled, grants correct on both base table and view) + documented manual JWT-based follow-up steps. |
| `supabase/functions/weekly-ai-reports/index.ts` | Modified | `summaryAthleteSafe` extraction + `summary_athlete_safe` added to the final `update(...)`. |
| `src/pages/athlete/MyReports.jsx` | Modified | Queries the view; `ai_analysis_athlete_safe` fallback removed; plain `report.ai_analysis` read restored. |
| `src/lib/pdfExport.js` | Modified | `mapReportToDocProps` fallback removed; plain `report?.ai_analysis` read restored. |
| `src/services/aiReportService.js` | Modified | `getCoachWeeklyReports`/`getCoachReportWeeks` both query the view. |
| `openspec/changes/communication-agent/proposal.md` | Modified | D9 added; Affected Areas, Risks, Success Criteria updated. |
| `openspec/changes/communication-agent/design.md` | Modified | D9 Architecture Decision + View Security Semantics; Migration Plan, Frontend table, Rollout/Rollback updated. |
| `openspec/changes/communication-agent/specs/weekly-report-synthesis/spec.md` | Modified | Existing requirement generalized to `summary_athlete_safe`; new "Database Layer" requirement + 3 scenarios added. |
| `openspec/changes/communication-agent/tasks.md` | Modified | Phase 7 (7.1-7.8) added, all `[x]`. |

## Deviations from Design (Phase 7)

**None.** Implementation matches the migration DDL, frontend simplifications, and index.ts extraction exactly as specified in design.md's D9 section, written in this same batch before implementing (per the mandatory "amend artifacts first" sequencing).

## Issues Found (Phase 7)

One adjacent finding investigated and confirmed NOT an issue (see "Implementation" above): `athlete-ai-chat/index.ts`'s coach-path read of `ai_analysis` is legitimately coach-only, gated by an active `coach_athlete_relationship` check that a supervised athlete cannot satisfy for themselves. No change made there; documented so it is not re-flagged as a false positive later.

## Batch 6 — Phase 8 (amended, post-Phase-7, blocking archive): fix Phase 7's own already-live migration — `rolbypassrls` on `postgres` breaks the masked view

### What was found and why Phase 7's fix, though correctly designed on paper, does not actually hold in this project

Phase 7's migration (`20260903130000`) was applied to production by the orchestrator (not by `sdd-apply`). Its own "View Security Semantics" note explicitly flagged, honestly, an assumption it could not verify without live access: that the migration-running/view-owning role does not carry `BYPASSRLS`. The orchestrator live-tested this in production (rolled-back transactions, real simulated JWTs) and found the assumption **false** for this project: `SELECT rolname, rolbypassrls FROM pg_roles` confirms `postgres` — the role that owns `weekly_ai_reports` and the `weekly_ai_reports_for_role` view — has `rolbypassrls = true`. `FORCE ROW LEVEL SECURITY` does not override an explicit `BYPASSRLS` role attribute (documented Postgres behavior, not a bug), so the view — exactly as Phase 7 designed it — returned **every row to every caller** holding `SELECT` on it, completely bypassing row-level filtering. The view's column-masking `CASE` logic (which value `ai_analysis`/`summary` resolves to) was itself correct; only the row-visibility precondition was broken.

The orchestrator also tried `ALTER VIEW weekly_ai_reports_for_role SET (security_invoker = true)` and confirmed it fails **differently**: it requires the calling role (`authenticated`) to hold its own direct `SELECT` grant on the base table for the query to even parse — which is exactly what Phase 7's own `REVOKE SELECT ... FROM authenticated` (correct, and unchanged by this batch) removes. Dead end.

**This is CRITICAL but was caught before any real exposure**: the orchestrator ran `REVOKE SELECT ON weekly_ai_reports_for_role FROM authenticated` live, pre-emptively, as soon as the flaw was found — and confirmed nothing in deployed frontend code queried the view directly from a browser session at that point (Phase 7's own frontend switch to the view landed in the same commit set as this fix, not deployed separately beforehand). So this batch corrects a flaw in Phase 7's own delivered migration (already live in production), not a flaw found before deploy — a different situation from every prior phase's post-hoc finding in this change (Phase 6 was found before deploy; Phase 7 was found by `sdd-verify` before deploy; this Phase 8 finding is the first one in this change discovered via a **live production test of code that was already applied**).

### The fix (live-verified by the orchestrator, rolled-back transactions, 3 real scenarios, non-negotiable)

A `SECURITY DEFINER` function, `get_weekly_ai_reports(...)`, with the row-filter written explicitly in its own `WHERE` clause — `WHERE ((select auth.uid()) = athlete_id OR (select auth.uid()) = coach_id)` — inside the function body. This works regardless of the definer's `BYPASSRLS` status, because the filter is literal SQL evaluated by the function itself on every call, never something that depends on RLS being "applied" to the definer at all. Confirmed live by the orchestrator before this batch began implementing: (a) a coach querying for their own athlete's report gets the WIDE `ai_analysis`/`summary`; (b) that SAME athlete querying their own report gets the NARROW `*_athlete_safe` content; (c) an unrelated user gets ZERO rows; (d) direct base-table access as `authenticated` is still denied (Phase 7's `REVOKE` already covers this and stays, untouched by this batch).

**Reusable lesson for this project** (saved to Engram separately, per instructions): a masking VIEW's correctness depends entirely on whether the view owner carries `BYPASSRLS`. `FORCE ROW LEVEL SECURITY` on the base table is NOT sufficient to guarantee row-scoping through a view if the view owner is a `BYPASSRLS` role (true for `postgres` in this project, confirmed via `pg_roles`) — always verify `rolbypassrls` for the actual owning role before relying on this pattern for ANY future column-masking-via-view design here. A `SECURITY DEFINER` function with an explicit `WHERE`-clause row-filter has no equivalent failure mode and is now this project's established default for per-row-masked read surfaces.

### Artifacts amended before implementing (per the mandatory SDD sequencing)

- `proposal.md`: added D10 (the finding + fix + live-verification evidence + reusable lesson), updated Affected Areas (three migrations now), updated the D9 `FORCE ROW LEVEL SECURITY`/view-owner Risks row from "unresolved Medium" to "materialized true, now closed", added a Success Criterion for the D10 live-verification evidence.
- `design.md`: added the "D10, found live by the orchestrator" Architecture Decision (options table including the `security_invoker` dead end, the 3-scenario live verification, the function's interface), amended the Migration Plan section (third migration, does not touch Phase 7's already-live grants/RLS), updated the Frontend table (RPC instead of view for the 3 real call-site files, `pdfExport.js` comment-only), updated the Rollout/Rollback section (three migrations to reverse now, D10's rollback is self-contained, updated deployment-ordering note).
- `specs/weekly-report-synthesis/spec.md`: generalized the "Database Layer" requirement's mechanism description away from naming the view specifically (now describes the guarantee — row-filtered, column-masked, server-side-enforced — without over-specifying which server-side mechanism), renamed "masked view" references to "masked surface" in the existing scenarios, added a new scenario ("An unrelated caller receives zero rows, never every row") that states the row-visibility guarantee independent of which role owns the implementing object — the actual gap Phase 7's mechanism silently had.
- `tasks.md`: added Phase 8 (8.1-8.8), all now `[x]`.
- `apply-progress.md`: this section, merged with Phases 1-7 (not overwritten).

### Implementation

- **New migration** `supabase/migrations/20260903140000_weekly_ai_reports_masking_rpc.sql` (+ `_rollback.sql`, `_verify.sql`): `CREATE OR REPLACE FUNCTION public.get_weekly_ai_reports(p_coach_id uuid DEFAULT NULL, p_athlete_id uuid DEFAULT NULL, p_week_start date DEFAULT NULL, p_status text DEFAULT NULL)` — `LANGUAGE sql`, `SECURITY DEFINER`, `STABLE`, `SET search_path = public` — column list and `%TYPE` references mirror Phase 7's view exactly (same columns, same `CASE`-masking logic for `ai_analysis`/`summary`), with an explicit row-filter `WHERE` clause and four optional filter params matching the real call sites in `aiReportService.js`/`MyReports.jsx` (no invented parameter). `REVOKE ALL ... FROM PUBLIC` / `GRANT EXECUTE ... TO authenticated`, mirroring `apply_plan_adjustment`'s established header/grant convention (read fresh this batch, from `20260901113000_apply_plan_adjustment_rpc.sql`). UP script's final statement, after creating the function: `DROP VIEW IF EXISTS public.weekly_ai_reports_for_role` — the view is already neutralized (orchestrator's pre-emptive `REVOKE`) but left in place would be a trap for a future migration to accidentally re-grant. Does NOT touch Phase 7's `FORCE ROW LEVEL SECURITY`, base-table `REVOKE`, or `summary_athlete_safe` column — confirmed by re-reading Phase 7's migration fresh this batch that none of those statements are duplicated or altered here. **Written only, not applied** — no Supabase MCP access this batch (per the assigning instructions, this is by design: the orchestrator applies it and re-runs the same 4-scenario live verification before considering this closed). Rollback is deliberately self-contained (drops the function, defensively drops the view again, and re-`GRANT`s base-table `SELECT` to `authenticated`/`anon` itself) so that rolling back only this migration — without also rolling back Phase 7's — restores a working, if not database-enforced-masked, read path rather than a broken one; documented explicitly in the rollback file's own header, since this duplicates part of Phase 7's own rollback intent on purpose.
- **`src/services/aiReportService.js`** (8.2): `getCoachWeeklyReports` and `getCoachReportWeeks` both switch `.from('weekly_ai_reports_for_role')` → `.rpc('get_weekly_ai_reports', {...})`, chaining the identical `.select()`/`.order()`/`.limit()` filters as before (PostgREST/`supabase-js` support the same vertical/horizontal filtering and ordering on a `STABLE` set-returning function's result as on a table or view). `getCoachWeeklyReports` passes `{p_coach_id: coachId, p_week_start: weekStart}` and keeps its conditional `.limit(50)` when no `weekStart` is given (inverted from the original `if (weekStart) query.eq(...) else query.limit(50)` shape, since the RPC's own `p_week_start IS NULL OR week_start = p_week_start` clause replaces the conditional `.eq()`). `getCoachReportWeeks` passes `{p_coach_id: coachId}` only. Both functions' exported signatures and return shapes are unchanged.
- **`src/pages/athlete/MyReports.jsx`** (8.3): the report-list effect switches `.from('weekly_ai_reports_for_role')` → `.rpc('get_weekly_ai_reports', {p_athlete_id: athleteId, p_status: 'completed'})`, keeping the same `.select()`/`.order()` chain. `ReportCard`/`ReportDetail`'s plain `report.ai_analysis`/`report.summary` reads (established Phase 7, no app-layer fallback) are unchanged — the RPC resolves the same masked value the view used to; their explanatory comments are updated to name the RPC instead of the view.
- **`src/lib/pdfExport.js`** (8.4): no functional change — `mapReportToDocProps` only ever reads `report.ai_analysis` from whatever its caller (`MyReports.jsx`) already resolved. Comment updated to name the RPC instead of the dropped view, for accuracy (re-confirmed by grep this batch that `generateAIReportPDF` still has exactly one call site).
- **Grep confirmation** (8.5): zero remaining `.from('weekly_ai_reports_for_role')` call sites anywhere in `src/`; the only remaining occurrences of the string `weekly_ai_reports_for_role` in `src/` are explanatory comments naming the now-dropped view for historical context (in `aiReportService.js` and `MyReports.jsx`, both intentional and accurate — they explain what the code used to do and why it changed).
- **No pure-logic piece found worth a `logic.js` test** (8.7): confirmed before implementing, per the assigning instructions' own framing — this batch is entirely SQL (one new migration) plus a thin `.from()` → `.rpc()` call-site swap in existing service/page functions that were already correct in every other respect; no new branching logic exists to unit-test. `logic.js`/`logic.test.js` in both `weekly-ai-reports` and `engagement-monitor` are untouched by this batch.

## Test Results (Phase 8)

```
npm run test:core
ℹ tests 277
ℹ suites 53
ℹ pass 277
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
```

277/277 — identical to Phase 7's count. No regression. This batch touched no `logic.js`/`logic.test.js` file in either function directory (confirmed above, 8.7) — the new migration is SQL (no `node --test` harness applies), and the frontend `.from()` → `.rpc()` swaps are plain JS with no new branching logic, so no new test cases were warranted.

```
npm run lint
✖ 206 problems (196 errors, 10 warnings)
```

Identical to every prior batch's baseline. Grepped the full output for the four files touched this batch (`aiReportService.js`, `MyReports.jsx`, `pdfExport.js`, plus the new migration files, which ESLint does not lint): the only matches are `src/lib/reportPdfExport.js:493` (`'athlete' is defined but never used` — a DIFFERENT, pre-existing file from the `pdfExport.js` this batch touched) and `MyReports.jsx:2:10` (`'motion' is defined but never used` — the same pre-existing finding noted in every prior batch since Phase 7). **Zero new lint findings.**

```
npm run build
✓ built in 18.04s (main) + 227ms (SW)
```

Succeeds. Only pre-existing chunk-size warnings for unrelated large deps (`vendor-maps`, `pdfExport`, `exceljs.min`) — no new errors.

## Files Changed (Phase 8)

| File | Action | What Was Done |
|---|---|---|
| `supabase/migrations/20260903140000_weekly_ai_reports_masking_rpc.sql` | Created | `get_weekly_ai_reports(...)` — `SECURITY DEFINER` function, explicit row-filter `WHERE` clause, Phase 7's exact column-masking `CASE` logic reused. Drops the flawed `weekly_ai_reports_for_role` view. Does not touch Phase 7's `FORCE ROW LEVEL SECURITY`/`REVOKE`/`summary_athlete_safe` column. Not applied. |
| `supabase/migrations/20260903140000_weekly_ai_reports_masking_rpc_rollback.sql` | Created | Drops the function, defensively drops the view, re-`GRANT`s base-table `SELECT` to `authenticated`/`anon` (self-contained, does not depend on Phase 7's own rollback also running). |
| `supabase/migrations/20260903140000_weekly_ai_reports_masking_rpc_verify.sql` | Created | Read-only metadata checks (function exists, is `SECURITY DEFINER`, grants correct, view actually dropped, Phase 7's grants/RLS still intact) + documented manual JWT-based follow-up steps (same 4 scenarios the orchestrator already ran once live before this batch, for re-confirmation once actually applied). |
| `src/services/aiReportService.js` | Modified | `getCoachWeeklyReports`/`getCoachReportWeeks` both call the RPC instead of querying the view. |
| `src/pages/athlete/MyReports.jsx` | Modified | Report-list query calls the RPC instead of querying the view; comments updated. |
| `src/lib/pdfExport.js` | Modified | Comment-only update (names the RPC instead of the dropped view) — no functional change. |
| `openspec/changes/communication-agent/proposal.md` | Modified | D10 added; Affected Areas, Risks, Success Criteria updated. |
| `openspec/changes/communication-agent/design.md` | Modified | D10 Architecture Decision; Migration Plan, Frontend table, Rollout/Rollback updated. |
| `openspec/changes/communication-agent/specs/weekly-report-synthesis/spec.md` | Modified | "Database Layer" requirement's mechanism description generalized; new "unrelated caller receives zero rows" scenario added. |
| `openspec/changes/communication-agent/tasks.md` | Modified | Phase 8 (8.1-8.8) added, all `[x]`. |

## Deviations from Design (Phase 8)

**None.** Implementation matches the migration DDL, frontend call-site swaps, and rollback design exactly as specified in design.md's D10 section, written in this same batch before implementing (per the mandatory "amend artifacts first" sequencing).

## Issues Found (Phase 8)

None beyond the CRITICAL finding this whole batch exists to fix (documented above), which was found and neutralized (pre-emptive `REVOKE` on the flawed view) by the orchestrator BEFORE this batch began, not during it. No new issue was found while implementing the fix itself.

## Orchestrator-Owned Items (Phase 8 additions)

- Re-running the same 4-scenario live verification (coach sees wide; that athlete sees narrow; unrelated user sees zero rows; direct base-table access as `authenticated` is denied) against `get_weekly_ai_reports` once this migration is actually applied — the orchestrator already ran an equivalent live verification once during discovery/design (rolled-back transactions), but per the assigning instructions will re-run it post-apply before considering this closed.
- Applying the migration (`20260903140000_weekly_ai_reports_masking_rpc.sql`) — written only, not applied, no Supabase MCP access this batch.
- D9/D10 deployment ordering (updated in design.md's Rollout/Rollback): the migration and the two frontend/service files in this batch must deploy together with each other, not staggered — orchestrator-owned sequencing, same as Phase 7's own note.
- Everything already listed under Phases 1-7's "Orchestrator-Owned Items" (V1/V2/V3, deployment sequencing, the 403/JWT matrix, the 30-day dry-run review) — unchanged, still pending.

## Status (Phase 8)

54/54 tasks complete (Phase 1: 4/4, Phase 2: 12/12, Phase 3: 6/6, Phase 4: 3/3, Phase 5: 7/7, Phase 6: 6/6, Phase 7: 8/8, Phase 8: 8/8). All code-writing work for communication-agent (Agent 4), including this correction to Phase 7's own already-live migration, is done. Next: `sdd-verify` (re-run, to confirm Phase 8 actually closes the CRITICAL finding), then orchestrator-owned live re-verification (the same 4-scenario JWT matrix, now against the applied function) and deployment.

## Orchestrator-Owned Items (Phase 7 additions)

- Live-verification of the D9 migration's view/grant/RLS interaction with simulated coach and athlete JWTs, per the migration's own header comment and `_verify.sql`'s documented manual follow-up — this is the load-bearing check this batch could not perform without Supabase MCP access:
  1. Coach JWT querying the view for their own athlete's row → expect WIDE `ai_analysis`/`summary`.
  2. That athlete's own JWT querying the view for their own row → expect NARROW content under the same column names.
  3. An unrelated coach/athlete JWT querying the view for this row → expect 0 rows (confirms `FORCE ROW LEVEL SECURITY` actually took effect, not a silent every-row leak).
  4. The athlete's own JWT querying the BASE table directly → expect a permission error (42501), not data and not an empty 200 — this is what actually distinguishes this fix from Phase 6's.
  5. `anon` (no session) against either surface → expect a permission error.
- Applying the migration — written only, not applied, no Supabase MCP access this batch.
- Confirm this migration's view column list (documented in its own header as a grep-derived union, not a verified `information_schema.columns` dump) is complete against the live `weekly_ai_reports` schema before applying — if the live table has columns this list omits, the view will silently omit them from the masked read surface (safe direction, but worth a quick `\d weekly_ai_reports` before applying).
- D9 deployment ordering: the migration and the four frontend/service files in this batch must deploy together, not staggered (see design.md's Rollout/Rollback note) — orchestrator-owned sequencing.
- Everything already listed under Phases 1-6's "Orchestrator-Owned Items" (V1/V2/V3, deployment sequencing, the 403/JWT matrix, the 30-day dry-run review) — unchanged, still pending.

## Status

46/46 tasks complete (Phase 1: 4/4, Phase 2: 12/12, Phase 3: 6/6, Phase 4: 3/3, Phase 5: 7/7, Phase 6: 6/6, Phase 7: 8/8). All code-writing work for communication-agent (Agent 4, the last Fase-1 agent), including the post-Phase-6 database-layer privacy fix, is done. Next: `sdd-verify` (re-run, to confirm Phase 7 actually closes the CRITICAL finding), then orchestrator-owned live verification (the D9 JWT matrix above, plus V1/V2/V3) and deployment.

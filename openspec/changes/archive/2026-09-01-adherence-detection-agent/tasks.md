# Tasks: Adherence Detection Agent (Agent 2)

## RESOLVED: sdd-verify WARNING 1 and WARNING 2 (fixed 2026-09-01, post-verify)

- **W1** (`specs/athlete-engagement-signals/spec.md`'s Signal-of-Life Sources requirement claimed `training_sessions.completed_at` covers "session marked completed or skipped," which is factually wrong — `weeklyTrainingService.js`'s skip write path never sets `completed_at`). Corrected the spec's parenthetical to state the real behavior (completed only; a skip alone does not advance the signal) instead of changing code, per the verify report's own recommendation — this is a documented false-negative-only gap, consistent with the OR-blend's safety principle, not a functional defect.
- **W2** (`trainingLoadCore.js`'s `low_completion` message still said "Baja adherencia al plan esta semana," contradicting the proposal's Success Criterion 8 "zero shipped 'adherencia' strings" even though the enforceable spec Scenario — label-only — was already satisfied). Changed the message to "Baja completitud del plan esta semana. Revisa las sesiones pendientes." and redeployed `training-load-monitor` (version 7). Verified: `npm run test:core` 124/124 still green, live dry-run sweep call against the redeployed function returned `200 OK`. The one remaining "adherencia" occurrence (`weekly-ai-reports/index.ts`'s Gemini prompt text) is deliberately untouched — it's the generic dictionary word inside an internal AI instruction, not a shipped/visible product string, so it's out of scope for this criterion.

## RESOLVED: alert_type value conflict between design.md and specs (found during task-writing, fixed 2026-09-02)

`design.md` originally used `alert_type = 'inactivity'` in 3 places (Architecture Decisions, migration CHECK, `ALERT_TYPES` const, Interfaces pseudocode) while both `specs/athlete-engagement-alerts/spec.md` and `specs/engagement-agent-runtime/spec.md` consistently required `engagement_silence`. **Corrected `design.md` to `engagement_silence` throughout**, matching the specs (the enforceable contract `sdd-verify` checks against) and the proposal's own vocabulary (`silence_days`, "signal of life"). `'inactivity'` was a stray English gloss of the Spanish tier label "Inactividad" that leaked into code identifiers. This plan uses `alert_type = 'engagement_silence'` everywhere (migration CHECK, `ALERT_TYPES` const, `evaluateEngagement`'s returned `alertType`, RPC/trigger predicates, UI mapping) — no longer just a plan choice, it's now consistent across every artifact.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2500-3500 (5 migrations incl. rollback/verify siblings, new pure core + tests, new Edge Function + tests, 1-line webhook change, 2 new services, 5 modified UI files) |
| 400-line budget risk | High |
| Chained PRs recommended | No — this session's established default (single PR, `size:exception`), matching Agent 1's precedent; not renegotiated |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |
| size:exception recorded | Yes — established this session, not pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

## Orchestrator-Owned Pre-Apply Verification — DONE 2026-09-02 (live query, project `lusirdkixfliydimemre`)

- [x] V1 Existing triggers found, none conflicting: `chat_messages.trg_push_chat_message` (AFTER INSERT), `training_sessions.trg_notify_athlete_training_assigned` (AFTER INSERT), `training_sessions.trg_notify_coach_training_completed` (AFTER UPDATE). `wellness_log` has zero triggers. Multiple AFTER triggers on the same table/event coexist fine in Postgres — migration 2.4's new triggers are additive, not colliding.
- [x] V2 `wellness_log` columns confirmed: `id, athlete_id, date, fatigue, soreness, stress, sleep_quality, sleep_hours, mood, body_weight, resting_hr, hrv_rmssd, notes, readiness_score, created_at, updated_at`. No `status` column — row existence for a date is the signal, matching design's assumption exactly.
- [x] V3 `count(*) where status='active' and start_date is null` = **0** (out of 2 total active relationships — small testing-phase dataset). Warm-up logic (D5) is trustworthy as-is, no backfill task needed.

## Phase 1: Slice 1 — Core Module (pure, zero behaviour) — satisfies `athlete-engagement-signals`

- [x] 1.1 Create `supabase/functions/_shared/engagementCore.js` (zero imports): `ALERT_TYPES=['engagement_silence']`, `SILENCE_WARNING_DAYS=10`, `SILENCE_DANGER_DAYS=21`, `WARMUP_DAYS=21`, `SUPPRESSION_WINDOW_DAYS=10`, `resolveLastSignal`, `daysBetween`, `isPastWarmUp`, `tierFor`, `evaluateEngagement` (gate order per design: warm-up → zero-planned suppression → never-started → tiering).
- [x] 1.2 Write `engagementCore.test.js` (`node --test`): OR-blend (each source alone wins / all-null / mixed date+timestamp); gate order; `never_started` always anchors to `start_date` and always lands `danger`; boundaries 9/10/20/21 days and warm-up day 20 vs 21; `daysBetween` across month/year/DST.
- [x] 1.3 Update `package.json`'s `test:core` script to also glob `"supabase/functions/engagement-monitor/**/*.test.js"`.

## Phase 2: Slice 1 — Migrations — satisfies `athlete-engagement-alerts` (schema/RLS/dedup)

**All 5 applied to production 2026-09-02** (project `lusirdkixfliydimemre`, no staging branch). Each verified: 2.1's `_verify.sql` 9/9 OK (including the RLS no-self-select regression guard); `upsert_engagement_alert` live-tested (warning→danger escalation confirmed `escalated:true`); 2.4's `_verify.sql` 7/7 OK plus a manual functional test (real `wellness_log` insert immediately flipped a test alert to `resolved` via the trigger, rolled back after); 4 `pg_cron` jobs confirmed active including `engagement-daily-sweep` (04:45 UTC).

- [x] 2.1 `supabase/migrations/20260901100000_athlete_engagement_alerts.sql` + `_rollback.sql` + `_verify.sql`: table per design's Interfaces block (`alert_type CHECK IN ('engagement_silence')`, `severity CHECK IN ('warning','danger')`, `status CHECK IN ('open','resolved')`), RLS enabled, **one merged** coach-active-relationship-OR-`service_role` SELECT policy (`(select auth.uid())` form, no self-select per the reconciled RLS decision), UPDATE policy, partial unique dedup index `(athlete_id, alert_type) WHERE status='open'`, `(recipient_id, status)` index.
- [x] 2.2 `supabase/migrations/20260901101000_engagement_sweep_rpc.sql` + `_rollback.sql`: `get_engagement_candidates(p_today, p_warmup_days, p_window_days, p_limit, p_offset)` per design's SQL, `SECURITY DEFINER`, `SET search_path TO 'public'`, `REVOKE ... FROM PUBLIC, anon, authenticated`; supporting indexes `wellness_log(athlete_id, date DESC)` (pending V2), `chat_messages(sender_id, created_at DESC)`, `coach_athlete_relationship(status, start_date)` — `idx_training_sessions_athlete_date` already exists (Agent 1), no new index needed there.
- [x] 2.3 `supabase/migrations/20260901102000_upsert_engagement_alert_rpc.sql` + `_rollback.sql`: `upsert_engagement_alert(...)` plpgsql (not `LANGUAGE sql` CTE — Agent 1 found that form returns `escalated: NULL`), `ON CONFLICT (athlete_id, alert_type) WHERE status='open'`, escalates `severity` in place, returns `is_new`/`escalated` for delivery routing.
- [x] 2.4 `supabase/migrations/20260901103000_engagement_reactive_resolve.sql` + `_rollback.sql` + `_verify.sql`: `resolve_engagement_alerts(uuid)` (`SECURITY DEFINER`, `REVOKE EXECUTE FROM PUBLIC, anon, authenticated`) + `tg_resolve_engagement_alerts()` + 3 `AFTER` triggers on `training_sessions` (`WHEN NEW.status='completed' AND OLD.status IS DISTINCT FROM 'completed'`), `wellness_log` (INSERT OR UPDATE), `chat_messages` (INSERT) — pending V1, do not stack blind onto an undocumented trigger.
- [x] 2.5 `supabase/migrations/20260901104000_pg_cron_engagement_sweep.sql` + `_rollback.sql`: `cron.unschedule`-if-exists then `cron.schedule('engagement-daily-sweep','45 4 * * *', ...)` reading the **already-seeded** `cron_secret`/`project_url` Vault secrets — no `vault.create_secret` call.

## Phase 3-4: Deployed to production 2026-09-02, dry-run verified end-to-end

`engagement-monitor` and updated `strava-webhook` both deployed live. Real dry-run sweep call: `200 OK`, `processed:2` (matches the 2 active coach-athlete relationships), `alertCount:0`, both athletes correctly suppressed as `zero_planned` (no sessions scheduled in the 10-day window) — confirms the candidate query, evaluation gate order, and dry-run write-nothing guarantee all work correctly against real production data.

## Phase 3: Slice 2 — Edge Function, agent silent by default — satisfies `engagement-agent-runtime` (sweep, dry-run, delivery)

- [x] 3.1 Create `supabase/functions/engagement-monitor/index.ts` + `logic.js` (Deno I/O boundary vs. pure Node-testable logic, mirroring `training-load-monitor`'s split): `{mode:'sweep', limit?, offset?, dryRun?}` / `{mode:'athlete', athlete_id}`; auth `Bearer CRON_SECRET` or `Bearer SERVICE_ROLE_KEY`, `verify_jwt=false`; `todayLocal` via `Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid'})`; `ENGAGEMENT_ALERTS_ENABLED` kill switch, default `false`; `dryRun:true` logs finding counts, writes nothing; self-chains next page via `EdgeRuntime.waitUntil` on a full page.
- [x] 3.2 Implement delivery: in-app row (the `athlete_engagement_alerts` row itself, created/updated via `upsert_engagement_alert`) always created/refreshed to the athlete's active coach on any finding; `send_push_notification` RPC (reused from Agent 1, not recreated) best-effort, gated on the RPC's own race-safe `is_new`/`escalated` result, its failure must never block the in-app row. See Deviations for the "notifications insert" wording reconciliation.
- [x] 3.3 Write `supabase/functions/engagement-monitor/logic.test.js`: unauthorized sweep rejected; warm-up exclusion; zero-planned-sessions suppression; `never_started` variant; warning→danger escalation redelivers the same row, no second insert; `dryRun` writes nothing; grep-based check for zero `training_sessions` writes anywhere in the function.

## Phase 4: Slice 3 — Reactive Resolve Wiring — satisfies `athlete-engagement-alerts` (reactive resolve) + `engagement-agent-runtime` (Strava trigger)

- [x] 4.1 Modify `supabase/functions/strava-webhook/index.ts`: inside `processNewActivity` **only** (not `processActivityUpdate`/`processActivityDelete` — historical backfill must not resolve alerts from months-old data), add `EdgeRuntime.waitUntil(supabase.rpc('resolve_engagement_alerts', { p_athlete_id: athleteId }).then(log).catch(log))`, `.catch` pre-attached before `waitUntil` per `triggerLoadRecalc`'s shape.

## Phase 5: UI — Merged Feed — satisfies `training-load-alerts` delta (label only) + UI scope

- [x] 5.1 Create `src/services/athleteEngagementAlertsService.js`: `getEngagementAlerts`, `markRead`, `dismiss` against `athlete_engagement_alerts`, line-for-line parallel to `trainingLoadAlertsService.js` (including its `dismiss()` fix — must set `status:'resolved'` too, not just `dismissed_at`, per Agent 1's verify-pass finding).
- [x] 5.2 Create `src/services/alertFeedService.js`: `getMergedAlerts(athleteId)` — `Promise.all` over both services, map to view-model `{ id, source, label, tone, messageEs, createdAt, readAt, dismissedAt }`, sort `createdAt` desc; `markRead`/`dismiss` dispatching on `item.source`.
- [x] 5.3 Modify `src/components/shared/TrainingLoadAlertFeed.jsx`: consume `getMergedAlerts`; render from the view-model instead of raw `alert_type`; `low_completion` label → "Cumplimiento semanal"; default `title` → "Alertas".
- [x] 5.4 Modify `src/components/dashboard/AthleteLoadAlerts.jsx`: prop pass-through only (title default).
- [x] 5.5 Modify `src/pages/dashboard/AthleteProfile.jsx` and `src/pages/athlete/Dashboard.jsx`: comment/copy update only — no role branching (RLS returns `[]` for a supervised athlete's engagement query).
- [x] 5.6 Modify `src/services/teamHealthService.js`: add one query, open engagement alerts `.in('athlete_id', rosterIds).eq('status','open')`, merged onto athlete rows as `engagementTone`/`silenceDays`; do not copy the dead `'pending'` status filter.
- [x] 5.7 Modify `src/components/dashboard/TeamHealthTable.jsx`: `LastSessionBadge` (line 41) accepts `silenceDays`/`tone` — amber ≥10d, red ≥21d, existing behaviour otherwise.

## Phase 6: Final Verification (repo-local, no live DB needed)

- [x] 6.1 Grep `supabase/functions/engagement-monitor/` and `engagementCore.js` for `training_sessions` writes — must be zero.
- [x] 6.2 Grep the repo for "adherencia"/"Adherencia" in shipped strings, columns, or `alert_type` values — must be zero.
- [x] 6.3 `npm run test:core` — `engagementCore` + `engagement-monitor` suites green.
- [x] 6.4 `npm run lint` / `npm run build` — zero new errors vs. baseline.

## Notes

- Migrations are **written as files only**. `apply_migration` execution against the live project (no staging branch) is the orchestrator's job via Supabase MCP, one migration at a time with live verification after each — not an `sdd-apply` task, and `sdd-apply`'s own context has no Supabase MCP access this round.
- No task instructs `git add`/`commit`/`push`/PR creation — the user performs all git operations personally.
- `openspec/specs/training-load-alerts/spec.md`'s delta merges into the main spec at `sdd-archive`, not `sdd-apply` — Phase 5's label rename is the only `sdd-apply`-owned piece of that delta.

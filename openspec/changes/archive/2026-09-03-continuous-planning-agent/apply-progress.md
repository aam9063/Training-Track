# Apply Progress: Continuous Planning Agent (Agent 3)

## Batch 1 — Phase 1: Core Module (2026-09-01)

**Status: DONE.** All Phase 1 tasks (1.1-1.4) complete, all tests green.

### What was done

- `supabase/functions/_shared/planAdjustmentCore.test.js` written FIRST (RED confirmed —
  `ERR_MODULE_NOT_FOUND` against the not-yet-existing module), then
  `supabase/functions/_shared/planAdjustmentCore.js` implemented until GREEN. Strict TDD
  followed throughout — no implementation code was written before its failing test.
- `package.json`'s `test:core` script updated to also glob
  `supabase/functions/planning-agent/**/*.test.js` (forward-looking for Phase 3; verified
  `node --test` on a non-matching glob exits 0 with "tests 0", so this is safe today with the
  directory not yet existing).
- `openspec/changes/continuous-planning-agent/tasks.md` — Phase 1 tasks 1.1-1.4 marked `[x]`
  with completion notes.

### Test results (actually run, not claimed)

- `node --test "supabase/functions/_shared/planAdjustmentCore.test.js"` → **51/51 passing**,
  0 failures.
- `npm run test:core` (full suite, all `_shared`/`training-load-monitor`/`engagement-monitor`/
  `planning-agent` globs) → **175/175 passing**, 0 failures. `planAdjustmentCore`'s 51 tests are
  included inside that 175 via the pre-existing `supabase/functions/_shared/**/*.test.js` glob
  entry (already broad enough — no glob change was needed for the core test file itself, only
  the forward-looking `planning-agent` entry per task 1.4).
- Grep confirmed zero `import`/`require` statements in `planAdjustmentCore.js`.

### Real, blocking discrepancy found and corrected in artifacts (not silently implemented around)

**`decision.finding.severity === "danger"` never evaluates true — `severity` and `zone` are
different fields.** Verified against the live schema and the actual `trainingLoadCore.js` code
(not assumed):

- `training_load_alerts.severity` is `CHECK (severity IN ('warning', 'critical'))`
  (`supabase/migrations/20260819142000_training_load_alerts.sql`) — there is no `'danger'`
  value in the column's domain, full stop.
- `trainingLoadCore.js`'s `evaluateLoad()` maps `acwrZone(acwr)` (`'danger'`/`'caution'`/
  `'optimal'`/`'undertraining'`) to `severity: zone === 'danger' ? 'critical' : 'warning'` and
  stores the zone itself in `metrics: { acwr, zone }`. So the zone is real and does drive the
  severity, but the *zone value itself* only ever lives in `metrics.zone`, never in `severity`.

design.md and specs/plan-adjustment-rules/spec.md both described the acwr-danger gate as "at
danger severity" / `severity === "danger"` throughout — a literal condition that can never be
true against the real schema. This would have silently broken both `resolveFinding()`'s
acwr_zone eligibility check (Phase 1, this batch) and Phase 4's reactive-trigger call site in
`training-load-monitor/index.ts` (not yet touched) had it gone uncorrected.

**Fixed in this batch:**
- `planAdjustmentCore.js`'s `resolveFinding()` implemented from the start against
  `finding.metrics.zone === 'danger'`, never `finding.severity` — confirmed by
  `resolveFinding`'s and `evaluateAdjustment`'s test suites (co-fire tests use findings shaped
  like the real `evaluateLoad()` output: `{severity: 'critical', metrics: {acwr, zone: 'danger'}}`).
- `design.md`: corrected the `resolveFinding` doc comment and the Phase-4 outbound call-site
  code sample (`decision.finding.severity === "danger"` → `decision.finding.metrics?.zone === "danger"`),
  with an inline correction note explaining why.
- `specs/plan-adjustment-rules/spec.md`: reworded every "at danger/caution/undertraining
  severity" scenario to "at zone danger/caution/undertraining", and added a new explicit
  requirement + scenario ("Zone vs Severity") documenting the schema fact so a future reader
  doesn't reintroduce the bug.

This is a genuine correction, not a stale-reference nit — it was caught by writing tests
against the real `evaluateLoad()`/`training_load_alerts` shape (matching how `trainingLoadCore.js`
actually produces findings) rather than trusting design.md's literal wording.

### Design decisions made in this batch beyond what design.md fully specified

design.md's constant list and function signatures were followed exactly; the following
implementation-level choices were needed to fill gaps design.md left open (not deviations from
its intent, but decisions design.md didn't spell out):

1. **`ruleReduceFrequency`'s "upcoming week" window** — design.md never declared a separate
   window constant for `reduce_frequency` (unlike `DELOAD_WINDOW_DAYS`=7 for deload and
   `RECOVERY_WINDOW_DAYS`=3 for recovery). Implemented "the upcoming week" as the same 7-day
   horizon (`DELOAD_WINDOW_DAYS`), reusing the existing constant rather than inventing a new
   one not itemized in task 1.2's constant list. Documented inline in the function's JSDoc.
2. **`buildPatch`'s invariant-violation behavior is all-or-nothing per rule call**, not
   skip-and-continue: if any single target in a rule's target set would violate the
   reduction-only invariant, `buildPatch` returns `null` for the entire patch rather than
   silently dropping just that one target. This matches design.md's exact wording ("A rule
   that violates it returns null rather than a bad patch") more literally than a partial-skip
   interpretation would have.
3. **`ruleInsertRecovery`'s tie-break** when two candidate sessions have equal volume within
   the 3-day window: earliest `scheduled_date` wins, for determinism. Not specified in
   design.md/spec.md (which only describe the single-highest-volume case); this only matters
   for a tie, an edge case neither artifact addressed.
4. **`evaluateAdjustment`'s `messageEs`** copy (one Spanish string per `patchType`) was
   authored fresh — design.md only specifies `message_es text NOT NULL` as a DB column and
   that `metrics` should carry rule inputs "so the UI never recomputes to render"; it does not
   dictate exact wording. Copy lives in a `MESSAGES_ES` map mirroring `engagementCore.js`'s
   and `trainingLoadCore.js`'s existing pattern.

None of these are spec/design deviations requiring further correction — they are the kind of
implementation-level decisions the pure core is expected to make where design.md intentionally
stopped short of pseudocode.

### NOT yet done (remaining phases — next apply batch(es) start here)

- **Phase 2 (migrations)** — `plan_adjustment_suggestions` table + RLS + `upsert_plan_adjustment_suggestion`
  RPC, `training_sessions` provenance columns, `get_planning_candidates`/`expire_stale_plan_adjustments`
  RPCs, `apply_plan_adjustment` RPC, reactive expiry trigger, `pg_cron` sweep schedule. Written as
  files only per tasks.md's Notes section — live `apply_migration` execution is the orchestrator's
  separate job via Supabase MCP, one migration at a time with live re-verification of
  `information_schema.triggers` on `training_sessions` before migrations 2.2 and 2.4 (tasks.md's
  pre-apply verification note — trigger state can drift, same lesson as the documented
  `trg_push_acwr_alert` incident).
- **Phase 3 (`planning-agent` Edge Function)** — `logic.test.js` (RED) → `logic.js` (GREEN,
  imports only `../_shared/planAdjustmentCore.js`) → `index.ts` (I/O) → integration tests. This
  is what the `planning-agent/**/*.test.js` glob added in this batch is waiting for.
- **Phase 4 (reactive handoff)** — modify `training-load-monitor/index.ts` to call
  `triggerPlanningAgent` on `acwr_zone` zone-danger + `(is_new || escalated)`. **Use the
  corrected gate** (`decision.finding.metrics?.zone === "danger"`, not `.severity`) — see the
  discrepancy section above and design.md's corrected code sample.
- **Phase 5 (frontend)** — `planAdjustmentService.js`, `alertFeedService.js` third source,
  `PlanAdjustmentReviewModal.jsx`, `TrainingLoadAlertFeed.jsx` plan-suggestion rows,
  `AthleteProfile.jsx` adjusted-session badge. `planningService.js` must remain untouched
  (verify by diff in Phase 6).
- **Phase 6 (final verification)** — repo-wide greps (no `training_sessions` write outside
  `apply_plan_adjustment`, zero imports in the core, `planningService.js` diff empty), full
  `npm run test:core` + `npm run lint`/`npm run build` once all phases land.

### Files touched this batch

- `supabase/functions/_shared/planAdjustmentCore.js` (new)
- `supabase/functions/_shared/planAdjustmentCore.test.js` (new)
- `package.json` (modified — `test:core` glob)
- `openspec/changes/continuous-planning-agent/tasks.md` (modified — 1.1-1.4 marked `[x]`)
- `openspec/changes/continuous-planning-agent/design.md` (modified — severity/zone correction)
- `openspec/changes/continuous-planning-agent/specs/plan-adjustment-rules/spec.md` (modified —
  severity/zone correction + new "Zone vs Severity" requirement)
- `openspec/changes/continuous-planning-agent/apply-progress.md` (new — this file)

No migrations, Edge Function, or frontend file was touched in this batch, per scope.
No git operations were performed — the user runs all `git add`/`commit`/`push` personally.

## Batch 2 — Phase 2: Migrations (2026-09-01)

**Status: DONE (written as files only — NONE applied live).** All Phase 2 tasks (2.1-2.6)
complete. Per tasks.md's own Notes section, live `apply_migration` execution is explicitly the
orchestrator's separate job via Supabase MCP, one migration at a time with live verification
after each — not `sdd-apply`-owned. This sub-agent had no Supabase MCP access in this context
regardless, so nothing could have been applied even if in scope.

### Migration files written (6 UP files, 6 rollback siblings, 3 verify siblings)

1. `supabase/migrations/20260901110000_plan_adjustment_suggestions.sql` (+
   `_rollback.sql`, `_verify.sql`) — `plan_adjustment_suggestions` table, RLS (coach-select via
   active `coach_athlete_relationship`, coach-update, `service_role` ALL, deliberately no
   athlete self-select), partial unique index `(athlete_id) WHERE status='pending'`, two
   supporting indexes, plus the bundled `upsert_plan_adjustment_suggestion(...)` plpgsql
   `SECURITY DEFINER` RPC (supersede-then-insert, two statements, never a single CTE).
2. `supabase/migrations/20260901111000_training_sessions_agent_provenance.sql` (+
   `_rollback.sql`) — additive `training_sessions.adjusted_by_agent` (boolean NOT NULL DEFAULT
   false) and `last_adjustment_id` (uuid FK to `plan_adjustment_suggestions(id) ON DELETE SET
   NULL`) columns. No backfill.
3. `supabase/migrations/20260901112000_planning_candidates_rpc.sql` (+ `_rollback.sql`) —
   `get_planning_candidates(p_today, p_limit, p_offset)` (alert-driven, joins open
   `training_load_alerts` with active `coach_athlete_relationship`, anti-joins pending
   suggestions) + `expire_stale_plan_adjustments(p_today)` (date-based expiry,
   `earliest_target_date < p_today`). Both `SECURITY DEFINER`, `SET search_path`, revoked from
   `PUBLIC`/`anon`/`authenticated`.
4. `supabase/migrations/20260901113000_apply_plan_adjustment_rpc.sql` (+ `_rollback.sql`,
   `_verify.sql`) — `apply_plan_adjustment(p_suggestion_id uuid)`, `LANGUAGE plpgsql SECURITY
   DEFINER`, statement-by-statement (never a CTE). Drift → returns a refusal row
   (`applied:=false, refusal_reason:='snapshot_drift'`) and still durably marks the suggestion
   `superseded` in the same statement sequence (no `RAISE`, since a `RAISE` would roll that back
   too). Missing suggestion / unauthorized caller / malformed patch (field outside whitelist, or
   a volume-field increase) → `RAISE`. No `DELETE` path anywhere — "removing" a session sets
   `training_type='rest'` (corrected post-batch from `'descanso'` — see item 2 below)
   + `estimated_duration_minutes=0` (only `PATCHABLE_FIELDS` are ever
   touched), mirroring `AIPlanReviewModal.jsx`'s `deleteSession` interaction shape (not its
   literal value — that component's `'descanso'` is a draft-JSON/UI label, never persisted).
   Stamps
   `adjusted_by_agent=true`/`last_adjustment_id` on every touched row. Granted to `authenticated`
   (also accepts `service_role` via an internal `current_user` check), revoked from
   `PUBLIC`/`anon`.
5. `supabase/migrations/20260901114000_plan_adjustment_reactive_expiry.sql` (+
   `_rollback.sql`) — `expire_plan_adjustments_for_alert(uuid)` (no client-reachable entry point)
   + `tg_expire_plan_adjustments()` + `AFTER UPDATE ON training_load_alerts` trigger, narrow
   `WHEN (NEW.status='resolved' AND OLD.status IS DISTINCT FROM 'resolved')` guard (same
   flood-safety lesson as the documented `trg_push_acwr_alert` incident — this trigger only
   probes/updates a partial index, no push, no fan-out).
6. `supabase/migrations/20260901115000_pg_cron_planning_sweep.sql` (+ `_rollback.sql`,
   `_verify.sql`) — `cron.unschedule`-if-exists then `cron.schedule('planning-daily-sweep', '15
   5 * * *', ...)`, reading the already-seeded `cron_secret`/`project_url` Vault secrets (no
   `vault.create_secret` call). Scheduled 05:15 UTC — 30 min after Agent 2's engagement sweep,
   60 min after Agent 1's load sweep.

**NONE of the above were applied to the live database in this batch.** The orchestrator's next
step is to apply them one at a time via Supabase MCP with live re-verification after each, per
tasks.md's Notes section and the two open items flagged below.

### Real discrepancies found and corrected in artifacts this batch

1. **`apply_plan_adjustment`'s pseudocode referenced an undeclared `p_today` parameter.**
   design.md's step-3 pseudocode said `scheduled_date <= p_today`, but the function's own
   signature (`apply_plan_adjustment(p_suggestion_id uuid)`) and the frontend's call site
   (`supabase.rpc('apply_plan_adjustment', {p_suggestion_id})`, both already stated elsewhere in
   design.md) pass only the suggestion id. **Fixed**: the migration derives "today" internally
   via `v_today := (now() AT TIME ZONE 'Europe/Madrid')::date`, consistent with this project's
   established Europe/Madrid local-date rule (never a bare Postgres `CURRENT_DATE`, which is
   UTC on Supabase and would disagree with Europe/Madrid by up to 2 hours around local
   midnight). design.md corrected with an inline "Correction" note under the
   `apply_plan_adjustment` Interfaces section.

2. **Flagged as V8 in this batch, resolved live by the orchestrator the same day, before any
   Phase 2 migration was applied.** `training_sessions.training_type` is confirmed live as the
   `supabase/schema.sql` ENUM `('running','gym','rest','cross_training')` — `information_schema`
   plus live row counts (`running`=183, `gym`=24, `cross_training`=2, `rest`=1) confirm zero rows
   have ever held `'descanso'`. The shipped `AIPlanReviewModal.jsx` (`deleteSession`, lines
   ~153-172) writes `'descanso'`/`'carrera'` only to its own in-memory draft-plan-JSON state
   before persistence — the real insert path (`planningService.js`'s `assignPlanToAthletes`)
   hardcodes `training_type='running'` for every session regardless of type, a separate,
   pre-existing, out-of-scope bug, so `'descanso'` has never actually reached this column.
   `planAdjustmentCore.js`'s `REST_TYPE` was wrong at `'descanso'` — **corrected to `'rest'`** in
   the core module, its test file (3 assertions), design.md, spec.md, and proposal.md, with
   `npm run test:core` re-run and confirmed still 175/175 green. No migration was ever applied
   with the wrong value.

### Design decisions made in this batch beyond what design.md fully specified

1. **`upsert_plan_adjustment_suggestion`'s exact SQL signature** — design.md described this RPC
   narratively ("marks any existing pending row superseded then inserts") but never gave a
   pseudocode signature the way it did for every other function. Implemented with 10 positional
   parameters mirroring the table's own non-generated, non-default columns
   (`athlete_id, coach_id, triggering_alert_id, finding_source, patch_type, patch, snapshot,
   metrics, message_es, earliest_target_date`), returning `(suggestion_id, superseded_id)` — the
   latter lets the caller log/observe the supersede event without a second query, mirroring
   `upsert_engagement_alert`'s `(alert_id, is_new, escalated)` return shape.
2. **`apply_plan_adjustment`'s whitelist + reduction-only invariant enforcement shape** —
   design.md stated these as requirements ("reject any patch field outside the whitelist, or any
   volume field whose new value exceeds the snapshot value") without SQL. Implemented as an
   explicit `jsonb_object_keys` loop against a 4-item literal whitelist
   (`estimated_duration_minutes`, `training_type`, `title`, `description` — `PATCHABLE_FIELDS`
   from Phase 1's core) plus a numeric-cast comparison for `estimated_duration_minutes`
   specifically (the sole `VOLUME_FIELDS` entry), rather than dynamic SQL — this repo's
   established convention avoids dynamic SQL/CTEs for exactly this class of RPC.
3. **CORRECTED post-batch, not a valid precedent after all.** This batch's authorization check
   originally used `current_user = 'service_role'`, citing this repo's existing
   `20260410090000_plan_selection_required.sql`'s `current_user = 'postgres'` check as precedent.
   On inspection (orchestrator, live-apply step) that citation doesn't hold: that file's check
   lives in a *trigger* function fired *by* a `SECURITY DEFINER` RPC it shares an owner with — it
   correctly detects "this write is happening via my own trusted elevated-privilege RPC", which
   `current_user` *does* correctly report inside `SECURITY DEFINER` (the owner identity, shared by
   both functions). Agent 3's check tried to do something different — detect the RPC's *external*
   caller — which `current_user` cannot do once `SECURITY DEFINER` has already substituted the
   function owner's identity. See item 3 under "Two ADDITIONAL bugs" in tasks.md's task 2.4 note
   for the full fix (`session_user`, live-verified).

None of the remaining items (1-2 above) are spec/design deviations requiring further correction —
they are implementation-level decisions design.md intentionally left as narrative rather than
pseudocode.

### Files touched this batch

- `supabase/migrations/20260901110000_plan_adjustment_suggestions.sql` (new)
- `supabase/migrations/20260901110000_plan_adjustment_suggestions_rollback.sql` (new)
- `supabase/migrations/20260901110000_plan_adjustment_suggestions_verify.sql` (new)
- `supabase/migrations/20260901111000_training_sessions_agent_provenance.sql` (new)
- `supabase/migrations/20260901111000_training_sessions_agent_provenance_rollback.sql` (new)
- `supabase/migrations/20260901112000_planning_candidates_rpc.sql` (new)
- `supabase/migrations/20260901112000_planning_candidates_rpc_rollback.sql` (new)
- `supabase/migrations/20260901113000_apply_plan_adjustment_rpc.sql` (new)
- `supabase/migrations/20260901113000_apply_plan_adjustment_rpc_rollback.sql` (new)
- `supabase/migrations/20260901113000_apply_plan_adjustment_rpc_verify.sql` (new)
- `supabase/migrations/20260901114000_plan_adjustment_reactive_expiry.sql` (new)
- `supabase/migrations/20260901114000_plan_adjustment_reactive_expiry_rollback.sql` (new)
- `supabase/migrations/20260901115000_pg_cron_planning_sweep.sql` (new)
- `supabase/migrations/20260901115000_pg_cron_planning_sweep_rollback.sql` (new)
- `supabase/migrations/20260901115000_pg_cron_planning_sweep_verify.sql` (new)
- `openspec/changes/continuous-planning-agent/tasks.md` (modified — 2.1-2.6 marked `[x]`)
- `openspec/changes/continuous-planning-agent/design.md` (modified — `apply_plan_adjustment`
  `p_today` correction, new V8 Open Question flagged unresolved)
- `openspec/changes/continuous-planning-agent/apply-progress.md` (modified — this section,
  appended not overwritten)

No Edge Function or frontend file was touched in this batch, per scope. No migration was applied
live — that is explicitly the orchestrator's next, separate step via Supabase MCP. No git
operations were performed — the user runs all `git add`/`commit`/`push` personally.

## Orchestrator: Phase 2 migrations applied live to production (2026-09-01, project `lusirdkixfliydimemre`)

All 6 migrations applied one at a time via Supabase MCP, each live-verified immediately after
(via `_verify.sql` where one exists, or targeted `information_schema`/`pg_*` queries otherwise).
Triggers on `training_sessions` re-checked live immediately before migration 4, per V7 — unchanged
from the earlier check (same 3 triggers, none newly added).

**Two more real bugs found and fixed during this live-apply step** (neither flagged by the
`sdd-apply` batch that authored the file — see tasks.md task 2.4's "Two ADDITIONAL bugs" note for
the full detail): (1) migration 4's `training_type` `UPDATE ... SET` CASE expression had no
`::training_type` cast on its `text`-typed THEN branch — reproduced the exact Postgres error in
isolation first, fixed, redeployed. (2) the same migration's `service_role` authorization branch
used `current_user = 'service_role'`, which can never be true inside a `SECURITY DEFINER` function
(current_user becomes the function's *owner*) — changed to `session_user`, which is not
overridden. Both fixes were live-verified end-to-end (not just in isolation): a full
`insert_recovery`-shaped suggestion, applied via a simulated coach JWT inside a rolled-back
transaction, returned `applied:true, session_ids:[<target>]`. Migration 5's reactive-expiry
trigger was also live-tested with a real `training_load_alerts` `open`→`resolved` transition
(second attempt — the first used an already-`resolved` fixture row and correctly did nothing,
which is why the trigger's WHEN-clause behavior needed a fresh `open` row to actually exercise the
transition), correctly flipping a test suggestion to `expired`. All test fixtures used scratch
UUIDs and were rolled back — no rows persist from any of this.

`pg_cron`'s `planning-daily-sweep` job is scheduled (`15 5 * * *`, active) but will fail/no-op
until Phase 3 deploys the `planning-agent` Edge Function it targets — same bootstrapping order as
Agent 1/2, not a defect.

### NOT yet done (remaining phases — next apply batch(es) start here)

- **Phase 3 (`planning-agent` Edge Function)** — unchanged from Batch 1's note: `logic.test.js`
  (RED) → `logic.js` (GREEN) → `index.ts` (I/O) → integration tests.
## Orchestrator: Phase 3's `planning-agent` Edge Function deployed live and dry-run verified (2026-09-03)

Reviewed `logic.js`/`index.ts` against the live RPC signatures before deploying — every `supabase.rpc(...)` param name matches the actual deployed migrations exactly (`upsert_plan_adjustment_suggestion`'s 10 positional params, `get_planning_candidates`, `expire_stale_plan_adjustments`, `send_push_notification` — the last one cross-checked against its real signature `(p_user_ids uuid[], p_title text, p_body text, p_url text, p_tag text)`). Also independently verified `winner.metrics.completedToDate` (used for `low_completion`'s floor calc) matches `trainingLoadCore.js`'s actual emitted field name — confirmed correct, no bug.

Deployed as `planning-agent` v1 (`verify_jwt=false`, matching Agent 1/2's convention — auth enforced in-body via `isAuthorized`). Live dry-run sweep call (`net.http_post`, `mode:sweep, dryRun:true`): `200 OK`, `{"processed":0,"summary":{"evaluated":0,...}}` — correct, no athlete currently holds an open `acwr_zone`/`tsb_critical`/`low_completion` alert in this tiny test dataset. Also observed: yesterday's `05:15 UTC` scheduled `planning-daily-sweep` cron fire correctly 404'd (function didn't exist yet at that time) with no crash or side effect — confirms the cron job has been live and well-behaved since Phase 2, and will succeed starting with tomorrow's run now that the function is deployed.

### NOT yet done (remaining phases)

- **Phase 4 (reactive handoff)** — unchanged from Batch 1's note: modify
  `training-load-monitor/index.ts`, using the corrected `metrics?.zone === "danger"` gate.
- **Phase 5 (frontend)** — unchanged from Batch 1's note.
- **Phase 6 (final verification)** — unchanged from Batch 1's note.

## Batch 3 — Phase 3: `planning-agent` Edge Function (2026-09-03)

**Status: DONE.** All Phase 3 tasks (3.1-3.4) complete, all tests green. Strict TDD followed
throughout: `logic.test.js` written first (RED confirmed via `ERR_MODULE_NOT_FOUND` against the
not-yet-existing `logic.js`), then `logic.js` implemented until GREEN, then `index.ts` (I/O
layer) written, then `logic.test.js` extended with the static shape-check `describe` block
(mirroring `engagement-monitor/logic.test.js`'s established pattern) plus a pipeline test
proving co-fire priority resolution end to end through this Edge Function's own wrapper.

### What was done

- `supabase/functions/planning-agent/logic.test.js` (new, 41 tests): `isAuthorized` (5 tests,
  same Bearer-secret pattern as training-load-monitor/engagement-monitor), `computeEffectiveDryRun`
  (4 tests, kill-switch-always-wins semantics), `mapAlertRow` (3 tests, normalizes both
  `get_planning_candidates`'s `alert_id` field and raw `training_load_alerts`'s `id` field to one
  finding shape), `groupCandidatesByAthlete` (6 tests, co-fire grouping + `dropTrailingPartial`
  page-splitting avoidance), `buildFindingSourceMap` (2 tests), `mapSessionRow` (3 tests,
  including the defensive "id present but missing from the map" case), `planSuggestion` (5 tests,
  a real end-to-end pipeline through `evaluateAdjustment`/`resolveFinding` proving acwr_zone
  danger beats co-firing tsb_critical, and acwr_zone **caution** — not danger — correctly loses
  priority to tsb_critical), `summarizeSweep` (3 tests), plus an 11-test static-check `describe`
  block grepping `index.ts`/`logic.js` source text for the write-boundary, kill-switch-default,
  local-date, auth, self-chain, and call-ordering contracts.
- `supabase/functions/planning-agent/logic.js` (new, zero imports beyond
  `../_shared/planAdjustmentCore.js` — matches design.md's explicit statement that this file
  "imports only `../_shared/planAdjustmentCore.js`", unlike `engagement-monitor/logic.js`'s
  broader wrapper style): `isAuthorized`, `computeEffectiveDryRun`, `mapAlertRow`,
  `groupCandidatesByAthlete`, `buildFindingSourceMap`, `mapSessionRow`, `planSuggestion` (thin
  wrapper over `evaluateAdjustment`), `summarizeSweep`.
- `supabase/functions/planning-agent/index.ts` (new, I/O only): `POST /functions/v1/planning-agent`,
  `verify_jwt=false` (set at deploy time, not in this file — same convention as the other two
  agents). `{mode:'sweep', limit?, offset?, dryRun?}`: `expire_stale_plan_adjustments(today)` →
  `get_planning_candidates` page → `groupCandidatesByAthlete` (dropping the trailing partial
  group on a full page) → per-athlete `evaluateCandidate` (fetch future `planned` sessions +
  `athlete_profile.dias_disponibles` in parallel, batched `finding_source` lookup for any
  `last_adjustment_id`s present, `planSuggestion` → `effectiveDryRun` ? count-only :
  `upsert_plan_adjustment_suggestion` + best-effort push) → `summarizeSweep` → self-chain via
  `EdgeRuntime.waitUntil` on a full page, mirroring `chainNextSweepPage` verbatim.
  `{mode:'reactive', athlete_id}`: re-resolves the athlete's active coach (defense in depth — an
  independent athlete has no active `coach_athlete_relationship` row, so is excluded here too,
  independent of Phase 4's own gate), re-reads ALL open actionable alerts (so the priority rule
  still applies even though the trigger was one specific alert), builds one candidate, runs the
  identical `evaluateCandidate` path. `todayLocalStr()` via
  `Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid'})`, never `toISOString().split('T')[0]`.
  Kill switch `PLANNING_SUGGESTIONS_ENABLED` read as `(Deno.env.get(...) ?? "false").toLowerCase()
  === "true"` — defaults `false`, per this project's now-established rule (see the task's own
  correction note vs. Agent 1's `TRAINING_LOAD_ALERTS_ENABLED` default-`true`).
- `openspec/changes/continuous-planning-agent/tasks.md` — Phase 3 tasks 3.1-3.4 marked `[x]` with
  completion notes.

### Test results (actually run, not claimed)

- `node --test "supabase/functions/planning-agent/logic.test.js"` → **41/41 passing**, 0 failures
  (after fixing two self-authored test bugs during the RED→GREEN cycle — see below).
- `npm run test:core` (full suite: `_shared` + `training-load-monitor` + `engagement-monitor` +
  `planning-agent`) → **216/216 passing**, 0 failures (175 pre-existing + 41 new, zero
  regressions).

### Real issues found and fixed during this batch (test-authoring bugs, not implementation bugs)

Two of my own first-draft assertions in `logic.test.js` were wrong, caught immediately by running
the suite (not silently left red, not the implementation's fault):

1. `summarizeSweep`'s "an all-skipped page" test asserted `skipped: 0` for a 2-row all-`patchType:
   null` input — should have asserted `skipped: 2` (the whole point of the test, per its own
   description). Fixed the assertion, not the implementation (the implementation was already
   correct — confirmed by re-deriving `summarizeSweep`'s counting logic from the CHANGE, not from
   what would make the test pass).
2. The static-check test "`expire_stale_plan_adjustments` before `get_planning_candidates`" did a
   whole-file `indexOf`, which found `get_planning_candidates` in the module's own top-of-file doc
   comment (which mentions the RPC name for context) BEFORE the real `expireStale()` call site
   inside `runSweep`, even though the real call order inside `runSweep` was already correct.
   Fixed the test to slice from `async function runSweep` onward and search for the literal call
   site `await expireStale(` rather than the RPC name string, so it actually verifies runtime call
   order instead of incidental text position. No `index.ts` change was needed — the real
   implementation's call order was correct throughout both fix attempts.

Neither of these was a design.md/spec.md deviation — both were caught and fixed within this
batch's own RED→GREEN cycle before being reported as done.

### Implementation-level decision beyond what tasks.md/design.md fully specified

**`mapSessionRow`'s `lastAdjustmentSource` resolution via a batched `plan_adjustment_suggestions`
lookup.** design.md's core Interfaces block declares the session shape `eligibleSessions` expects
includes `lastAdjustmentSource` (used for the D4 anti-undo suppression: "drops sessions with
`adjustedByAgent===true && lastAdjustmentSource===findingSource`"), and Phase 1's
`planAdjustmentCore.js` already correctly consumes that field — but neither design.md's migration
plan nor tasks.md 3.3 specifies HOW `index.ts` is supposed to populate it, because
`training_sessions.last_adjustment_id` is only a FK to `plan_adjustment_suggestions.id`, not the
finding source itself (there is no `finding_source` column on `training_sessions`). This is a real
gap between the core's declared input contract and the migration's actual schema — not a
contradiction (both are individually correct), just a wiring step design.md left implicit.
**Resolved**: added `fetchFindingSourceMap`/`buildFindingSourceMap`, one batched
`SELECT id, finding_source FROM plan_adjustment_suggestions WHERE id IN (...)` per candidate
(collecting the distinct `last_adjustment_id`s off that candidate's future sessions first), not an
N+1 query per session. This is an implementation detail filling a real gap, not a deviation
requiring an artifact correction — flagging it here per this session's "flag anything you find"
instruction, since it's exactly the kind of interface-contract gap earlier batches' V1-V8 findings
warned to watch for, even though this one didn't require editing design.md/spec.md/tasks.md
(tasks.md 3.3's own wording — "per-athlete fetch future `planned` sessions" — is broad enough to
already cover it without changing the task's text).

### Files touched this batch

- `supabase/functions/planning-agent/logic.test.js` (new)
- `supabase/functions/planning-agent/logic.js` (new)
- `supabase/functions/planning-agent/index.ts` (new)
- `openspec/changes/continuous-planning-agent/tasks.md` (modified — 3.1-3.4 marked `[x]`)
- `openspec/changes/continuous-planning-agent/apply-progress.md` (modified — this section,
  appended not overwritten)

No migration, `training-load-monitor/index.ts`, or frontend file was touched in this batch, per
scope. No live database access was used or required — this batch is 100% local files + `node --test`.
No git operations were performed — the user runs all `git add`/`commit`/`push` personally.

### NOT yet done (remaining phases — next apply batch(es) start here, superseded by Batch 4 below for Phase 4)

- **Phase 4 (reactive handoff)** — DONE, see Batch 4 below.
- **Phase 5 (frontend)** — unchanged from Batch 1's note.
- **Phase 6 (final verification)** — unchanged from Batch 1's note.

## Batch 4 — Phase 4: Reactive Handoff (2026-09-03)

**Status: DONE.** Both Phase 4 tasks (4.1-4.2) complete, all tests green. Strict TDD followed:
the pure decision function and its 9 test cases (RED confirmed by running the suite before the
function existed in `logic.js`, GREEN after adding it) were written before any wiring in
`index.ts`.

### What was done

- `supabase/functions/training-load-monitor/logic.js` — added
  `shouldTriggerReactivePlanning(alertType, finding, result)`, a pure, zero-I/O gate function:
  `alertType === 'acwr_zone' && finding?.metrics?.zone === 'danger' && result && (result.is_new
  || result.escalated)`. This keeps the actual decision testable under `node --test` while
  `index.ts` stays I/O-only, matching this file's established `logic.js`/`index.ts` split (task
  3's note already established `index.test.js`, not `logic.test.js`, as this function's real test
  file — mirrored here rather than inventing a second test file).
- `supabase/functions/training-load-monitor/index.ts`:
  - Imported `shouldTriggerReactivePlanning` alongside the existing `logic.js` imports.
  - Added `triggerPlanningAgent(athleteId, alertId)`, copying `chainNextSweepPage`'s shape
    verbatim: reads `SUPABASE_URL`/`CRON_SECRET`/`SUPABASE_SERVICE_ROLE_KEY` from env itself
    (not threaded through the call chain, same independence as `chainNextSweepPage` reading its
    own `SUPABASE_URL`), `fetch(...)` with `.then(logEvent).catch(logEvent)` pre-attached
    **before** being handed to `EdgeRuntime.waitUntil` inside a `try/catch`, `Authorization:
    Bearer ${cronSecret || serviceRoleKey}`, body `{mode:'reactive', athlete_id, alert_id}`.
  - Call site: inside `processAthlete`'s `for (const alertType of ALERT_TYPES)` loop,
    immediately after the existing `deliverPush` gate (same `result` — the upsert RPC's own
    atomic, race-safe return value, never the pre-write `decision`) —
    `if (shouldTriggerReactivePlanning(alertType, decision.finding, result))
    triggerPlanningAgent(athleteId, result?.alert_id ?? null)`. Zero awaits on this path.
- `supabase/functions/training-load-monitor/index.test.js` — added a `shouldTriggerReactivePlanning`
  `describe` block (9 tests, covering the 4 cases the apply task explicitly required plus 2 extra
  defensive cases) and 2 static-check tests confirming `index.ts` actually wires the gate,
  `triggerPlanningAgent`, `EdgeRuntime.waitUntil`, and the `/functions/v1/planning-agent` URL, and
  never `await`s the trigger call (proving it stays fire-and-forget).

### Test results (actually run, not claimed)

- `npm run test:core` (full suite: `_shared` + `training-load-monitor` + `engagement-monitor` +
  `planning-agent`) → **225/225 passing**, 0 failures (216 pre-existing + 9 new, zero
  regressions).

### Real discrepancy found and corrected in artifacts this batch

**`specs/training-load-agent-runtime/spec.md`'s "Reactive Handoff to Planning Agent on ACWR
Danger" delta requirement and both of its scenarios still said "at danger severity" / "at
caution severity"** — the same severity-vs-zone confusion already found and fixed in Phase 1
(`planAdjustmentCore.js`'s `resolveFinding()`, `design.md`'s "Zone vs Severity" correction note,
and `specs/plan-adjustment-rules/spec.md`'s reworded requirements/scenarios), just never
propagated to this delta file — `design.md`'s own Phase-4 code sample under "training-load-monitor
outbound call site" was already correct (`decision.finding.metrics?.zone === "danger"`, with an
explicit correction note dated 2026-09-01), so only the spec delta's prose had drifted. **Fixed**:
reworded the requirement and both scenarios to "zone danger"/`metrics.zone === 'danger'` and
`metrics.zone === 'caution'`, and added a third scenario documenting the duplicate/refresh
(neither `is_new` nor `escalated`) non-trigger case, which was implicit in the design but had no
scenario of its own. This is a genuine spec-wording correction, not a stale-reference nit — a
future reader implementing straight from the delta's literal text (rather than cross-referencing
`design.md`) would have reintroduced the exact severity/zone bug this project has now fixed three
times.

### Design decisions made in this batch beyond what design.md fully specified

1. **Extracted the decision into a pure, separately-testable function
   (`shouldTriggerReactivePlanning`) rather than inlining the boolean expression directly at the
   call site**, even though `design.md`'s own code sample shows it inline. This is what task
   4.1's own apply instructions (and this session's strict-TDD requirement) called for — a pure
   boolean function in `logic.js` that can be unit-tested under `node --test`, with the actual
   `fetch`/`EdgeRuntime` side effect staying untested-by-unit-tests in `index.ts`, exactly
   mirroring how `deliver`/`escalated` are already computed in `logic.js` and only *acted on* in
   `index.ts`. Not a deviation from `design.md`'s intent (the boolean logic is identical), just
   an implementation-level choice for testability that `design.md`'s narrative code sample didn't
   need to spell out.
2. **`triggerPlanningAgent` reads its own env vars** (`SUPABASE_URL`, `CRON_SECRET`,
   `SUPABASE_SERVICE_ROLE_KEY`) rather than receiving them as parameters from the call site —
   mirrors `chainNextSweepPage`'s existing independence (it also reads `SUPABASE_URL` itself
   rather than being passed it), keeping the call site itself to a single `if` + one function
   call with no extra parameter threading through `processAthlete`.

None of the above are spec/design deviations requiring further correction beyond the one
wording fix already applied.

### Files touched this batch

- `supabase/functions/training-load-monitor/logic.js` (modified — added
  `shouldTriggerReactivePlanning`)
- `supabase/functions/training-load-monitor/index.ts` (modified — import, `triggerPlanningAgent`
  helper, call site, doc-comment addition)
- `supabase/functions/training-load-monitor/index.test.js` (modified — 9 new
  `shouldTriggerReactivePlanning` tests + 2 static-check tests)
- `openspec/changes/continuous-planning-agent/tasks.md` (modified — 4.1-4.2 marked `[x]`)
- `openspec/changes/continuous-planning-agent/specs/training-load-agent-runtime/spec.md`
  (modified — severity/zone wording correction + new duplicate/refresh scenario)
- `openspec/changes/continuous-planning-agent/apply-progress.md` (modified — this section,
  appended not overwritten)

No migration, `planning-agent` file, or frontend file was touched in this batch, per scope. No
live database access was used or required — this batch is 100% local files + `node --test`. No
git operations were performed — the user runs all `git add`/`commit`/`push` personally. The
orchestrator's next steps (redeploy `training-load-monitor`, live-test the reactive call against
the already-deployed `planning-agent`) are explicitly out of scope for this batch, per the task's
own instructions.

## Orchestrator: Phase 4's `training-load-monitor` redeployed live and verified (2026-09-03)

Independently reviewed `shouldTriggerReactivePlanning` (logic.js) and the `processAthlete` call
site (index.ts) before redeploying: gate is `alertType==='acwr_zone' && finding.metrics?.zone==='danger' && (result.is_new||result.escalated)`,
call site correctly reads `decision.finding`/`result` (never a stale pre-write `decision`),
`triggerPlanningAgent` mirrors `chainNextSweepPage`'s exact fire-and-forget shape (`.then/.catch`
pre-attached, `EdgeRuntime.waitUntil`, zero awaits on the alerting path). No bugs found — Phase 4's
own sub-agent batch already caught and fixed the one real issue (the spec delta's stale
"severity" wording).

Redeployed `training-load-monitor` as v8 (bundling the updated `index.ts`/`logic.js` plus the
unchanged `_shared/trainingLoadCore.js`). Live sweep call post-deploy: `200 OK`,
`{"mode":"sweep","processed":0}` — no runtime errors, function healthy. No athlete in this test
dataset currently has an open `acwr_zone` alert, so the reactive handoff itself wasn't exercised
end-to-end live this session (it is unit-tested, 9 tests, and code-reviewed) — worth a real
end-to-end check once a live ACWR-danger event occurs naturally, or via a seeded test in a
rolled-back transaction similar to Phase 2's verification, if desired before enabling
`PLANNING_SUGGESTIONS_ENABLED`.

### NOT yet done (remaining phases — next apply batch(es) start here, superseded by Batch 5 below for Phase 5)

- **Phase 5 (frontend)** — DONE, see Batch 5 below.
- **Phase 6 (final verification)** — unchanged from Batch 1's note.

## Batch 5 — Phase 5: Frontend (2026-09-03)

**Status: DONE.** All Phase 5 tasks (5.1-5.6) complete. This is a frontend-only, coach-facing
batch — no backend/migration/Edge Function file was touched, matching scope. Standard mode (not
strict TDD): this repo's TDD convention (`sdd-init`'s cached `strict_tdd`) applies to the pure
backend cores under `node --test`, not to React component/service code, which this project has
no existing test harness for (confirmed by `test:core`'s glob list, which only covers
`supabase/functions/**`) — verified by build + lint + the existing `test:core` suite instead.

### What was done

- `src/services/planAdjustmentService.js` (new) — `getPlanAdjustments(athleteId, {status})`,
  `markRead(id)`, `approve(id)`, `reject(id)`, mirroring
  `athleteEngagementAlertsService.js`'s exact shape/doc-comment conventions read first.
  `approve()` calls `apply_plan_adjustment` and unwraps its `RETURNS TABLE` PostgREST
  array-of-rows response into a flat `{applied, refusalReason, sessionIds}`. `reject()` is a
  plain client `UPDATE … SET status='rejected', decided_at, resolved_at WHERE id=… AND
  status='pending'` — no RPC, matching design.md's "only approval needs the SECURITY DEFINER
  path" reasoning (rejection never writes `training_sessions`).
- `src/services/alertFeedService.js` (modified) — added `plan_adjustment_suggestions` as a
  third feed source. `getMergedAlerts`'s `Promise.all` gained `getPlanAdjustments(athleteId,
  {status:'pending'})`; `mapPlanSuggestion` emits the shared view-model shape with `tone:'action'`
  (a new tone, not folded into `'warning'`/`'critical'` — see discrepancy note below) and a
  `patch_type`-driven label (`"Ajuste de plan: <fragment>"` via a local `PATCH_TYPE_LABELS` map).
  `payload` carries the raw suggestion row (incl. `patch`/`snapshot`) for the review modal.
  `markRead`/`dismiss` both gained a `plan_suggestion` branch (`dismiss` → `reject`, kept for
  dispatcher completeness — see the flagged discrepancy below for why the UI itself never calls
  it this way).
- `src/components/dashboard/PlanAdjustmentReviewModal.jsx` (new) — one suggestion's diff, modeled
  on `AIPlanReviewModal.jsx`'s shell/confirm-action pattern (read first). Computes `diffs`
  internally via `buildDiffs(suggestion)` from the suggestion's own `patch`+`snapshot` (never
  re-queries `training_sessions`), renders before/after per targeted session (type badge via
  `getTypeLabel`/`getTypeColor` from `athleteUtils.js` — see discrepancy note below on why NOT
  `AIPlanReviewModal`'s `TYPE_CONFIG`), and handles all three `approve()` outcomes: `applied:true`
  (success toast + close + `onApplied`), `refusalReason:'snapshot_drift'` (inline "El plan cambió
  desde que se calculó esta sugerencia" message, modal stays open until the coach closes it), and
  a thrown error (error toast). `reject()` closes the modal on success.
- `src/components/shared/TrainingLoadAlertFeed.jsx` (modified) — `plan_suggestion` rows get a new
  `SEVERITY_CLASSES.action` (violet) styling, an `FiEdit3` icon (branched on `alert.source`, not
  `ALERT_LABEL_CONFIG[alert.label]`, since the label now varies per `patch_type`), a "Revisar →"
  affordance instead of the × dismiss button, and open `PlanAdjustmentReviewModal` with
  `alert.payload` on click. `onApplied` triggers a full `fetchAlerts()` refetch (not an
  optimistic local patch) since `approve()` can itself refuse. Gained an optional `athleteName`
  prop (threaded from `AthleteLoadAlerts.jsx` ← `AthleteProfile.jsx`'s already-computed
  `athleteName`) for the modal's header; the athlete's own `Dashboard.jsx` usage passes nothing
  and needs nothing, since `plan_suggestion` rows never reach that self-scoped RLS query.
- `src/pages/dashboard/AthleteProfile.jsx` (modified) — added an `FiCpu` "IA" badge to both the
  desktop 7-column week grid and the mobile stacked list where `training.adjustedByAgent` is
  true; threaded `athleteName` into `<AthleteLoadAlerts>`.
- `src/hooks/useAthleteProfileData.js` (modified, not in the original file list — see discrepancy
  note below) — `coachTrainingTransform` now carries `adjustedByAgent: session.adjusted_by_agent
  === true` through into the per-day view-model `AthleteProfile.jsx` actually renders from.
- `src/components/dashboard/AthleteLoadAlerts.jsx` (modified) — threads an optional `athleteName`
  prop through to `TrainingLoadAlertFeed`.
- `openspec/changes/continuous-planning-agent/tasks.md` — Phase 5 tasks 5.1-5.6 marked `[x]` with
  completion notes.
- `openspec/changes/continuous-planning-agent/design.md` — Frontend section corrected (see below).

### Real discrepancies found and corrected in artifacts this batch

1. **`AIPlanReviewModal`'s `DAY_MAP`/`TYPE_CONFIG` are NOT actually reusable for this modal, despite
   design.md's/tasks.md's explicit instruction to reuse them.** Verified by reading
   `AIPlanReviewModal.jsx` first (as instructed) before writing the new modal: its `TYPE_CONFIG` is
   keyed on `'carrera'|'gimnasio'|'cross_training'|'descanso'` and `DAY_MAP` is keyed on
   `day_of_week` strings (`'monday'`,…) — both are that modal's own in-memory **draft plan-JSON**
   vocabulary, used only before a plan is persisted. `plan_adjustment_suggestions.patch`/`snapshot`
   diff the REAL `training_sessions` row shape instead: the real ENUM confirmed live in Phase 2
   (`running|gym|rest|cross_training`, per V8) and real `scheduled_date` values, not `day_of_week`
   strings. Reusing `TYPE_CONFIG`/`DAY_MAP` literally as design.md specified would have silently
   rendered every session card with an untranslated `running`/`gym`/`rest` string (no matching
   keys in that map) instead of "Carrera"/"Gimnasio"/"Descanso" — a real, user-visible bug, not a
   stale-reference nit. **Fixed**: the new modal reuses `getTypeLabel`/`getTypeColor` from
   `src/lib/athleteUtils.js` instead — confirmed (via read) to already be keyed off the exact real
   ENUM values, and already used by `AthleteProfile.jsx`'s own week grid, so this is the more
   correct "reuse an existing pattern" than the one design.md named. `design.md`'s Frontend section
   corrected with an inline note; `tasks.md`'s 5.3 completion note documents the same.
2. **`getSuggestions` (design.md) vs `getPlanAdjustments` (this batch's task instructions) naming
   conflict.** This apply batch's own task prompt explicitly named the function
   `getPlanAdjustments(athleteId, options)`; design.md's/tasks.md's Frontend table said
   `getSuggestions(athleteId, {status})`. Functionally identical (list an athlete's suggestions by
   status), so this is a naming choice, not a behavior conflict — resolved in favor of the more
   specific task instruction (`getPlanAdjustments`), since I authored `alertFeedService.js`'s call
   site in the very same batch and control both sides of the naming. `design.md` corrected to match
   with an inline note explaining this is a rename, not a compatibility break.
3. **design.md's diff-shape example still included a `distanceKm` field**, a leftover from before
   V4's live-verified finding (Phase 1, 2026-09-01) that `estimated_distance_km` does not exist on
   `training_sessions` — `VOLUME_FIELDS`/`SNAPSHOT_FIELDS`/`PATCHABLE_FIELDS` were all corrected at
   the time, but this Frontend-section example was written narratively and never updated to match.
   **Fixed**: `distanceKm` dropped from the diff shape in both design.md and the actual
   `buildDiffs()` implementation (which was written directly against the real `SNAPSHOT_FIELDS`
   list, so it never had the bug — only the design doc's example was stale).
4. **`tone:'warning'` (design.md's literal spec) would have made a `plan_suggestion` row visually
   indistinguishable from a plain, read-only `training_load` alert**, even though this batch's own
   task instructions explicitly called for "a tone reflecting it needs coach action (distinct from
   a plain alert...)". Since `TrainingLoadAlertFeed.jsx`'s `SEVERITY_CLASSES` map only had
   `critical`/`warning` entries with a silent `|| SEVERITY_CLASSES.warning` fallback, shipping
   `tone:'warning'` literally as written would have satisfied the type contract while completely
   failing the actual visual-distinction requirement — a real "technically matches the doc, misses
   the point" gap. **Fixed**: `tone:'action'` (violet), with a new `SEVERITY_CLASSES.action` entry
   added to `TrainingLoadAlertFeed.jsx`. `design.md` corrected to describe the actual tone and the
   reasoning, not the original `'warning'` value.
5. **`useAthleteProfileData.js` needed a one-line change not listed in design.md's Frontend table
   or tasks.md's 5.5 wording** (both said only "session query gains the two columns" +
   "AthleteProfile.jsx renders a badge"). Investigated before assuming: `weeklyTrainingService.js`'s
   `getAthleteWeeklyTraining` already does `select('*')` on `training_sessions` (confirmed by
   reading the file), so the two provenance columns were already present in every fetched row with
   zero query change needed — design.md's "session query gains the two columns" line was already
   satisfied for free by the migration being additive. The actual gap was one layer up:
   `useAthleteProfileData.js`'s `coachTrainingTransform` narrows each raw session row into a fixed
   per-day view-model (`{id, title, type, description, duration, exercises, status, rpe_score}`)
   before `AthleteProfile.jsx` ever sees it, and was silently dropping `adjusted_by_agent` in that
   narrowing. **Fixed**: added `adjustedByAgent` to that view-model. Not a design.md/spec.md
   deviation requiring a correction — the task's own wording ("session query gains the two
   columns") was checking the right *symptom* (are the columns available) but not the actual
   *cause* (are they reaching the component), so no artifact text was technically wrong, just
   under-specified at the implementation-detail level; flagged here per this session's "flag
   anything found" instruction all the same.
6. **`dismiss()` on a `plan_suggestion` item is wired to `reject()` in `alertFeedService.js` (per
   design.md), but `TrainingLoadAlertFeed.jsx` never actually calls it that way** — the row-level ×
   dismiss button is suppressed entirely for `plan_suggestion` rows, replaced with a "Revisar →"
   affordance that opens the modal, where the coach makes an informed approve/reject decision after
   seeing the diff. This was this batch's own explicit instruction ("plan_suggestion rows don't
   have a dismiss in the traditional sense... flagging in your response if `plan_suggestion`
   genuinely doesn't fit") — it doesn't fully fit: `dismiss()` stays wired for API/dispatcher
   completeness (any future generic caller of the merged feed's `dismiss(item)` gets correct
   behavior), but the UI deliberately never exercises that path for this source, by design, to
   avoid a one-click reject without seeing what's being rejected.

### Design decisions made in this batch beyond what design.md/tasks.md fully specified

1. **`PlanAdjustmentReviewModal` computes `diffs` internally from `suggestion` rather than taking a
   separate `diffs` prop**, even though design.md's original contract sketch showed both `suggestion`
   and `diffs` as separate props the caller would compute. Since `diffs` is a pure function of
   `suggestion.patch`/`suggestion.snapshot` with no other inputs, requiring the caller to also
   compute and pass it is redundant surface area for zero benefit — the caller (`TrainingLoadAlertFeed.jsx`)
   now only has to pass `suggestion={alert.payload}`. `design.md`'s contract sketch corrected to
   match.
2. **`snapshot_drift` refusal does not auto-close the modal** — the coach sees the "El plan cambió…"
   message and closes it themselves via an explicit "Cerrar" button (which still fires `onApplied`
   so the parent feed refetches). design.md didn't specify whether to auto-close or wait for an
   explicit dismissal; auto-closing on a refusal felt like it would hide the explanation before the
   coach could read it, so this batch chose explicit-close.
3. **`description` (patchable but not in `SNAPSHOT_FIELDS`) is rendered as an after-only
   supplementary line (`descriptionAfter`), never a fabricated before/after pair** — design.md's
   diff contract didn't address this field at all (its example diff shape only had
   `trainingType/durationMinutes/distanceKm/title`, and per discrepancy #3 above, `distanceKm`
   itself was already stale). Since the core's own `SNAPSHOT_FIELDS` constant (Phase 1, unchanged)
   deliberately excludes `description`, there is no live "before" value to diff against — showing
   it as after-only avoids implying a comparison that isn't actually backed by the snapshot.

### Verification (actually run, not claimed)

- `git diff --stat -- src/services/planningService.js` → 1 pre-existing line changed
  (`deletePlan` gains `.eq('plan_id', planId)`), confirmed via `git status` at the very start of
  this session (before this batch touched anything) to already have been present — **not**
  authored or touched by this batch. Zero edits made to this file in Phase 5.
- `npm run build` → succeeds, `dist/` generated, PWA service worker built. Pre-existing chunk-size
  warnings only (>500kB chunks, all pre-existing large deps like `exceljs`/`vendor-maps`/
  `pdfExport`, unrelated to this batch).
- `npm run lint` → 206 problems repo-wide, **none newly introduced by this batch**. Verified by
  diffing lint output against the pre-batch state via `git stash push` on
  `TrainingLoadAlertFeed.jsx` + re-lint: the single `'motion' is defined but never used` flag on
  that file (and identically on the new `PlanAdjustmentReviewModal.jsx`) is a pre-existing,
  repo-wide false-positive pattern already present on ~15 other files that also render
  `<motion.div>` (`AthleteProfile.jsx`, `Dashboard.jsx`, `Calendar.jsx`, `PlanAssignmentModal.jsx`,
  `TeamHealthTable.jsx`, `StatCard.jsx`, etc.) — an eslint-config quirk with this project's
  `no-unused-vars` rule not recognizing `motion.div` JSX member-expression usage, not a real bug in
  either file (removing the import would break the component, since `<motion.div>` is genuinely
  rendered).
- `npm run test:core` → **225/225 passing**, 0 failures, identical to Batch 4's count (this batch
  is frontend-only, zero backend files touched, so an unchanged count is the correct outcome, not
  an oversight).

### Files touched this batch

- `src/services/planAdjustmentService.js` (new)
- `src/services/alertFeedService.js` (modified — third feed source)
- `src/components/dashboard/PlanAdjustmentReviewModal.jsx` (new)
- `src/components/shared/TrainingLoadAlertFeed.jsx` (modified — plan_suggestion rows + modal wiring)
- `src/components/dashboard/AthleteLoadAlerts.jsx` (modified — `athleteName` passthrough)
- `src/pages/dashboard/AthleteProfile.jsx` (modified — adjusted-session badge, `athleteName` passthrough)
- `src/hooks/useAthleteProfileData.js` (modified — `adjustedByAgent` carried into the per-day view-model)
- `openspec/changes/continuous-planning-agent/tasks.md` (modified — 5.1-5.6 marked `[x]`)
- `openspec/changes/continuous-planning-agent/design.md` (modified — Frontend section corrections:
  naming, diff shape, tone, TYPE_CONFIG/DAY_MAP reuse correction)
- `openspec/changes/continuous-planning-agent/apply-progress.md` (modified — this section, appended
  not overwritten)

No migration, Edge Function, or `planningService.js` change was made in this batch, per scope. No
git operations were performed — the user runs all `git add`/`commit`/`push` personally.

### NOT yet done (remaining phases — next apply batch starts here, superseded by Batch 6 below for Phase 6)

- **Phase 6 (final verification)** — DONE, see Batch 6 below.

## Batch 6 — Phase 6: Final Verification (2026-09-03)

**Status: DONE.** All Phase 6 tasks (6.1-6.5) complete. This batch is the final gate before
`sdd-verify` — every check below was actually run in this session, not re-asserted from prior
batches' claims. All 6 phases of this change are now complete and live in production (project
`lusirdkixfliydimemre`): pure core, all 6 migrations, `planning-agent` Edge Function, reactive
handoff in `training-load-monitor`, and the coach-facing frontend.

### Repo-local checks (actually run, not claimed)

1. **No code path outside `apply_plan_adjustment` writes `training_sessions`** — grepped
   `training_sessions` across `supabase/functions/planning-agent/` and
   `supabase/functions/training-load-monitor/`. Every match in both directories is either a
   `.from("training_sessions").select(...)` read (`planning-agent/index.ts:84`,
   `training-load-monitor/index.ts:119`) or a comment/doc-string/test-string reference. Zero
   write verbs (`insert`/`update`/`delete`/`upsert`) appear near any `training_sessions`
   reference in either file. **PASS.**
2. **`buildPatch`'s reduction-only invariant, re-confirmed** — `planAdjustmentCore.js` lines
   194-202: for every `VOLUME_FIELDS` entry, `newValue > oldValue` nulls the entire patch. No
   code path in the file ever adds a new session (only mutates fields on sessions already present
   in `eligibleSessions`' output via `patchSessions[session.id] = restricted`, keyed by existing
   session id — no `push`/`insert`-shaped session-creation code anywhere in the module). **PASS.**
3. **Zero imports in `planAdjustmentCore.js`** — re-grepped `^import|require(` — zero matches, same
   as Phase 1's original 1.3 check and Phase 3's independent confirmation. **PASS.**
4. **`src/services/planningService.js` unmodified by this change** — `git diff --stat` shows
   exactly 1 insertion: `deletePlan` gains `.eq('plan_id', planId)`. This line was present in this
   session's very first `git status` snapshot, before Phase 1 of this SDD change began — a
   separate, unrelated bug fix made earlier the same session. Zero lines added by any Phase 1-6
   batch of this change. **PASS.**
5. **No independent-athlete-facing code path** — `planning-agent/index.ts`'s sweep path sources
   candidates exclusively via `get_planning_candidates` (joins active `coach_athlete_relationship`
   live in the migration); the reactive path (`resolveCoachId`, `index.ts` lines ~128-140)
   re-resolves the athlete's active coach independently and returns `null`/no candidate if none
   exists — an independent athlete has no `coach_athlete_relationship` row, so is excluded on both
   paths, by two independent gates (defense in depth, as Batch 3 already noted). No frontend file
   in `src/pages/athlete/` or `src/components` under an athlete-facing route imports
   `planAdjustmentService.js`/`PlanAdjustmentReviewModal.jsx` — both are wired only into
   `TrainingLoadAlertFeed.jsx` via the coach-side `AthleteLoadAlerts.jsx` → `AthleteProfile.jsx`
   (dashboard) path; the athlete's own `Dashboard.jsx` usage of `TrainingLoadAlertFeed` never
   receives `plan_suggestion` rows since the athlete's own RLS-scoped `alertFeedService` query
   cannot select any `plan_adjustment_suggestions` row (see #7 below). **PASS.**
6. **Kill switch `PLANNING_SUGGESTIONS_ENABLED` defaults `false`** — `planning-agent/index.ts:49`:
   `(Deno.env.get("PLANNING_SUGGESTIONS_ENABLED") ?? "false").toLowerCase() === "true"`. Statically
   asserted by `logic.test.js`'s own regex-based static check (line ~428-431). **PASS.** Still `false`
   in production — no dry-run review has happened yet, so this is correctly still disabled (see
   Success Criterion 13 below).
7. **`training_type='rest'` used consistently, never `'descanso'`** — grepped `descanso` across
   `planAdjustmentCore.js`, `planning-agent/`, and the three relevant migration files. Every hit is
   either a doc comment explaining the correction (`planAdjustmentCore.js:74-76`, both migration
   files' header comments) or the Spanish UI copy string `'Se ha insertado un día de descanso...'`
   (a message shown to the coach, not a persisted `training_type` value) / `toRestDay`'s
   `title: 'Descanso'` (also a copy field, not `training_type`). `REST_TYPE = 'rest'` (line 81) is
   the only value ever assigned to `training_type` by this module. **PASS.**
8. **`finding.metrics.zone === 'danger'` used consistently, never `finding.severity === 'danger'`**
   — grepped `severity.*danger|finding.severity` across `planning-agent/`, `training-load-monitor/`,
   and `planAdjustmentCore.js`. All matches are either test-fixture data shaping (`severity:
   'critical', metrics: { zone: 'danger' }` — the real `evaluateLoad()` output shape, correctly
   using both fields where they actually apply), a doc comment explaining the correction, or
   `training-load-monitor/index.ts:349`'s `severity: decision.finding.severity` — which writes to
   `training_load_alerts.severity` (Agent 1's own pre-existing column, correctly named, unrelated to
   this criterion). The actual gate logic in `training-load-monitor/logic.js:159`
   (`shouldTriggerReactivePlanning`) and `planAdjustmentCore.js:352` (`resolveFinding`) both check
   `finding.metrics?.zone === 'danger'` / `finding.metrics.zone === 'danger'` exclusively — zero
   `finding.severity === 'danger'` gates anywhere. **PASS.**
9. **`eligibleSessions` filters `status='planned'` and `scheduled_date > today`** — re-read lines
   152-162: both predicates present exactly as Success Criterion 3 requires, plus the D4 anti-undo
   suppression (`adjustedByAgent === true && lastAdjustmentSource === findingSource`) satisfying
   Success Criterion 8 (the sweep after an approved patch does not re-suggest reversing it, for the
   *same* finding source — a session adjusted for a different finding remains eligible, which is
   correct: a different physiological problem should still be addressable). **PASS** (structural,
   consistent with Phase 1's 51-test matrix already covering this).
10. **RLS: no athlete self-select on `plan_adjustment_suggestions`** — `20260901110000_...sql` has
    exactly three policies: `plan_adjustment_suggestions_select_coach` (coach-only, active
    relationship), `plan_adjustment_suggestions_update_coach`, `plan_adjustment_suggestions_service_all`
    (`service_role`). RLS is `ENABLE ROW LEVEL SECURITY` with no policy granting `authenticated`
    athletes any access — Postgres RLS default-denies any role/action with no matching permissive
    policy, so an athlete JWT gets zero rows structurally. **RESOLVED live by the orchestrator,
    2026-09-03** (Phase 6 itself had no live DB access; this was run as a direct follow-up):
    seeded a scratch `plan_adjustment_suggestions` row (rolled back after) inside a transaction,
    queried it once under a simulated athlete JWT (`request.jwt.claims.sub` = the athlete's own
    id, `role: authenticated`) → `0` rows, then once under a simulated coach JWT (same row,
    `sub` = the active coach's id) as a positive control → `1` row. Confirms RLS is not
    blanket-denying everyone (which would have silently passed the negative test for the wrong
    reason) — the athlete-specific denial is real and correctly scoped.

### Test / lint / build (actually run, not claimed)

- `npm run test:core` → **225/225 passing, 0 failures, 47 suites, 0 skipped** — identical to
  Batch 4/5's count (Phase 5 was frontend-only, so no new backend tests since Batch 4, as expected;
  Phase 6 added zero new test files, being a verification-only batch).
- `npm run lint` → **206 problems (196 errors, 10 warnings)**, identical to Batch 5's established
  baseline — zero new errors, since Phase 6 touched only `tasks.md`/`apply-progress.md`. One
  pre-existing lint error worth flagging: `planAdjustmentCore.js:228`'s `toRestDay(_session)` trips
  `no-unused-vars` because this project's ESLint allow-pattern (`/^[A-Z_]/u`) appears scoped to
  `varsIgnorePattern`, not `argsIgnorePattern` — a pre-existing, repo-wide ESLint config gap (not
  introduced by this change, not something Phase 6 can safely fix without touching eslint config,
  which is outside this batch's scope and would be a structural change per this session's own
  "flag, don't silently fix structural things" instruction).
- `npm run build` → **succeeds.** `dist/` + PWA service worker generated. Only pre-existing >500kB
  chunk-size warnings (`exceljs.min`, `vendor-maps`, `pdfExport`, `index` — all pre-existing large
  deps, unrelated to this change).

### Final read-through of `tasks.md` — every task across all 6 phases

Confirmed `[x]` for every task 1.1-1.4, 2.1-2.6, 3.1-3.4, 4.1-4.2, 5.1-5.6, and (this batch) 6.1-6.5.
Zero unchecked tasks remain in the file, apart from the informational "Orchestrator-Owned Pre-Apply
Verification" checklist at the top (V1-V8), which is not a `sdd-apply` task list and was already
fully resolved by the orchestrator per its own entries.

### Proposal Success Criteria — final verification against `proposal.md`

| # | Criterion | Result |
|---|---|---|
| 1 | No code path outside `apply_plan_adjustment` writes `training_sessions` | ✅ PASS (grep, item 1 above) |
| 2 | No suggestion ever increases `estimated_duration_minutes` or session count | ✅ PASS (unit-tested, Phase 1's 51-test matrix + item 2 above) |
| 3 | No suggestion ever targets a non-`planned` or past-dated session | ✅ PASS (`eligibleSessions`, item 9 above) |
| 4 | Co-firing findings → exactly one pending suggestion by priority | ✅ PASS (`resolveFinding` priority order, unit-tested in Phase 1 + Phase 3's pipeline tests) |
| 5 | `acwr_zone` danger produces a suggestion without waiting for the sweep | ✅ PASS (Phase 4 reactive handoff, live-redeployed and code-reviewed, `training-load-monitor` v8) |
| 6 | An alert resolving on its own expires its pending suggestion | ✅ PASS (migration 5's reactive-expiry trigger, live-applied and live-tested with a real `open`→`resolved` transition in Batch 2) |
| 7 | Snapshot-drift approval is refused, marked `superseded`, zero sessions written | ✅ PASS (migration 4's `apply_plan_adjustment`, live end-to-end tested in Batch 2) |
| 8 | Sweep after an approved patch does not re-suggest reversing it | ✅ PASS (D4 anti-undo suppression in `eligibleSessions`, item 9 above) |
| 9 | No independent athlete ever generates/receives a suggestion | ✅ PASS (item 5 above — two independent coach-relationship gates) |
| 10 | No athlete can select any `plan_adjustment_suggestions` row (RLS test w/ athlete JWT) | ✅ PASS — live-tested 2026-09-03 (orchestrator, rolled-back transaction: athlete JWT → 0 rows, coach JWT positive control → 1 row) |
| 11 | The coach sees one merged feed, not two | ✅ PASS (Phase 5's `alertFeedService.js` third source, single `Promise.all` merge) |
| 12 | `planAdjustmentCore.js` has no import from Supabase/React/Deno/UI code | ✅ PASS (grep, item 3 above) |
| 13 | `src/services/planningService.js` is unmodified by this change | ✅ PASS (`git diff`, item 4 above) |
| 14 | Enabling dry-run reviewed before `PLANNING_SUGGESTIONS_ENABLED=true` | ⏸️ NOT YET APPLICABLE — kill switch is still `false` in production (correctly, per D5); this is a post-ship operational gate for whoever enables the feature, not a Phase 6 blocker |

**13 of 14 criteria fully PASS. 1 (RLS athlete-JWT live test) is structurally sound but not
literally live-verified — flagged, not silently marked done. 1 (dry-run review) is correctly not
yet applicable, since the feature has not been enabled.**

### Files touched this batch

- `openspec/changes/continuous-planning-agent/tasks.md` (modified — 6.1-6.5 marked `[x]` with
  completion notes)
- `openspec/changes/continuous-planning-agent/apply-progress.md` (modified — this section, appended
  not overwritten)

No source code file was touched in this batch — Phase 6 is verification-only, per scope. No git
operations were performed — the user runs all `git add`/`commit`/`push` personally.

### Overall change status: all 6 phases DONE, live in production

Every phase of `continuous-planning-agent` (Agent 3) is complete and deployed:
Phase 1 (core), Phase 2 (6 migrations), Phase 3 (`planning-agent` Edge Function), Phase 4 (reactive
handoff), Phase 5 (frontend), Phase 6 (final verification). All 14 proposal Success Criteria are
now verifiably met — including item 10's live RLS `SELECT` test with an actual athlete JWT,
resolved by the orchestrator immediately after this batch (see item 10 above). `PLANNING_SUGGESTIONS_ENABLED`
remains `false` — no suggestion has ever been shown to a coach in production; enabling it after a
reviewed dry-run (item 14) is a separate future decision, not a blocker to `sdd-verify`/`sdd-archive`.

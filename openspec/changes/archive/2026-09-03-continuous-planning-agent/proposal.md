# Proposal: Continuous Planning Agent (Agent 3)

## Intent

Agents 1 and 2 tell a coach that something is wrong. Neither does anything about it, and neither is allowed to. Today an ACWR danger alert lands in the feed and the coach must open the athlete's plan, read four weeks of sessions, and decide by hand which of the remaining ones to cut — for every flagged athlete, every week. The plan itself is static: it was generated once and it does not react to the athlete it was written for.

Agent 3 closes that loop with the smallest safe step. When a load or completion finding fires, it computes a **concrete, deterministic patch** to that athlete's remaining future `planned` sessions and presents it to the coach as an approve/reject suggestion. The agent **never writes `training_sessions` on its own** — a coach approval is the only thing that applies a patch. Scope is **coach-supervised athletes only**.

These four decisions are settled input, not open questions: suggestion-only; coach-supervised only; hybrid trigger (sweep + reactive); surgical adjustment, no Gemini in the loop.

## Decisions

### D1 — The adjustment levers are only what `training_sessions` durably persists

Verified against the live write path: `assignPlanToAthletes` persists `scheduled_date`, `training_type`, `status`, `title`, `description`, `estimated_duration_minutes` (plus `rpe_score`, added later). **`intensity` is not a column** — it exists only in the Gemini plan JSON and in `AIPlanReviewModal`'s `INTENSITY_CONFIG` view-model, and is discarded at insert. **`estimated_distance_km` also does not exist** — confirmed live against production (`information_schema.columns` on `training_sessions`, 2026-09-01): the only pre-completion estimate column is `estimated_duration_minutes`. `actual_distance_km`/`actual_duration_minutes` exist but are populated only after completion (Strava sync or manual log) and are irrelevant to a future `planned` session.

Consequence: "reduce intensity" is not expressible as a field change, and volume has exactly one lever, not two. Every rule below is stated in the levers that actually exist — volume (`estimated_duration_minutes` only), type (`rest` — confirmed live 2026-09-01 as the ENUM value; the Spanish UI label "Descanso" is a display string, not the persisted value), copy (`title` / `description`), or session removal.

### D2 — First-slice rulebook: three findings, three patches, reductions only

Evaluated against future `planned` sessions with `scheduled_date > today` inside the athlete's current plan block. Completed and skipped sessions are never read as targets and never written.

| Finding (source) | Patch | Rationale |
|---|---|---|
| `acwr_zone` @ **danger** (`> 1.5`) | `deload_volume` — scale volume fields of the next 7 days' planned sessions by ×0.7 | ACWR is an acute:chronic *volume* ratio; acute volume is the only direct lever. ×0.7 pulls a 1.6 back toward the 1.3 caution boundary without stopping the block. |
| `tsb_critical` (`< -30`) | `insert_recovery` — convert the highest-volume planned session within the next 3 days to `training_type='rest'`, volume 0 | Overreaching needs one real rest day, not a uniform trim across everything. |
| `low_completion` (`< 50%` this week) | `reduce_frequency` — drop the trailing planned sessions of the upcoming week until the planned count matches the athlete's completed count, floored at 2 and at `athlete_profile.dias_disponibles` | Chronic under-completion means the plan is over-prescribed relative to real availability, not that the athlete needs less per session. |

**Invariant: no patch in this change ever increases planned volume, adds a session, or moves a session to an earlier date.** Proposing *more* work off an automated signal is asymmetric risk (injury, not just annoyance) and is out of scope for a first rollout.

Deliberately not acted on in slice 1, each for a stated reason:
- **`high_rpe`** — subjective, single-week, and largely co-fires with `acwr_zone`/`tsb_critical`; acting on it too would double-patch the same physiological event.
- **`acwr_zone` @ caution (1.3–1.5)** — the observation point, not the intervention point (same warning/danger split Agent 2 uses).
- **`acwr_zone` @ undertraining (`< 0.8`)** — would require an upward patch; barred by the invariant above.
- **`engagement_silence`** — an athlete who has been silent 10+ days needs the coach to contact them, not a rewritten plan. Editing the plan of someone not opening the app is noise. This is Agent 4's territory.

**One suggestion per athlete at a time.** When several findings co-fire, the rulebook picks by priority `acwr_zone` danger > `tsb_critical` > `low_completion` and emits a single patch, so two rules never write conflicting edits to the same session.

### D3 — Suggestion lifecycle: pending suggestions expire, they do not linger

New table `plan_adjustment_suggestions`, status `pending | approved | rejected | expired | superseded`. Each row carries the computed patch **and a snapshot of the target sessions' current values**.

| Event | Outcome |
|---|---|
| Triggering alert resolves or is dismissed | `expired` — reactively, not on the next sweep (Agent 2's reactive-resolve precedent). An ACWR that normalises on its own withdraws its own suggestion. |
| The patch's earliest target session date has passed | `expired` — a patch for yesterday is not actionable. |
| A later sweep computes a materially different patch for the same athlete | old row → `superseded`; one `pending` per athlete enforced by a partial unique index on `(athlete_id) WHERE status='pending'`. |
| Coach approves, but a target session's live values differ from the snapshot | Apply is **refused**, row → `superseded`, coach is told the plan changed. |

That last rule is the answer to "will the agent clobber coach intent?" without building a provenance system: the agent does not need to know *who* changed a session, only that it changed since the patch was computed. Application is a single `SECURITY DEFINER` RPC so the whole patch lands atomically or not at all.

### D4 — Minimal provenance: two additive columns, not a system

On `training_sessions`: `adjusted_by_agent boolean NOT NULL DEFAULT false` and `last_adjustment_id uuid` referencing the applied suggestion. Nothing else, no backfill needed — no agent has ever written a session, so `false` is factually correct for every existing row.

Two jobs only: (1) the rulebook skips sessions already adjusted by an approved suggestion for the same finding, so the next sweep cannot immediately propose undoing its own accepted patch; (2) the coach UI can mark an adjusted session. This is explicitly **not** the general provenance model that autonomous writes would need later — it is the minimum that keeps the explore's "zero provenance" gap from widening while this change ships.

### D5 — Kill switch defaults `false`, and the prior inconsistency gets a rule

Agent 1 defaulted `true` (`TRAINING_LOAD_ALERTS_ENABLED`); Agent 2 defaulted `false` (`ENGAGEMENT_ALERTS_ENABLED`), neither justified. The rule this proposal adopts, and that Agent 4 should inherit: **read-only agents may default enabled; any agent whose output can mutate athlete data defaults disabled and is switched on only after a reviewed dry-run.** `PLANNING_SUGGESTIONS_ENABLED` therefore defaults `false`, OR'd with an explicit `dryRun` param into one `effectiveDryRun` flag, exactly as `engagement-monitor` does it.

### D6 — Discovery in the existing merged feed; approval in its own modal

Discovery slots into `alertFeedService.js`'s merged view-model as a third `source: 'plan_suggestion'`. A separate feed would undo Agent 2's D2 mitigation — the coach keeps **one** place to look.

Approval does not: a suggestion mutates data and needs a per-session before/after diff, which a feed row cannot carry. A new `PlanAdjustmentReviewModal.jsx` reuses `AIPlanReviewModal`'s shape (week grid, per-session cards, single confirm action) rather than inventing an interaction. It is a modal, not a new navigational surface.

## Scope

### In Scope

- Migration: `plan_adjustment_suggestions` (+ `_rollback.sql` sibling, CHECK constraints not ENUM) — RLS coach-select via active `coach_athlete_relationship`, `service_role` all, **no athlete self-select** (an athlete must not see a plan cut proposed about them before their coach decides); partial unique index on `(athlete_id) WHERE status='pending'`
- Migration: additive `training_sessions.adjusted_by_agent` + `last_adjustment_id` (D4)
- Migration: `apply_plan_adjustment` `SECURITY DEFINER` RPC — coach-authorized, snapshot-guarded, atomic
- `supabase/functions/_shared/planAdjustmentCore.js` — pure, zero-import: finding→patch rulebook, priority resolution, eligibility/suppression, reduction-only invariant
- `planning-agent` Edge Function: daily `pg_cron` sweep (versioned migration, `CRON_SECRET` Bearer) + reactive `mode` for `acwr_zone` danger inserts; dry-run mode; kill switch
- Reactive expiry: alert resolve/dismiss expires the dependent pending suggestion
- UI: third source in the merged alert feed; `PlanAdjustmentReviewModal.jsx`; adjusted-session marker

### Out of Scope

- **Independent athletes** — no coach exists to approve; a self-approval variant is a different product decision (same exclusion Agent 2 made)
- **Autonomous writes** — deferred until a real provenance model exists; D4 is deliberately not that model
- **Full plan regeneration / any Gemini call** — the 58s/60s wall-clock limit and per-athlete cost make it unviable per trigger; `assignPlanToAthletes`' unscoped delete makes reuse unsafe
- **Fixing `assignPlanToAthletes`** — a real bug (verified: deletes by `plan_id`+`athlete_id` with no status or date filter, wiping completed history), but this change never calls it. Fixing it here would smuggle an unrelated regression risk into an agent PR. Flagged for its own change.
- `high_rpe`, `engagement_silence`, caution-zone and undertraining rules (D2)
- Upward adjustments, cross-block replanning, per-coach configurable rule parameters
- MCP/SDK extraction (Phase 2). Only constraint honoured now: the core module imports nothing from Supabase or the UI.

## Capabilities

### New Capabilities

- `plan-adjustment-rules`: finding→patch rulebook, the three slice-1 rules, adjustment levers, priority resolution, reduction-only invariant, eligibility and suppression
- `plan-adjustment-suggestions`: `plan_adjustment_suggestions` schema, statuses, one-pending-per-athlete dedup, expiry/supersede lifecycle, snapshot-drift guard, RLS visibility
- `planning-agent-runtime`: scheduled sweep + reactive invocation, kill-switch and dry-run semantics, coach approval/apply path, coach-supervised-only routing, `training_sessions` write boundary (writes permitted **only** via the approval RPC)

### Modified Capabilities

- None. `training-load-agent-runtime` and `engagement-agent-runtime` each scope their "MUST NOT write `training_sessions`" requirement to their **own** Edge Function directory, so both remain true after this change. `training-load-alerts`' lifecycle is read by Agent 3, not altered by it.

## Approach

A pure core module maps one selected finding to one deterministic patch over the athlete's remaining future `planned` sessions. An Edge Function owns all I/O and is invoked from two directions, mirroring Agents 1 and 2: a daily `pg_cron` sweep across athletes with an active `coach_athlete_relationship`, plus a fire-and-forget reactive call when an `acwr_zone` danger alert is created — the one finding where waiting a day is materially worse. The function persists a snapshot-carrying `pending` suggestion; delivery is gated by the kill switch. The coach sees it in the existing merged feed, opens a diff modal, and approves — which is the only code path in this repo that calls the apply RPC and the only way any session is written. Incoming alert resolutions expire pending suggestions reactively so the feed never shows a suggestion for a problem that already went away.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `supabase/migrations/` | New | `plan_adjustment_suggestions` + RLS + indexes; `training_sessions` provenance columns; `apply_plan_adjustment` RPC; `pg_cron` job; `_rollback.sql` siblings |
| `supabase/functions/_shared/planAdjustmentCore.js` | New | Pure rulebook, no Supabase/UI imports |
| `supabase/functions/planning-agent/` | New | Sweep + reactive → evaluate → persist suggestion |
| `supabase/functions/training-load-monitor/index.ts` | Modified | Fire-and-forget reactive call on `acwr_zone` danger (`EdgeRuntime.waitUntil`) |
| `src/services/alertFeedService.js` | Modified | Third source in the merged view-model |
| `src/services/planAdjustmentService.js` | New | Read suggestions, approve (RPC), reject |
| `src/components/dashboard/PlanAdjustmentReviewModal.jsx` | New | Diff view + approve/reject, modeled on `AIPlanReviewModal` |
| `src/components/shared/TrainingLoadAlertFeed.jsx` | Modified | Render suggestion rows, open the modal |
| `src/pages/dashboard/AthleteProfile.jsx` | Modified | Mark agent-adjusted sessions |
| `src/services/planningService.js` | Unchanged | Explicitly NOT touched — see Out of Scope |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| An approved patch silently overwrites a coach edit made after the suggestion was computed | Medium | Snapshot-drift guard (D3) refuses the apply and marks it `superseded` |
| First sweep floods coaches with suggestions across the whole roster | High | Kill switch defaults `false` (D5) + dry-run reporting counts before enabling, per Agent 2's precedent |
| The agent re-suggests undoing its own accepted patch on the next sweep | Medium | `adjusted_by_agent` skip rule (D4) plus one-pending-per-athlete dedup |
| ×0.7 / 3-day / floor-of-2 constants are mis-calibrated for this population | Medium | Named constants in the pure core, unit-testable, revisit after a month of approve/reject ratios |
| A `pending` suggestion is applied after its target dates have passed | Medium | Date-based expiry (D3) plus RPC-side re-validation of `scheduled_date > today` |
| Coaches reject everything and the feature is dead weight | Medium | Approve/reject ratio is the primary post-launch metric; three narrow rules rather than a broad rulebook keeps the first read cheap |
| Reactive call slows or breaks `training-load-monitor` | Low | `EdgeRuntime.waitUntil` fire-and-forget; failure must not fail alert creation |
| `supabase/schema.sql` is stale; migrations diverge from live schema | Medium | Verify against live schema before apply; idempotent `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`; no staging branch exists, so verify live after each step |
| An undocumented trigger fires on `training_sessions` during an apply | Medium | Check `information_schema.triggers` on `training_sessions` before the first live approval (documented prior incident) |

## Rollback Plan

1. Set `PLANNING_SUGGESTIONS_ENABLED=false` — no new suggestions, no code revert, no data loss. Already the default.
2. Unschedule the `pg_cron` job and remove the `training-load-monitor` reactive call (fire-and-forget; its absence only delays suggestions).
3. Revert the UI commit. The merged feed degrades to the two-source Agent 1 + Agent 2 feed with no change to their rows.
4. Drop `apply_plan_adjustment` — with the RPC gone, nothing in the repo can write a patch.
5. `plan_adjustment_suggestions` is a new isolated table; apply its `_rollback.sql`.
6. `training_sessions.adjusted_by_agent` / `last_adjustment_id` are additive and nullable — droppable, but safe to leave. **Already-approved patches are not reverted**: they are legitimate coach-approved plan edits, indistinguishable in intent from manual ones, and `last_adjustment_id` records which rows they were.

## Dependencies

- `pg_cron` + `pg_net` (active, proven by Agents 1 and 2)
- `training_load_alerts` producing `acwr_zone`, `tsb_critical`, `low_completion` with the documented severities and lifecycle
- `coach_athlete_relationship` for sweep candidate selection and coach-side RLS
- `athlete_profile.dias_disponibles` populated for the `reduce_frequency` floor; rule degrades to the floor of 2 when absent
- Live schema verification of `training_sessions` columns — DONE 2026-09-01: `rpe_score` confirmed live; `estimated_distance_km` does NOT exist (`supabase/schema.sql` was stale on this point) — `estimated_duration_minutes` is the sole volume lever, D1/D2 corrected accordingly
- No staging Supabase branch: migrations and function deploys go straight to production and are verified live after each step

## Success Criteria

- [ ] No code path outside `apply_plan_adjustment` writes `training_sessions` in this change (verifiable by grep)
- [ ] No suggestion ever increases `estimated_duration_minutes` or the count of planned sessions — zero upward patches exist in the rulebook (verifiable by unit test over the full finding matrix)
- [ ] No suggestion ever targets a session with `status` other than `planned`, or `scheduled_date <= today`
- [ ] An athlete with two co-firing findings receives exactly one pending suggestion, chosen by the documented priority
- [ ] An `acwr_zone` danger alert produces a suggestion without waiting for the next daily sweep
- [ ] An alert resolving on its own expires its pending suggestion, and that suggestion disappears from the coach's feed without a coach action
- [ ] Approving a suggestion whose target session was edited after computation is refused and marked `superseded`, with zero sessions written
- [ ] The sweep immediately after an approved patch produces no suggestion that reverses it
- [ ] No independent athlete ever generates or receives a plan adjustment suggestion
- [ ] No athlete can select any row of `plan_adjustment_suggestions` (verifiable by RLS test with an athlete JWT)
- [ ] The coach sees one merged feed, not two — suggestion rows render alongside Agent 1 and Agent 2 alerts
- [ ] `planAdjustmentCore.js` has no import from Supabase, React, Deno APIs, or any UI code
- [ ] `src/services/planningService.js` is unmodified by this change (verifiable by diff)
- [ ] The enabling dry-run reports how many suggestions the first live sweep would have produced, per rule, and was reviewed before `PLANNING_SUGGESTIONS_ENABLED` was set to `true`

## Proposal question round

The four foundational decisions came from a prior round. Decided here on judgment; flag before `sdd-spec` if you disagree:

1. **The ×0.7 deload factor, the 3-day recovery window, and the floor of 2 sessions** — chosen to be explainable rather than optimal. A coach's instinct on "how much would you actually cut" may differ.
2. **`high_rpe` and `engagement_silence` excluded** — if coaches consider "he's reporting RPE 9 every session" the single most actionable signal, it comes back into slice 1.
3. **Suggestion visibility is coach-only** — an athlete never sees that a cut was proposed, only the applied result. If athletes should see "tu entrenador redujo tu carga", that is a different RLS policy and different copy.
4. **Reductions only** — the agent will never propose adding load, even for a clearly undertrained athlete. If "this athlete can handle more" is a suggestion coaches want, it is a separate, later rule with a different risk profile.

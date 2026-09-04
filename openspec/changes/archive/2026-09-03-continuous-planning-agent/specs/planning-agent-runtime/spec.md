# Planning Agent Runtime Specification

## Purpose

Defines the `planning-agent` Edge Function's triggers, kill-switch and dry-run semantics, the `training_sessions` write boundary, coach-supervised-only routing, and the minimal provenance columns that suppress self-undo.

## Requirements

### Requirement: Hybrid Trigger — Daily Sweep Plus Reactive on acwr_zone Danger Only

`planning-agent` MUST be invoked by a daily `pg_cron` sweep across athletes with an active `coach_athlete_relationship`, and additionally by a reactive call from `training-load-monitor` when, and only when, an `acwr_zone` alert is created at zone danger (carried in `metrics.zone`, never `severity` — `training_load_alerts.severity` is CHECK-constrained to `'warning'`/`'critical'` only, there is no `'danger'` severity value in the schema). No other alert type or zone MUST trigger a reactive invocation.

#### Scenario: Daily sweep evaluates all coach-supervised athletes

- GIVEN the daily `pg_cron` job runs
- WHEN it invokes `planning-agent`'s sweep path
- THEN every athlete with an active `coach_athlete_relationship` is evaluated

#### Scenario: acwr_zone danger triggers a reactive invocation

- GIVEN `training-load-monitor` creates an `acwr_zone` alert at zone danger
- WHEN the alert is persisted
- THEN `planning-agent`'s reactive path is invoked for that athlete before the next sweep

#### Scenario: tsb_critical does not trigger a reactive invocation

- GIVEN `training-load-monitor` creates a `tsb_critical` alert
- WHEN the alert is persisted
- THEN no reactive invocation of `planning-agent` occurs; the athlete is evaluated on the next daily sweep

### Requirement: Kill Switch Defaults False, OR'd with Dry Run

`PLANNING_SUGGESTIONS_ENABLED` MUST default to `false`. The function MUST compute a single `effectiveDryRun` flag as `!PLANNING_SUGGESTIONS_ENABLED OR dryRun`. When `effectiveDryRun` is true, the function MUST evaluate all rules and MUST NOT persist any suggestion row.

#### Scenario: Kill switch off suppresses all persistence

- GIVEN `PLANNING_SUGGESTIONS_ENABLED` is unset (defaults `false`) and `dryRun` is not passed
- WHEN `planning-agent` runs a sweep
- THEN suggestions are evaluated but no row is persisted to `plan_adjustment_suggestions`

#### Scenario: Explicit dry-run suppresses persistence even when enabled

- GIVEN `PLANNING_SUGGESTIONS_ENABLED=true` and the request passes `dryRun=true`
- WHEN `planning-agent` runs
- THEN no suggestion row is persisted, and the run reports counts per rule

### Requirement: training_sessions Write Boundary

`planning-agent`'s sweep and reactive paths MUST NOT write to `training_sessions` under any circumstance. The only code path permitted to write `training_sessions` for a plan adjustment is the `apply_plan_adjustment` RPC, invoked exclusively by an explicit coach approval action.

#### Scenario: Sweep run writes no session

- GIVEN a full daily sweep produces several new suggestions
- WHEN the sweep completes
- THEN no row in `training_sessions` was written by the sweep

#### Scenario: Only the approval RPC writes a session

- GIVEN the repository after this change is applied
- WHEN searching for writes to `training_sessions` originating from a plan adjustment
- THEN the only such write path is the `apply_plan_adjustment` RPC

### Requirement: Coach-Supervised-Only Routing

`planning-agent` MUST evaluate and suggest only for athletes with an active `coach_athlete_relationship`. Independent athletes MUST NOT be evaluated by either trigger path, and MUST NOT receive a suggestion.

#### Scenario: Independent athlete is excluded from the sweep

- GIVEN an independent athlete with no coach and an eligible ACWR/TSB/completion condition
- WHEN the daily sweep runs
- THEN that athlete is not evaluated and no suggestion is produced

#### Scenario: Independent athlete's acwr_zone danger alert does not trigger a reactive call

- GIVEN an independent athlete's `acwr_zone` alert reaches zone danger
- WHEN the alert is created
- THEN `planning-agent`'s reactive path is not invoked for that athlete

### Requirement: Minimal Provenance and Self-Undo Suppression

On approval, `apply_plan_adjustment` MUST set `training_sessions.adjusted_by_agent = true` and `last_adjustment_id` to the applied suggestion's id on every patched session. The rulebook MUST skip a session already marked `adjusted_by_agent = true` for the same finding type when computing the next sweep's patch, so an approved patch is never immediately re-proposed as its own undo.

#### Scenario: Approved patch marks provenance columns

- GIVEN a coach approves a suggestion
- WHEN `apply_plan_adjustment` runs
- THEN every patched session has `adjusted_by_agent = true` and `last_adjustment_id` set to that suggestion's id

#### Scenario: Next sweep does not re-propose reversing an approved patch

- GIVEN a session was patched by an approved `deload_volume` suggestion yesterday and the athlete's `acwr_zone` alert is still open today
- WHEN the next daily sweep evaluates that athlete
- THEN the rulebook does not produce a new suggestion targeting that already-adjusted session for the same finding type

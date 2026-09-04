# Delta for Training Load Agent Runtime

## ADDED Requirements

### Requirement: Reactive Handoff to Planning Agent on ACWR Danger

After `training-load-monitor` persists an `acwr_zone` alert at zone danger (`finding.metrics.zone === 'danger'`, NEVER `finding.severity` — `training_load_alerts.severity` is CHECK-constrained to `'warning'`/`'critical'` only, so a literal `'danger'` severity value never exists in the schema; the ACWR zone lives exclusively in the finding's `metrics.zone` field), it MUST invoke `planning-agent`'s reactive endpoint via `EdgeRuntime.waitUntil` (fire-and-forget), gated on the same race-safe `is_new || escalated` result the push-delivery decision already uses (never the pre-write `decision`) so a same-severity refresh does not re-fire it. No other alert type or zone MUST trigger this call. A failure or slow response from `planning-agent` MUST NOT delay or fail alert creation or delivery, and this invocation MUST NOT itself write to `training_sessions` or regenerate any training plan — it only requests that `planning-agent` evaluate the athlete, consistent with the existing Agent Scope Boundary requirement.

#### Scenario: ACWR zone-danger alert triggers a reactive call to planning-agent

- GIVEN `training-load-monitor` creates an `acwr_zone` alert with `metrics.zone === 'danger'`, and the upsert result is new or escalated
- WHEN the alert row is persisted
- THEN `training-load-monitor` invokes `planning-agent`'s reactive endpoint via `EdgeRuntime.waitUntil`

#### Scenario: Caution-zone alert does not trigger the reactive call

- GIVEN `training-load-monitor` creates an `acwr_zone` alert with `metrics.zone === 'caution'`
- WHEN the alert row is persisted
- THEN no reactive call to `planning-agent` is made

#### Scenario: A duplicate/refresh of an already-open danger episode does not re-trigger the reactive call

- GIVEN `training-load-monitor` upserts an `acwr_zone` alert with `metrics.zone === 'danger'`
- WHEN the upsert RPC's own result reports neither `is_new` nor `escalated` (a same-severity refresh)
- THEN no reactive call to `planning-agent` is made

#### Scenario: planning-agent invocation failure does not affect alert delivery

- GIVEN the reactive call to `planning-agent` fails or times out
- WHEN `training-load-monitor` has already persisted and delivered the `acwr_zone` alert
- THEN the alert record and its delivery are unaffected by that failure

#### Scenario: The handoff itself performs no plan write

- GIVEN `training-load-monitor` invokes `planning-agent` reactively
- WHEN the invocation completes or fails
- THEN `training-load-monitor` performs no write to `training_sessions` and triggers no plan regeneration as part of that invocation

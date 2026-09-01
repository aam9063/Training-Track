# Training Load Agent Runtime Specification

## Purpose

Defines the reactive and scheduled triggers, recompute orchestration, and alert delivery routing for the `training-load-monitor` Edge Function. The agent only recomputes and alerts — it never writes `training_sessions` and never replans.

## Requirements

### Requirement: Reactive Trigger from `strava-webhook`

After `strava-webhook` successfully processes a new or updated activity, it MUST invoke the `training-load-monitor` function via `EdgeRuntime.waitUntil` (fire-and-forget). A failure or slow response from the monitor MUST NOT delay or fail the webhook's response to Strava.

#### Scenario: New activity triggers recompute

- GIVEN `strava-webhook` receives and processes a new activity event
- WHEN processing completes successfully
- THEN `training-load-monitor` is invoked via `EdgeRuntime.waitUntil` for that athlete

#### Scenario: Monitor failure does not break the webhook

- GIVEN `training-load-monitor` throws or times out
- WHEN `strava-webhook` has already sent its response
- THEN the webhook's HTTP response is unaffected by the monitor failure

### Requirement: Scheduled Sweep for Non-Syncing Athletes

A daily `pg_cron` job, declared in a versioned migration, MUST invoke the sweep path of `training-load-monitor` for athletes who did not receive a reactive trigger that day. The endpoint MUST be secured using the `CRON_SECRET` Bearer-token pattern from `cleanup-gym-files`, and MUST reject requests without a valid `CRON_SECRET`.

#### Scenario: Athlete without a same-day sync is swept

- GIVEN an athlete had no Strava activity processed today
- WHEN the daily `pg_cron` sweep runs
- THEN `training-load-monitor` recomputes that athlete's row

#### Scenario: Unauthorized sweep request is rejected

- GIVEN a request to the sweep endpoint without a valid `CRON_SECRET` Bearer token
- WHEN the request is received
- THEN the function returns an authorization error and performs no recomputation

### Requirement: Recompute Orchestration

On any trigger, `training-load-monitor` MUST recompute the athlete's current-day `daily_training_load` row using the canonical core module, persist it with the current `calc_version`, and then evaluate the single alert rulebook against the fresh row.

#### Scenario: End-to-end recompute and alert

- GIVEN a warmed-up athlete whose new activity pushes ACWR into the danger zone
- WHEN `training-load-monitor` runs for that athlete
- THEN `daily_training_load` is updated with the current `calc_version`
- AND an alert is created per the alerts rulebook

#### Scenario: Insufficient history does not crash the function

- GIVEN an athlete with fewer than 126 days of history
- WHEN `training-load-monitor` runs for that athlete
- THEN the row is recomputed and persisted
- AND no alert is created

### Requirement: Agent Scope Boundary

The agent MUST NOT write to `training_sessions` under any trigger path, and MUST NOT create, modify, or trigger regeneration of any training plan. Its only writes are to `daily_training_load` and `training_load_alerts`.

#### Scenario: No writes to training_sessions

- GIVEN the repository after this change is applied
- WHEN searching `supabase/functions/training-load-monitor/` for writes to `training_sessions`
- THEN no such write exists

#### Scenario: Alert emission does not touch planning data

- GIVEN an alert is created for an athlete in the danger zone
- WHEN the alert is created
- THEN no `training_plan`, `mesocycle`, `microcycle`, or `training_sessions` row is created or modified as a side effect

### Requirement: Alert Delivery Routing

Independent athletes MUST be alerted directly (self-alert, no coach in the loop). Coach-supervised athletes' alerts MUST be delivered to their active coach. In-app alert record creation MUST always occur; push delivery via the imported `send-push` function/`send_push_notification` RPC is best-effort and its failure MUST NOT prevent the in-app alert record from being created.

#### Scenario: Independent athlete alert delivered only to the athlete

- GIVEN an independent athlete triggers a danger-zone alert
- WHEN the alert is delivered
- THEN the athlete receives it and no coach is notified

#### Scenario: Coach-supervised athlete alert delivered to the active coach

- GIVEN a coach-supervised athlete triggers a danger-zone alert
- WHEN the alert is delivered
- THEN the athlete's active coach receives it

#### Scenario: Push delivery failure does not block alert creation

- GIVEN the `send-push` call fails or times out
- WHEN an alert is otherwise eligible for creation
- THEN the `training_load_alerts` row is still created

### Requirement: `weekly-ai-reports` Consumes Canonical Values

`weekly-ai-reports` MUST drop its inline ACWR computation and `deriveAlertLevel` logic, and MUST read `daily_training_load` and `training_load_alerts` values instead of recomputing them.

#### Scenario: Weekly report uses stored ACWR

- GIVEN `weekly-ai-reports` runs for an athlete with a current `daily_training_load` row
- WHEN it builds the weekly report
- THEN it reads `acwr`/`chronic_load_28` from the stored row rather than recomputing from raw distances

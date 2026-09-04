# Plan Adjustment Suggestions Specification

## Purpose

Defines the `plan_adjustment_suggestions` table, its lifecycle from `pending` through terminal states, the dedup and drift-guard invariants that prevent it from overwriting coach edits, and its RLS visibility.

## Requirements

### Requirement: Suggestion Schema and Statuses

Each row of `plan_adjustment_suggestions` MUST carry `status` as exactly one of `pending | approved | rejected | expired | superseded`, the computed patch, and a snapshot of the target sessions' current field values at computation time.

#### Scenario: New suggestion is created pending with a snapshot

- GIVEN the rulebook computes a patch for an athlete
- WHEN the suggestion row is persisted
- THEN `status = 'pending'` and the row includes a snapshot of every target session's pre-patch field values

### Requirement: One Pending Suggestion Per Athlete

The system MUST enforce, via a partial unique index on `(athlete_id) WHERE status = 'pending'`, that an athlete has at most one `pending` suggestion at any time.

#### Scenario: Second pending suggestion is rejected by the database

- GIVEN an athlete already has a `pending` suggestion
- WHEN a second `pending` suggestion is attempted for the same athlete
- THEN the insert is rejected by the partial unique index

#### Scenario: Materially different recompute supersedes the prior pending row

- GIVEN an athlete has a `pending` suggestion and a later sweep computes a materially different patch
- WHEN the new suggestion is persisted
- THEN the prior row transitions to `superseded` and the new row becomes the sole `pending` row

### Requirement: Reactive Expiry on Alert Resolution

When the alert that triggered a `pending` suggestion resolves or is dismissed, the suggestion MUST transition to `expired` reactively, not on the next sweep.

#### Scenario: Alert resolving on its own expires its suggestion immediately

- GIVEN a `pending` suggestion whose triggering `acwr_zone` alert is unresolved
- WHEN that alert resolves on its own before the next sweep
- THEN the suggestion transitions to `expired` at the time the alert resolves

#### Scenario: Dismissing the triggering alert also expires the suggestion

- GIVEN a `pending` suggestion whose triggering alert is unresolved
- WHEN a coach dismisses that alert
- THEN the suggestion transitions to `expired`

### Requirement: Date-Based Expiry

A `pending` suggestion whose patch's earliest target session date has passed MUST transition to `expired`.

#### Scenario: Suggestion expires once its earliest target date passes

- GIVEN a `pending` suggestion whose earliest target session `scheduled_date` is today
- WHEN that date passes without coach action
- THEN the suggestion transitions to `expired`

### Requirement: Snapshot-Drift Guard on Apply

When a coach approves a `pending` suggestion, the apply path MUST compare each target session's live field values against the suggestion's snapshot. If any live value differs from the snapshot, the apply MUST be refused, zero sessions MUST be written, and the suggestion MUST transition to `superseded`.

#### Scenario: Matching snapshot applies successfully

- GIVEN a `pending` suggestion whose snapshot matches every target session's current live values
- WHEN a coach approves it
- THEN the patch is applied and the suggestion transitions to `approved`

#### Scenario: Drifted snapshot refuses the apply

- GIVEN a `pending` suggestion whose snapshot no longer matches a target session's current live value
- WHEN a coach approves it
- THEN the apply is refused, no session is written, and the suggestion transitions to `superseded`

### Requirement: RLS Visibility — Coach and Service Role Only

`plan_adjustment_suggestions` MUST enforce coach-select via an active `coach_athlete_relationship` to the suggestion's athlete, and full access for `service_role`. No policy MUST grant athlete self-select.

#### Scenario: Coach sees suggestions for their supervised athlete

- GIVEN a coach has an active relationship with an athlete who has a suggestion
- WHEN the coach queries `plan_adjustment_suggestions`
- THEN the athlete's suggestion is returned

#### Scenario: Athlete cannot select their own suggestion

- GIVEN an athlete has a `pending` suggestion proposing a cut to their plan
- WHEN that athlete queries `plan_adjustment_suggestions` with their own JWT
- THEN no row is returned

#### Scenario: Coach without an active relationship sees nothing

- GIVEN a coach has no active `coach_athlete_relationship` with an athlete who has a suggestion
- WHEN that coach queries `plan_adjustment_suggestions`
- THEN no row for that athlete is returned

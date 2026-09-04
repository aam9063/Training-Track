# Training Load Alerts Specification

## Purpose

Defines the single alert rulebook, severity classification, deduplication, lifecycle, and RLS visibility for `training_load_alerts`, across all four legacy signals (ACWR, TSB, session completion rate, RPE). Replaces the three current, inconsistent rulebooks (`getAcwrZone`, `getAcwrAlertConfig`, `deriveAlertLevel`).

## Requirements

### Requirement: Single Alert Rulebook

Exactly one rulebook module MUST evaluate alert severity across all four signals (ACWR zone, TSB, session completion rate, RPE), reading `daily_training_load` (ACWR, TSB) and `training_sessions` (completion rate, RPE) for the athlete's current evaluation window. `getAcwrZone`, `getAcwrAlertConfig`, and `deriveAlertLevel` MUST be removed and MUST NOT have any surviving independent implementation.

#### Scenario: No duplicate rulebooks remain

- GIVEN the repository after this change is applied
- WHEN searching for alert-severity logic outside the single rulebook
- THEN `getAcwrZone`, `getAcwrAlertConfig`, and `deriveAlertLevel` no longer exist as separate implementations

### Requirement: ACWR Severity Zones

The rulebook MUST classify ACWR (`ewma7(tss)/ewma28(tss)`) into ordered zones using the 0.8 / 1.3 / 1.5 breakpoints: undertraining (`< 0.8`), optimal (`0.8–1.3`), caution (`1.3–1.5`), danger (`> 1.5`). Only caution and danger zones are alert-eligible.

#### Scenario: Danger zone triggers an alert-eligible classification

- GIVEN a warmed-up athlete with `acwr = 1.6`
- WHEN the rulebook evaluates today's row
- THEN the row is classified in the danger zone and is alert-eligible

#### Scenario: Optimal zone is not alert-eligible

- GIVEN a warmed-up athlete with `acwr = 1.0`
- WHEN the rulebook evaluates today's row
- THEN the row is classified optimal and no alert is created

### Requirement: TSB, Completion Rate, and RPE Alert Signals

The rulebook MUST evaluate three additional signals, each single-tier (danger severity only):

| Signal | Source | Threshold |
|---|---|---|
| TSB | `daily_training_load` (`ctl - atl`) | `< -30` |
| Session completion rate | `training_sessions`, current training week (`completed / planned`) | `< 50%` |
| Average RPE | `training_sessions`, current training week (`rpe_score` of completed sessions) | `>= 8.5` |

Completion rate and RPE are new reads from `training_sessions`, not currently consumed by the training-load-monitor function; the design/runtime MUST account for this dependency.

#### Scenario: TSB below -30 triggers a danger alert

- GIVEN a warmed-up athlete with `tsb = -35`
- WHEN the rulebook evaluates today
- THEN a `tsb_critical` alert is created at danger severity

#### Scenario: Completion rate below 50% triggers a danger alert

- GIVEN an athlete with 2 of 6 planned sessions completed this week
- WHEN the rulebook evaluates the current week
- THEN a `low_completion` alert is created at danger severity

#### Scenario: Average RPE at or above 8.5 triggers a danger alert

- GIVEN an athlete with an average RPE of 9.0 this week
- WHEN the rulebook evaluates the current week
- THEN a `high_rpe` alert is created at danger severity

### Requirement: Alert Type Taxonomy and Severity Independence

`training_load_alerts.alert_type` MUST be exactly one of four values, one per signal: `acwr_zone`, `tsb_critical`, `low_completion`, `high_rpe`. Types MUST NOT collapse into one generic type; each signal is evaluated, deduplicated, and lifecycled independently. When two or more signals fire for the same athlete on the same day, severities MUST NOT blend into one combined value — each firing signal produces its own alert row at its own severity, independent of any other signal's state.

#### Scenario: Distinct signals produce distinct, independent alert rows

- GIVEN an athlete whose ACWR is in the danger zone and whose TSB is below -30 on the same day
- WHEN the rulebook evaluates today
- THEN two independent alert rows are created (`acwr_zone` danger, `tsb_critical` danger) and neither severity value is elevated by the other's presence

### Requirement: EWMA Warm-up Suppression

If the core metrics module reports EWMA warm-up as incomplete (fewer than 126 days of history) for an athlete, no `acwr_zone` or `tsb_critical` alert MUST be created for that athlete, because both signals derive from EWMA-based load metrics. `low_completion` and `high_rpe` alerts MUST NOT be suppressed by incomplete warm-up, since they read `training_sessions` independent of EWMA state.
(Previously: suppression applied generically to the ACWR-only rulebook; now scoped explicitly to the two EWMA-derived signals.)

#### Scenario: Danger zone suppressed during warm-up

- GIVEN an athlete with 50 days of history and a computed `acwr = 1.6`
- WHEN the rulebook evaluates today's row
- THEN no `acwr_zone` alert is created because warm-up is incomplete

#### Scenario: TSB signal also suppressed during warm-up

- GIVEN an athlete with 50 days of history and `tsb = -35`
- WHEN the rulebook evaluates today
- THEN no `tsb_critical` alert is created because warm-up is incomplete

#### Scenario: Completion signal is not suppressed during warm-up

- GIVEN an athlete with 50 days of history and a completion rate of 30% this week
- WHEN the rulebook evaluates the current week
- THEN a `low_completion` alert is created despite incomplete warm-up

### Requirement: Current-Day-Only Alert Eligibility

Only the athlete's current-day (or current training week, for completion rate and RPE) evaluation MUST be eligible to emit an alert, across all four signals. Backfilled or historical `daily_training_load` rows MUST NOT emit `acwr_zone` or `tsb_critical` alerts. Recomputing `low_completion` or `high_rpe` for a past week MUST NOT emit an alert.
(Previously: scoped only to `daily_training_load` row backfill; now generalized to all four signals since completion/RPE evaluation is not tied to `daily_training_load` rows.)

#### Scenario: Backfill emits zero alerts

- GIVEN a backfill run recomputing 90 days of historical rows for an athlete
- WHEN the backfill completes
- THEN zero alert rows were created as a result of the backfill

#### Scenario: Today's row remains alert-eligible after backfill

- GIVEN a backfill run that also recomputes today's row
- WHEN today's row lands in the danger zone
- THEN an `acwr_zone` alert is created for today's row only

#### Scenario: Recomputing a past week's completion rate emits no alert

- GIVEN a job recomputes session completion rate for a past training week
- WHEN that past week's completion rate is below 50%
- THEN no `low_completion` alert is created

### Requirement: Deduplication of Ongoing Conditions

The system MUST NOT create a new alert while an unresolved alert already exists for the same `(athlete_id, alert_type)` at the same severity. For `acwr_zone`, a new alert MUST only be created when the ACWR zone changes (escalates or de-escalates into a different alert-eligible zone) relative to the most recent unresolved `acwr_zone` alert, or after that alert is dismissed. For `tsb_critical`, `low_completion`, and `high_rpe` (single-severity, binary signals), a new alert MUST only be created after the prior unresolved alert of that `alert_type` is dismissed. The dedup key MUST be scoped per `(athlete_id, alert_type)`, so an athlete MAY hold multiple concurrent unresolved alerts of different types.
(Previously: dedup key was implicitly per-athlete only, assuming a single ACWR-zone rulebook; now scoped per `(athlete_id, alert_type)` to support four independent signals.)

#### Scenario: Same zone on consecutive days does not duplicate

- GIVEN an unresolved danger-zone `acwr_zone` alert exists for an athlete from yesterday
- WHEN today's row is also classified danger zone
- THEN no new `acwr_zone` alert is created

#### Scenario: Zone escalation creates a new alert

- GIVEN an unresolved caution-zone `acwr_zone` alert exists for an athlete
- WHEN today's row escalates to danger zone
- THEN a new `acwr_zone` alert is created for the danger zone

#### Scenario: Concurrent alert types do not deduplicate against each other

- GIVEN an unresolved `acwr_zone` alert exists for an athlete
- WHEN that athlete's completion rate also drops below 50% the same day
- THEN a new `low_completion` alert is created despite the existing `acwr_zone` alert

### Requirement: Alert Lifecycle

Each alert MUST support `read` and `dismissed` states. Dismissing an alert MUST allow a new alert to be created for the same condition per the deduplication rule.

#### Scenario: Mark alert as read

- GIVEN an unread alert visible to a coach
- WHEN the coach opens it
- THEN the alert is marked read

#### Scenario: Dismissed alert allows re-alerting on same zone

- GIVEN a danger-zone alert has been dismissed
- WHEN the athlete's next processed row is still in the danger zone
- THEN a new alert is created

### Requirement: RLS Visibility

`training_load_alerts` MUST enforce self-select via `(select auth.uid()) = athlete_id`, coach-select via an active `coach_athlete_relationship`, and full access for `service_role`. Independent athletes' alerts MUST NOT be visible to any coach.

#### Scenario: Independent athlete sees only their own alerts

- GIVEN an independent athlete with no coach
- WHEN they query `training_load_alerts`
- THEN only their own alerts are returned

#### Scenario: Coach sees alerts only for actively supervised athletes

- GIVEN a coach with an active relationship to athlete A and no relationship to athlete B
- WHEN the coach queries `training_load_alerts`
- THEN only athlete A's alerts are returned

#### Scenario: Independent athlete's alert is not visible to any coach

- GIVEN an independent athlete's alert exists
- WHEN any coach queries `training_load_alerts`
- THEN that alert is not returned

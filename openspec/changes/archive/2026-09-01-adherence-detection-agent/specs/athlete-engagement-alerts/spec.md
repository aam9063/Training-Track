# Athlete Engagement Alerts Specification

## Purpose

Defines the alert taxonomy, severity tiers, deduplication, lifecycle (creation, escalation, reactive resolve), and RLS visibility for `athlete_engagement_alerts`. Unlike `training_load_alerts`' four independent physiology-derived types, this capability has exactly one alert type driven by the four-source signal-of-life defined in `athlete-engagement-signals`.

## Requirements

### Requirement: Single Alert Type, Severity-Tiered

`athlete_engagement_alerts.alert_type` MUST have exactly one value (`engagement_silence`) for this capability. Escalation between severities MUST update the `severity` field on the existing row; it MUST NOT create a second `alert_type` value or a second row for the same open condition.

#### Scenario: Only one alert_type value exists

- GIVEN the `athlete_engagement_alerts` table after this change is applied
- WHEN inspecting distinct `alert_type` values
- THEN only `engagement_silence` exists

### Requirement: Severity Tiers

Severity MUST be `warning` when `silence_days >= 10` and `danger` when `silence_days >= 21`, per the thresholds computed by `athlete-engagement-signals`.

#### Scenario: 10 days of silence produces a warning alert

- GIVEN a warmed-up, eligible athlete with `silence_days = 10`
- WHEN the evaluation runs
- THEN a `warning`-severity `engagement_silence` alert is created

#### Scenario: 21 days of silence produces a danger alert directly

- GIVEN a warmed-up, eligible athlete with `silence_days = 21` and no prior open alert
- WHEN the evaluation runs
- THEN a `danger`-severity `engagement_silence` alert is created directly, not preceded by a separate warning row

### Requirement: Escalation Reuses the Same Row and Redelivers

When an athlete with an open `warning` alert reaches `silence_days >= 21`, the system MUST update that same row's `severity` to `danger` rather than inserting a new row, and MUST redeliver the alert (in-app update plus a new best-effort push) so the coach is notified of the escalation.

#### Scenario: Warning escalates to danger on the same row

- GIVEN an open `warning` `engagement_silence` alert for an athlete with `silence_days = 15`
- WHEN the next evaluation finds `silence_days = 22` for that athlete
- THEN the existing alert row's severity is updated to `danger`
- AND no second alert row is created
- AND a new delivery (in-app + best-effort push) is sent for the escalation

### Requirement: Danger-to-Warning De-escalation Is Unreachable While Open

For an open alert, `silence_days` is monotonically non-decreasing between evaluations, because any new signal of life fully resolves the alert immediately (per Reactive Resolve Lifecycle) rather than reducing its severity. The system MUST NOT implement a `danger` → `warning` downgrade path for an open alert; the only two transitions for an open alert are `warning` → `danger` (escalation, redelivered) and `open` → `resolved` (reactive resolve, silent). This is a deliberate asymmetry: escalation needs redelivery because the coach's risk assessment changed; de-escalation never occurs mid-alert because any de-escalating signal already fully resolves the condition.

#### Scenario: No downgrade transition exists for an open alert

- GIVEN an open `danger` `engagement_silence` alert for an athlete
- WHEN any new signal of life is recorded for that athlete
- THEN the alert is resolved per Reactive Resolve Lifecycle, not downgraded to `warning`

### Requirement: Never-Started Alert Uses the Same Type With Distinct Copy

When `athlete-engagement-signals` reports the "never started" condition (past warm-up, zero lifetime signals), the alert MUST still use `alert_type = 'engagement_silence'` and the standard severity tiers based on `silence_days` anchored to `start_date`, but MUST carry distinct message copy indicating the athlete never began rather than went quiet, since the coach action (onboarding) differs from re-engagement.

#### Scenario: Never-started athlete receives distinct copy at the same alert_type

- GIVEN an athlete 25 days past warm-up with zero lifetime signals
- WHEN the evaluation runs
- THEN a `danger`-severity `engagement_silence` alert is created
- AND its message content is the "never started" variant, distinct from the standard silence message

### Requirement: Deduplication — At Most One Open Alert Per Athlete

The system MUST enforce at most one row with `status = 'open'` per `(athlete_id, alert_type)` via a partial unique index. Because there is only one `alert_type` value in this capability, this means at most one open engagement alert per athlete at any time.

#### Scenario: Duplicate open alert is prevented

- GIVEN an open `engagement_silence` alert already exists for an athlete
- WHEN the evaluation runs again for that athlete while still silent
- THEN no second open row is created; the existing row is updated in place if severity changed, otherwise left untouched

### Requirement: Reactive Resolve Lifecycle

ANY of the four signal-of-life sources arriving for an athlete with an open `engagement_silence` alert MUST resolve that alert immediately, without waiting for the next scheduled sweep and without the hysteresis delay used by `training_load_alerts`.

#### Scenario: New completed session resolves an open alert

- GIVEN an athlete has an open `engagement_silence` alert
- WHEN a `training_sessions` row for that athlete is marked completed
- THEN the open alert is resolved immediately

#### Scenario: New wellness check-in resolves an open alert

- GIVEN an athlete has an open `engagement_silence` alert
- WHEN a new `wellness_log` entry is recorded for that athlete
- THEN the open alert is resolved immediately

#### Scenario: New Strava activity resolves an open alert

- GIVEN an athlete has an open `engagement_silence` alert
- WHEN the `strava-webhook` records a new activity for that athlete
- THEN the open alert is resolved immediately

#### Scenario: Athlete-sent chat message resolves an open alert

- GIVEN an athlete has an open `engagement_silence` alert
- WHEN that athlete sends a new chat message
- THEN the open alert is resolved immediately

#### Scenario: Coach-sent message does not resolve the alert

- GIVEN an athlete has an open `engagement_silence` alert
- WHEN the athlete's coach sends them a message
- THEN the alert remains open, since a coach-sent message is not a signal of life for the athlete

### Requirement: Coach-Supervised Athletes Only

No independent athlete (one with no active `coach_athlete_relationship`) MUST ever be evaluated, generate, or receive an `engagement_silence` alert.

#### Scenario: Independent athlete is never evaluated

- GIVEN an athlete with no active coach relationship, silent for 40 days
- WHEN the engagement evaluation runs
- THEN no `athlete_engagement_alerts` row is created for that athlete

### Requirement: RLS Visibility

`athlete_engagement_alerts` MUST NOT be self-select. Unlike `training_load_alerts` (physiological facts about an athlete's own training), this capability is a coach-facing management tool about the athlete's disengagement risk — the athlete themselves MUST NOT be able to read it. RLS MUST enforce coach-select via an active `coach_athlete_relationship` and full access for `service_role` only.

**Explicit deviation from the original proposal, confirmed by the user (2026-09-02)**: the proposal's RLS wording implied self-select, mirroring `training_load_alerts`. Design flagged that `TrainingLoadAlertFeed` renders unconditionally on any athlete's own dashboard (`src/pages/athlete/Dashboard.jsx:174-177`, no `isIndependent` gate on that block) — a supervised athlete would otherwise read their own "risk of churn" assessment on their own screen, undermining the capability's purpose (warn the coach before the relationship dies, not confront the athlete with it). The user confirmed coach-only visibility.

#### Scenario: Athlete cannot see their own engagement alert

- GIVEN an engagement alert exists for an athlete
- WHEN that athlete queries `athlete_engagement_alerts`
- THEN no row is returned to them

#### Scenario: Coach sees alerts only for actively supervised athletes

- GIVEN a coach with an active relationship to athlete A and no relationship to athlete B
- WHEN the coach queries `athlete_engagement_alerts`
- THEN only athlete A's alert is returned

#### Scenario: Independent athlete's data is never coach-visible

- GIVEN an independent athlete (out of scope for evaluation; no rows exist for them)
- WHEN any coach queries `athlete_engagement_alerts`
- THEN no row for that athlete is returned, because none was ever created

# Plan Adjustment Rules Specification

## Purpose

Defines the finding→patch rulebook that computes deterministic training-plan adjustments from Agent 1/2 findings: the three slice-1 rules, the adjustment levers available on `training_sessions`, priority resolution when findings co-fire, the reduction-only invariant, and the findings explicitly excluded from this rulebook.

## Requirements

### Requirement: Adjustment Levers Restricted to Persisted Fields

The rulebook MUST express every patch only in terms of fields `training_sessions` durably persists: `estimated_duration_minutes`, `training_type`, `title`, `description`, or removal/skip of a session. The rulebook MUST NOT express a patch as an `intensity` change, since `intensity` is not a `training_sessions` column and exists only in the Gemini plan JSON, discarded at insert. The rulebook MUST NOT reference `estimated_distance_km` — confirmed live (2026-09-01) that this column does not exist on `training_sessions`; `estimated_duration_minutes` is the only pre-completion volume estimate the schema persists.

#### Scenario: No patch references intensity

- GIVEN any patch produced by the rulebook for any finding
- WHEN the patch's field-level changes are inspected
- THEN no change targets an `intensity` field, because none exists on `training_sessions`

### Requirement: Eligible Target Sessions

The rulebook MUST evaluate and patch only sessions where `status = 'planned'` and `scheduled_date > today`, within the athlete's current plan block. Completed and skipped sessions MUST NOT be read as patch targets and MUST NOT be written.

#### Scenario: Completed sessions are never targeted

- GIVEN an athlete has a completed session dated tomorrow due to a schedule change
- WHEN the rulebook computes a patch
- THEN that completed session is excluded from the patch's target set

#### Scenario: Sessions in the past are never targeted

- GIVEN an athlete has a `planned` session with `scheduled_date` equal to yesterday
- WHEN the rulebook computes a patch
- THEN that session is excluded from the patch's target set

### Requirement: acwr_zone Danger Produces a Deload Volume Patch

When an `acwr_zone` finding at zone `danger` (`acwr > 1.5`, carried in `metrics.zone` — see the "Zone vs Severity" note below) is evaluated, the rulebook MUST produce a `deload_volume` patch that scales `estimated_duration_minutes` of every eligible planned session within the next 7 days by a factor of ×0.7.

#### Scenario: Danger-zone ACWR scales the next 7 days by 0.7

- GIVEN an athlete has an unresolved `acwr_zone` alert at zone `danger` and three eligible planned sessions within the next 7 days
- WHEN the rulebook evaluates this finding
- THEN a `deload_volume` patch is produced scaling each of the three sessions' volume fields by ×0.7

#### Scenario: Sessions beyond 7 days are not scaled

- GIVEN an athlete has an unresolved `acwr_zone` alert at zone `danger` and an eligible planned session 10 days out
- WHEN the rulebook evaluates this finding
- THEN the patch does not include that session

### Requirement: tsb_critical Produces an Insert Recovery Patch

When a `tsb_critical` finding (`< -30`) is evaluated, the rulebook MUST produce an `insert_recovery` patch that converts the single highest-volume eligible planned session within the next 3 days to `training_type = 'rest'` (confirmed live 2026-09-01 as the only valid ENUM value for a rest day — not `'descanso'`, which is only ever a client-side draft/UI label, never a value this column actually persists) with volume fields set to 0.

#### Scenario: Highest-volume session within 3 days becomes rest

- GIVEN an athlete has an unresolved `tsb_critical` alert and two eligible planned sessions within the next 3 days, one with higher volume than the other
- WHEN the rulebook evaluates this finding
- THEN the higher-volume session is patched to `training_type = 'rest'` with volume fields set to 0, and the lower-volume session is untouched

#### Scenario: No eligible session within 3 days produces no patch

- GIVEN an athlete has an unresolved `tsb_critical` alert and no eligible planned session within the next 3 days
- WHEN the rulebook evaluates this finding
- THEN no `insert_recovery` patch is produced

### Requirement: low_completion Produces a Reduce Frequency Patch

When a `low_completion` finding (`< 50%` this week) is evaluated, the rulebook MUST produce a `reduce_frequency` patch that drops the trailing eligible planned sessions of the upcoming week until the remaining planned count equals the athlete's completed-session count this week, floored at 2 and at the athlete's available-day count, whichever floor is higher. `athlete_profile.dias_disponibles` is a jsonb map of weekday flags (`{"L":true,"M":false,...}`, one key per day), not an integer — the available-day count MUST be computed as the number of truthy keys (`Object.values(dias_disponibles).filter(Boolean).length`), the same count `OnboardingWizard.jsx` already derives for its own step-4 validation. A missing or empty `dias_disponibles` yields a count of 0, which does not raise the floor above 2.

#### Scenario: Trailing sessions dropped to match completed count

- GIVEN an athlete completed 3 of 7 planned sessions this week and has 5 eligible planned sessions in the upcoming week
- WHEN the rulebook evaluates this finding
- THEN the trailing 2 sessions of the upcoming week are dropped, leaving 3 planned sessions

#### Scenario: Floor of 2 is never crossed

- GIVEN an athlete completed 0 of 7 planned sessions this week and `dias_disponibles` is unset (or empty)
- WHEN the rulebook evaluates this finding
- THEN the patch never reduces the upcoming week's planned session count below 2

#### Scenario: Available-day count raises the floor when higher than 2

- GIVEN an athlete completed 1 of 7 planned sessions this week and `athlete_profile.dias_disponibles` has exactly 3 truthy days
- WHEN the rulebook evaluates this finding
- THEN the patch never reduces the upcoming week's planned session count below 3

### Requirement: Reduction-Only Invariant

No patch produced by the rulebook MUST ever increase `estimated_duration_minutes`, add a session, or move any session to an earlier `scheduled_date`, regardless of the finding evaluated.

#### Scenario: No rule in the matrix proposes an upward change

- GIVEN the full matrix of findings the rulebook can evaluate (`acwr_zone` danger, `tsb_critical`, `low_completion`)
- WHEN each rule's patch is computed against a representative athlete
- THEN none of the resulting patches increases volume, adds a session, or reschedules a session earlier

### Requirement: Priority Resolution on Co-Firing Findings

When more than one alert-eligible finding fires for the same athlete at the same time, the rulebook MUST select exactly one finding by priority order `acwr_zone` danger > `tsb_critical` > `low_completion`, and MUST emit exactly one patch for that athlete.

#### Scenario: acwr_zone danger outranks tsb_critical

- GIVEN an athlete has both an unresolved `acwr_zone` danger alert and an unresolved `tsb_critical` alert
- WHEN the rulebook evaluates this athlete
- THEN only the `deload_volume` patch is produced, and no `insert_recovery` patch is produced for the same run

#### Scenario: tsb_critical outranks low_completion

- GIVEN an athlete has both an unresolved `tsb_critical` alert and an unresolved `low_completion` alert, with no `acwr_zone` danger alert
- WHEN the rulebook evaluates this athlete
- THEN only the `insert_recovery` patch is produced

### Requirement: Excluded Findings

The rulebook MUST NOT produce a patch for `high_rpe`, `engagement_silence`, `acwr_zone` at zone `caution`, or `acwr_zone` at zone `undertraining`, under any circumstance.

#### Scenario: high_rpe alone produces no patch

- GIVEN an athlete has only an unresolved `high_rpe` alert
- WHEN the rulebook evaluates this athlete
- THEN no patch is produced

#### Scenario: engagement_silence alone produces no patch

- GIVEN an athlete has only an unresolved `engagement_silence` alert
- WHEN the rulebook evaluates this athlete
- THEN no patch is produced

#### Scenario: acwr_zone caution alone produces no patch

- GIVEN an athlete has only an unresolved `acwr_zone` alert at zone `caution`
- WHEN the rulebook evaluates this athlete
- THEN no patch is produced

#### Scenario: acwr_zone undertraining alone produces no patch

- GIVEN an athlete has only an unresolved `acwr_zone` alert at zone `undertraining`
- WHEN the rulebook evaluates this athlete
- THEN no patch is produced

### Requirement: Zone vs Severity (schema correction, 2026-09-01)

`training_load_alerts.severity` is CHECK-constrained to `'warning'`/`'critical'` only
(`supabase/migrations/20260819142000_training_load_alerts.sql`) — there is no literal
`'danger'` severity value anywhere in the schema. The acwr zone (`'danger'` / `'caution'` /
`'optimal'` / `'undertraining'`) is carried exclusively in `training_load_alerts.metrics.zone`
(produced by `trainingLoadCore.js`'s `acwrZone()`). Every scenario above that refers to an
`acwr_zone` finding "at zone X" means `finding.metrics.zone === 'X'`; the rulebook's
`resolveFinding()` MUST gate `acwr_zone` eligibility on `metrics.zone`, never on `severity`.

#### Scenario: acwr_zone eligibility reads metrics.zone, not severity

- GIVEN an `acwr_zone` finding whose `severity` is `'critical'` (the only value the schema
  allows when the zone is `danger`) and whose `metrics.zone` is `'danger'`
- WHEN the rulebook resolves this finding
- THEN it is treated as zone-`danger` and produces a `deload_volume` patch

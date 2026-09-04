# Delta for Training Load Alerts

## MODIFIED Requirements

### Requirement: TSB, Completion Rate, and RPE Alert Signals

The rulebook MUST evaluate three additional signals, each single-tier (danger severity only):

| Signal | Source | Threshold |
|---|---|---|
| TSB | `daily_training_load` (`ctl - atl`) | `< -30` |
| Session completion rate | `training_sessions`, current training week (`completed / planned`) | `< 50%` |
| Average RPE | `training_sessions`, current training week (`rpe_score` of completed sessions) | `>= 8.5` |

Completion rate and RPE are new reads from `training_sessions`, not currently consumed by the training-load-monitor function; the design/runtime MUST account for this dependency.

`low_completion` measures a single training week's `completed / planned` ratio only. It MUST NOT be conflated with, and MUST NOT be presented as, multi-week engagement or churn detection — that is the distinct concern of `athlete-engagement-alerts`. The user-facing label for `low_completion` MUST read "Cumplimiento semanal" and MUST NOT read "Adherencia" or any other term implying multi-week engagement.
(Previously: no terminology or labeling constraint existed; `low_completion` had no defined user-facing label, and the word "adherencia" was used ambiguously in the UI for this signal.)

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

#### Scenario: low_completion label reads "Cumplimiento semanal"

- GIVEN a `low_completion` alert is rendered in the UI
- WHEN a coach views the alert feed
- THEN the label reads "Cumplimiento semanal" and never "Adherencia"

#### Scenario: low_completion is never presented as engagement/churn risk

- GIVEN a `low_completion` alert and an `engagement_silence` alert both exist for the same coach's roster
- WHEN a coach views either alert
- THEN their labels and descriptions do not overlap in wording, and `low_completion`'s copy makes no claim about multi-week engagement

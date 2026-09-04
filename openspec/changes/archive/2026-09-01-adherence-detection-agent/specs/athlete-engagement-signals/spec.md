# Athlete Engagement Signals Specification

## Purpose

Defines the signal-of-life computation underlying engagement detection: the four source signals, their OR-blend into a single last-seen timestamp, the resulting silence-day count, and the eligibility rules (warm-up, zero-planned-sessions suppression, never-started edge case) that gate whether an athlete is evaluated at all. This module is pure — no Supabase, React, or UI imports — and is consumed by `athlete-engagement-alerts` and `engagement-agent-runtime`.

## Requirements

### Requirement: Signal-of-Life Sources

The system MUST compute an athlete's most recent signal of life as the maximum timestamp across exactly four sources: `training_sessions.completed_at` (session marked completed — the current write path never sets this column on a skip, so a skip event alone does not update the signal), the most recent `wellness_log` entry, `strava_activities.start_date_local`, and the most recent `chat_messages` row sent BY the athlete (not the coach). No other source, including `users.last_login`, MUST contribute to this computation.

#### Scenario: Most recent source determines last-seen timestamp

- GIVEN an athlete with a completed session 5 days ago, a wellness entry 3 days ago, no Strava connection, and no chat messages
- WHEN signal-of-life is computed
- THEN the last-seen timestamp is the wellness entry from 3 days ago

#### Scenario: Athlete-sent chat message counts as a signal

- GIVEN an athlete whose only recent activity is a chat message they sent to their coach yesterday
- WHEN signal-of-life is computed
- THEN yesterday's message timestamp is used as the last-seen signal

#### Scenario: Coach-sent messages do not count as the athlete's signal

- GIVEN a coach sends a message to an athlete today, and the athlete's last own activity was 15 days ago
- WHEN signal-of-life is computed for that athlete
- THEN the last-seen timestamp remains 15 days ago, unaffected by the coach's message

### Requirement: Missing Source Coverage Must Never Produce a False Positive

Coverage across the four sources is uneven by design (not every athlete uses Strava or sends chat messages). The absence of any one source MUST NOT be treated as a negative signal or shorten the computed last-seen time. The OR-blend MUST use only sources that have data for that athlete; a source with zero rows MUST simply be excluded from the max(), never substituted with a value that increases silence.

#### Scenario: Athlete without Strava is judged only on other sources

- GIVEN an athlete who has never connected Strava but completes sessions weekly
- WHEN signal-of-life is computed
- THEN the absence of Strava data does not affect the computed `silence_days`, which is based on the completed sessions alone

### Requirement: Silence Day Computation

`silence_days` MUST be computed as the number of whole days between today and the athlete's signal-of-life timestamp (`silence_days = today − max(all four sources)`).

#### Scenario: Silence days computed from most recent signal

- GIVEN an athlete's most recent signal of life was exactly 12 days ago
- WHEN `silence_days` is computed
- THEN `silence_days = 12`

### Requirement: Warm-Up Exclusion

An athlete whose `coach_athlete_relationship.start_date` is less than 21 days before today MUST NOT be evaluated for engagement at all — excluded from evaluation entirely, not merely suppressed post-evaluation.

#### Scenario: Newly supervised athlete is never evaluated

- GIVEN an athlete whose coach relationship started 10 days ago
- WHEN the engagement evaluation runs
- THEN that athlete is skipped entirely, regardless of their `silence_days`

#### Scenario: Athlete exactly at the warm-up boundary is evaluated

- GIVEN an athlete whose coach relationship started exactly 21 days ago
- WHEN the engagement evaluation runs
- THEN that athlete is evaluated normally

### Requirement: Zero-Planned-Sessions Suppression

An athlete with zero planned `training_sessions` in the observation window MUST NOT be evaluated as silent, regardless of their computed `silence_days`. This reflects the coach not having planned anything, not the athlete disengaging.

#### Scenario: Athlete with no planned sessions is never alerted

- GIVEN an athlete with `silence_days = 30` but zero planned sessions in the observation window
- WHEN the engagement evaluation runs
- THEN no alert-eligible condition is produced for that athlete

#### Scenario: Athlete with at least one planned session is evaluated normally

- GIVEN an athlete with `silence_days = 30` and at least one planned session in the observation window
- WHEN the engagement evaluation runs
- THEN the athlete is evaluated against the silence tiers

### Requirement: Never-Started Edge Case

An athlete past the warm-up window with zero lifetime signals across all four sources MUST be treated as a distinct "never started" condition rather than an ordinary silence escalation. `silence_days` for this case MUST be anchored to `coach_athlete_relationship.start_date`, since there is no signal timestamp to anchor to.

#### Scenario: Athlete past warm-up with zero lifetime signals

- GIVEN an athlete whose coach relationship started 30 days ago and who has never completed a session, logged wellness, connected Strava, or sent a chat message
- WHEN the engagement evaluation runs
- THEN the athlete is flagged as "never started" with `silence_days = 30`, anchored to their `start_date`

#### Scenario: Athlete with at least one lifetime signal is never flagged as never-started

- GIVEN an athlete who sent one chat message 40 days ago and has had no signal since
- WHEN the engagement evaluation runs
- THEN the athlete is evaluated under ordinary silence tiering, not the "never started" case

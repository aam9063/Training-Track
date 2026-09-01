# Session Completion Specification

## Purpose

Define how independent athletes manually complete sessions and provide post-session feedback.

## DB Schema Changes

| Change | Table | Column/Detail |
|--------|-------|---------------|
| ADD column | `training_sessions` | `completed_at TIMESTAMPTZ NULL` |
| ADD column | `training_sessions` | `actual_distance_km NUMERIC NULL` |
| ADD column | `training_sessions` | `actual_time_minutes NUMERIC NULL` |
| ADD column | `training_sessions` | `rpe SMALLINT NULL CHECK (rpe BETWEEN 1 AND 10)` |
| ADD column | `training_sessions` | `completion_notes TEXT NULL` |

## Requirements

### Requirement: Manual Session Completion

Each training session MUST have a "Marcar Completado" action. Clicking it MUST open a `SessionCompletionModal` with fields: distancia (km), tiempo (minutes), RPE (1-10 scale), notas. Only distancia and RPE are REQUIRED; tiempo and notas are optional.

#### Scenario: Complete session with all fields

- GIVEN an independent athlete views an uncompleted session
- WHEN they click "Marcar Completado" and fill distance=10, time=55, RPE=6, notes="Buen ritmo"
- THEN `completed_at` is set to current timestamp
- AND `actual_distance_km=10`, `actual_time_minutes=55`, `rpe=6`, `completion_notes="Buen ritmo"` are saved

#### Scenario: Complete session with minimum fields

- GIVEN an athlete clicks "Marcar Completado"
- WHEN they fill only distance=5 and RPE=4
- THEN the session is marked complete with those values
- AND `actual_time_minutes` and `completion_notes` remain NULL

### Requirement: Post-Session RPE Feedback

After completing a session, the system SHOULD show a brief feedback prompt: "Como te sentiste?" with options Facil (RPE 1-3), Normal (RPE 4-5), Duro (RPE 6-7), Muy duro (RPE 8-10). This MAY be shown instead of the numeric RPE for beginners.

#### Scenario: Quick RPE via feeling labels

- GIVEN a beginner athlete completes a session
- WHEN the feedback prompt appears
- THEN they can select "Duro" which maps to RPE 7
- AND the session is saved with `rpe=7`

### Requirement: Strava Auto-Completion Compatibility

Existing Strava webhook auto-completion MUST continue to work for independent athletes who connect Strava. The webhook SHOULD populate `actual_distance_km` and `actual_time_minutes` from the Strava activity. Manual completion MUST remain available as fallback.

#### Scenario: Strava auto-completes for independent athlete

- GIVEN an independent athlete with Strava connected completes a run
- WHEN the Strava webhook fires
- THEN the matching `training_session` is updated with `completed_at`, `actual_distance_km`, `actual_time_minutes`
- AND the session shows as completed in the UI

#### Scenario: Manual override after Strava completion

- GIVEN a session was auto-completed by Strava
- WHEN the athlete opens the completion modal
- THEN they can add/edit RPE and notes (Strava does not provide these)

### Requirement: Completion State Display

Completed sessions MUST be visually distinguished from pending sessions (e.g., green badge, checkmark icon). The calendar and session list views MUST reflect completion status.

#### Scenario: Visual distinction on calendar

- GIVEN 3 of 5 sessions this week are completed
- WHEN the athlete views the calendar
- THEN completed sessions show a green "Completado" badge
- AND pending sessions show no completion indicator

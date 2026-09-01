# Mi Plan Specification

## Purpose

Define the AI-powered plan generation and management page for independent athletes at `/athlete/my-plan`.

## Requirements

### Requirement: Onboarding Gate

When an independent athlete visits Mi Plan with an incomplete `athlete_profile`, the system MUST show the onboarding wizard (reuse existing `OnboardingWizard`). The "Generar Plan" action MUST NOT be available until the profile is complete.

#### Scenario: First visit without profile

- GIVEN an independent athlete with no `athlete_profile` record
- WHEN they navigate to `/athlete/my-plan`
- THEN the OnboardingWizard is displayed
- AND the plan generation button is hidden

#### Scenario: Profile already complete

- GIVEN an independent athlete with a complete profile
- WHEN they navigate to `/athlete/my-plan`
- THEN the plan view is displayed with a "Generar Plan" button

### Requirement: AI Plan Generation (Self-Trigger)

Independent athletes MUST be able to trigger `generate-ai-plan` Edge Function using their own JWT. The Edge Function MUST accept dual auth: coach JWT (existing) OR independent athlete JWT (new path). When called by an independent athlete, `athlete_id` MUST equal the caller's `user_id`.

#### Scenario: Independent athlete generates first plan

- GIVEN an independent athlete with a complete profile and no active plan
- WHEN they click "Generar Plan"
- THEN the system calls `generate-ai-plan` with the athlete's own JWT
- AND a 4-week plan (3 load + 1 deload) is created and auto-assigned
- AND training sessions appear on the calendar

#### Scenario: Edge Function rejects cross-user generation

- GIVEN an independent athlete calls `generate-ai-plan` with a different `athlete_id`
- WHEN the function validates the request
- THEN it returns 403 Forbidden

### Requirement: Auto-Assignment Without Review

When an independent athlete generates a plan, it MUST be auto-assigned directly (no `AIPlanReviewModal`). The plan MUST flow through the existing pipeline: `training_plans` -> `mesocycles` -> `microcycles` -> `plan_assignments` -> `training_sessions`.

#### Scenario: Plan auto-assigns to calendar

- GIVEN plan generation completes successfully
- WHEN the athlete views their calendar
- THEN 4 weeks of training sessions are visible starting from the assignment date

### Requirement: Plan Regeneration

The Mi Plan page MUST offer a "Regenerar Plan con IA" button when an active plan exists. Regeneration SHOULD use completion data and RPE feedback from the previous cycle to improve the next plan.

#### Scenario: Regenerate with historical data

- GIVEN an independent athlete completed 3 of 4 weeks with avg RPE of 7
- WHEN they click "Regenerar Plan con IA"
- THEN the AI receives completion rate and RPE data as context
- AND a new 4-week plan is generated and auto-assigned

### Requirement: Plan Display

Mi Plan MUST show the current active plan with a weekly view: day-by-day sessions with type, distance, and description. It SHOULD show plan history (past plans) in a collapsible section.

#### Scenario: View active plan

- GIVEN an independent athlete with an active 4-week plan
- WHEN they view Mi Plan
- THEN they see the current week's sessions with type, distance, and description
- AND can navigate between the 4 weeks

### Requirement: Beginners with Zero Data

For athletes with profile-only data (no Strava, no history), the AI MUST generate a conservative plan. The plan SHOULD include a "Basado en tu perfil" label. After 2+ weeks of completion data, the system SHOULD recommend plan regeneration.

#### Scenario: Zero-data beginner plan

- GIVEN an independent athlete with profile only (no Strava, no completion history)
- WHEN they generate their first plan
- THEN the plan uses conservative distances and paces based on profile data
- AND displays a "Basado en tu perfil" indicator

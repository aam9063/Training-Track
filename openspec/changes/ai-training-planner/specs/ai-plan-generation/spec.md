# AI Plan Generation Specification

## Purpose

Edge Function that generates a structured training plan using DeepSeek, adapting intelligence level to available athlete data. Coach reviews and edits the plan before assigning via existing system.

## Requirements

### REQ-GEN-1: Edge Function Contract

The `generate-ai-plan` Edge Function MUST accept POST with `{ athlete_id }` (+ coach JWT). It MUST return a JSON plan or an error object.

**Output schema** (success):

```json
{
  "plan_name": "string",
  "duration_weeks": 4,
  "tier": "full|mixed|profile_heavy|profile_only",
  "weeks": [
    {
      "week_number": 1,
      "sessions": [
        {
          "day": "L",
          "title": "string",
          "description": "string",
          "training_type": "carrera|gimnasio|descanso",
          "estimated_distance_km": 8.0
        }
      ]
    }
  ]
}
```

#### Scenario: Successful generation with full data

- GIVEN an athlete with 90+ days of Strava data and a complete profile
- WHEN the coach calls `generate-ai-plan` with the athlete_id
- THEN the function returns a 4-week plan with `tier: "full"`
- AND sessions respect the athlete's `dias_disponibles`

#### Scenario: Auth failure

- GIVEN a user with no coach relationship to the athlete
- WHEN they call `generate-ai-plan`
- THEN HTTP 403 is returned

### REQ-GEN-2: Progressive Intelligence Tiers

The function MUST determine the tier based on Strava activity count in the last 90 days:

| Strava days (90d) | Tier | Behavior |
|-------------------|------|----------|
| 90+ activities | `full` | Plan driven by real training data |
| 30-89 activities | `mixed` | Data + profile equally weighted |
| 1-29 activities | `profile_heavy` | Profile primary, data supplementary |
| 0 activities | `profile_only` | 100% profile, conservative volumes |

#### Scenario: Profile-only tier

- GIVEN an athlete with 0 Strava activities
- WHEN plan is generated
- THEN tier is `profile_only`
- AND weekly km MUST NOT exceed `athlete_profile.km_semanales * 1.1`

#### Scenario: Mixed tier

- GIVEN an athlete with 45 Strava activities in 90 days
- WHEN plan is generated
- THEN tier is `mixed`

### REQ-GEN-3: Data Aggregation

The function MUST aggregate (not send raw rows) Strava data as weekly summaries (total km, avg pace, session count) to stay within token limits. It MUST include upcoming `competitions` within the plan window.

#### Scenario: Token-safe aggregation

- GIVEN an athlete with 120 Strava activities in 90 days
- WHEN building the AI prompt
- THEN activities are summarized as weekly aggregates (max ~13 weekly rows)

### REQ-GEN-4: Respect Athlete Constraints

The generated plan MUST only schedule sessions on days marked available in `dias_disponibles`. It SHOULD include gym sessions only if `acceso_gimnasio` is true. It MUST include a rest day if the athlete has fewer than 7 available days.

#### Scenario: Gym access false — no gym sessions

- GIVEN an athlete profile with `acceso_gimnasio: false`
- WHEN plan is generated
- THEN no sessions have `training_type: "gimnasio"`

### REQ-GEN-5: Error Handling

On DeepSeek parse failure, the function MUST retry once. On second failure, return HTTP 502 with `{ error: "ai_generation_failed" }`. On timeout (>25s), return HTTP 504.

#### Scenario: Malformed AI response — retry succeeds

- GIVEN DeepSeek returns invalid JSON on first attempt
- WHEN the function retries
- THEN the second valid response is returned to the coach

#### Scenario: Both attempts fail

- GIVEN DeepSeek returns invalid JSON twice
- THEN HTTP 502 with error code `ai_generation_failed` is returned

### REQ-REV-1: Plan Review Modal

The coach MUST see the AI-generated plan in an editable modal/panel before assignment. Each session's title, description, type, and distance MUST be editable. The coach MUST be able to delete or add sessions.

#### Scenario: Edit a session before confirming

- GIVEN the AI plan review modal is open
- WHEN the coach changes a session's title and distance
- THEN the modified values are reflected in the preview

#### Scenario: Confirm plan

- GIVEN the coach has reviewed (and optionally edited) the plan
- WHEN they click "Asignar Plan"
- THEN the plan is saved via the existing planning system (training_plan + mesocycles + microcycles)
- AND training_sessions are created for the athlete

#### Scenario: Discard plan

- GIVEN the review modal is open
- WHEN the coach clicks "Descartar"
- THEN no data is saved and the modal closes

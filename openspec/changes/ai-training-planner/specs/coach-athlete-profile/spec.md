# Coach Athlete Profile View Specification

## Purpose

Display the athlete's onboarding profile data to the coach in a read-only "Perfil Deportivo" section on the existing AthleteProfile page, with the entry point for AI plan generation.

## Requirements

### REQ-CAP-1: Perfil Deportivo Section

The AthleteProfile page (`/dashboard/athlete/:id`) MUST display a "Perfil Deportivo" section showing all `athlete_profile` data for the athlete. The section MUST be read-only for the coach.

#### Scenario: Athlete has completed onboarding

- GIVEN a coach viewing `/dashboard/athlete/:id`
- WHEN the athlete has an `athlete_profile` row
- THEN the "Perfil Deportivo" section displays all profile fields grouped logically (identity, physical, focus, availability, engine)

#### Scenario: Athlete has not completed onboarding

- GIVEN a coach viewing `/dashboard/athlete/:id`
- WHEN the athlete has no `athlete_profile` row
- THEN a message "El atleta aun no ha completado su perfil" is shown
- AND the "Generar Plan con IA" button is disabled with a tooltip explaining why

### REQ-CAP-2: Generar Plan con IA Button

The section MUST include a "Generar Plan con IA" button. The button MUST be enabled only when `athlete_profile` exists. Clicking it MUST trigger the AI plan generation flow.

#### Scenario: Generate plan — profile exists

- GIVEN a coach viewing an athlete with a completed profile
- WHEN they click "Generar Plan con IA"
- THEN the AI plan generation is initiated (calls Edge Function)
- AND a loading state is shown

#### Scenario: Generate plan — no Strava data

- GIVEN an athlete with profile but 0 Strava activities
- WHEN the coach clicks "Generar Plan con IA"
- THEN generation proceeds using profile-only tier
- AND a badge "Basado en perfil" is shown on the result

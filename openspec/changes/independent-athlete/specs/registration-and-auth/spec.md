# Registration & Auth Specification

## Purpose

Define how independent athletes register, authenticate, and how the `isIndependent` flag propagates through the system.

## DB Schema Changes

| Change | Table | Column/Detail |
|--------|-------|---------------|
| ADD column | `users` | `is_independent BOOLEAN DEFAULT false NOT NULL` |
| MODIFY column | `training_sessions` | `coach_id` becomes NULLABLE |
| MODIFY column | `competitions` | `coach_id` becomes NULLABLE |
| ADD RLS | `training_sessions` | Independent athlete can SELECT/INSERT/UPDATE/DELETE own rows where `coach_id IS NULL AND athlete_id = auth.uid()` |
| ADD RLS | `competitions` | Independent athlete can CRUD own rows where `coach_id IS NULL AND athlete_id = auth.uid()` |
| ADD RLS | `training_plans` | Independent athlete can CRUD own plans where creator is self |

## Requirements

### Requirement: Independent Registration Option

The registration page MUST display an "Atleta Independiente" card alongside existing Coach and Athlete options. Selecting it MUST set `role = 'athlete'` and `is_independent = true` in Supabase user metadata. The coach email field MUST NOT appear for independent registration.

#### Scenario: Successful independent registration

- GIVEN the user is on the registration page
- WHEN they select "Atleta Independiente" and submit valid email + password
- THEN a new user is created with `role = 'athlete'` and `is_independent = true` in metadata
- AND the user is redirected to `/athlete/dashboard`

#### Scenario: Independent registration skips coach email

- GIVEN the user selects "Atleta Independiente"
- WHEN the registration form renders
- THEN the "Email del entrenador" field MUST NOT be displayed

### Requirement: AuthContext Exposes isIndependent

AuthContext MUST expose an `isIndependent` boolean derived from user metadata. It MUST be `false` for coached athletes and coaches. It MUST be available alongside existing `isAthlete` and `isCoach` flags.

#### Scenario: Independent athlete context

- GIVEN a logged-in user with `is_independent = true`
- WHEN any component reads AuthContext
- THEN `isAthlete` is `true` AND `isIndependent` is `true` AND `isCoach` is `false`

#### Scenario: Coached athlete context unchanged

- GIVEN a logged-in coached athlete (`is_independent = false`)
- WHEN any component reads AuthContext
- THEN `isAthlete` is `true` AND `isIndependent` is `false`

### Requirement: Login Redirect

Independent athletes MUST be redirected to `/athlete/dashboard` after login, same as coached athletes. No separate redirect path.

#### Scenario: Independent athlete login

- GIVEN an independent athlete enters valid credentials
- WHEN login completes
- THEN they are redirected to `/athlete/dashboard`

### Requirement: RLS Policy Isolation

RLS policies MUST ensure independent athletes can only access their own data. They MUST NOT be able to read or modify other users' sessions, plans, or competitions.

#### Scenario: Cross-user data isolation

- GIVEN independent athlete A has training sessions
- WHEN independent athlete B queries training_sessions
- THEN athlete B sees zero rows belonging to athlete A

#### Scenario: Independent athlete self-access

- GIVEN an independent athlete with `coach_id IS NULL` sessions
- WHEN they query their own training_sessions
- THEN they see all their own rows

# Athlete Onboarding Specification

## Purpose

Full-screen wizard that captures an athlete's profile data on first login, blocking dashboard access until complete. Data stored in `athlete_profile` table.

## Data Model: `athlete_profile`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid PK | no | default gen_random_uuid() |
| user_id | uuid FK → auth.users | no | unique, on delete cascade |
| nombre | text | no | |
| sexo | text | no | 'M' or 'F' |
| fecha_nacimiento | date | no | |
| peso_kg | numeric(5,1) | yes | |
| altura_cm | integer | yes | |
| modalidad | text | no | enum: '800m','1500m','5K','10K','media_maraton','maraton','trail' |
| objetivo | text | no | enum: 'empezar','completar','mejorar_marca','salud' |
| marca_actual | text | yes | free text, e.g. "3:52" or "1h28" |
| competicion_objetivo | text | yes | |
| competicion_fecha | date | yes | |
| dias_disponibles | jsonb | no | e.g. {"L":true,"M":false,...,"D":true} |
| horas_por_dia | jsonb | yes | e.g. {"L":1.5,"X":1,"S":2} (only selected days) |
| acceso_gimnasio | boolean | no | default false |
| acceso_pista | boolean | no | default false |
| km_semanales | numeric(5,1) | no | 0-120+ |
| ritmo_comodo | text | yes | min/km or null ("no sé") |
| fc_max | integer | yes | |
| vo2max | numeric(4,1) | yes | |
| lesiones | text | yes | free text |
| created_at | timestamptz | no | default now() |
| updated_at | timestamptz | no | default now() |

### RLS Policies

| Policy | Role | Action | Rule |
|--------|------|--------|------|
| athlete_own | athlete | ALL | `user_id = (select auth.uid())` |
| coach_read | coach | SELECT | `user_id IN (select athlete_id from coach_athlete_relationship where coach_id = (select auth.uid()) and status = 'active')` |

## Requirements

### REQ-ONB-1: Wizard Gate

The system MUST show the onboarding wizard at `/athlete` when the authenticated athlete has no `athlete_profile` row. The system MUST NOT allow navigation to any athlete page until the wizard is completed.

#### Scenario: First login — no profile

- GIVEN an authenticated athlete with no `athlete_profile` row
- WHEN they navigate to `/athlete`
- THEN the full-screen onboarding wizard is displayed
- AND the sidebar/nav is hidden

#### Scenario: Returning athlete — profile exists

- GIVEN an authenticated athlete with an existing `athlete_profile`
- WHEN they navigate to `/athlete`
- THEN the normal athlete dashboard is shown

### REQ-ONB-2: Wizard Steps

The wizard MUST present 5 sequential steps: Identidad, Fisico, Tu Enfoque, Disponibilidad, Tu Motor. Each step MUST validate required fields before allowing Next. The user SHOULD be able to go Back without losing data.

#### Scenario: Step validation — missing required field

- GIVEN the athlete is on step "Identidad"
- WHEN they click "Siguiente" without filling nombre
- THEN a validation error is shown on the nombre field
- AND the wizard stays on step 1

#### Scenario: Navigate back preserves data

- GIVEN the athlete completed step 1 and is on step 2
- WHEN they click "Atras"
- THEN step 1 is shown with previously entered data intact

### REQ-ONB-3: Wizard Completion

On the final step, the system MUST save all data to `athlete_profile` in a single insert. On success, the wizard MUST redirect to the athlete dashboard.

#### Scenario: Successful completion

- GIVEN the athlete has filled all required fields across all 5 steps
- WHEN they click "Completar" on step 5
- THEN an `athlete_profile` row is created with all entered data
- AND the athlete is redirected to `/athlete` (dashboard view)

#### Scenario: Save failure

- GIVEN the athlete clicks "Completar"
- WHEN the Supabase insert fails (network error, RLS violation)
- THEN an error toast is shown
- AND the wizard remains on step 5 with data intact

### REQ-ONB-4: Disponibilidad Step Logic

The system MUST show day toggles (L-M-X-J-V-S-D). When a day is selected, the system SHOULD show an hours input for that day. The system MUST require at least 1 day selected.

#### Scenario: No days selected

- GIVEN the athlete is on step "Disponibilidad"
- WHEN no days are toggled on and they click "Siguiente"
- THEN validation error "Selecciona al menos 1 dia" is shown

### REQ-ONB-5: Optional Fields

The fields marca_actual, competicion_objetivo, competicion_fecha, ritmo_comodo, fc_max, vo2max, and lesiones MAY be left empty. The system MUST save null for unfilled optional fields.

#### Scenario: Minimal profile (only required fields)

- GIVEN the athlete fills only required fields and leaves all optional blank
- WHEN they complete the wizard
- THEN the profile is saved with nulls for optional columns

# Design: AI Training Planner

## Technical Approach

Three additive layers: (1) `athlete_profile` table + onboarding wizard for athletes, (2) `generate-ai-plan` Edge Function following the `generate-ai-report` pattern, (3) coach-side review modal on AthleteProfile page that feeds confirmed plans into the existing `planningService.assignPlanToAthletes` flow.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Wizard placement | Full-screen overlay at `/athlete` route when no `athlete_profile` row exists | Separate `/onboarding` route; modal on dashboard | Keeps routing simple; athlete cannot skip; no new route needed — just a conditional render in the athlete layout |
| Form library | React Hook Form + Zod | Uncontrolled / useState | Already in `config.yaml` stack; validation rules are complex (conditional fields per modality) |
| Edge Function data aggregation | Server-side in Edge Function (queries all sources) | Client aggregates then sends payload (like `generate-ai-report`) | `generate-ai-report` sends pre-aggregated data from client — but for plan generation we need heavier queries (90d Strava, exercise bank). Server-side keeps client thin and avoids large payloads. |
| AI output format | Flat JSON array of sessions `[{day, title, description, type, estimated_distance_km}]` | Nested plan/meso/micro structure | Coach reviews a simple week grid. The nesting (plan → mesocycle → microcycle) is built on confirm, not by the AI. |
| Plan creation on confirm | Reuse `createPlan` + `createMesocycle` + `updateMicrocycleContent` from `planningService.js`, then `assignPlanToAthletes` | Direct `training_sessions` insert | Keeps AI plans as first-class plans in the existing system; coach can re-assign or edit later. |
| AI provider | DeepSeek (`deepseek-chat`) via existing secret | Claude/GPT | Already configured; `generate-ai-report` and `athlete-ai-chat` use it. No fallback chain per proposal scope. |

## Data Flow

```
┌─────────────┐     POST /generate-ai-plan      ┌──────────────────────┐
│ Coach clicks │ ──────────────────────────────→  │  Edge Function        │
│ "Generar     │     { athlete_id }               │  1. Verify JWT+rel    │
│  Plan IA"    │                                  │  2. Query data sources│
│              │     ← JSON plan sessions ──────  │  3. Build prompt      │
│ AIPlanReview │                                  │  4. Call DeepSeek     │
│ Modal        │                                  │  5. Parse + validate  │
└──────┬───────┘                                  └──────────────────────┘
       │ Coach edits & confirms
       ▼
 planningService.createPlan()
 planningService.createMesocycle()
 planningService.updateMicrocycleContent()
 planningService.assignPlanToAthletes()
       │
       ▼
 training_sessions created → athlete sees plan
```

**Onboarding flow:**
```
Athlete login → AuthContext.profile loaded
  → AthleteLayout checks: athlete_profile exists?
    No  → <OnboardingWizard /> (5 steps, full-screen)
           Step 5 submit → INSERT athlete_profile → refresh → dashboard
    Yes → Normal dashboard
```

## Database Schema

```sql
-- UP
CREATE TABLE athlete_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  sex text CHECK (sex IN ('male','female')),
  birth_date date,
  weight_kg numeric,
  height_cm numeric,
  modality text CHECK (modality IN ('800m','1500m','5k','10k','half_marathon','marathon','trail')),
  goal text CHECK (goal IN ('start_running','complete_distance','improve_time','health_fitness')),
  current_best_time text,
  target_competition text,
  target_date date,
  available_days jsonb DEFAULT '{}',
  has_gym_access boolean DEFAULT false,
  has_track_access boolean DEFAULT false,
  current_weekly_km numeric,
  comfortable_pace text,
  max_hr integer,
  vo2max numeric,
  injuries_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE athlete_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "athlete_own" ON athlete_profile
  FOR ALL USING ((select auth.uid()) = user_id);

CREATE POLICY "coach_read_via_rel" ON athlete_profile
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.coach_id = (select auth.uid())
        AND car.athlete_id = athlete_profile.user_id
        AND car.status = 'active'
    )
  );

-- DOWN
DROP TABLE IF EXISTS athlete_profile;
```

## Edge Function: generate-ai-plan

Pattern follows `generate-ai-report/index.ts`:
1. CORS preflight handling
2. JWT auth via `supabase.auth.getUser()`
3. Coach-athlete relationship check via `coach_athlete_relationship`
4. Data gathering (service role client):
   - `athlete_profile` row
   - `strava_activities` (last 90d, aggregated to weekly summaries)
   - `daily_training_load` (last 90d for ACWR)
   - `training_sessions` (last 90d for history)
   - `competitions` (upcoming, for periodization anchoring)
   - `running_exercises_bank` (for exercise vocabulary)
5. Compute `dataTier` from Strava activity count
6. Build tier-specific prompt requesting JSON output: `{ sessions: [{day: 0-6, title, description, type, estimated_distance_km}], plan_name, weekly_km_target, notes }`
7. Call DeepSeek with `response_format: { type: "json_object" }`, `temperature: 0.5`, `max_tokens: 4000`
8. Parse response, validate schema, return to client
9. On parse failure: one retry with lower temperature (0.3)

## Component Hierarchy

```
src/components/athlete/OnboardingWizard.jsx  (new)
  ├── StepIdentidad      (name, sex, birth_date)
  ├── StepFisico         (weight, height)
  ├── StepEnfoque        (modality, goal, best_time, target)
  ├── StepDisponibilidad (available_days, gym/track access)
  └── StepMotor          (weekly_km, pace, max_hr, vo2max, injuries)

src/components/dashboard/AIPlanReviewModal.jsx  (new)
  ├── Week grid (7 columns, Mon–Sun)
  ├── Editable session cards (title, description, type, distance)
  ├── "Regenerar" button (re-call Edge Function)
  └── "Asignar Plan" button → creates plan via planningService

src/services/athleteProfileService.js  (new)
  ├── getAthleteProfile(userId)
  ├── createAthleteProfile(data)
  └── updateAthleteProfile(userId, data)

src/services/aiPlanService.js  (new)
  └── generateAIPlan(athleteId)  → calls Edge Function
```

## Error Handling

| Error | Handler |
|-------|---------|
| DeepSeek timeout/5xx | Edge Function returns 502; client shows "Inténtalo de nuevo" with retry button |
| Malformed JSON from AI | Edge Function retries once with lower temp; if still fails, returns 502 |
| Missing athlete_profile | "Generar Plan" button disabled with tooltip "El atleta debe completar su perfil" |
| No coach-athlete relationship | Edge Function returns 403; client shows auth error |
| Onboarding partial abandon | Form state persists in React state during session; no partial DB save (wizard is short enough) |

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/XXXXXX_athlete_profile.sql` | Create | Table + RLS policies |
| `supabase/functions/generate-ai-plan/index.ts` | Create | Edge Function |
| `src/components/athlete/OnboardingWizard.jsx` | Create | 5-step wizard |
| `src/components/dashboard/AIPlanReviewModal.jsx` | Create | AI plan review/edit modal |
| `src/services/athleteProfileService.js` | Create | CRUD for athlete_profile |
| `src/services/aiPlanService.js` | Create | Edge Function caller |
| `src/pages/dashboard/AthleteProfile.jsx` | Modify | Add "Generar Plan IA" button + AIPlanReviewModal + "Perfil Deportivo" section |
| `src/pages/athlete/Dashboard.jsx` | Modify | Conditional render of OnboardingWizard when no profile |
| `src/App.jsx` | No change | No new routes needed |

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Manual | Onboarding wizard completion | Walk through all 5 steps, verify DB insert |
| Manual | AI plan generation + review | Trigger from coach view, verify JSON structure |
| Manual | Plan assignment flow | Confirm plan creates training_sessions correctly |
| Manual | RLS | Test athlete can only see own profile; coach can read via relationship |
| Build | Lint + build | `eslint` + `vite build` pass |

## Migration / Rollout

1. Apply `athlete_profile` migration to Supabase
2. Deploy `generate-ai-plan` Edge Function + set DEEPSEEK_API_KEY secret (already exists)
3. Deploy frontend — onboarding shows only to athletes without profile; coach button is additive
4. Rollback: drop table + delete Edge Function + revert branch (fully additive, no destructive changes)

## Open Questions

- [ ] Should partial onboarding data be saved (e.g., localStorage draft) for athletes who abandon mid-wizard?
- [ ] Weekly plan (7 days) or multi-week plan? Proposal says weekly — confirm with coach users
- [ ] Should the AI plan include rest days explicitly, or only training days?

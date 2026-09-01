# Design: Independent Athlete

## Technical Approach

Add an `is_independent` flag to the `users` table. AuthContext exposes `isIndependent` derived from this column. Sidebar, BottomNav, and Dashboard branch on this flag to show independent-specific navigation and content. New pages (MyPlan, Competitions, AIAssistant) are lazy-loaded routes under `/athlete/`. The `generate-ai-plan` Edge Function gains a dual-auth path: coach JWT (existing) OR independent athlete JWT (new). Independent athletes self-assign plans with `coach_id = NULL`.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Independent flag storage | `users.is_independent` boolean column | Separate role value, user_metadata only | Reuses `athlete` role for shared RLS; column is queryable in DB triggers and Edge Functions; metadata alone is not accessible in RLS |
| Session completion fields | Extend `training_sessions` with completion columns | New `session_completions` junction table | Fewer joins, simpler queries; existing `status` field already tracks completion; adding `actual_distance_km`, `actual_time_minutes`, `rpe`, `completion_notes`, `completed_at` keeps data co-located |
| Edge Function dual-auth | Single function with branching auth logic | Separate Edge Function for independent athletes | Avoids code duplication; plan generation logic is identical; only auth check differs |
| Plan auto-assignment | Direct insert to `training_sessions` with `coach_id = NULL` | Use `plan_assignments` pipeline | Simpler for independent flow; no coach review step needed; reuse existing session creation logic from `weeklyTrainingService` patterns |
| Navigation branching | Conditional `menuItems` array in existing Sidebar/BottomNav | Separate IndependentSidebar component | Less code duplication; shared structure (logo, user section, theme toggle) stays DRY; only the menu array differs |
| Competition CRUD | Reuse `competitions` table with `coach_id = NULL` | New `athlete_competitions` table | Table already has all needed columns; RLS update is simpler than new table |

## Data Flow

### Registration (Independent)

```
Register.jsx ──→ useRegisterForm (role='athlete', is_independent=true)
    │
    ├── signUp({ role:'athlete', is_independent:true }) ──→ Supabase Auth
    │                                                         │
    │                                               DB trigger sets users.is_independent=true
    │
    └── Redirect ──→ /athlete/dashboard ──→ OnboardingWizard (if no profile)
```

### AI Plan Generation (Independent)

```
MyPlan.jsx ──→ independentPlanService.generateSelfPlan(userId)
    │
    ├── POST generate-ai-plan { athlete_id: self }
    │       │
    │       ├── JWT decode ──→ check users.is_independent = true
    │       ├── Skip coach_athlete_relationship check
    │       ├── Fetch athlete_profile, strava_activities, etc.
    │       └── Return plan JSON
    │
    └── autoAssignPlan(planData, userId)
            │
            ├── INSERT training_plans (coach_id=NULL, created_by=userId)
            ├── INSERT mesocycles
            ├── INSERT microcycles
            └── INSERT training_sessions (coach_id=NULL, athlete_id=userId)
```

### Session Completion (Manual)

```
Training.jsx / SessionCard ──→ "Completar" button
    │
    └── SessionCompletionModal { distance, time, rpe, sensation, notes }
            │
            └── sessionCompletionService.completeSession(sessionId, data)
                    │
                    └── UPDATE training_sessions SET
                          status='completed', completed_at=now(),
                          actual_distance_km, actual_time_minutes,
                          rpe, completion_notes
```

## Database Schema

### Migration UP

```sql
-- 1. Independent flag
ALTER TABLE public.users ADD COLUMN is_independent boolean DEFAULT false NOT NULL;

-- 2. Nullable coach_id on training_sessions
ALTER TABLE public.training_sessions ALTER COLUMN coach_id DROP NOT NULL;

-- 3. Completion fields on training_sessions
ALTER TABLE public.training_sessions
  ADD COLUMN completed_at timestamptz,
  ADD COLUMN actual_distance_km numeric(6,2),
  ADD COLUMN actual_time_minutes integer,
  ADD COLUMN rpe smallint CHECK (rpe BETWEEN 1 AND 10),
  ADD COLUMN completion_notes text;

-- 4. Nullable coach_id on competitions
ALTER TABLE public.competitions ALTER COLUMN coach_id DROP NOT NULL;

-- 5. Nullable coach_id on training_plans
ALTER TABLE public.training_plans ALTER COLUMN coach_id DROP NOT NULL;
ALTER TABLE public.training_plans ADD COLUMN created_by uuid REFERENCES auth.users(id);

-- 6. RLS: independent athlete CRUD on own training_sessions
CREATE POLICY "independent_athlete_own_sessions"
  ON public.training_sessions FOR ALL
  USING (
    athlete_id = (select auth.uid())
    AND (select is_independent from public.users where id = (select auth.uid()))
  )
  WITH CHECK (
    athlete_id = (select auth.uid())
    AND coach_id IS NULL
  );

-- 7. RLS: independent athlete CRUD on own competitions
CREATE POLICY "independent_athlete_own_competitions"
  ON public.competitions FOR ALL
  USING (
    athlete_id = (select auth.uid())
    AND (select is_independent from public.users where id = (select auth.uid()))
  )
  WITH CHECK (
    athlete_id = (select auth.uid())
    AND coach_id IS NULL
  );

-- 8. RLS: independent athlete own training_plans
CREATE POLICY "independent_athlete_own_plans"
  ON public.training_plans FOR ALL
  USING (
    created_by = (select auth.uid())
    AND (select is_independent from public.users where id = (select auth.uid()))
  )
  WITH CHECK (
    created_by = (select auth.uid())
    AND coach_id IS NULL
  );
```

### Migration DOWN

```sql
DROP POLICY IF EXISTS "independent_athlete_own_sessions" ON public.training_sessions;
DROP POLICY IF EXISTS "independent_athlete_own_competitions" ON public.competitions;
DROP POLICY IF EXISTS "independent_athlete_own_plans" ON public.training_plans;
ALTER TABLE public.training_plans DROP COLUMN IF EXISTS created_by;
ALTER TABLE public.training_sessions DROP COLUMN IF EXISTS completion_notes;
ALTER TABLE public.training_sessions DROP COLUMN IF EXISTS rpe;
ALTER TABLE public.training_sessions DROP COLUMN IF EXISTS actual_time_minutes;
ALTER TABLE public.training_sessions DROP COLUMN IF EXISTS actual_distance_km;
ALTER TABLE public.training_sessions DROP COLUMN IF EXISTS completed_at;
-- WARNING: reverting NOT NULL requires backfilling NULLs first
-- ALTER TABLE public.training_sessions ALTER COLUMN coach_id SET NOT NULL;
-- ALTER TABLE public.competitions ALTER COLUMN coach_id SET NOT NULL;
-- ALTER TABLE public.training_plans ALTER COLUMN coach_id SET NOT NULL;
ALTER TABLE public.users DROP COLUMN IF EXISTS is_independent;
```

## Edge Function Changes

### `generate-ai-plan/index.ts`

Replace the auth block (lines 432-482) with dual-path logic:

```
1. Decode JWT → get userId (same as today)
2. Fetch users row: SELECT role, is_independent FROM users WHERE id = userId
3. IF is_independent AND athlete_id == userId:
     → Skip coach relationship check
     → Set coachId = null (for response metadata)
4. ELSE (coach path — existing logic):
     → Verify coach_athlete_relationship
     → coachId = userId
5. Rest of function unchanged
```

### `athlete-ai-chat/index.ts`

Add to context payload for independent athletes: plan adherence %, average RPE from last 4 weeks, upcoming competitions, recent completion notes.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/independent_athlete_migration.sql` | Create | Up + down migration SQL |
| `src/contexts/AuthContext.jsx` | Modify | Add `isIndependent` to context value, derived from `profile?.is_independent` |
| `src/pages/Register.jsx` | Modify | Add "Atleta Independiente" card in role selection step |
| `src/hooks/useRegisterForm.js` | Modify | Handle `is_independent` flag in signUp metadata |
| `src/components/athlete/AthleteSidebar.jsx` | Modify | Conditional `menuItems` based on `isIndependent` from AuthContext |
| `src/components/athlete/AthleteBottomNav.jsx` | Modify | Conditional `tabs` array for independent vs coached |
| `src/pages/athlete/Dashboard.jsx` | Modify | Independent variant: hide WellnessForm/WeeklyDiary, show plan summary + competition countdown |
| `src/hooks/useAthleteDashboardData.js` | Modify | Accept `isIndependent` param, skip coach-specific queries when true |
| `src/pages/athlete/MyPlan.jsx` | Create | Plan management: generate, preview, current plan view, regenerate |
| `src/pages/athlete/Competitions.jsx` | Create | Competition CRUD with countdown timer |
| `src/pages/athlete/AIAssistant.jsx` | Create | AI chat page (reuse `athlete-ai-chat` Edge Function) |
| `src/components/athlete/SessionCompletionModal.jsx` | Create | Completion form: distance, time, RPE, sensation, notes |
| `src/components/athlete/CompetitionCountdown.jsx` | Create | Countdown timer component (days/hours to event) |
| `src/services/independentPlanService.js` | Create | `generateSelfPlan()`, `autoAssignPlan()` |
| `src/services/competitionService.js` | Create | Independent competition CRUD |
| `src/services/sessionCompletionService.js` | Create | `completeSession()`, `getCompletionStats()` |
| `src/hooks/useMyPlanData.js` | Create | Active plan, plan history, generation state |
| `src/hooks/useCompetitionsData.js` | Create | Competition list, CRUD operations |
| `src/App.jsx` | Modify | Add lazy imports + routes: `my-plan`, `competitions`, `ai-assistant` |
| `supabase/functions/generate-ai-plan/index.ts` | Modify | Dual-auth path (coach OR independent athlete) |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Manual | Registration flow, plan generation, session completion, competition CRUD | Walk through each flow as independent + coached athlete |
| RLS | Independent cannot access other users' data; coached athlete flows unaffected | Supabase SQL editor with different JWTs |
| Edge Function | Dual-auth: independent athlete can generate for self, cannot generate for others | curl with independent athlete JWT |
| Build | No lint errors, Vite build passes | `npm run lint && npm run build` |

## Migration / Rollout

1. Apply DB migration (additive — no breaking changes to existing data)
2. Deploy updated `generate-ai-plan` Edge Function
3. Deploy frontend with feature code
4. Existing coached athletes unaffected (`is_independent` defaults to `false`)
5. Rollback: revert frontend branch + revert Edge Function + run down migration

## Open Questions

- [ ] Should independent athletes see WellnessForm and WeeklyDiary (currently coached-only UX), or replace with simpler RPE-based self-assessment?
- [ ] Rate limiting on AI plan generation for independent athletes (prevent abuse without coach gating)
- [ ] Should `OPEN_REGISTRATION` flag in Register.jsx gate independent registration separately from invite-only coached registration?

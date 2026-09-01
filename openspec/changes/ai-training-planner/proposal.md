# Proposal: AI Training Planner

## Intent

Coaches lack a data-driven starting point when creating training plans. They manually build every plan from scratch, even when Strava data and athlete profile information could inform volume, intensity, and periodization. This feature lets a coach generate a structured AI plan from real athlete data (or onboarding profile for new athletes), review/edit it, then assign it through the existing planning system.

## Scope

### In Scope
- **Athlete profile onboarding wizard** — new `athlete_profile` table; wizard shown to athletes with no history; coach-visible in AthleteProfile page
- **`generate-ai-plan` Edge Function** — queries Strava activities (90d), daily_training_load, training_sessions history, competitions, athlete_profile, running_exercises_bank; calls DeepSeek; returns structured JSON plan
- **Progressive intelligence tiers** — 90+ days data (full), 30-90 (mixed), <30 (profile-heavy), 0 (profile-only conservative)
- **Coach review UI** — "Generar Plan con IA" button on AthleteProfile; preview/edit modal for AI output; confirm creates plan via existing planning system
- **RLS policies** for `athlete_profile` (athlete owns, coach reads via relationship)

### Out of Scope
- Independent user module (no-coach users)
- CSV upload/parsing (removed from scope)
- AI provider changes (stays DeepSeek, no fallback chain)
- React Flow visualization
- Athlete-facing plan generation

## Approach

1. **DB**: New `athlete_profile` table with onboarding fields. Migration with up+down SQL.
2. **Onboarding**: Multi-step wizard component shown post-signup when no profile exists. Stores to `athlete_profile`.
3. **Edge Function**: `generate-ai-plan` follows `generate-ai-report` pattern. Builds context payload from all data sources, applies progressive intelligence tier, sends to DeepSeek with a structured output prompt, returns weekly plan JSON.
4. **Coach UI**: Button on AthleteProfile triggers generation. Modal displays editable plan grid (days/sessions). On confirm, creates `training_plan` + `mesocycles` + `microcycles` via existing `assignPlanToAthletes` flow.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/` | New | `athlete_profile` table + RLS policies |
| `supabase/functions/generate-ai-plan/` | New | Edge Function for AI plan generation |
| `src/pages/athlete/` | New | Onboarding wizard component (shown post-signup) |
| `src/pages/dashboard/AthleteProfile.jsx` | Modified | "Generar Plan con IA" button + review modal |
| `src/services/aiPlanService.js` | New | Service for calling generate-ai-plan + data aggregation |
| `src/services/athleteProfileService.js` | New | CRUD for athlete_profile table |
| `src/components/dashboard/AIPlanReviewModal.jsx` | New | Editable plan preview before assignment |
| `src/components/athlete/OnboardingWizard.jsx` | New | Multi-step profile form |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| DeepSeek returns malformed JSON plan | Med | Strict JSON schema in prompt + validation layer; retry once on parse failure |
| Onboarding abandonment (athlete skips wizard) | Med | Allow partial save; coach can fill profile manually |
| AI plan quality with 0 data (profile-only) | Med | Conservative defaults; clear "basado en perfil" label; coach always reviews |
| Token limits with 90d of dense Strava data | Low | Summarize/aggregate activities (weekly totals) instead of raw rows |
| RLS complexity for coach reading athlete_profile | Low | Single policy using existing `coach_athlete_relationship` pattern |

## Rollback Plan

1. **DB**: Drop `athlete_profile` table (down migration)
2. **Edge Function**: Delete `generate-ai-plan` function
3. **Frontend**: Revert branch — no existing features modified destructively
4. **No data loss risk**: Feature is additive; existing planning system untouched

## Dependencies

- DeepSeek API key already configured as Supabase secret
- Existing planning system (`training_plans`, `mesocycles`, `microcycles`, `plan_assignments`)
- Existing data sources (`strava_activities`, `daily_training_load`, `running_exercises_bank`)
- `athlete-ai-chat` / `generate-ai-report` as Edge Function patterns to follow

## Success Criteria

- [ ] New athlete can complete onboarding wizard and data persists in `athlete_profile`
- [ ] Coach can view athlete profile data on AthleteProfile page
- [ ] Coach clicks "Generar Plan con IA" and receives a structured plan within 30s
- [ ] AI plan adapts based on data availability tier (progressive intelligence)
- [ ] Coach can edit AI-generated plan before confirming
- [ ] Confirmed plan creates proper `training_plan` + sessions via existing system
- [ ] RLS policies enforce athlete-owns / coach-reads-via-relationship

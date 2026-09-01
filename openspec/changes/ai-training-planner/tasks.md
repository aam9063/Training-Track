# Tasks: AI Training Planner

## Phase 1: Infrastructure (DB + Services)

- [x] 1.1 Create Supabase migration `supabase/athlete_profile.sql` — `athlete_profile` table with Spanish column names (nombre, sexo, fecha_nacimiento, etc.), RLS policies (`athlete_own` ALL, `coach_read_via_rel` SELECT via `coach_athlete_relationship`), up+down SQL. Use `(select auth.uid())` pattern.
- [x] 1.2 Create `src/services/athleteProfileService.js` — `getAthleteProfile(userId)`, `createAthleteProfile(userId, data)`, `updateAthleteProfile(userId, data)`. Handle `{ data, error }` destructuring. Also created `src/hooks/useAthleteProfile.js`.
- [x] 1.3 Create `src/services/aiPlanService.js` — `generateAIPlan(athleteId)` calls `generate-ai-plan` Edge Function via `fetch()` (following `aiChatService.js` pattern). Returns parsed plan JSON or throws.

## Phase 2: Onboarding Wizard (Athlete)

- [x] 2.1 Create `src/components/athlete/OnboardingWizard.jsx` — Full-screen 5-step wizard with manual per-step validation. Steps: StepIdentidad, StepFisico, StepEnfoque, StepDisponibilidad (min 2 days), StepMotor. Stepper header with checkmarks, Framer Motion AnimatePresence slide transitions, sky-blue brand on dark bg. No partial save.
- [x] 2.2 Modify `src/pages/athlete/Dashboard.jsx` — Added AthleteDashboardWithGate wrapper using useAthleteProfile hook. Shows OnboardingWizard full-screen when no profile; refreshes on completion.

## Phase 3: Coach Profile View

- [x] 3.1 Modify `src/pages/dashboard/AthleteProfile.jsx` — Add "Perfil Deportivo" tab/section. Fetch `athlete_profile` via `athleteProfileService.getAthleteProfile(athleteId)`. Display fields grouped: Identidad, Fisico, Enfoque, Disponibilidad, Motor. Read-only. If no profile: message "El atleta aun no ha completado su perfil".
- [x] 3.2 In same file, add "Generar Plan con IA" button — Enabled only when profile exists. Disabled with tooltip when missing. On click: call `aiPlanService.generateAIPlan(athleteId)`, show loading spinner, on success open `AIPlanReviewModal`.

## Phase 4: Edge Function (CRITICAL — prompt engineering)

- [x] 4.1 Create `supabase/functions/generate-ai-plan/index.ts` — CORS, JWT auth, coach-athlete relationship check. Data gathering with service-role client: `athlete_profile`, `strava_activities` (90d aggregated to weekly summaries: total_km, avg_pace, count), `training_sessions` (90d history), `competitions` (upcoming), `running_exercises_bank` (full list as exercise vocabulary). Compute `dataTier` from activity count. Use `senior-security` skill for auth/RLS.
- [x] 4.2 Craft DeepSeek system prompt — Use `senior-prompt-engineer` skill. Prompt MUST: (a) enforce 4-week mesocycle (3 load + 1 deload), (b) use `running_exercises_bank` as ONLY exercise source (no hallucinated exercises), (c) include explicit rest days (type:'descanso') for non-training days, (d) respect dias_disponibles/horas_por_dia/gym/track/injuries, (e) enforce max 10%/week volume increase, (f) output valid JSON matching REQ-GEN-1 schema with 4 weeks, (g) include few-shot example for reliable JSON, (h) adapt prompt detail per tier. Sport context: athletics/running, 800m through marathon, track+road.
- [x] 4.3 Wire DeepSeek call — `response_format: { type: "json_object" }`, `temperature: 0.5`, `max_tokens: 4000`. Parse response, validate all 4 weeks present and 7 days each. On parse failure: retry once at `temperature: 0.3`. On second failure: return 502 `{ error: "ai_generation_failed" }`. Timeout: 504 at 25s.

## Phase 5: AI Plan Review Modal (Coach)

- [x] 5.1 Create `src/components/dashboard/AIPlanReviewModal.jsx` — Modal/panel showing 4-week plan. Tab or accordion per week. Each week: 7-column grid (L-D) with session cards. Each card editable: title, description, training_type (dropdown), estimated_distance_km. Rest days shown as "Descanso" cards. Coach can delete sessions or add new ones. "Regenerar" button re-calls Edge Function. Tier badge shown (e.g., "Basado en perfil"). Use `frontend-design` skill + Framer Motion.
- [x] 5.2 Implement "Asignar Plan" flow in modal — On confirm: (a) call `planningService.createPlan()` with plan_name, (b) create 1 mesocycle (4 weeks), (c) create 4 microcycles with `content` jsonb from edited sessions, (d) call `planningService.assignPlanToAthletes()` for the athlete. Show success toast, close modal. "Descartar" button closes without saving.

## Phase 6: Integration & Review

- [x] 6.1 Wire complete flow end-to-end — Verified and fixed: field name mismatch in AthleteProfile.jsx (was using English names, DB uses Spanish), day abbreviation mapping bug in Edge Function, and non-existent session_date column reference.
- [x] 6.2 Run `code-reviewer` skill — Reviewed all files against AGENTS.md: const/let OK, arrow functions OK, destructuring OK, async/await OK, Tailwind only OK, Framer Motion OK, Spanish UI OK, `(select auth.uid())` in RLS OK. Fixed console.error in AIPlanReviewModal, fixed modalityLabels and goalLabels to match DB enum values. Build passes clean.
- [x] 6.3 Manual RLS verification — Verified: athlete_own policy uses `(select auth.uid()) = user_id` for ALL ops, coach_read_via_rel uses EXISTS on coach_athlete_relationship with active status for SELECT only, no DELETE policy. Edge Function verifies coach-athlete relationship before proceeding.

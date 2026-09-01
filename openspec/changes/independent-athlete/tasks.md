# Tasks: Independent Athlete

## Phase 1: Foundation — DB, Auth, Layout, Routes

- [x] 1.1 Create `supabase/migrations/independent_athlete_up.sql` and `independent_athlete_down.sql` with all schema changes from design: `users.is_independent`, nullable `coach_id` on `training_sessions`/`competitions`/`training_plans`, `created_by` on `training_plans`, completion columns on `training_sessions` (`completed_at`, `actual_distance_km`, `actual_time_minutes`, `rpe`, `completion_notes`), competition columns (`goal_time_minutes`, `actual_time_minutes`, `position`), and RLS policies (`independent_athlete_own_sessions`, `independent_athlete_own_competitions`, `independent_athlete_own_plans`). Satisfies: registration-and-auth spec (DB Schema), competitions spec (DB Schema), session-completion spec (DB Schema).

- [x] 1.2 Modify `src/contexts/AuthContext.jsx`: derive `isIndependent` from `profile?.is_independent` and expose in context value alongside `isAthlete`/`isCoach`. Satisfies: registration-and-auth spec (AuthContext Exposes isIndependent).

- [x] 1.3 Modify `src/pages/auth/Register.jsx` and `src/hooks/useRegisterForm.js`: add "Atleta Independiente" card in role selection, set `is_independent: true` in signup metadata, hide coach email field when selected. Satisfies: registration-and-auth spec (Independent Registration Option, skips coach email).

- [x] 1.4 Modify `src/components/athlete/AthleteSidebar.jsx`: conditional `menuItems` array — when `isIndependent` show Inicio, Mi Plan, Calendario, Mis Metricas, Competiciones, Asistente IA, Dispositivos, Perfil. Use icons from react-icons. Satisfies: layout-and-navigation spec (Independent Athlete Sidebar).

- [x] 1.5 Modify `src/components/athlete/AthleteBottomNav.jsx`: conditional `tabs` — when `isIndependent` show 5 items: Inicio, Mi Plan, Calendario, Metricas, Perfil. Satisfies: layout-and-navigation spec (Independent Athlete Bottom Nav).

- [x] 1.6 Modify `src/components/athlete/AthleteMobileHeader.jsx`: show "TrainingTrack" branding when `isIndependent`. Satisfies: layout-and-navigation spec (AthleteMobileHeader Branding).

- [x] 1.7 Modify `src/App.jsx`: add lazy imports and routes for `/athlete/my-plan` (MyPlan), `/athlete/competitions` (Competitions), `/athlete/ai-assistant` (AIAssistant). Guard routes to require `isIndependent`. Satisfies: layout-and-navigation spec (Route Registration).

## Phase 2: Mi Plan — Service, Hook, Page, Edge Function

- [x] 2.1 Create `src/services/independentPlanService.js`: `generateSelfPlan(userId)` calls `generate-ai-plan` Edge Function with athlete's JWT, `autoAssignPlan(planData, userId)` inserts `training_plans` (coach_id=NULL, created_by=userId) -> `mesocycles` -> `microcycles` -> `training_sessions`. Use `toLocalDateStr()` for dates. Satisfies: my-plan spec (AI Plan Generation, Auto-Assignment).

- [x] 2.2 Modify `supabase/functions/generate-ai-plan/index.ts`: add dual-auth path — after JWT decode, check `users.is_independent`; if true and `athlete_id == userId`, skip coach relationship check; else use existing coach path. Return 403 if independent athlete requests different `athlete_id`. Satisfies: my-plan spec (Edge Function dual-auth, rejects cross-user).

- [x] 2.3 Create `src/hooks/useMyPlanData.js`: fetch active plan, plan history, generation loading state, `hasProfile` check. Satisfies: my-plan spec (Onboarding Gate, Plan Display).

- [x] 2.4 Create `src/pages/athlete/MyPlan.jsx`: if no profile show `OnboardingWizard`; if profile show current plan weekly view (day-by-day sessions), "Generar Plan" / "Regenerar Plan con IA" button, plan history collapsible. "Basado en tu perfil" label for zero-data plans. All labels Spanish. Satisfies: my-plan spec (all requirements).

## Phase 3: Session Completion

- [x] 3.1 Create `src/services/sessionCompletionService.js`: `completeSession(sessionId, { distance, time, rpe, notes })` updates `training_sessions` with completion fields, `getCompletionStats(userId, weeks)` returns aggregated stats. Satisfies: session-completion spec (Manual Session Completion).

- [x] 3.2 Create `src/components/athlete/SessionCompletionModal.jsx`: form with distancia (required), tiempo (optional), RPE 1-10 (required), sensation labels (Facil/Normal/Duro/Muy duro mapping to RPE ranges), notas (optional). Tailwind styling, Framer Motion transitions. Satisfies: session-completion spec (Manual Session Completion, Post-Session RPE Feedback).

- [x] 3.3 Modify session display in `src/pages/athlete/Training.jsx` and calendar views: add "Marcar Completado" button on pending sessions, green "Completado" badge on completed sessions. Satisfies: session-completion spec (Completion State Display).

## Phase 4: Competitions

- [x] 4.1 Create `src/services/competitionService.js`: `createCompetition(data)`, `getAthleteCompetitions(userId)`, `updateCompetition(id, data)`, `deleteCompetition(id)`, `getNextCompetition(userId)`. All with `coach_id=NULL`, `athlete_id=auth.uid()`. Use `toLocalDateStr()`. Satisfies: competitions spec (Competition CRUD).

- [x] 4.2 Create `src/hooks/useCompetitionsData.js`: upcoming/past competition lists, CRUD handlers, next competition for countdown. Satisfies: competitions spec (all requirements).

- [x] 4.3 Create `src/components/athlete/CompetitionCountdown.jsx`: displays days remaining or "Hoy". Format goal time as "Xh Ym". Satisfies: competitions spec (Competition Countdown, Target Time Display).

- [x] 4.4 Create `src/pages/athlete/Competitions.jsx`: "Nueva Competicion" form/modal, upcoming list with countdown, "Anteriores" section with result recording (actual_time, position). All Spanish. Satisfies: competitions spec (Competition CRUD, Past Competition Results).

## Phase 5: Metrics & Dashboard

- [x] 5.1 Create `src/services/metricsService.js`: `getWeeklyKm(userId, weeks)`, `getRpeTrend(userId, weeks)`, `getPaceTrend(userId, weeks)`, `getPersonalBests(userId)`, `getCompletionRate(userId, planId)`. Prefer Strava data over manual when both exist. Satisfies: metrics-and-progression spec (all data requirements, Strava Deduplication).

- [x] 5.2 Modify `src/pages/athlete/Metrics.jsx`: add sections for weekly km chart, RPE trend chart, pace trend chart, personal bests (5K/10K/Media/Maraton), completion rate ring. Empty state: "Completa tus entrenamientos para ver tus metricas". Satisfies: metrics-and-progression spec (all display requirements).

- [x] 5.3 Modify `src/pages/athlete/Dashboard.jsx` and `src/hooks/useAthleteDashboardData.js`: when `isIndependent`, show plan summary CTA, weekly km/sessions widget, next competition countdown (`CompetitionCountdown`), streak counter. Hide coach-specific widgets. Satisfies: proposal Phase 1 (Inicio dashboard).

## Phase 6: AI Chat & Gamification

- [x] 6.1 Create `src/pages/athlete/AIAssistant.jsx`: chat interface reusing `athlete-ai-chat` Edge Function. Pass enhanced context (plan adherence %, RPE trends, upcoming competitions). All Spanish labels. Satisfies: proposal Phase 4 (AI assistant chat).

- [x] 6.2 Modify `supabase/functions/athlete-ai-chat/index.ts`: add plan adherence %, avg RPE (last 4 weeks), upcoming competitions, recent completion notes to context payload for independent athletes. Satisfies: proposal Phase 4 (enhanced AI context).

- [x] 6.3 Create `src/services/gamificationService.js`: `getStreak(userId)` calculates consecutive training weeks, `checkAchievements(userId)` evaluates static achievement definitions (first 5K, 100km month, etc.). Satisfies: proposal Phase 4 (Gamification).

- [x] 6.4 Add push notification triggers for independent athletes: plan ready, session reminder, streak at risk, competition countdown (1 week, 1 day). Modify `send-push` Edge Function or DB triggers. Filter `sender_id = receiver_id` to avoid loops. Satisfies: proposal Phase 4 (Push notifications).

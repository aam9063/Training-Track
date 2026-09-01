# Proposal: Independent Athlete

## Intent

Currently TrainingTrack only supports coached athletes: every athlete must be linked to a coach who creates plans, assigns sessions, and monitors progress. This excludes a large segment of runners who train alone and want structured plans without hiring a coach. This feature adds a new user type -- the independent athlete -- who registers without a coach, receives AI-generated 4-week training plans based on their profile and Strava data (if available), and manages their own training lifecycle including session completion, competition tracking, and AI-assisted guidance.

## Scope

### In Scope

**Phase 1 -- Foundation & Registration**
- DB migration: `is_independent` boolean on `users` table (default false), `coach_id` nullable on `training_sessions`
- RLS policy updates: independent athletes can CRUD their own sessions, plans, and competitions without coach relationship
- Registration flow: new "Atleta Independiente" option on signup (reuses existing `athlete` role, sets `is_independent = true`)
- AuthContext: expose `isIndependent` derived from user metadata
- Login redirect: independent athletes go to `/athlete/dashboard` (same as coached, different sidebar)
- Sidebar/BottomNav conditional: independent athletes see "Inicio", "Mi Plan", "Calendario", "Metricas", "Competiciones", "Asistente IA" instead of coached athlete menu
- AthleteMobileHeader: conditional branding/nav for independent mode
- Inicio (Dashboard): weekly summary card (km, sessions done/planned, streak), upcoming sessions list, next competition countdown, Strava sync status
- Mi Plan page: triggers `generate-ai-plan` Edge Function (dual-auth path: independent athlete calls directly, not via coach), displays current 4-week plan, auto-assigns generated plan to self via existing `plan_assignments` system

**Phase 2 -- Calendar & Session Completion**
- Calendar reuse: existing athlete calendar works as-is (reads from `training_sessions`)
- Manual session completion: "Marcar completado" action on each session with fields: distance, time, RPE (1-10), notes
- New `session_completions` table or extend `training_sessions` with completion columns (`completed_at`, `actual_distance_km`, `actual_time_minutes`, `rpe`, `completion_notes`)
- Post-session feedback: after marking complete, prompt for RPE and brief notes (used by AI for next plan generation)
- Strava auto-complete: existing webhook flow works if athlete connects Strava (no changes needed)

**Phase 3 -- Metrics & Competitions**
- Metrics page: weekly km progression chart, pace trend, RPE average over time, personal bests tracking
- Data sources: Strava activities (if connected) + manual completions
- Competitions section: CRUD for self-managed competitions (name, date, distance, location, notes, goal_time)
- Competition countdown: days remaining displayed on dashboard and competition detail
- Competition list with past results (actual_time, position if entered)

**Phase 4 -- AI Chat & Gamification**
- AI assistant chat: reuse `athlete-ai-chat` Edge Function with enhanced context (include plan adherence %, RPE trends, upcoming competitions, injury flags from profile)
- Chat accessible from sidebar as dedicated section
- Gamification: training streaks (consecutive weeks with >= X sessions), achievement badges (first 5K, first 10K, 100km month, etc.), motivational push notifications for streaks and milestones
- Push notification triggers: plan ready, session reminder (morning of), streak at risk, competition countdown (1 week, 1 day)

### Out of Scope
- CSV import from Garmin/Polar (separate change)
- React Flow plan visualization
- Coach marketplace / coach matching
- Payment/subscription system
- Garmin/COROS API integration (separate change)
- Social features (athlete-to-athlete interaction)
- Multi-sport support (cycling, swimming) -- running only

## Approach

1. **DB**: Add `is_independent` boolean to `users` table. Make `coach_id` nullable on `training_sessions` and `competitions`. Add completion fields to `training_sessions` (or new junction table). Update RLS policies so independent athletes can manage their own data without a coach relationship. Prepare up+down migration SQL.

2. **Auth & Registration**: Add "Atleta Independiente" radio/toggle on the registration page. On signup, set `role = 'athlete'` and `is_independent = true` in user metadata. AuthContext reads `is_independent` from the user profile and exposes it. Login redirect logic remains the same (`/athlete/dashboard`), but the sidebar renders differently.

3. **Layout Conditionals**: `AthleteSidebar` and `AthleteBottomNav` check `isIndependent` to show the independent menu items (Mi Plan, Competiciones, Asistente IA) instead of the coached menu (Entrenamiento, Mensajes). Shared items (Inicio, Calendario, Metricas) appear in both modes. `AthleteMobileHeader` adjusts branding.

4. **AI Plan Generation (dual-auth)**: The existing `generate-ai-plan` Edge Function currently requires coach JWT. Add a second auth path: if the caller is an independent athlete (`is_independent = true`), allow them to generate plans for themselves. The function checks `is_independent` from the user profile and uses the caller's own `user_id` as the target athlete. Plan output feeds into the existing `training_plans` -> `mesocycles` -> `microcycles` -> `plan_assignments` -> `training_sessions` pipeline.

5. **Mi Plan Page**: New page at `/athlete/plan`. On first visit (no active plan), shows the onboarding wizard (reuse existing `OnboardingWizard` component if profile incomplete). Once profile exists, offers "Generar Plan" button. Generated plan is previewed and auto-assigned (no coach review step). Shows current active plan with weekly view.

6. **Session Completion**: Add completion fields to `training_sessions` table (`completed_at`, `actual_distance_km`, `actual_time_minutes`, `rpe`, `completion_notes`). New `SessionCompletionModal` component. For Strava-connected users, auto-completion via existing webhook continues to work. Manual completion is always available as fallback.

7. **Competitions**: New `/athlete/competitions` page. Independent athletes create their own competitions (reuse `competitions` table with `coach_id = NULL`, `athlete_id = auth.uid()`). Countdown timer component shows days/hours to next competition. Past competitions show results.

8. **Metrics Enhancement**: Extend existing Metrics page with internal data (completion rate, RPE trends, progression). Add personal bests tracking derived from Strava activities and manual completions.

9. **AI Chat Enhancement**: Pass richer context to `athlete-ai-chat`: plan adherence percentage, average RPE, upcoming competitions, recent completion notes. Independent athletes access chat from sidebar.

10. **Gamification**: Streak tracking via a simple query on `training_sessions` completion dates. Achievement definitions stored as constants (not DB). Push notifications triggered by completion events (streak milestones, approaching competitions).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/` | New | `is_independent` column, nullable `coach_id`, completion fields, RLS policy updates |
| `supabase/functions/generate-ai-plan/` | Modified | Dual-auth path: coach OR independent athlete |
| `supabase/functions/athlete-ai-chat/` | Modified | Enhanced context payload for independent athletes |
| `supabase/functions/send-push/` | Modified | New notification triggers for independent athlete events |
| `src/contexts/AuthContext.jsx` | Modified | Expose `isIndependent` flag |
| `src/pages/auth/Register.jsx` | Modified | "Atleta Independiente" option on signup |
| `src/pages/auth/Login.jsx` | Modified | Redirect logic awareness of independent mode |
| `src/components/athlete/AthleteSidebar.jsx` | Modified | Conditional menu items based on `isIndependent` |
| `src/components/athlete/AthleteBottomNav.jsx` | Modified | Conditional nav items for mobile |
| `src/components/athlete/AthleteMobileHeader.jsx` | Modified | Branding adjustments |
| `src/pages/athlete/Dashboard.jsx` | Modified | Independent dashboard variant (streak, countdown, plan summary) |
| `src/pages/athlete/Metrics.jsx` | Modified | Internal progression metrics (RPE, completion rate, PBs) |
| `src/pages/athlete/MyPlan.jsx` | New | AI plan generation, preview, current plan view |
| `src/pages/athlete/Competitions.jsx` | New | Self-managed competitions CRUD with countdown |
| `src/pages/athlete/AIAssistant.jsx` | New | Dedicated AI chat page |
| `src/components/athlete/SessionCompletionModal.jsx` | New | Manual session completion form (distance, time, RPE, notes) |
| `src/components/athlete/CompetitionCountdown.jsx` | New | Countdown timer component |
| `src/components/athlete/AchievementBadges.jsx` | New | Gamification badges display |
| `src/components/athlete/StreakTracker.jsx` | New | Streak visualization component |
| `src/services/aiPlanService.js` | Modified | Add independent athlete plan generation call |
| `src/services/sessionCompletionService.js` | New | Manual completion CRUD |
| `src/services/competitionService.js` | New/Modified | Self-managed competition CRUD for independent athletes |
| `src/services/metricsService.js` | New | Internal metrics aggregation (RPE trends, PBs, completion rate) |
| `src/services/gamificationService.js` | New | Streak calculation, achievement checks |
| `src/App.jsx` | Modified | New lazy routes for MyPlan, Competitions, AIAssistant |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| RLS complexity with nullable `coach_id` | Medium | Separate RLS policies for independent vs coached; thorough testing matrix |
| Edge Function dual-auth security hole | Medium | Explicit `is_independent` check in function; never allow athlete to generate for another user |
| Self-notification loops (athlete triggers own push) | Low | Filter: skip push when `sender_id = receiver_id`; independent completion notifications are informational only |
| Scope creep on gamification (Phase 4) | Low | Keep achievements as static constants; no custom badge creation; defer leaderboards |
| Profile-only AI plans feel generic for beginners | Medium | Clear "basado en tu perfil" label; suggest connecting Strava; conservative defaults; plan improves after first 4-week cycle with completion data |
| Existing coached athlete flows accidentally affected | Medium | All conditionals gate on `isIndependent`; coached flow remains default; feature flag option for gradual rollout |
| Plan auto-assignment without coach review | Low | Independent athletes accept risk; AI plan includes safety warnings for high volume; RPE feedback loop self-corrects |

## Rollback Plan

1. **DB**: Drop `is_independent` column from `users`. Revert `coach_id` to NOT NULL on `training_sessions` and `competitions`. Drop completion columns. Revert RLS policies (down migration SQL).
2. **Edge Functions**: Revert `generate-ai-plan` to coach-only auth. Revert `athlete-ai-chat` context changes.
3. **Frontend**: Revert branch -- remove new pages (MyPlan, Competitions, AIAssistant), revert sidebar/nav conditionals, revert registration form.
4. **No data loss risk for existing users**: Feature is additive. Existing coached athletes are unaffected (default `is_independent = false`). Independent athlete data (plans, completions) would be orphaned but not corrupt existing data.

## Dependencies

- Existing `athlete_profile` table and `OnboardingWizard` component (from ai-training-planner change)
- Existing `generate-ai-plan` Edge Function (modified, not replaced)
- Existing `athlete-ai-chat` Edge Function (modified for richer context)
- Existing planning system (`training_plans`, `mesocycles`, `microcycles`, `plan_assignments`)
- Existing Strava integration (`strava_activities`, `strava-webhook`, `strava-token-exchange`)
- Existing push notification infrastructure (`send-push`, `push_subscriptions`, `PushNotificationBanner`)
- DeepSeek API key already configured as Supabase secret
- `dateUtils.js` for all date formatting (never `toISOString().split('T')[0]`)

## Success Criteria

- [ ] Independent user can register with "Atleta Independiente" option and lands on athlete dashboard
- [ ] Onboarding wizard collects profile data on first visit to Mi Plan
- [ ] Independent athlete can generate a 4-week AI plan and it auto-assigns to their calendar
- [ ] Sessions appear on calendar and can be manually marked complete with distance/time/RPE/notes
- [ ] Strava-connected independent athletes get auto-completion via existing webhook
- [ ] AI adapts next plan generation based on completion rate and RPE feedback from previous cycle
- [ ] Metrics page shows weekly km progression, pace trends, RPE averages, and personal bests
- [ ] Independent athlete can create/edit/delete their own competitions with countdown display
- [ ] AI chat provides contextual advice using plan adherence, RPE, and competition data
- [ ] PWA push notifications work for independent athletes (plan ready, session reminders, streaks)
- [ ] Existing coached athlete experience is completely unaffected
- [ ] RLS policies correctly isolate independent athlete data (no cross-user access)

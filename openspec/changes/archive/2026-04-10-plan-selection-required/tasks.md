# Tasks — plan-selection-required

## Phase 1: Database infrastructure

- [x] 1.1 Write migration SQL file (UP + DOWN)
  - Acceptance: File `supabase/migrations/YYYYMMDDHHMMSS_plan_selection_required.sql` created with UP (ADD COLUMN `plan_selected_at`, `selected_plan`, CHECK constraint, backfill `UPDATE users SET plan_selected_at = created_at`, partial index, trigger + function `users_block_plan_cols`) and companion DOWN SQL documented in header comment. All statements inside a single `BEGIN; ... COMMIT;` block. Matches design section 3.
  - Files: `supabase/migrations/YYYYMMDDHHMMSS_plan_selection_required.sql` (new)
  - Dependencies: none
  - Skill: supabase-postgres-best-practices
  - Risk: medium

- [x] 1.2 Run nullability pre-check + amend migration if needed
  - Acceptance: Execute verification query from design section 2 on project `lusirdkixfliydimemre` for columns `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`, `current_period_start`, `current_period_end`, `billing_interval`. If any return `NO`, uncomment the `ALTER COLUMN ... DROP NOT NULL` block in the migration.
  - Files: migration file from 1.1
  - Dependencies: 1.1
  - Skill: supabase-postgres-best-practices
  - Risk: low

- [ ] 1.3 Apply migration to Supabase project lusirdkixfliydimemre
  - Acceptance: Migration runs successfully. `SELECT COUNT(*) FROM users WHERE plan_selected_at IS NULL` returns `0`. `information_schema.columns` shows both new columns. Trigger `users_block_plan_cols_trg` listed in `pg_trigger`. Partial index exists.
  - Files: none (DB change)
  - Dependencies: 1.1, 1.2
  - Skill: supabase-postgres-best-practices
  - Risk: high

- [ ] 1.4 Write and deploy `commit_plan_selection` RPC
  - Acceptance: SQL function created per design section 4 with `SECURITY DEFINER`, `SET search_path = public`, JWT validation via `auth.uid()`, plan_key whitelist, billing_interval whitelist, idempotency guard (`plan_already_selected`), role/plan cross-validation, atomic UPDATE users + conditional INSERT subscriptions. `REVOKE ALL FROM public` and `GRANT EXECUTE TO authenticated`. Verified via `\df commit_plan_selection`.
  - Files: `supabase/migrations/YYYYMMDDHHMMSS_plan_selection_required.sql` (append to same migration)
  - Dependencies: 1.3
  - Skill: supabase-postgres-best-practices
  - Risk: high

- [ ] 1.5 Verify BEFORE UPDATE trigger blocks direct writes
  - Acceptance: As `authenticated` role, attempt `UPDATE users SET plan_selected_at = now() WHERE id = auth.uid()` → fails with `plan_selection_readonly`. Same for `selected_plan`. Via RPC (SECURITY DEFINER) the update succeeds because `current_user = 'postgres'`.
  - Files: none (smoke test)
  - Dependencies: 1.4
  - Skill: supabase-postgres-best-practices
  - Risk: medium

- [ ] 1.6 Verify RLS on subscriptions still allows free-plan RPC insert
  - Acceptance: Test call of `commit_plan_selection('coach_free','month')` as test user inserts a subscriptions row with null stripe fields. Existing `sub_select_own` still lets the user read it. Existing `sub_service_all` unchanged.
  - Files: none
  - Dependencies: 1.4
  - Skill: supabase-postgres-best-practices
  - Risk: medium

## Phase 2: Backend services

- [ ] 2.1 Add `commitPlanSelection` to subscriptionService
  - Acceptance: Function `commitPlanSelection(planKey, billingInterval='month')` calls `supabase.rpc('commit_plan_selection', { p_plan_key, p_billing_interval })`. Maps PG errors (`invalid_plan_key`, `plan_already_selected`, `plan_role_mismatch`, `invalid_billing_interval`, `unauthorized`) to typed return `{ success, error }`. Returns `{ success: true, planKey, committedAt }` on success.
  - Files: `src/services/subscriptionService.js`
  - Dependencies: 1.4
  - Skill: react-best-practices
  - Risk: low

- [ ] 2.2 Update AuthContext.fetchProfile to include new columns
  - Acceptance: `fetchProfile` SELECT statement includes `plan_selected_at, selected_plan`. Profile object exposes both fields. No other behavior change.
  - Files: `src/contexts/AuthContext.jsx`
  - Dependencies: 1.3
  - Skill: react-best-practices
  - Risk: low

- [ ] 2.3 Add `profileLoaded` flag to AuthContext
  - Acceptance: New `profileLoaded` state (boolean, default `false`). Set `true` after `fetchProfile` resolves (both success and catch paths). Reset to `false` on `SIGNED_OUT`. Exposed in context value. Existing `loading` flag preserved.
  - Files: `src/contexts/AuthContext.jsx`
  - Dependencies: 2.2
  - Skill: react-best-practices
  - Risk: medium

## Phase 3: Registration wizard (email/password)

- [ ] 3.1 Read plan query params in useRegisterForm
  - Acceptance: Hook reads `?plan=` and `?interval=` from URL. Validates `plan` against whitelist `{coach_free, coach_pro, coach_team, athlete_free, athlete_premium}` and `interval` against `{month, year}`. Invalid values are ignored (treated as absent). State fields `plan` and `billingInterval` populated.
  - Files: `src/hooks/useRegisterForm.js`
  - Dependencies: none (can run parallel with Phase 2)
  - Skill: react-best-practices
  - Risk: low

- [ ] 3.2 Create PlanSelectionStep component
  - Acceptance: `<PlanSelectionStep role value onChange onNext />` renders plan cards from `planFeatures.js` filtered by role (coach → Free/Pro/Team, athlete/independent → Free/Premium). Month/year interval toggle. "Seleccionar" button per card, Next button disabled until a card is picked. Inline error "Debes elegir un plan para continuar" wired via `aria-describedby`. Cards are keyboard-navigable (role="radio", `aria-checked`, Tab/Space). Spanish copy per spec.
  - Files: `src/components/register/PlanSelectionStep.jsx` (new)
  - Dependencies: 3.1
  - Skill: react-best-practices
  - Risk: medium

- [ ] 3.3 Insert plan step into Register wizard
  - Acceptance: `Register.jsx` wizard includes `step='plan'` between `role` and `form`, shown only when URL `?plan=` is absent AND the path is NOT coached-athlete (no `coachId` from invite and no `coachEmail`). For `?plan=<valid>` flows, plan step is skipped. For invites, plan step is skipped.
  - Files: `src/pages/Register.jsx`, `src/hooks/useRegisterForm.js`
  - Dependencies: 3.1, 3.2
  - Skill: react-best-practices
  - Risk: medium

- [ ] 3.4 Commit plan after successful signup
  - Acceptance: After `supabase.auth.signUp` resolves with a session, the submit handler calls `commitPlanSelection(plan, billingInterval)`. On success, navigation proceeds to dashboard by role. If email verification is required (no session), a sessionStorage entry `pending_plan_selection` is written so `AuthCallback` can commit on first login.
  - Files: `src/hooks/useRegisterForm.js`, `src/pages/Register.jsx`
  - Dependencies: 2.1, 3.3
  - Skill: react-best-practices
  - Risk: high

- [ ] 3.5 Surface RPC errors in wizard
  - Acceptance: Errors returned from `commitPlanSelection` are mapped to Spanish toasts: `invalid_plan_key` → "Plan no válido"; `plan_role_mismatch` → "Plan no compatible con tu rol"; `plan_already_selected` → silently refetch profile and navigate; `unauthorized` → navigate to `/login`. Wizard state not advanced on error.
  - Files: `src/hooks/useRegisterForm.js`, `src/pages/Register.jsx`
  - Dependencies: 3.4
  - Skill: react-best-practices
  - Risk: low

- [ ] 3.6 Coached athlete auto-commit path
  - Acceptance: If `coachId` (from `?invite=`) or `coachEmail` is set, wizard writes `sessionStorage['pending_plan_selection'] = { planKey: 'athlete_free', interval: 'month', role: 'athlete' }` BEFORE `supabase.auth.signUp`. If session returns immediately, the handler also commits directly. Plan step and role step are both skipped.
  - Files: `src/hooks/useRegisterForm.js`
  - Dependencies: 3.4
  - Skill: react-best-practices
  - Risk: medium

## Phase 4: Select plan fallback page

- [ ] 4.1 Create SelectPlan page
  - Acceptance: Full-page layout with single `<h1>` "¡Bienvenido! Elige tu plan para continuar" and subtitle per spec. Uses `<PlanSelectionStep>` reusing same component from wizard. Reads `role` from `AuthContext.profile`. Redirects to dashboard if `plan_selected_at` already set.
  - Files: `src/pages/SelectPlan.jsx` (new)
  - Dependencies: 3.2, 2.3
  - Skill: react-best-practices
  - Risk: medium

- [ ] 4.2 Wire commit + redirect on SelectPlan submit
  - Acceptance: On submit, call `subscriptionService.commitPlanSelection(planKey, interval)`. On success: toast ("¡Listo! Disfruta de tus 14 días de prueba" for free / "Tu prueba de 14 días ha comenzado..." for paid), refetch profile, `navigate('/dashboard')` for coach or `navigate('/athlete')` for athlete. On `plan_already_selected` error: silently refetch and navigate. On other errors: toast and stay.
  - Files: `src/pages/SelectPlan.jsx`
  - Dependencies: 4.1, 2.1
  - Skill: react-best-practices
  - Risk: medium

- [ ] 4.3 Register /select-plan route
  - Acceptance: `App.jsx` lazy-imports `SelectPlan` and registers `<Route path="/select-plan" element={<SelectPlan />} />` outside any dashboard layout. Route is only protected by auth (redirect to `/login` if no user).
  - Files: `src/App.jsx`
  - Dependencies: 4.1
  - Skill: react-best-practices
  - Risk: low

## Phase 5: Google OAuth flow

- [ ] 5.1 Extend signInWithGoogle with pendingPlan
  - Acceptance: `signInWithGoogle(metadata, pendingPlan?)` accepts optional `{ planKey, billingInterval, role }`. When provided, writes to `sessionStorage['pending_plan_selection']` BEFORE calling `supabase.auth.signInWithOAuth`. No effect on existing `google_oauth_metadata` localStorage flow.
  - Files: `src/contexts/AuthContext.jsx`
  - Dependencies: 2.3
  - Skill: react-best-practices
  - Risk: medium

- [ ] 5.2 AuthCallback reads pending plan and commits
  - Acceptance: After `getSession()` resolves and profile is fetched, `AuthCallback` reads `sessionStorage['pending_plan_selection']`. If present AND `profile.plan_selected_at IS NULL`: call `commitPlanSelection`, clear sessionStorage, refetch profile, navigate to dashboard by role. Must await RPC before navigation to avoid guard race.
  - Files: `src/pages/AuthCallback.jsx`
  - Dependencies: 2.1, 2.3, 5.1
  - Skill: react-best-practices
  - Risk: high

- [ ] 5.3 AuthCallback fallback to /select-plan
  - Acceptance: If sessionStorage empty AND `plan_selected_at IS NULL` → `navigate('/select-plan')`. If `plan_selected_at` is set → clear any stale sessionStorage and navigate to role dashboard. If `plan_role_mismatch` error from commit → clear sessionStorage and redirect to `/select-plan`.
  - Files: `src/pages/AuthCallback.jsx`
  - Dependencies: 5.2
  - Skill: react-best-practices
  - Risk: medium

- [ ] 5.4 Pricing Google OAuth CTA stores plan
  - Acceptance: If `Pricing.jsx` has a "Continuar con Google" CTA per plan card, the handler writes `sessionStorage['pending_plan_selection']` before calling `signInWithGoogle`. If only the `/register?plan=...` path exists, this task becomes a no-op verification step.
  - Files: `src/components/landing/Pricing.jsx`
  - Dependencies: 5.1
  - Skill: react-best-practices
  - Risk: low

## Phase 6: Route guards

- [ ] 6.1 Create PlanSelectionGuard component
  - Acceptance: `<PlanSelectionGuard>{children}</PlanSelectionGuard>`. Behavior: if `!profileLoaded` → render neutral loading (`Cargando tu perfil...`) and DO NOT redirect; if `profile.is_admin` → render children; if `profile.plan_selected_at == null` → `<Navigate to="/select-plan" replace />`; else render children.
  - Files: `src/components/common/PlanSelectionGuard.jsx` (new)
  - Dependencies: 2.3
  - Skill: react-best-practices
  - Risk: medium

- [ ] 6.2 Wrap DashboardLayout with guard
  - Acceptance: `<PlanSelectionGuard>` wraps the `<SubscriptionGuard><Outlet/></SubscriptionGuard>` composition inside `DashboardLayout.jsx`. Order: auth check → PlanSelectionGuard → SubscriptionGuard → Outlet.
  - Files: `src/layouts/DashboardLayout.jsx`
  - Dependencies: 6.1
  - Skill: react-best-practices
  - Risk: medium

- [ ] 6.3 Wrap AthleteDashboardLayout with guard
  - Acceptance: Same wrapping pattern as 6.2 applied to `AthleteDashboardLayout.jsx`.
  - Files: `src/layouts/AthleteDashboardLayout.jsx`
  - Dependencies: 6.1
  - Skill: react-best-practices
  - Risk: medium

- [ ] 6.4 Verify no flash-redirect while profile loads
  - Acceptance: Manual test: hard-refresh as existing user on `/dashboard` → guard shows neutral state or children, never briefly renders `/select-plan`.
  - Files: none (verification)
  - Dependencies: 6.2, 6.3
  - Skill: react-best-practices
  - Risk: medium

## Phase 7: Admin dashboard consistency

- [ ] 7.1 Verify admin UserDetail shows Free plan labels
  - Acceptance: Load `/admin/users/<id>` for a freshly-registered free user. Displays "Coach Free" / "Athlete Free" + "Activa" instead of "Sin suscripción". No code change expected — automatic once `subscriptions` row exists.
  - Files: `src/pages/admin/UserDetail.jsx` (verify only)
  - Dependencies: 3.4, 4.2
  - Skill: react-best-practices
  - Risk: low

- [ ] 7.2 Verify admin-api edge function still returns plan_key
  - Acceptance: `get_user_detail` inside `supabase/functions/admin-api/index.ts` returns the new `subscriptions` row for free users and returns `plan_key` correctly. No code change expected.
  - Files: `supabase/functions/admin-api/index.ts` (verify only)
  - Dependencies: 3.4
  - Skill: supabase-postgres-best-practices
  - Risk: low

- [ ] 7.3 (Optional) Show selected_plan in UserDetail during trial
  - Acceptance: For paid-intent users (no sub row, `selected_plan` set), display "Plan elegido (sin pago aún): <label>" badge. Defer unless trivial.
  - Files: `src/pages/admin/UserDetail.jsx`
  - Dependencies: 7.1
  - Skill: react-best-practices
  - Risk: low

## Phase 8: Testing

- [ ] 8.1 Test: email/pw register with ?plan=coach_pro
  - Acceptance: Scenario 1 passes. Plan step skipped. `users.selected_plan='coach_pro'`, `plan_selected_at` set, no subscriptions row, `trial_ends_at = created_at + 14d`.
  - Dependencies: Phase 3 complete, 1.3, 1.4
  - Risk: low

- [ ] 8.2 Test: /register direct shows plan step
  - Acceptance: Scenario 2 passes. Wizard shows plan selection before personal data form. Invalid plan (`?plan=hacker_ultra`) ignored (Scenario 6).
  - Dependencies: Phase 3
  - Risk: low

- [ ] 8.3 Test: coach picks coach_free
  - Acceptance: Scenarios 3, 8. Subscriptions row created `plan_key='coach_free'`, `status='active'`, null stripe fields. Toast shown. Dashboard loads.
  - Dependencies: Phase 3, Phase 6
  - Risk: low

- [ ] 8.4 Test: coach picks coach_pro
  - Acceptance: Scenarios 4, 9. No subscriptions row. `selected_plan='coach_pro'`. Toast shown. Dashboard loads. Banner suggests "add payment method".
  - Dependencies: Phase 3, Phase 6
  - Risk: low

- [ ] 8.5 Test: independent athlete picks athlete_premium
  - Acceptance: Same as 8.4 with athlete role.
  - Dependencies: Phase 3, Phase 6
  - Risk: low

- [ ] 8.6 Test: Google OAuth from /pricing with plan
  - Acceptance: Scenarios 15, 16. sessionStorage written before OAuth, callback commits, redirects to dashboard.
  - Dependencies: Phase 5
  - Risk: medium

- [ ] 8.7 Test: Google OAuth without plan → /select-plan
  - Acceptance: Scenarios 17, 18. Callback redirects to `/select-plan`. Submit commits and navigates.
  - Dependencies: Phase 4, Phase 5
  - Risk: medium

- [ ] 8.8 Test: coached athlete via invite link
  - Acceptance: Scenarios 12, 13, 14. No plan step shown. `athlete_free` auto-committed. `coach_athlete_relationship` created. `plan_selected_at` set.
  - Dependencies: Phase 3
  - Risk: medium

- [ ] 8.9 Test: grandfathered user login
  - Acceptance: Scenarios 22, 23. Raúl García Illán and coach@test.com log in and are NOT redirected to `/select-plan`. Admin with `is_exempt=true` unaffected.
  - Dependencies: 1.3, Phase 6
  - Risk: high

- [ ] 8.10 Test: admin shows Coach Free label
  - Acceptance: Scenario 38. New free user appears as "Coach Free" / "Activa".
  - Dependencies: 8.3
  - Risk: low

- [ ] 8.11 Test: direct UPDATE blocked by trigger
  - Acceptance: Scenario 39. From browser console, `supabase.from('users').update({plan_selected_at: new Date()}).eq('id', user.id)` → error `plan_selection_readonly`.
  - Dependencies: 1.3
  - Risk: medium

- [ ] 8.12 Test: invalid plan_key rejected
  - Acceptance: Scenario 41. RPC call with `plan_key='hacker_enterprise'` returns `invalid_plan_key`. No DB modification.
  - Dependencies: 1.4
  - Risk: low

- [ ] 8.13 Test: role/plan mismatch rejected
  - Acceptance: Scenario 42. Athlete calling RPC with `coach_pro` returns `plan_role_mismatch`. No DB modification.
  - Dependencies: 1.4
  - Risk: low

- [ ] 8.14 Test: multi-tab OAuth independence
  - Acceptance: Scenario 19. Two tabs, different plans, each sessionStorage isolated, each commits own plan.
  - Dependencies: Phase 5
  - Risk: medium

- [ ] 8.15 Test: idempotent commit rejected
  - Acceptance: Scenario 47 / idempotency. Second RPC call returns `plan_already_selected`. Client silently refetches and navigates.
  - Dependencies: 1.4, 2.1
  - Risk: low

- [ ] 8.16 Run ESLint + Vite build
  - Acceptance: `pnpm lint` and `pnpm build` both pass with zero errors.
  - Dependencies: Phases 2–7 complete
  - Skill: vite
  - Risk: low

- [ ] 8.17 GGA pre-commit hooks pass
  - Acceptance: `git commit` succeeds without hook failures. All AGENTS.md conventions honored.
  - Dependencies: 8.16
  - Risk: low

## Phase 9: Deployment

- [ ] 9.1 Apply migration to production
  - Acceptance: Run migration against `lusirdkixfliydimemre` production. Verify backfill `SELECT COUNT(*) FROM users WHERE plan_selected_at IS NULL` = 0. Verify trigger and RPC exist.
  - Dependencies: All Phase 8 tasks passing in preview
  - Skill: supabase-postgres-best-practices
  - Risk: high

- [ ] 9.2 Deploy RPC (same migration)
  - Acceptance: `\df commit_plan_selection` returns the function with correct signature and `SECURITY DEFINER` flag.
  - Dependencies: 9.1
  - Risk: medium

- [ ] 9.3 Deploy frontend to Vercel
  - Acceptance: Production build deployed. `trainingtrack.es` serves new code. Smoke-check `/select-plan` route exists.
  - Dependencies: 9.2
  - Skill: deploy-to-vercel
  - Risk: medium

- [ ] 9.4 Monitor logs for 48h
  - Acceptance: Supabase logs show no `plan_selection_readonly` exceptions from normal traffic. `SELECT COUNT(*) FROM users WHERE plan_selected_at IS NULL AND created_at > '<deploy-ts>'` stays at 0.
  - Dependencies: 9.3
  - Risk: medium

- [ ] 9.5 End-to-end production smoke test
  - Acceptance: Register a fresh test user via email/pw with `?plan=coach_free`. Verify user row, subscriptions row, dashboard loads. Register second test user via Google OAuth from `/pricing`. Verify commit. Clean up test users after.
  - Dependencies: 9.3
  - Risk: medium

## Execution notes

- Phases must run in order (1 → 2 → ... → 9)
- Within a phase, tasks may run in parallel unless a `Dependencies:` line says otherwise
- Each task should be executable in one sub-agent session
- Mark tasks `[-]` if in progress, `[x]` if complete
- Deployment order is strict: migration+RPC first, then frontend (per design section 9)
- Rollback: DOWN migration + revert frontend deploy

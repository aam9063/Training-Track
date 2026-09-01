# Specification — plan-selection-required

## Overview

Every new user of TrainingTrack MUST explicitly choose a subscription plan (free or paid) before gaining access to the application, regardless of entry point (email/password wizard, Google OAuth, pricing deep link, or direct `/register` landing). Coached athletes (invited by a coach) are exempt and are auto-assigned `athlete_free`. Existing users are grandfathered via a one-time backfill of `users.plan_selected_at = created_at`. The feature introduces a blocking route `/select-plan`, a plan-selector wizard step, a server-side commit path for free-plan subscriptions, and an AuthContext race fix (`profileLoaded` flag) to prevent flash-redirects.

All UI copy is Spanish (es-ES). The specification uses RFC 2119 keywords (MUST, SHALL, SHOULD, MAY) and Given/When/Then scenarios.

## Terminology

- **New user**: Any user whose `users.plan_selected_at IS NULL` at authentication time.
- **Coached athlete**: A user with `role = 'athlete'` registered via coach invite (`?invite=<coachId>`) or manual `coachEmail` field (NOT `independent_athlete`).
- **Grandfathered user**: An existing user in the DB at migration time whose `plan_selected_at` is backfilled to `created_at`.
- **Pending plan**: A plan key held transiently in `sessionStorage` under key `pending_plan_selection` during Google OAuth roundtrips. Format: `{ planKey: string, interval: 'month'|'year', role: string }`.
- **Paid plan intent**: A row in `users` with `selected_plan` set to a paid `plan_key` but NO row in `subscriptions`. User is in trial until `trial_ends_at`.
- **Free plan commit**: Atomic server-side operation that sets `users.plan_selected_at`, `users.selected_plan`, AND inserts a row in `subscriptions` with `status='active'`.
- **Plan whitelist**: The set `{coach_free, coach_pro, coach_team, athlete_free, athlete_premium}` (derived from `planFeatures.js`).
- **Role whitelist**: `coach_*` plans require `role IN ('coach')`; `athlete_*` plans require `role IN ('athlete','independent_athlete')`.

## Scenarios

### 1. Email/Password Registration

#### Scenario 1: Deep link from pricing with valid plan

- **GIVEN** a visitor on `/pricing` clicks the "Coach Pro" monthly CTA
- **WHEN** the visitor lands on `/register?plan=coach_pro&interval=month` and completes the wizard
- **THEN** the wizard MUST skip the plan-selection step
- **AND** on successful submit the backend MUST set `users.plan_selected_at = now()` and `users.selected_plan = 'coach_pro'`
- **AND** NO row MUST be inserted in `subscriptions`
- **AND** `users.trial_ends_at` MUST equal `now() + 14 days`

#### Scenario 2: Direct /register landing without plan param

- **GIVEN** a visitor navigates to `/register` directly
- **WHEN** they select role `coach` and advance the wizard
- **THEN** the wizard MUST display a plan-selection step BEFORE the personal-data form
- **AND** the step MUST show all plans valid for the chosen role

#### Scenario 3: Picking a Free plan in the wizard

- **GIVEN** a new user on the wizard plan step
- **WHEN** they select "Coach Free" and submit the form
- **THEN** the system MUST call the `select-plan` Edge Function
- **AND** a row MUST be inserted in `subscriptions` with `plan_key='coach_free'`, `status='active'`, null stripe fields
- **AND** `users.plan_selected_at` MUST be set to `now()`
- **AND** a success toast "¡Listo! Disfruta de tus 14 días de prueba" MUST be shown

#### Scenario 4: Picking a Paid plan in the wizard

- **GIVEN** a new user on the wizard plan step
- **WHEN** they select "Coach Pro" (monthly) and submit the form
- **THEN** the system MUST set `users.plan_selected_at = now()` and `users.selected_plan = 'coach_pro'`
- **AND** NO row MUST be inserted in `subscriptions`
- **AND** a toast "Tu prueba de 14 días ha comenzado. Completa el pago antes de que termine para mantener el acceso." MUST be shown

#### Scenario 5: User attempts to skip plan selection

- **GIVEN** the wizard is on the plan-selection step
- **WHEN** the user clicks "Siguiente" without selecting any plan card
- **THEN** the button MUST be disabled and an inline error "Debes elegir un plan para continuar" MUST be shown
- **AND** the wizard MUST NOT advance

#### Scenario 6: Invalid plan_key in URL

- **GIVEN** a visitor lands on `/register?plan=hacker_ultra`
- **WHEN** the wizard reads the query param
- **THEN** the system MUST ignore the invalid value
- **AND** the wizard MUST display the plan-selection step as if no `?plan=` were present

#### Scenario 7: Duplicate email during signup

- **GIVEN** an email already exists in `auth.users`
- **WHEN** the user submits the wizard with that email
- **THEN** `supabase.auth.signUp` MUST return an error
- **AND** NO row MUST be inserted in `public.users` or `subscriptions`
- **AND** `users.plan_selected_at` MUST NOT be set for any user
- **AND** the wizard MUST display the Supabase error in Spanish

#### Scenario 8: Free plan → subscription row active

- **GIVEN** a new user completes Free plan registration
- **WHEN** the commit function resolves
- **THEN** `SELECT status FROM subscriptions WHERE user_id = <new>` MUST return `'active'`

#### Scenario 9: Paid plan → no subscription row

- **GIVEN** a new user completes Paid plan registration
- **WHEN** the commit function resolves
- **THEN** `SELECT COUNT(*) FROM subscriptions WHERE user_id = <new>` MUST return `0`

#### Scenario 10: plan_selected_at always set on success

- **GIVEN** any successful email/password registration (free OR paid)
- **WHEN** the transaction completes
- **THEN** `users.plan_selected_at` MUST be non-NULL

#### Scenario 11: 14-day trial always set

- **GIVEN** any successful email/password registration
- **WHEN** the trigger `set_trial_on_signup` fires
- **THEN** `users.trial_ends_at` MUST equal `users.created_at + interval '14 days'` (±1 second)

### 2. Coached Athlete Registration

#### Scenario 12: Coach invite link skips plan step

- **GIVEN** an athlete clicks a coach invite link `/register?invite=<coachId>`
- **WHEN** the wizard detects the invite param
- **THEN** the wizard MUST skip both the role step AND the plan-selection step
- **AND** advance directly to the personal-data form

#### Scenario 13: Coached athlete gets athlete_free automatically

- **GIVEN** a coached athlete submits the wizard
- **WHEN** the backend processes the signup
- **THEN** a row MUST be inserted in `subscriptions` with `plan_key='athlete_free'`, `status='active'`
- **AND** `coach_athlete_relationship` MUST be created

#### Scenario 14: Coached athlete plan_selected_at set

- **GIVEN** a coached athlete has just registered
- **WHEN** the DB transaction completes
- **THEN** `users.plan_selected_at` MUST equal `users.created_at` (±1 second)

### 3. Google OAuth — First-Time Registration

#### Scenario 15: OAuth from /pricing with plan pre-selected

- **GIVEN** a visitor on `/pricing` selects "Coach Pro (mensual)" and clicks "Continuar con Google"
- **WHEN** the handler executes
- **THEN** the system MUST write `{planKey:'coach_pro', interval:'month', role:'coach'}` to `sessionStorage['pending_plan_selection']` BEFORE calling `supabase.auth.signInWithOAuth`

#### Scenario 16: OAuth callback commits pending plan

- **GIVEN** Google returns to `/auth/callback` and a session is available
- **WHEN** `AuthCallback` detects a new user AND `sessionStorage['pending_plan_selection']` is populated
- **THEN** the callback MUST call `select-plan` with the stored plan
- **AND** clear `sessionStorage['pending_plan_selection']`
- **AND** navigate to the role-appropriate dashboard

#### Scenario 17: OAuth from /register without plan → /select-plan

- **GIVEN** a user clicks "Continuar con Google" on `/register` without having selected a plan
- **WHEN** the callback runs and `sessionStorage['pending_plan_selection']` is empty AND `users.plan_selected_at IS NULL`
- **THEN** the user MUST be redirected to `/select-plan`

#### Scenario 18: Completing /select-plan after OAuth

- **GIVEN** an authenticated user on `/select-plan`
- **WHEN** they select a plan and click "Siguiente"
- **THEN** the commit MUST succeed and the user MUST be redirected to their role-appropriate dashboard

#### Scenario 19: Multi-tab OAuth independence

- **GIVEN** two browser tabs each performing Google OAuth with different plans
- **WHEN** both callbacks run
- **THEN** each tab's `sessionStorage` MUST be isolated and each callback MUST commit its own plan without interference

#### Scenario 20: Role mismatch in stored plan

- **GIVEN** `sessionStorage['pending_plan_selection']` contains `{planKey:'coach_pro', role:'coach'}` but the Google account is registered as `athlete`
- **WHEN** `AuthCallback` processes it
- **THEN** the commit MUST be rejected by the Edge Function with 400
- **AND** `sessionStorage` MUST be cleared
- **AND** the user MUST be redirected to `/select-plan`

### 4. Google OAuth — Returning User

#### Scenario 21: Returning Google user skips /select-plan

- **GIVEN** an existing user with `plan_selected_at IS NOT NULL` logs in via Google
- **WHEN** `AuthCallback` runs
- **THEN** the callback MUST ignore any `sessionStorage['pending_plan_selection']` content
- **AND** redirect directly to the role dashboard
- **AND** NOT modify `users.plan_selected_at` or `users.selected_plan`

### 5. Existing Users (Grandfathered)

#### Scenario 22: Grandfathered user never redirected

- **GIVEN** a user created before the migration ran
- **WHEN** they log in after deployment
- **THEN** `users.plan_selected_at` MUST equal `users.created_at`
- **AND** `PlanSelectionGuard` MUST NOT redirect them to `/select-plan`

#### Scenario 23: Exempt user unaffected

- **GIVEN** an existing user with `is_exempt = true`
- **WHEN** they log in
- **THEN** behavior MUST be unchanged (still bypasses paywall, still has `plan_selected_at` set by backfill)

#### Scenario 24: Existing user upgrades via /pricing

- **GIVEN** an existing user with `plan_selected_at` set
- **WHEN** they navigate to `/pricing` and click a paid plan CTA
- **THEN** they MUST be sent to Stripe Checkout as today (no new plan-selector flow)

### 6. Route Guard Behavior

#### Scenario 25: Guard waits for profileLoaded

- **GIVEN** a user has just authenticated and `AuthContext.profileLoaded === false`
- **WHEN** `PlanSelectionGuard` mounts
- **THEN** the guard MUST render a neutral loading state (or nothing) and MUST NOT redirect
- **AND** the guard MUST re-evaluate once `profileLoaded === true`

#### Scenario 26: New user redirected from coach dashboard

- **GIVEN** an authenticated user with `plan_selected_at IS NULL`, role `coach`, not admin
- **WHEN** they navigate to `/dashboard`
- **THEN** `PlanSelectionGuard` MUST render `<Navigate to="/select-plan" replace />`

#### Scenario 27: New user redirected from athlete route

- **GIVEN** an authenticated user with `plan_selected_at IS NULL`, role `athlete`
- **WHEN** they navigate to `/athlete/training`
- **THEN** `PlanSelectionGuard` MUST redirect to `/select-plan`

#### Scenario 28: User with plan on /select-plan

- **GIVEN** an authenticated user with `plan_selected_at IS NOT NULL`
- **WHEN** they navigate to `/select-plan`
- **THEN** the page MUST redirect them to the role-appropriate dashboard

#### Scenario 29: Logout while on /select-plan

- **GIVEN** a user on `/select-plan` with `plan_selected_at IS NULL`
- **WHEN** they click Logout
- **THEN** the session MUST be destroyed and they MUST be redirected to the landing page
- **AND** `users.plan_selected_at` MUST remain NULL (recoverable on next login)

### 7. Paid Plan Post-Registration

#### Scenario 30: Paid trial grants Premium

- **GIVEN** a user registered with `selected_plan = 'coach_pro'` and NO subscription row
- **WHEN** `useSubscription` evaluates within the trial window
- **THEN** `effectivePlan` MUST be Premium (via `isTrialing = true`)

#### Scenario 31: Stripe Checkout during trial

- **GIVEN** a trialing paid-intent user completes Stripe Checkout
- **WHEN** the `stripe-webhook` processes `checkout.session.completed`
- **THEN** a row MUST be upserted in `subscriptions` with `plan_key='coach_pro'`, `status='active'`
- **AND** from that point `useSubscription` MUST derive access from the subscription row (not trial)

#### Scenario 32: Trial expires without payment → paywall

- **GIVEN** a paid-intent user whose `trial_ends_at < now()` and still has no subscription row
- **WHEN** they navigate to any protected route
- **THEN** `SubscriptionGuard` MUST show the paywall modal
- **AND** the user MUST still be able to navigate to `/pricing` and complete checkout OR choose Free

#### Scenario 33: Selected_plan preserved after trial expiry

- **GIVEN** a user whose paid trial has expired without payment
- **WHEN** the paywall UI reads `users.selected_plan`
- **THEN** the value MUST still equal the originally chosen `coach_pro` (for UI messaging like "Completa el pago para Coach Pro")

#### Scenario 34: Paid user downgrades to Free post-registration

- **GIVEN** a user with `selected_plan='coach_pro'` and no subscription row
- **WHEN** they navigate to `/pricing` and click "Empezar gratis"
- **THEN** the system MUST call `commit-free-subscription` with `plan_key='coach_free'`
- **AND** a `subscriptions` row MUST be created with `plan_key='coach_free'`, `status='active'`
- **AND** `users.selected_plan` MUST be updated to `'coach_free'`

### 8. Free Plan Post-Registration

#### Scenario 35: Free trial grants Premium features

- **GIVEN** a user who chose Free and has `trial_ends_at > now()`
- **WHEN** `useSubscription` evaluates
- **THEN** Premium features MUST be accessible during the trial window

#### Scenario 36: Free matrix applies after trial

- **GIVEN** the same user once `trial_ends_at <= now()`
- **WHEN** `useSubscription` evaluates
- **THEN** the Free feature matrix MUST apply (e.g. athlete cap, gym files count)
- **AND** the user MUST retain read access to the app (no paywall)

#### Scenario 37: Free user upgrades via /pricing

- **GIVEN** a user with `plan_key='coach_free'` in subscriptions
- **WHEN** they click a paid CTA on `/pricing`
- **THEN** they MUST be directed to Stripe Checkout
- **AND** after payment the webhook MUST upsert their subscription row to the new plan

#### Scenario 38: Admin dashboard shows Free plan label

- **GIVEN** a new free user exists
- **WHEN** an admin views their detail page
- **THEN** the plan field MUST read `coach_free` or `athlete_free` (NOT "Sin suscripción")
- **AND** the status field MUST read `Activa`

### 9. Backend Security / RLS

#### Scenario 39: Client cannot update plan_selected_at directly

- **GIVEN** an authenticated user session
- **WHEN** the client attempts `supabase.from('users').update({plan_selected_at: now}).eq('id', auth.uid())`
- **THEN** the request MUST be rejected by RLS (no matching UPDATE policy)

#### Scenario 40: Client cannot insert subscriptions directly

- **GIVEN** an authenticated user session
- **WHEN** the client attempts `supabase.from('subscriptions').insert({user_id: auth.uid(), plan_key: 'coach_free'})`
- **THEN** the request MUST be rejected by RLS

#### Scenario 41: Edge Function validates plan_key whitelist

- **GIVEN** the `select-plan` Edge Function receives a request with `plan_key = 'hacker_enterprise'`
- **WHEN** the function validates the payload
- **THEN** it MUST respond with HTTP 400 and body `{error: 'invalid_plan_key'}`
- **AND** MUST NOT modify any DB row

#### Scenario 42: Edge Function validates role/plan alignment

- **GIVEN** a caller with `users.role = 'athlete'` requests `plan_key = 'coach_pro'`
- **WHEN** the function validates the role-plan mapping
- **THEN** it MUST respond with HTTP 400 and body `{error: 'role_plan_mismatch'}`
- **AND** MUST NOT modify any DB row

### 10. Migration Behavior

#### Scenario 43: Migration adds plan_selected_at column

- **GIVEN** the `plan_selection_required` migration executes against the production DB
- **WHEN** it completes
- **THEN** `information_schema.columns` MUST show `users.plan_selected_at` (`timestamptz`, nullable)

#### Scenario 44: Migration adds selected_plan column

- **GIVEN** the same migration
- **WHEN** it completes
- **THEN** `information_schema.columns` MUST show `users.selected_plan` (`text`, nullable)

#### Scenario 45: Backfill in same transaction

- **GIVEN** the migration transaction
- **WHEN** the DDL `ADD COLUMN plan_selected_at` and the DML `UPDATE users SET plan_selected_at = created_at` execute
- **THEN** both statements MUST be wrapped in a single transaction block
- **AND** MUST NOT be split across separate migration files

#### Scenario 46: No NULL plan_selected_at post-migration

- **GIVEN** the migration has completed successfully
- **WHEN** `SELECT COUNT(*) FROM users WHERE plan_selected_at IS NULL` runs
- **THEN** the result MUST be `0`

### 11. Idempotency / Edge Cases

#### Scenario 47: Abandoned wizard before submit

- **GIVEN** a user opens `/register`, picks a plan, but closes the browser before submitting
- **WHEN** the browser closes
- **THEN** NO row MUST exist in `auth.users`, `public.users`, or `subscriptions` for that email
- **AND** no partial state MUST persist (sessionStorage MAY hold the pending plan but is irrelevant)

#### Scenario 48: Email/password signup with unverified email

- **GIVEN** a user completes email/password registration but never verifies the email
- **WHEN** the DB state is inspected
- **THEN** `public.users` row MUST exist (trigger) and `users.plan_selected_at` MUST be set synchronously by the commit path
- **AND** for Free plan: the `subscriptions` row MUST also exist
- **AND** the user MUST still be unable to log in until email verification (benign state)

#### Scenario 49: Network failure during commit

- **GIVEN** email/password signup succeeds but the subsequent `select-plan` Edge Function call fails
- **WHEN** the user later verifies email and logs in
- **THEN** `users.plan_selected_at` MUST still be NULL
- **AND** `PlanSelectionGuard` MUST redirect them to `/select-plan` so they can retry the commit

#### Scenario 50: Duplicate Google signup

- **GIVEN** a Google account that has already registered once
- **WHEN** the user clicks "Continuar con Google" again
- **THEN** Supabase Auth MUST return the same user session (not a new user)
- **AND** `AuthCallback` MUST detect `plan_selected_at IS NOT NULL` and skip the commit path
- **AND** the user MUST be redirected to their dashboard

## Data Requirements

### Columns added to `public.users`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `plan_selected_at` | `timestamptz` | YES | NULL until plan commit; backfilled to `created_at` for existing users |
| `selected_plan` | `text` | YES | Plan key (free or paid) chosen by user; informational |

### Constraints on `subscriptions` (verify nullable)

`stripe_subscription_id`, `stripe_price_id`, `billing_interval`, `current_period_start`, `current_period_end` MUST be nullable to support free-plan rows. If currently NOT NULL, the migration MUST include `ALTER COLUMN ... DROP NOT NULL`.

### RLS policies

- `users`: user SELECT own row (existing). NO client UPDATE policy on `plan_selected_at` or `selected_plan` — writes only via service role / Edge Function.
- `subscriptions`: user SELECT own (existing). NO client INSERT policy. Writes only via `select-plan` Edge Function (service role) or `stripe-webhook`.

## UI Requirements (Spanish, es-ES)

| Element | Copy |
|---------|------|
| Plan selector heading | `Elige tu plan` |
| Plan selector subtitle | `Todos los planes incluyen 14 días de prueba gratis` |
| Primary button (disabled until selection) | `Siguiente` |
| Skip-attempt error | `Debes elegir un plan para continuar` |
| `/select-plan` page heading | `¡Bienvenido! Elige tu plan para continuar` |
| `/select-plan` page subtitle | `Para acceder a TrainingTrack necesitas seleccionar un plan. Todos incluyen 14 días de prueba gratis y puedes cambiarlo más tarde.` |
| Toast after free commit | `¡Listo! Disfruta de tus 14 días de prueba` |
| Toast after paid commit (no payment yet) | `Tu prueba de 14 días ha comenzado. Completa el pago antes de que termine para mantener el acceso.` |
| Guard loading state | `Cargando tu perfil...` |

The plan-selector component MUST render plan cards with: plan name, price, billing interval toggle (mes/año), feature bullet list, and a "Seleccionar" button. The currently selected card MUST show a visible selected state (border + checkmark). All plan data SHOULD come from `src/lib/planFeatures.js`.

## Security Requirements

- The `select-plan` Edge Function MUST authenticate the caller via the Supabase JWT.
- The function MUST validate `plan_key` against the whitelist `{coach_free, coach_pro, coach_team, athlete_free, athlete_premium}`.
- The function MUST validate `role`/`plan_key` alignment per the role-whitelist rule.
- The function MUST reject requests where `users.plan_selected_at IS NOT NULL` for non-free plan changes (prevent plan downgrade abuse — use `/pricing` flow instead).
- The function MUST run as service role to bypass RLS for the atomic `subscriptions` insert + `users` update.
- `users.plan_selected_at` and `users.selected_plan` MUST NOT be writable by authenticated clients via direct SQL (no UPDATE RLS policy covers them).
- The feature MUST NOT introduce any new CSRF surface beyond what Supabase JWT verification already provides.

## Performance Requirements

- `PlanSelectionGuard` MUST add no more than 50ms to route navigation in the steady state (after `profileLoaded`).
- The `select-plan` Edge Function MUST complete in under 500ms at p95 (single DB transaction: one INSERT into `subscriptions` + one UPDATE on `users`).
- The AuthContext `profileLoaded` flag MUST NOT delay `loading=false` by more than 300ms at p95.
- The migration backfill MUST run in a single SQL statement and SHOULD complete in under 2 seconds for a DB with <10,000 users.

## Accessibility Requirements

- The plan-selector cards MUST be keyboard navigable (Tab to move between cards, Space/Enter to select).
- Each plan card MUST have an accessible name including plan name, price, and interval (e.g. `Coach Pro, 19 euros al mes`).
- Selected state MUST be exposed via `aria-pressed="true"` or `role="radio" aria-checked="true"`.
- The error message "Debes elegir un plan para continuar" MUST be wired to the submit button via `aria-describedby` and announced to screen readers via `role="alert"`.
- The `/select-plan` page MUST have a single `<h1>` matching the heading copy.
- Color MUST NOT be the only indicator of the selected card (a checkmark icon or border is required).
- Focus MUST remain trapped within the wizard step until selection is made and "Siguiente" is activated.

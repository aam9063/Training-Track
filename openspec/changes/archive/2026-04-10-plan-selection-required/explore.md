# Exploration — plan-selection-required

## Goal

Force every NEW user to explicitly choose a subscription plan during registration, regardless of entry point (email/password wizard, Google OAuth, or landing on `/register` directly). Existing users are grandfathered and must NOT be affected.

---

## Current state

### Registration wizard (email/password)

**File:** `src/hooks/useRegisterForm.js` + `src/pages/Register.jsx`

- Two-step wizard:
  - **Step 1**: Role cards (`coach` / `athlete` / `independent_athlete`). Selecting one calls `selectRole(role)` which sets `step = 2`.
  - **Step 2**: Form (name/email/password + optional `coachEmail` + terms). Submits to `signUp()` from `AuthContext`.
- Query params handled on mount via `useEffect(..., [searchParams])`:
  - `?invite=<coachId>` → looks up coach, pre-selects `athlete` role, jumps to step 2.
  - `?role=coach` → sets role, jumps to step 2.
  - `?role=independent` → sets role to `independent_athlete`, jumps to step 2.
  - `?role=athlete` → sets role to `athlete`, jumps to step 2.
  - **`?plan=X` is NOT read today.** Pricing page already passes it but `useRegisterForm` silently ignores it.
- Actual signup happens in `onSubmit` → calls `signUp({ email, password, role, firstName, lastName, coachEmail, coachId, isIndependent })` in `AuthContext.jsx` (line 182).
- `signUp` in AuthContext does `supabase.auth.signUp` with `options.data` metadata; the DB trigger `handle_new_user` creates the `public.users` row, and `set_trial_on_signup` sets `trial_ends_at = now() + 14 days`.
- After signup: `navigate('/login')` with success message (no auto-login; user must verify email first).
- **No plan data is ever persisted** for new email/password signups — they simply enter the trial.

**Insertion point for plan step:** A new step (either step 1.5 or step 2 pushed to 3) between role selection and the form. When `?plan=` is present in the URL, skip the plan step and carry the chosen plan through to submit.

### Google OAuth flow

**Files:** `src/contexts/AuthContext.jsx` (`signInWithGoogle`, line 223) and `src/pages/AuthCallback.jsx`.

- `signInWithGoogle(metadata)` is called from `useRegisterForm.handleGoogleRegister()`. It requires `role` to already be set (step 2 reached). It writes `{ role, coachId, coachEmail }` into **`localStorage`** (`google_oauth_metadata`) BEFORE calling `supabase.auth.signInWithOAuth({ provider: 'google', redirectTo: /auth/callback })`.
- `AuthCallback.jsx`:
  1. Waits for session via `getSession()` (1s retry if needed).
  2. Reads `google_oauth_metadata` from localStorage and removes it.
  3. If metadata exists → this is a NEW registration: updates `auth.users.user_metadata`, upserts `public.users` row (role, first_name, last_name, auth_provider='google'), upserts `athletes`/`coaches` row, and optionally creates `coach_athlete_relationship`.
  4. Redirects to `/athlete/dashboard` or `/dashboard`.
  5. If NO metadata → this is a LOGIN, just redirect by role.
- **No plan logic at any point.** No sessionStorage/localStorage `plan` is saved or read.
- Google users skip the wizard entirely when hitting `/login`'s Google button OR when clicking Google on register step 2. The callback goes straight into the dashboard with full trial access.

**Entry points for Google that bypass any future `/select-plan`:**
- `/register` → Google button (role is set, but no plan chosen).
- `/login` → Google button (no role, no plan — relies on `handle_new_user` default or existing row).

### AuthContext & profile shape

**File:** `src/contexts/AuthContext.jsx`

- `AuthProvider` holds: `user` (auth user), `profile` (hybrid: session metadata → fills in from DB in background), `loading`.
- `fetchProfile(userId, sessionUser)` does:
  1. Fallback profile from `sessionUser.user_metadata` (instant).
  2. `users` table select.
  3. If `is_active === false` → sign out, return null.
  4. Role-specific join (`coaches` or `athletes` with `coach_athlete_relationship`).
  5. `subscriptions` table `.maybeSingle()`.
  6. Returns `{ ...userData, coach|athlete: roleData, subscription }`.
- `onAuthStateChange` sets an initial metadata-based profile immediately, then fetches DB profile in background. **This means `profile` exists before the DB fetch completes.**
- Context exposes: `user`, `profile`, `loading`, `isCoach`, `isAthlete`, `isIndependent`, `isAdmin`, plus mutations.
- **`profile` has `trial_ends_at`, `subscription`, `is_exempt`** — these drive `useSubscription`.
- **`profile` does NOT currently have any `plan_selected_at` or `selected_plan` field.** We'll need to add one to `users` table and surface it in `fetchProfile`.

**First-login detection:** There is no explicit "first login" flag. To detect "has not selected a plan yet", we need a DB column (proposed: `users.plan_selected_at timestamptz` — null for old users AND for new users who haven't chosen).

**Important race condition:** Because `profile` is first populated from metadata (which won't include `plan_selected_at`), any guard checking `profile.plan_selected_at` will see `undefined` on the first render and could flash-redirect to `/select-plan`. The guard must wait for `loading === false` AND for the DB fetch to complete. Current code sets `loading = false` before the DB fetch completes — this is a problem for the guard.

### Route guards

**File:** `src/App.jsx` + `src/layouts/DashboardLayout.jsx` + `src/layouts/AthleteDashboardLayout.jsx`

- No `PrivateRoute` component exists. Guarding is done inside each layout:
  - `DashboardLayout`: if `!user` → redirect to `/login`. If `userRole === 'athlete'` → redirect to `/athlete/dashboard`. Else render dashboard.
  - `AthleteDashboardLayout`: mirror — if `!user` → `/login`. If `userRole === 'coach'` → `/dashboard`.
- Each layout wraps its `<Outlet />` in `<SubscriptionGuard>` (which renders `<PaywallModal />` overlay when `needsPaywall` is true via `useSubscription`).
- `IndependentRoute` is a simple inline component (only for 3 independent-athlete routes).
- Admin has its own `AdminLayout`.

**Where the `plan_selected_at IS NULL → /select-plan` guard should live:** Inside both `DashboardLayout` and `AthleteDashboardLayout`, after the existing `!user` check. Or, cleaner, as a new wrapper/guard component used in both layouts (e.g. `PlanSelectionGuard`). The guard must:
- Skip if `loading` is still true (wait for DB profile fetch).
- Skip if the path is already `/select-plan`.
- Skip if user is admin (`profile.is_admin`).
- Skip if `plan_selected_at` is populated (covers old users too — we'll backfill them).
- Otherwise → `<Navigate to="/select-plan" replace />`.

### Subscriptions schema

No migration file in `supabase/migrations/` touches `subscriptions` (that folder is sparse; most SQL lives in ad-hoc `*.sql` files in `supabase/`). The schema must have been applied directly via Supabase SQL editor as part of the `stripe-subscriptions` change.

Reading the **`stripe-webhook/index.ts`** upsert tells us the columns that definitely exist:

```
subscriptions (
  user_id (PK / unique),
  stripe_subscription_id,
  stripe_price_id,
  plan_key,
  status,          -- 'active' | 'trialing' | 'past_due' | 'canceled' | ...
  billing_interval,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  updated_at
)
```

`onConflict: 'user_id'` proves **`user_id` has a unique constraint**. Free-plan rows for new users can be upserted with:
- `user_id = <uuid>`
- `stripe_subscription_id = NULL` (assuming nullable)
- `stripe_price_id = NULL`
- `plan_key = 'coach_free' | 'athlete_free'`
- `status = 'active'`
- `billing_interval = NULL`
- `current_period_start / end = NULL`

**Unknown / needs verification:** whether `stripe_subscription_id` and `stripe_price_id` are NOT NULL. If they are NOT NULL, a migration is required (`ALTER COLUMN ... DROP NOT NULL`). Given that `is_exempt` users currently have no `subscriptions` row either (only webhook-created rows exist today), nothing proves nullability yet.

There may also be a unique index on `stripe_subscription_id` — if so, multiple null values must be allowed (Postgres allows multiple NULLs in a UNIQUE by default, so this is fine).

**`users` table columns of interest (confirmed from code):**
- `id`, `email`, `first_name`, `last_name`, `role`, `is_active`, `is_admin`, `is_exempt`
- `trial_ends_at` (timestamptz, set by trigger)
- `stripe_customer_id` (set by stripe-webhook on checkout complete)
- `auth_provider` (set to `'google'` by AuthCallback)
- `created_at`, `last_login`, `profile_image`

**Does NOT exist yet:** `plan_selected_at`, `selected_plan`.

### Admin dashboard subscription display

**Files:** `src/pages/admin/UserDetail.jsx` + `supabase/functions/admin-api/index.ts`

- `admin-api` Edge Function fetches `subscriptions` via `.from("subscriptions").select("*").eq("user_id", payload.userId).maybeSingle()`.
- `UserDetail.jsx` renders (lines 277-318):
  - Trial until: `user.trial_ends_at`.
  - Plan: `user.subscription?.plan_key` or `'Sin suscripción'`.
  - Status: `user.subscription?.status` → `'active'|'past_due'|'canceled'` or `'Exento'` if `is_exempt` or else `'Sin suscripción'`.
- **Confirmed:** once new users get a real `subscriptions` row with `plan_key='coach_free'|'athlete_free'` and `status='active'`, the admin dashboard will automatically show `Coach Free` / `Athlete Free` + `Activa` instead of `Sin suscripción`. No admin UI changes required. (Raúl's case specifically: he's an existing user, so he stays as-is unless we backfill him manually.)

---

## Touchpoints — files that will change

### New files
- `src/pages/SelectPlan.jsx` — blocking page for users who landed without selecting a plan (Google OAuth fallback + safety net).
- `src/components/common/PlanSelectionGuard.jsx` — wrapper used by both layouts to enforce the check.
- `src/components/register/PlanStep.jsx` (or similar) — plan cards component reused in the wizard.
- `supabase/functions/select-plan/index.ts` — Edge Function (or RPC) called by frontend to commit the plan choice server-side (creates `subscriptions` row + updates `users.plan_selected_at` + optionally `users.selected_plan`). Service role needed to write.
- `supabase/migrations/YYYYMMDD_plan_selection_required.sql` — add `users.plan_selected_at`, optional `users.selected_plan`, backfill old users, ensure `subscriptions` FK columns are nullable.

### Modified files
- `src/hooks/useRegisterForm.js` — read `?plan=` and `?interval=`, add new step, carry plan in state, pass to submit handler.
- `src/pages/Register.jsx` — render the plan selection step (skipped when `?plan=` present).
- `src/contexts/AuthContext.jsx`:
  - `signUp(...)` — accept `planKey`, `billingInterval`, write them to user metadata, and after successful signup call the new `select-plan` Edge Function (or defer until first login).
  - `signInWithGoogle(metadata)` — use **sessionStorage** (not localStorage per user decision #4), and include `planKey` in metadata.
  - `fetchProfile` — include `plan_selected_at` (and `selected_plan` if added) in the returned profile.
  - Ensure `loading` only flips to `false` after the DB profile fetch finishes (to prevent guard flash).
- `src/pages/AuthCallback.jsx` — read `plan` from sessionStorage, persist plan choice via the Edge Function, set `plan_selected_at`. If no plan stored (someone landed on Google login directly for a brand-new account) → redirect to `/select-plan` instead of dashboard.
- `src/layouts/DashboardLayout.jsx` and `src/layouts/AthleteDashboardLayout.jsx` — insert `<PlanSelectionGuard>` wrapping the `<Outlet />` (or before).
- `src/App.jsx` — register the public `/select-plan` route (rendered behind auth, not behind a dashboard layout).
- `src/components/landing/Pricing.jsx` — already sends `?plan=`; verify `?interval=` is present too (yes, line 154: `&interval=${billingCycle === 'monthly' ? 'month' : 'year'}`). Consider switching storage to sessionStorage for the Google path.

### DB / backend
- New migration: `users.plan_selected_at timestamptz NULL` + optional `users.selected_plan text NULL`.
- Backfill migration: `UPDATE users SET plan_selected_at = created_at WHERE plan_selected_at IS NULL` executed **as part of the shipping migration** so every existing user is grandfathered as "already selected" and the guard never shows them `/select-plan`.
- Possibly: `ALTER TABLE subscriptions ALTER COLUMN stripe_subscription_id DROP NOT NULL;` (same for `stripe_price_id`, `current_period_start`, `current_period_end`) if currently non-nullable.
- New Edge Function `select-plan` (or a `SECURITY DEFINER` RPC) that upserts the `subscriptions` row for free plans and records `plan_selected_at` + `selected_plan` atomically.
- RLS consideration: the insert into `subscriptions` for free plans must be authorized. Easiest path = Edge Function with service role. Direct client insert would require a new RLS policy allowing users to insert their own free-plan row (with a check on `plan_key IN ('coach_free','athlete_free') AND stripe_subscription_id IS NULL`).

---

## Key design decisions (already made, documented for traceability)

1. **Hybrid plan selection** — Use `?plan=` from URL when present; otherwise show a plan selector step inside the `/register` wizard. `/register` entry alone still works without going through `/pricing` first.
2. **Free plan = real subscriptions row** — On picking Free, backend creates a row in `subscriptions` with `plan_key='coach_free'|'athlete_free'`, `status='active'`, null Stripe fields. Fixes the admin "Sin suscripción" inconsistency.
3. **Paid plan flow** — Register → email verify → login → trial (14 days). Mark `users.selected_plan = X` to remember the paid plan intent. Show banner during trial: "Añade método de pago antes del {date}". At trial end without payment → paywall. **Do NOT** force Stripe Checkout immediately after registration.
4. **Google OAuth** — Save `plan` in `sessionStorage` (not localStorage) BEFORE `signInWithOAuth`. In AuthCallback, read and apply it. If sessionStorage is empty (user landed on Google signup directly), redirect to the new blocking `/select-plan` page before granting app access.
5. **Existing users are grandfathered** — Do NOT affect anyone already in the DB (Raúl, coach@test.com, etc.). Backfill `users.plan_selected_at = created_at` in the migration so old users instantly satisfy the guard.
6. **SDD mode** — openspec (file-based artifacts under `openspec/changes/plan-selection-required/`).

---

## Open questions / risks

### Risks identified in the prompt

1. **Abandoned registration after plan pick, before email verify** — `supabase.auth.signUp` creates the `auth.users` row immediately (and triggers fire, creating `public.users` and `trial_ends_at`). If the user abandons before verifying email, we will have orphaned `public.users` rows without `plan_selected_at`. Options:
   - (a) Create the `subscriptions` row and set `plan_selected_at` **synchronously** inside `signUp()` right after `supabase.auth.signUp` resolves. Even unverified users get a free row — acceptable, because they can't sign in anyway until verification.
   - (b) Defer plan commit to first login. Requires storing chosen plan in user metadata `options.data.pending_plan_key` and having the DB trigger or client post-login hook apply it. More robust against the "user closes tab mid-flow" case.
   - **Recommendation**: (a) — synchronous commit keeps state consistent and matches decision #2.
2. **Paid plan picked but never paid within trial** — After trial ends, `useSubscription` currently returns `effectivePlan = free` because `hasActiveSubscription` is false and `isTrialing` is false. If we also write the free-plan row on register, the subscription row exists with `plan_key='coach_free'` (if picked free) OR with the paid plan_key but `status='incomplete'|'past_due'|null` (if picked paid and never paid). We need a clear rule: **"selected a paid plan but never paid"** → effective plan must be the role's free plan (or blocked). Proposed: if the user picks a paid plan, DO NOT write a subscription row yet — only set `users.selected_plan = X` and `users.plan_selected_at`. The `subscriptions` row is only created when the trial ends with payment OR on successful Stripe Checkout. If picked free, write the row immediately. This keeps useSubscription logic clean.
3. **Google OAuth race condition** — `AuthContext.onAuthStateChange` fires before `AuthCallback` has persisted the plan. Current `loading = false` is set immediately from metadata, so `PlanSelectionGuard` could race and redirect to `/select-plan` BEFORE AuthCallback commits the plan. Mitigations:
   - Have `AuthCallback` stay on its loading screen until the plan commit is done, THEN navigate.
   - Make `PlanSelectionGuard` wait for `profile?.id` AND a DB-fetched profile (track a `profileLoaded` flag separately from `loading`).
   - Have `AuthCallback` skip `PlanSelectionGuard` by navigating after the commit is finalized.
4. **Bypass of `/select-plan` via direct API call** — A determined user could call the app's routes directly or manipulate client state. Defense: the guard is client-side, but backend enforcement is stronger. Options:
   - RLS policy on key tables (e.g. `training_sessions`, `athlete_profile`) that requires `EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND plan_selected_at IS NOT NULL)`.
   - Lightweight: no backend enforcement, rely on the guard. For MVP, client-side only is acceptable.
5. **Invite-link athletes (`?invite=<coachId>`)** — These users are being onboarded by a coach. Should they also be forced to pick a plan? Two subcases:
   - Coached athletes (role `athlete` with a coach): probably should NOT pick their own plan (their coach's plan covers them; there's no athlete_free vs athlete_premium distinction for coached athletes in the pricing page). Need to confirm — `athletePlans` in `Pricing.jsx` only targets `independent_athlete`.
   - Recommendation: **Skip the plan step entirely for coached athletes** (both invite-link and manual `coachEmail` flow). Auto-assign them `athlete_free` (or `null` — but then backfill handles the "old user" case, and these new ones would still satisfy the guard if we set `plan_selected_at` automatically at registration). Backfill `plan_selected_at = now()` for them.
6. **Admin users** — Must bypass the guard (admin has its own login at `/admin/login` and its own layout that doesn't use `PlanSelectionGuard`, so this is already fine as long as we only inject the guard into `DashboardLayout` and `AthleteDashboardLayout`).
7. **`loading` gate in AuthContext** — Currently `setLoading(false)` runs BEFORE `fetchProfile` resolves. The guard will see stale/metadata-only profile and could misfire. Fix: introduce a `profileLoaded` boolean OR delay `setLoading(false)` until DB fetch resolves.
8. **`subscriptions.user_id` unique constraint** — Already confirmed via webhook's `onConflict: 'user_id'`. Good.
9. **Nullability of `stripe_subscription_id` / `stripe_price_id`** — Must verify against live DB. If NOT NULL, migration required.
10. **`trial_ends_at` still set on everyone** — The `set_trial_on_signup` trigger will still fire. If the user picks Free, they technically also get a trial, but `useSubscription` correctly subordinates trial to subscription (an active `coach_free` row means `isTrialing = false` because `!subscription` is false). Double-check this: in `useSubscription.js` line 44, `isTrialing = trialEndsAt && trialEndsAt > now && !subscription`. Good — with a subscription row, `isTrialing = false`, no false-positive banner for free users. But free users will see features gated to `coach_free`/`athlete_free` immediately, losing the "14-day full access trial". Is that intended? **Open question for propose phase**: should free-plan users still get 14 days of full access (trial), or should they immediately get free-tier limits? Per decision #3, trial is for paid-plan pickers — free-plan pickers should probably NOT get a trial (or if they do, it's purely informational). Recommendation: set `trial_ends_at = NULL` for users who pick Free (or skip the trial trigger for them). This needs confirmation.

### New questions surfaced during exploration

11. **Existing trigger `handle_new_user`** — does it already do anything with metadata that might conflict with our Edge Function writing to `subscriptions`? Need to read the trigger body.
12. **Email verification window** — Supabase's default email verify flow means the user clicks a link in their inbox → lands on `/login` (or directly signed in). At what point does the guard run? First time the user hits a protected layout, which is after login. By then the subscription row is already committed (if we do synchronous commit on signup).
13. **RLS on `subscriptions` for the user's own row** — currently free users have NO row, so there's been no need for SELECT RLS that returns a real row. Must verify the SELECT policy allows the user to read their own subscription row. `fetchProfile` already does `.eq('user_id', userId)`, which works if the policy is `user_id = (select auth.uid())`.
14. **Should `/select-plan` be accessible to LOGGED-OUT users?** No — it should require auth. If someone hits `/select-plan` without a session, redirect to `/login`. The page is specifically for "logged in but hasn't selected".
15. **Multiple browser tabs / stale state** — User picks plan in tab A, the other tab B still has an old profile without `plan_selected_at`. Refresh/re-fetch pattern? Probably acceptable to ignore; the guard re-runs on next navigation.

---

## Recommended next phase

Go to **sdd-propose** next.

### Dependencies for downstream phases

- **sdd-propose** (next) — reads this exploration. Produces the change proposal with scope, out-of-scope, and approach summary.
- **sdd-spec** — needs the proposal. Delta specs against existing capabilities:
  - `auth-and-registration` (modify — new plan step, Google sessionStorage, AuthCallback plan commit)
  - `subscription-management` (modify — free plan creates real row; guards; `plan_selected_at` column)
- **sdd-design** — needs the proposal. Must cover:
  - `PlanSelectionGuard` component contract and its placement in both layouts.
  - AuthContext `loading`/`profileLoaded` split to eliminate race.
  - Migration plan: `users.plan_selected_at`, `users.selected_plan`, backfill old users, subscriptions nullability.
  - Edge Function `select-plan` signature and RLS implications.
  - Free vs paid plan commit strategy (free → write row; paid → only mark `selected_plan`).
  - Handling of coached athletes (invite + manual coachEmail) — skip plan step.
- **sdd-tasks** — needs spec + design. Task list including migration, backend function, frontend wizard step, guard component, AuthCallback update, and manual backfill verification.
- **sdd-apply** — implements tasks.
- **sdd-verify** — must re-check Raúl's user (existing) is NOT blocked and admin dashboard still shows him correctly.

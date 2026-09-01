# Proposal: Plan Selection Required on Registration

## Why

- New users register without ever picking a plan (Raúl García Illán case). Admin dashboard shows "Sin suscripción", product has no signal of intent, and there is no attribution/conversion data.
- Pricing page links (`/register?plan=X`) already pass the plan, but the wizard silently ignores it.
- Free users need a visible "Free" status in admin and in-app instead of ambiguous `null`.
- Google OAuth bypass leaves users in dashboards without any plan choice ever recorded.

## What Changes

- **Registration wizard**: new plan-selector step when `?plan=` is absent. When present, honor it and skip the step (hybrid flow).
- **Coached athletes** (invited via coach link / `coachEmail`): skip plan selection entirely — auto-assign `athlete_free`, set `plan_selected_at = created_at`. Coach pays, athlete never sees a plan screen.
- **Free plan**: creates a real `subscriptions` row immediately on signup (`plan_key='coach_free'|'athlete_free'`, `status='active'`, null stripe IDs). Still gets `trial_ends_at = now() + 14 days` with Premium features during trial; drops to Free matrix after.
- **Paid plan**: only sets `users.selected_plan` + `users.plan_selected_at`. NO `subscriptions` row until Stripe webhook fires. During trial `useSubscription` grants Premium via `trial_ends_at`. Trial expires without payment → paywall.
- **Google OAuth**: save chosen plan in `sessionStorage` (`pending_plan_selection`) before `signInWithOAuth`. `AuthCallback` reads and commits it. If empty AND `plan_selected_at IS NULL` → redirect to new blocking page `/select-plan`.
- **New blocking route `/select-plan`**: only visible to authenticated users with `plan_selected_at IS NULL`. Not admin. Not coached athletes.
- **AuthContext race fix**: add `profileLoaded` flag. Guards must wait for `profileLoaded === true` before deciding to redirect — eliminates flash-redirect on new sessions.
- **Route guards** in `DashboardLayout` and `AthleteDashboardLayout`: after `!user` check, if `profileLoaded && !plan_selected_at && !is_admin` → `Navigate /select-plan`.
- **DB migration**: add `users.plan_selected_at timestamptz NULL` + `users.selected_plan text NULL`. Backfill `UPDATE users SET plan_selected_at = created_at WHERE plan_selected_at IS NULL` in the SAME migration to grandfather existing users.
- **Server-side commit path**: free-plan subscription insert via Edge Function or `SECURITY DEFINER` RPC (clients cannot insert into `subscriptions` directly under current RLS).

## Locked User Decisions (verbatim)

1. **Hybrid plan selection**: `/register?plan=X` from /pricing is honored. `/register` without `?plan=` shows a plan-selector step in the wizard.
2. **Coached athletes skip plan selection entirely**. Atletas que llegan vía invite-link de un coach NO pagan nada — el coach paga. Se les asigna `athlete_free` automáticamente y su `plan_selected_at` se marca junto con `created_at`. No ven pantalla de plan.
3. **Free plan has 14-day trial with Premium features**. Users who pick Free still get `trial_ends_at = now() + 14 days`. During trial they access Premium features. After trial, they drop to Free feature matrix. This matches the "14 días de prueba gratis" promise on the landing.
4. **Paid plan = no subscriptions row until Stripe payment confirmed**. On registration with a paid plan, we only set `users.selected_plan` + `users.plan_selected_at`. NO row in `subscriptions` yet. During trial, `useSubscription` derives Premium access from `trial_ends_at`. When user pays via Stripe Checkout, webhook upserts subscriptions row. If trial expires without payment, paywall blocks access.
5. **Free plan DOES create subscriptions row** immediately on registration: `plan_key='coach_free'|'athlete_free'`, `status='active'`, null stripe IDs. Solves admin dashboard "Sin suscripción" confusion for free users.
6. **Google OAuth**: Before initiating `signInWithOAuth`, save selected plan to `sessionStorage` (key: `pending_plan_selection`). In `AuthCallback`, read it and commit. If sessionStorage is empty AND `plan_selected_at IS NULL`, redirect to new blocking page `/select-plan` after OAuth completes. Existing Google OAuth metadata already uses localStorage — switch to sessionStorage per this decision OR keep localStorage but add the plan key separately (whichever is cleaner, decide in design phase).
7. **Existing users are grandfathered**. Migration runs `UPDATE users SET plan_selected_at = created_at WHERE plan_selected_at IS NULL` AFTER adding the column. Only users registered from this feature forward will see the plan selector.
8. **Race condition fix**: `AuthContext.jsx` currently sets `loading=false` before `fetchProfile` resolves. Add a `profileLoaded` boolean flag. Route guards must wait for `profileLoaded === true` before deciding whether to redirect to `/select-plan`, otherwise new users flash-redirect.
9. **New column `users.plan_selected_at timestamptz`** (nullable). Also add `users.selected_plan text` (nullable, stores chosen plan key for paid flow). RLS: user can read their own, service_role full access, authenticated users cannot write it directly (only via signup trigger or server-side function).
10. **Existing column `users.trial_ends_at`** stays as-is. All plans (free + paid) get 14 days.

## Affected Modules

| File | Impact | Description |
|------|--------|-------------|
| `src/hooks/useRegisterForm.js` | Modified | Read `?plan=` / `?interval=`, add plan step to wizard state machine, carry plan through submit. |
| `src/pages/Register.jsx` | Modified | Render new plan-selection step when `?plan=` absent and role is not coached athlete. |
| `src/pages/SelectPlan.jsx` | NEW | Blocking page for authenticated users with `plan_selected_at IS NULL` (Google OAuth fallback + safety net). |
| `src/components/register/PlanSelectionStep.jsx` | NEW | Reusable plan cards component for both wizard and `/select-plan` page. |
| `src/components/common/PlanSelectionGuard.jsx` | NEW | Wrapper used by both dashboard layouts to enforce redirect. |
| `src/contexts/AuthContext.jsx` | Modified | Add `profileLoaded` flag; include `plan_selected_at` + `selected_plan` in `fetchProfile`; update `signUp` and `signInWithGoogle` to handle `pending_plan_selection` sessionStorage. |
| `src/pages/AuthCallback.jsx` | Modified | Read `pending_plan_selection` from sessionStorage, call commit function, clear key. If empty and new user → navigate to `/select-plan`. |
| `src/components/landing/Pricing.jsx` | Modified | Before initiating Google OAuth path, write `pending_plan_selection` to sessionStorage (already stores before `/register` via `?plan=`). |
| `src/layouts/DashboardLayout.jsx` | Modified | Wrap `<Outlet />` with `<PlanSelectionGuard>` after existing auth/role checks. |
| `src/layouts/AthleteDashboardLayout.jsx` | Modified | Same guard. |
| `src/lib/planFeatures.js` | Verify | Confirm no changes needed (should already handle `coach_free`/`athlete_free` correctly). |
| `src/hooks/useSubscription.js` | Verify | Confirm priority logic: free-row present + trial active → Premium; post-trial → free matrix. |
| `src/services/subscriptionService.js` | Modified | Add `commitFreeSubscription(userId, planKey)` / `commitSelectedPlan(userId, planKey)` wrappers calling Edge Function/RPC. |
| `src/App.jsx` | Modified | Register public-behind-auth `/select-plan` route (no dashboard layout). |
| `supabase/migrations/YYYYMMDDHHMMSS_plan_selection_required.sql` | NEW | Add `plan_selected_at` + `selected_plan` columns, RLS policies, backfill, ensure subscriptions nullability if needed. |
| `supabase/functions/select-plan/index.ts` | NEW | Edge Function (or RPC alternative) that atomically upserts subscriptions row for free and sets `plan_selected_at` + `selected_plan`. Service role. |
| `supabase/functions/admin-api/index.ts` | Verify | `get_user_detail` should already return the sub row correctly once it exists. No expected changes. |

## RLS Implications

- **`users.plan_selected_at` / `users.selected_plan`**:
  - `SELECT`: user can read their own row (existing policy covers this).
  - `INSERT/UPDATE` from clients: **forbidden**. Must be written by the DB trigger (`handle_new_user` / new trigger) or a `SECURITY DEFINER` function / Edge Function with service role. Rationale: a user could bypass `/select-plan` by direct-updating their own row, which is a security and data-integrity risk.
- **`subscriptions` INSERT for free plan**:
  - Current policies: `sub_select_own` (authenticated SELECT own), `sub_service_all` (service_role FULL). NO authenticated INSERT policy.
  - Options: (a) Edge Function with service role (preferred — isolated, input-validated). (b) `SECURITY DEFINER` RPC with plan-key whitelist (`plan_key IN ('coach_free','athlete_free')`).
  - Either path must validate `plan_key` against a whitelist to prevent plan injection (user claiming `coach_team` free).
- **Nullability check**: `subscriptions.stripe_subscription_id`, `stripe_price_id`, `current_period_start`, `current_period_end` — must be nullable. If not, include `ALTER COLUMN ... DROP NOT NULL` in the migration.

## Rollback Plan

1. Remove `<PlanSelectionGuard>` wrapper from `DashboardLayout` and `AthleteDashboardLayout`.
2. Remove `/select-plan` route registration in `App.jsx`.
3. Delete `SelectPlan.jsx`, `PlanSelectionStep.jsx`, `PlanSelectionGuard.jsx`.
4. Revert `AuthContext.jsx` (`profileLoaded` flag, sessionStorage handoff) and `AuthCallback.jsx`.
5. Revert `useRegisterForm.js` + `Register.jsx` plan step.
6. Drop Free-plan subscription INSERT path (`commitFreeSubscription`).
7. Undeploy / delete `select-plan` Edge Function (or drop RPC).
8. Drop columns via down-migration: `ALTER TABLE users DROP COLUMN plan_selected_at, DROP COLUMN selected_plan;` (data loss acceptable — they are only markers).
9. Optionally DELETE free-plan `subscriptions` rows created during the feature window (not strictly required — they are benign).
10. Existing users unaffected: grandfather backfill is a no-op to drop.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Migration/code deployment order: new code reading `plan_selected_at` before column exists. | Medium | Deploy migration FIRST, verify column live, THEN deploy frontend. Document in apply phase. |
| Grandfather backfill window: new code sees NULL on existing users between column add and UPDATE backfill. | High | Run `ALTER TABLE ADD COLUMN` and `UPDATE users SET plan_selected_at = created_at` in the SAME migration transaction. Never split across migrations. |
| Google OAuth multi-tab race: sessionStorage mixed between tabs. | Low | sessionStorage is per-tab by design — already isolates. Document limitation; do not pursue per-tab keys. |
| Free-plan RPC/Edge Function plan injection: user forges `plan_key='coach_team'` free. | Medium | Whitelist `plan_key IN ('coach_free','athlete_free')` inside function. Reject anything else with 400. |
| AuthContext race flash-redirect: `loading=false` before profile fetched. | High | Introduce `profileLoaded` flag (locked decision #8). Guard blocks until `profileLoaded === true`. |
| Bypass of `/select-plan` via direct client state manipulation. | Low | Guard is client-side; acceptable for MVP. Backend write restriction on `plan_selected_at` is the real defense. Future: add RLS `EXISTS` check on key tables if abuse appears. |
| Orphaned unverified signups: user picks plan, never verifies email → `subscriptions` row exists but user can't log in. | Low | Benign — row is harmless, user can re-register, admin can clean up if needed. |
| Feature-flag gating for safe rollout. | Open question | Defer decision to design phase. Note as open question. |
| Multiple dashboard tabs open mid-selection. | Low | Guard re-runs on navigation; profile re-fetches on auth state change. Acceptable. |

## Success Criteria

- [ ] Every new user (email/password or Google OAuth) has `plan_selected_at IS NOT NULL` after first successful login.
- [ ] Free users get a row in `subscriptions` with `plan_key='coach_free'|'athlete_free'` and `status='active'`.
- [ ] Paid users get `users.selected_plan` set but NO `subscriptions` row until Stripe webhook confirms payment.
- [ ] Coached athletes (invited via coach link or `coachEmail`) skip plan selection entirely and are auto-assigned `athlete_free`.
- [ ] Existing users (Raúl, coach@test.com, etc.) are never redirected to `/select-plan` (grandfathered).
- [ ] Admin dashboard shows `Coach Free` / `Athlete Free` + `Activa` for free users instead of "Sin suscripción".
- [ ] AuthContext race condition eliminated: no flash-redirect to `/select-plan` on new session load.
- [ ] `/select-plan` page blocks all app navigation for authenticated users with `plan_selected_at IS NULL` (except admin).
- [ ] Backend rejects direct client writes to `users.plan_selected_at` and `users.selected_plan`.
- [ ] Free-plan `subscriptions` INSERT is only possible via service-role Edge Function / SECURITY DEFINER RPC, and validates `plan_key` whitelist.

## Dependencies

- Existing `subscriptions` table schema from `stripe-subscriptions` change.
- Existing `users.trial_ends_at` + `set_trial_on_signup` trigger.
- Existing `handle_new_user` trigger (may need inspection in design phase).
- Supabase Auth + Google OAuth configured.
- `useSubscription` hook priority logic (verify correct in design phase).

## Next Phase

- `sdd-spec` and `sdd-design` can run in parallel (both depend only on this proposal).
- `sdd-tasks` depends on both spec and design.

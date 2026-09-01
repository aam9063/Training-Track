# Archive Report — plan-selection-required

**Archived**: 2026-04-10
**Mode**: openspec
**Status**: shipped to dev

## Summary

Required every new TrainingTrack user to explicitly commit to a subscription plan (free or paid) before gaining access to the app, closing a gap where users registering via Google OAuth or direct `/register` landings could reach the dashboard without any plan selection, creating silent "Sin suscripcion" accounts. The change introduced a new wizard plan-selection step, a blocking `/select-plan` fallback page, a `PlanSelectionGuard` wrapping both coach and athlete dashboard layouts, a `commit_plan_selection` SECURITY DEFINER RPC, new `users.plan_selected_at` / `users.selected_plan` columns (writable only via the RPC and enforced by a trigger), and a grandfather backfill so all 11 pre-existing users were migrated in the same transaction with zero downtime. During E2E a race condition between `onAuthStateChange` propagation and `refreshProfile` was discovered and fixed by adding a `userIdOverride` parameter plus a `fetchIdRef` monotonic counter in `AuthContext`. Final outcome: all three entry points (email/password wizard, Google OAuth deep link, direct `/register`) now produce rows with a non-null `plan_selected_at`, and the admin dashboard shows meaningful plan labels for every user.

## Artifacts

- proposal.md
- explore.md
- spec.md
- design.md
- tasks.md
- archive-report.md (this file)

## Verification

- RPC unit tests: 7/7 PASS (invalid_plan_key, invalid_interval, role_mismatch, happy paid, happy free, idempotency, cleanup)
- E2E browser tests via Playwright: 3/3 PASS
  - Test 1: Athlete independent premium deep link (`/register?plan=athlete_premium`) -> `/athlete/dashboard`
  - Test 2: Coach Pro wizard with plan step -> `/dashboard`
  - Test 3: Grandfathered user login (`coach@test.com`) -> `/dashboard` (no `/select-plan` redirect)
- Build + lint: PASS (no new errors beyond pre-existing baseline of 188 errors)
- Note: No formal `verify-report.md` was produced; verification was performed interactively via the Supabase MCP (SQL-level RPC tests) and Playwright MCP (browser E2E), and the results documented here constitute the verification record for this change.

## Files touched

### Created

- `src/components/register/PlanSelectionStep.jsx`
- `src/components/common/PlanSelectionGuard.jsx`
- `src/pages/SelectPlan.jsx`
- `supabase/migrations/20260410090000_plan_selection_required.sql`
- `supabase/migrations/20260410090000_plan_selection_required_rollback.sql`
- `supabase/migrations/20260410090000_plan_selection_required_verify.sql`

### Modified

- `src/services/subscriptionService.js` (commitPlanSelection wrapper over RPC)
- `src/contexts/AuthContext.jsx` (profileLoaded, profileError, refreshProfile(userIdOverride), fetchIdRef counter)
- `src/hooks/useRegisterForm.js` (plan step, sessionStorage handoff, auto-commit, refreshProfile with override)
- `src/pages/Register.jsx` (3-step wizard)
- `src/pages/AuthCallback.jsx` (two-effect pattern with hydrationDoneRef)
- `src/layouts/DashboardLayout.jsx` + `src/layouts/AthleteDashboardLayout.jsx` (wrap with PlanSelectionGuard)
- `src/App.jsx` (`/select-plan` route + AuthenticatedRoute)
- `src/components/landing/Pricing.jsx` (already passes plan via query params — no change needed)
- `src/pages/SelectPlan.jsx` (on-mount refreshProfile as defensive refetch)

## Database changes (applied to `lusirdkixfliydimemre`)

- `ALTER TABLE public.users`: add `plan_selected_at timestamptz`, add `selected_plan text` (nullable + CHECK against plan whitelist)
- `CREATE FUNCTION public.users_block_plan_cols` (trigger function)
- `CREATE TRIGGER users_block_plan_cols_trg ON public.users` (blocks direct writes to the two new columns)
- `CREATE FUNCTION public.commit_plan_selection(text, text) RETURNS json` `SECURITY DEFINER`
- `CREATE INDEX idx_users_plan_selected_at_null ON public.users`
- Grandfather backfill: `UPDATE users SET plan_selected_at = created_at` (11 rows affected, same transaction as the DDL)
- Bonus: fixed RLS warnings on `subscriptions` table (`auth_rls_initplan` + `multiple_permissive_policies`)

## Notable decisions / lessons learned

- **Race condition in refreshProfile**: discovered during E2E that `onAuthStateChange` may not have propagated the new user into `AuthContext` state by the time `useRegisterForm` calls `refreshProfile`. Fixed by adding an optional `userIdOverride` parameter to `refreshProfile`, plus a `fetchIdRef` monotonic counter that invalidates stale in-flight fetches. Without these, grandfathered users were correctly handled but fresh signups were bouncing to `/select-plan` intermittently.
- **Free vs paid plan row creation**: Free plans create a real `subscriptions` row (`status='active'`, no Stripe IDs) so the admin dashboard shows "Coach Free" / "Athlete Free" instead of "Sin suscripcion". Paid plans do NOT create a subscriptions row until the Stripe webhook confirms payment — during trial, `useSubscription` derives Premium access from `trial_ends_at`.
- **Coached athletes exempt**: Athletes registered via coach invite link auto-commit to `athlete_free` and skip the plan step entirely.
- **Zero-downtime grandfather**: All 11 existing users were backfilled in the same migration transaction as the DDL, eliminating any window where a real user could see `/select-plan`.
- **Trigger-enforced column immutability**: The `users_block_plan_cols_trg` trigger ensures `plan_selected_at` and `selected_plan` can only be written via the `commit_plan_selection` RPC (which sets a `SET LOCAL` session variable to bypass the trigger). This closes the RLS gap where a client with an `UPDATE users` policy could otherwise write the columns directly.

## Rollback procedure

If the feature needs to be reverted:

1. Deploy frontend without `PlanSelectionGuard`, wizard plan step, and `SelectPlan` page (`git revert` the commit).
2. Apply the rollback migration: `supabase/migrations/20260410090000_plan_selection_required_rollback.sql` — drops the columns, trigger, RPC, and index.
3. Free-plan `subscriptions` rows created during the feature window are preserved intentionally (they represent real active subscriptions; removing them would silently revoke access).

## Next steps

- Deploy to production (Vercel)
- Monitor logs for the first few real signups to confirm `plan_selected_at` is being set
- Consider adding an analytics event on plan commit for funnel tracking

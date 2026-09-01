# Tasks: Stripe Subscriptions

## Phase 1: Database Infrastructure

- [ ] 1.1 Add columns to `users` table: `trial_ends_at` (timestamptz, default now()+14d), `is_exempt` (bool, default false), `stripe_customer_id` (text, unique). File: `supabase/migrations/YYYYMMDD_stripe_subscriptions.sql`. Deps: none. Size: S
- [ ] 1.2 Create `subscriptions` table with all columns per design (id, user_id unique FK, stripe_subscription_id unique, stripe_price_id, plan_key check, status check, billing_interval check, period dates, cancel_at_period_end, timestamps). Add indexes. File: same migration. Deps: 1.1. Size: S
- [ ] 1.3 Enable RLS on `subscriptions`: "Users read own subscription" (SELECT, `user_id = (select auth.uid())`), "Service role manages subscriptions" (ALL, `auth.role() = 'service_role'`). File: same migration. Deps: 1.2. Size: S
- [ ] 1.4 DB trigger: set `trial_ends_at = now() + interval '14 days'` on new user INSERT into `users`. File: same migration. Deps: 1.1. Size: S
- [ ] 1.5 Beta user migration: `UPDATE users SET is_exempt = true WHERE created_at < '2026-04-09'`. File: same migration. Deps: 1.1. Size: S
- [ ] 1.6 Prepare DOWN migration SQL (drop subscriptions table, drop added columns). File: same migration file, commented block or separate down file. Deps: 1.1-1.5. Size: S

## Phase 2: Stripe Configuration (Manual)

- [ ] 2.1 Create products and prices in Stripe Dashboard: coach_pro (month/year), coach_team (month/year), athlete_premium (month/year). Document Price IDs. Deps: none. Size: S
- [ ] 2.2 Add Supabase secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs. Add `VITE_STRIPE_PUBLISHABLE_KEY` to `.env` and Vercel. Deps: 2.1. Size: S

## Phase 3: Edge Functions

- [ ] 3.1 Create `supabase/functions/stripe-checkout/index.ts`: JWT auth, validate `plan_key`+`billing_interval`, lookup/create Stripe customer, save `stripe_customer_id`, create Checkout Session with `PRICE_MAP`, return `{ url }`. Deps: 1.1, 2.2. Size: M
- [ ] 3.2 Create `supabase/functions/stripe-webhook/index.ts`: verify Stripe signature, handle `checkout.session.completed` (upsert subscription + set customer_id), `customer.subscription.updated` (sync status/period/plan), `customer.subscription.deleted` (status=canceled), `invoice.payment_failed` (status=past_due). Uses service_role. Deps: 1.2, 2.2. Size: L
- [ ] 3.3 Create `supabase/functions/stripe-portal/index.ts`: JWT auth, lookup `stripe_customer_id`, create Portal session, return `{ url }`. 400 if no customer. Deps: 1.1, 2.2. Size: S

## Phase 4: Frontend — Core Logic

- [ ] 4.1 Create `src/lib/planFeatures.js`: export `PLAN_FEATURES` config (coach_free/pro/team, athlete_free/premium), `canAccessFeature(plan, feature)` helper, `PRICE_MAP` with plan_key+interval to Stripe price_id mapping. Deps: 2.1. Size: S
- [ ] 4.2 Create `src/services/subscriptionService.js`: `createCheckout(planKey, interval)` calls stripe-checkout EF, `createPortalSession()` calls stripe-portal EF. Both use supabase `functions.invoke()`. Deps: 3.1, 3.3. Size: S
- [ ] 4.3 Modify `src/contexts/AuthContext.jsx`: join `subscriptions` in `fetchProfile()` query (left join on user_id), expose `subscription`, `trial_ends_at`, `is_exempt` on profile object. Deps: 1.2. Size: M
- [ ] 4.4 Create `src/hooks/useSubscription.js`: derive `plan`, `status`, `isTrialing`, `trialDaysLeft`, `trialExpired`, `isExempt`, `canAccess(feature)`, `canAddAthlete(count)` from AuthContext profile. Logic per design: exempt→max plan, active sub→plan_key, trialing→max plan, else→free. Deps: 4.1, 4.3. Size: M

## Phase 5: Frontend — UI Components

- [ ] 5.1 Create `src/components/common/TrialBanner.jsx`: sticky banner "Te quedan X dias de prueba. Elige tu plan →" when `isTrialing && trialDaysLeft <= 7`. "Tu prueba ha expirado" when `trialExpired && !subscription`. Hidden for exempt. Link to pricing. Deps: 4.4. Size: S
- [ ] 5.2 Create `src/components/common/PaywallModal.jsx`: full-screen overlay showing plan limitations + upgrade CTAs. CTA calls `subscriptionService.createCheckout()`. Deps: 4.2, 4.4. Size: M
- [ ] 5.3 Create `src/components/common/SubscriptionGuard.jsx`: wraps layout children. If `trialExpired && plan is *_free && !isExempt` → render PaywallModal overlay. Deps: 5.2, 4.4. Size: S
- [ ] 5.4 Modify `src/layouts/DashboardLayout.jsx` and `src/layouts/AthleteDashboardLayout.jsx`: wrap content with `SubscriptionGuard`, add `TrialBanner` at top. Deps: 5.1, 5.3. Size: S
- [ ] 5.5 Modify `src/components/landing/Pricing.jsx`: wire CTAs to `createCheckout()` for logged-in users, redirect to `/register?plan=X&interval=Y` for anonymous. Deps: 4.2. Size: M
- [ ] 5.6 Create `src/pages/CheckoutSuccess.jsx`: poll `subscriptions` table for up to 10s post-payment, show confirmation or timeout message. Add route `/checkout/success` in `src/App.jsx`. Deps: 4.3. Size: M

## Phase 6: Admin Panel

- [ ] 6.1 Modify `src/services/adminService.js`: add `toggleExempt(userId, isExempt)` calling `admin-api` EF with `toggle_exempt` action. Update `admin-api` EF to handle this action. Deps: 1.1. Size: S
- [ ] 6.2 Modify `src/pages/admin/UserDetail.jsx`: add exempt toggle switch + subscription info display (plan, status, billing interval, period end, cancel_at_period_end). Deps: 6.1, 4.3. Size: M
- [ ] 6.3 Modify `src/pages/admin/Users.jsx`: add subscription status column (plan + status badge). Deps: 4.3. Size: S

## Phase 7: Verification

- [ ] 7.1 Run `npm run build` — confirm zero errors. Deps: all above. Size: S
- [ ] 7.2 Test flow: signup → verify `trial_ends_at` set → trial banner appears at day 7 → trial expires → paywall shown → checkout → webhook fires → subscription active → features unlocked. Deps: 7.1. Size: L
- [ ] 7.3 Test exempt flow: admin toggles `is_exempt=true` → user has full access regardless of subscription. Deps: 7.1. Size: S
- [ ] 7.4 Test downgrade flow: user cancels in portal → webhook sets `cancel_at_period_end` → period ends → status=canceled → features locked to free tier. Deps: 7.1. Size: M
- [ ] 7.5 Test invalid webhook signature returns 400. Test unauthenticated checkout/portal returns 401. Deps: 7.1. Size: S

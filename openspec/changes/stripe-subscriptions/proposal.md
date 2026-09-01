# Proposal: Stripe Subscriptions Integration

## Intent

TrainingTrack is exiting beta. Users need a monetization path: 14-day free trial on signup, then choose Free (limited) or paid plan via Stripe. Existing beta users and partners must be exemptable. Without this, there is no revenue model.

## Scope

### In Scope
- DB schema: `trial_ends_at`, `is_exempt`, `stripe_customer_id` on `users`; new `subscriptions` table
- 3 Edge Functions: `stripe-checkout`, `stripe-webhook`, `stripe-portal`
- `useSubscription()` hook exposing plan, trial state, feature gating
- Pricing page wired to real Stripe Checkout (redirect mode)
- Route-level paywall + component-level feature locks
- Admin panel: exempt toggle, subscription status view
- Trial banner ("X days left") and upgrade prompts
- Beta user migration (mark as exempt or extend trial)

### Out of Scope
- Stripe Tax / VAT automation (manual config in Stripe Dashboard for now)
- Embedded checkout (redirect mode only)
- Coupon/promo codes
- Usage-based / metered billing
- Stripe Connect (marketplace payouts)

## Approach

Stripe Checkout (redirect mode) + webhook-driven DB state. Frontend reads subscription status from `subscriptions` table via `useSubscription()` hook. Trial managed at app level (`trial_ends_at` on `users`). Feature gating via `PLAN_FEATURES` config constant + `canAccess(feature)` helper. Stripe Customer Portal for self-service management (cancel, change plan, update payment).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| DB: `users` table | Modified | Add `trial_ends_at`, `is_exempt`, `stripe_customer_id` columns |
| DB: `subscriptions` table | New | Stripe subscription state mirror |
| DB: `coaches.subscription_plan` | Modified | Migrate starter/professional/elite to free/pro/team |
| `supabase/functions/stripe-checkout/` | New | Create Checkout Session |
| `supabase/functions/stripe-webhook/` | New | Process Stripe events, update DB |
| `supabase/functions/stripe-portal/` | New | Create Customer Portal session |
| `src/contexts/AuthContext.jsx` | Modified | Expose subscription data |
| `src/hooks/useSubscription.js` | New | Plan, trial, gating logic |
| `src/lib/planFeatures.js` | New | PLAN_FEATURES config + canAccess() |
| `src/components/landing/Pricing.jsx` | Modified | Wire CTAs to Stripe Checkout |
| `src/pages/CheckoutSuccess.jsx` | New | Post-payment confirmation + polling |
| `src/components/common/PaywallModal.jsx` | New | Upgrade prompt for gated features |
| `src/components/common/TrialBanner.jsx` | New | Trial countdown banner |
| `src/layouts/DashboardLayout.jsx` | Modified | Route-level paywall check |
| `src/layouts/AthleteDashboardLayout.jsx` | Modified | Route-level paywall check |
| `src/services/subscriptionService.js` | New | Stripe-related API calls |
| `src/pages/admin/UserDetail.jsx` | Modified | Exempt toggle, subscription info |
| `src/pages/admin/Users.jsx` | Modified | Subscription status column |
| `src/services/adminService.js` | Modified | New admin actions |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Webhook delivery failure -> stale DB state | Med | Periodic cron sync job; success page polls for up to 10s |
| Race condition: payment completes before webhook | Med | Success page polls subscription status before showing confirmation |
| Beta user migration breaks existing access | Low | Default: set existing users as `is_exempt = true` |
| Coach plan name mismatch (old vs new) | Low | Migration script updates `coaches.subscription_plan` values |
| Double subscription per user | Low | Stripe single-customer constraint + DB unique index |
| Stripe test/live key confusion | Low | Env-based config (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) |

## Rollback Plan

1. **Edge Functions**: Delete or disable `stripe-checkout`, `stripe-webhook`, `stripe-portal`
2. **Frontend**: Revert `useSubscription()` hook to always return full access (exempt-like behavior)
3. **DB**: `trial_ends_at`, `is_exempt`, `stripe_customer_id` columns are additive — safe to leave. Drop `subscriptions` table if needed
4. **Pricing page**: Revert CTAs to `/register` links
5. **Feature gating**: Remove paywall checks from layouts; all features unlocked again
6. Data in Stripe Dashboard is independent — no rollback needed there

## Dependencies

- Stripe account configured with EUR currency and correct products/prices
- Stripe Dashboard: create products + prices for all 5 plan keys (coach_free excluded)
- Supabase secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`
- Frontend env: `VITE_STRIPE_PUBLISHABLE_KEY`

## Success Criteria

- [ ] New user gets 14-day trial with full access, no credit card required
- [ ] After trial expiry, user is downgraded to Free plan with feature restrictions
- [ ] User can upgrade via Stripe Checkout and subscription is reflected in DB within 10s
- [ ] User can manage subscription (cancel, change plan) via Stripe Customer Portal
- [ ] `is_exempt` users have full access regardless of subscription state
- [ ] Admin can toggle exempt status and view subscription details
- [ ] Feature gating works at both route and component level
- [ ] Existing beta users are migrated without losing access

# Design: Stripe Subscriptions Integration

## Technical Approach

Stripe Checkout (redirect mode) with webhook-driven DB state. Frontend reads subscription via `useSubscription()` hook built on AuthContext profile data. Three Edge Functions handle Stripe API calls. Feature gating uses a static `PLAN_FEATURES` config with route-level and component-level enforcement.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Checkout mode | Stripe Checkout (redirect) | Embedded checkout, Payment Links | PWA-safe, PCI-compliant, minimal frontend code |
| Subscription state source | `subscriptions` table via Supabase | Stripe API on each request | Low latency, works offline, RLS-compatible |
| Feature config | Static `PLAN_FEATURES` constant | DB-driven feature flags | Plans rarely change; avoids extra query; instant access |
| Hook placement | Dedicated `useSubscription()` hook | Extend AuthContext directly | Separation of concerns; AuthContext already large |
| Data loading | Join subscription in `fetchProfile()` | Separate query in hook | Single round-trip; subscription available with profile |
| Admin exempt toggle | Via existing `admin-api` Edge Function | Direct RLS update | Consistent with current admin pattern (`callAdminApi`) |
| Trial management | `trial_ends_at` on `users` table | Stripe trial period | App-level control; no credit card required for trial |

## Data Flow

```
  Signup ──→ DB trigger sets trial_ends_at ──→ Full access (14d)
                                                     │
  Trial expires ──→ useSubscription detects ──→ PaywallModal / TrialBanner
                                                     │
  User clicks upgrade ──→ subscriptionService.createCheckout(plan, interval)
       │
       ▼
  stripe-checkout EF ──→ Stripe API (create session) ──→ redirect to Stripe
       │
  Stripe payment complete ──→ stripe-webhook EF ──→ upsert subscriptions row
       │
  CheckoutSuccess page ──→ polls subscription status ──→ confirms active plan
       │
  Manage subscription ──→ stripe-portal EF ──→ Stripe Customer Portal
       │
  Cancel/change ──→ stripe-webhook EF ──→ updates subscriptions row
```

### Exempt user flow
```
  Admin toggles is_exempt=true ──→ admin-api EF ──→ users.is_exempt=true
       │
  useSubscription reads is_exempt ──→ bypasses all plan checks ──→ full access
```

## DB Design

### Migration UP

```sql
-- Users table additions
ALTER TABLE users ADD COLUMN trial_ends_at timestamptz DEFAULT (now() + interval '14 days');
ALTER TABLE users ADD COLUMN is_exempt boolean DEFAULT false;
ALTER TABLE users ADD COLUMN stripe_customer_id text UNIQUE;

-- Subscriptions table
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  stripe_subscription_id text UNIQUE NOT NULL,
  stripe_price_id text NOT NULL,
  plan_key text NOT NULL CHECK (plan_key IN ('coach_pro','coach_team','athlete_premium')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','canceled','incomplete','trialing')),
  billing_interval text NOT NULL CHECK (billing_interval IN ('month','year')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own subscription"
  ON subscriptions FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Service role manages subscriptions"
  ON subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- Coach athlete limit enforcement (RLS on coach_athlete_relationship)
-- Enforced at application level via useSubscription().canAddAthlete()
-- because RLS cannot reference joined subscription data efficiently.

-- Update existing beta users
UPDATE users SET is_exempt = true WHERE created_at < '2026-04-09'::date;
```

### Migration DOWN

```sql
DROP TABLE IF EXISTS subscriptions;
ALTER TABLE users DROP COLUMN IF EXISTS trial_ends_at;
ALTER TABLE users DROP COLUMN IF EXISTS is_exempt;
ALTER TABLE users DROP COLUMN IF EXISTS stripe_customer_id;
```

## Edge Function Design

### `stripe-checkout`
- **Auth**: JWT verified (logged-in user required)
- **Input**: `{ plan_key, billing_interval }` — validated against allowed values
- **Flow**: Look up `users.stripe_customer_id`. If null, create Stripe customer (email from JWT), save `stripe_customer_id` to users table. Create Checkout Session with `customer`, `price` (looked up from `PRICE_MAP[plan_key][billing_interval]`), `mode: 'subscription'`, `success_url`, `cancel_url`, `client_reference_id: user_id`. Return `{ url: session.url }`.
- **Error handling**: 400 for invalid plan_key/interval, 500 for Stripe errors.

### `stripe-webhook`
- **Auth**: No JWT — uses `Stripe-Signature` header + `STRIPE_WEBHOOK_SECRET`
- **Idempotency**: Upsert by `stripe_subscription_id` (unique index prevents duplicates)
- **Events handled**:
  - `checkout.session.completed` — upsert subscription row, set `stripe_customer_id` on user if missing
  - `customer.subscription.updated` — update status, period dates, cancel_at_period_end, plan_key
  - `customer.subscription.deleted` — set status = 'canceled'
  - `invoice.payment_failed` — set status = 'past_due'
- **Uses service_role** key for DB writes (bypasses RLS).

### `stripe-portal`
- **Auth**: JWT verified
- **Flow**: Look up `users.stripe_customer_id`. If null, return 400. Create Stripe Billing Portal session with `customer` and `return_url`. Return `{ url: session.url }`.

## Frontend Architecture

### File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/useSubscription.js` | Create | Hook: plan, trial, gating logic |
| `src/lib/planFeatures.js` | Create | `PLAN_FEATURES` config + `canAccess()` + `PRICE_MAP` |
| `src/services/subscriptionService.js` | Create | `createCheckout()`, `createPortalSession()` API calls |
| `src/components/common/PaywallModal.jsx` | Create | Upgrade prompt modal |
| `src/components/common/TrialBanner.jsx` | Create | Countdown banner |
| `src/components/common/SubscriptionGuard.jsx` | Create | Route-level paywall wrapper |
| `src/pages/CheckoutSuccess.jsx` | Create | Post-payment polling + confirmation |
| `src/contexts/AuthContext.jsx` | Modify | Join `subscriptions` in `fetchProfile()` |
| `src/components/landing/Pricing.jsx` | Modify | Wire CTAs to `subscriptionService.createCheckout()` |
| `src/layouts/DashboardLayout.jsx` | Modify | Add `SubscriptionGuard` + `TrialBanner` |
| `src/layouts/AthleteDashboardLayout.jsx` | Modify | Add `SubscriptionGuard` + `TrialBanner` |
| `src/App.jsx` | Modify | Add `/checkout/success` route |
| `src/services/adminService.js` | Modify | Add `toggle_exempt` action |
| `src/pages/admin/UserDetail.jsx` | Modify | Exempt toggle + subscription info display |
| `src/pages/admin/Users.jsx` | Modify | Subscription status column |

### `useSubscription()` hook

```js
// State shape returned by hook
{
  plan: 'coach_free' | 'coach_pro' | 'coach_team' | 'athlete_free' | 'athlete_premium',
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | null,
  isExempt: boolean,
  isTrialing: boolean,
  trialDaysLeft: number,
  trialExpired: boolean,
  canAccess: (feature: string) => boolean,
  canAddAthlete: (currentCount: number) => boolean,
  billingInterval: 'month' | 'year' | null,
  cancelAtPeriodEnd: boolean,
}
```

**Logic**: Reads from `profile` (AuthContext). Derives `plan` from: (1) if `is_exempt` → role's max plan, (2) if active subscription → `subscription.plan_key`, (3) if trialing (`trial_ends_at > now()`) → role's max plan, (4) else → role's free plan.

### `PLAN_FEATURES` config

```js
export const PLAN_FEATURES = {
  coach_free:       { max_athletes: 3, ai_reports: false, strava_webhook: false, tests: false, export: false, mesocycles: false, gym_pdfs: false, push: false, predictions: false, competitions: false },
  coach_pro:        { max_athletes: 20, ai_reports: true, strava_webhook: true, tests: true, export: true, mesocycles: true, gym_pdfs: false, push: false, predictions: false, competitions: false },
  coach_team:       { max_athletes: 999, ai_reports: true, strava_webhook: true, tests: true, export: true, mesocycles: true, gym_pdfs: true, push: true, predictions: true, competitions: true },
  athlete_free:     { ai_plans: 1, hermes_chat: false, advanced_metrics: false, gamification: false },
  athlete_premium:  { ai_plans: 'weekly', hermes_chat: true, advanced_metrics: true, gamification: true },
};
```

### `SubscriptionGuard`
Wraps layout content. If `trialExpired && plan === '*_free' && !isExempt` → renders `PaywallModal` overlay instead of children. Does NOT redirect — keeps URL intact so user can upgrade and return.

### `TrialBanner`
Shown when `isTrialing && trialDaysLeft <= 7`. Sticky banner at top: "Te quedan X dias de prueba. Elige tu plan →". Hidden for exempt users.

### `PaywallModal`
Full-screen overlay. Shows current plan limitations + upgrade options. CTA calls `subscriptionService.createCheckout(plan_key, interval)` which hits `stripe-checkout` EF and redirects.

### Pricing page wiring
For logged-in users: CTA calls `createCheckout()` directly. For anonymous users: CTA links to `/register?plan=coach_pro&interval=month` — after registration, redirect to checkout.

## Security

- **Webhook signature**: `stripe-webhook` verifies `Stripe-Signature` header using `STRIPE_WEBHOOK_SECRET` before processing any event.
- **RLS**: `subscriptions` table readable only by own user. Writes only via service_role (webhook EF).
- **No client bypass**: `canAccess()` is convenience UX — actual enforcement happens server-side via RLS on `coach_athlete_relationship` (athlete count) and Edge Function checks for AI features.
- **Stripe keys**: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` stored as Supabase secrets. Only `VITE_STRIPE_PUBLISHABLE_KEY` exposed to frontend.

## Rollback Plan

1. **Edge Functions**: Delete `stripe-checkout`, `stripe-webhook`, `stripe-portal` from Supabase
2. **Frontend**: Set `useSubscription()` to always return exempt-like state (full access)
3. **DB columns**: `trial_ends_at`, `is_exempt`, `stripe_customer_id` are additive — safe to leave. Run DOWN migration only if needed
4. **Pricing CTAs**: Revert to `/register` links
5. **Layouts**: Remove `SubscriptionGuard` wrapper — all features unlocked
6. **Stripe Dashboard data**: Independent, no rollback needed

## Open Questions

- [ ] Exact Stripe Price IDs — must be created in Stripe Dashboard before implementation
- [ ] Should `Register.jsx` accept `?plan=` query param to auto-redirect to checkout post-signup?
- [ ] Cron job for periodic Stripe-DB reconciliation — use pg_cron or scheduled Edge Function?

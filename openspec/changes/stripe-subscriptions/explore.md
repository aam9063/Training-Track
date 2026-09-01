# Exploration: Stripe Subscriptions Integration

## Current State

### Authentication & Profiles
- `AuthContext.jsx` manages auth via Supabase. It fetches from `users` table (base info: role, is_admin, is_active, is_independent) plus role-specific tables (`coaches`, `athletes`).
- The context exposes `isCoach`, `isAthlete`, `isIndependent`, `isAdmin` flags. No subscription/plan awareness exists yet.
- User signup stores metadata (role, first_name, last_name, coach_email, is_independent) in Supabase auth user_metadata, then a DB trigger creates rows in `users` + `coaches`/`athletes`.

### Existing Plan Management (Admin Only)
- The `coaches` table already has `subscription_plan` (starter/professional/elite) and `max_athletes` columns.
- Admin panel (`UserDetail.jsx`) lets admins manually set these values via the `admin-api` Edge Function (`update_coach_subscription` action).
- The current plans (starter/professional/elite) are admin-internal and do NOT match the landing page plans (Free/Pro/Team).
- No plan enforcement exists at the RLS or application level -- during beta, all features are unlocked.

### Landing Page Pricing
- `Pricing.jsx` shows two audiences: Coach (Free/Pro/Team) and Athlete (Free/Premium).
- Coach plans: 0/14.99/24.99 EUR/mo (or 0/149/249 EUR/yr).
- Athlete plans: 0/5 EUR/mo (or 0/48 EUR/yr).
- Currently all CTAs link to `/register` with no plan selection.
- A "beta banner" declares all features free during beta (coach audience only).

### Routing & Feature Gating
- `DashboardLayout` guards by auth + role (coach vs athlete redirect).
- `IndependentRoute` component guards independent-athlete-only routes.
- No feature-level gating by plan exists anywhere. No paywall components.

### Admin Infrastructure
- Admin operations go through a single `admin-api` Edge Function (verified server-side with service_role).
- Pattern: `callAdminApi(action, payload)` with JWT auth header.

## Affected Areas

- `src/contexts/AuthContext.jsx` -- Must expose subscription status (plan, trial state, is_exempt) to the entire app
- `src/components/landing/Pricing.jsx` -- CTA buttons must link to Stripe Checkout (or register-then-checkout flow)
- `src/pages/Register.jsx` -- Post-registration must set trial_ends_at and optionally redirect to checkout
- `src/pages/admin/UserDetail.jsx` -- Add is_exempt toggle, show Stripe subscription details
- `src/pages/admin/Users.jsx` -- Show subscription status column
- `src/services/adminService.js` -- New actions: toggle_exempt, view subscription info
- `src/layouts/DashboardLayout.jsx` -- Intercept expired trials with paywall/upgrade screen
- `src/layouts/AthleteDashboardLayout.jsx` -- Same paywall for independent athletes
- New: `src/contexts/SubscriptionContext.jsx` or extend AuthContext -- plan/feature access logic
- New: `src/components/common/PaywallModal.jsx` -- upgrade prompt when feature is gated
- New: `src/pages/Checkout.jsx` -- Stripe Checkout redirect page
- New: `src/pages/CheckoutSuccess.jsx` -- post-payment confirmation
- New: `src/services/subscriptionService.js` -- Stripe-related API calls
- New Edge Function: `stripe-checkout` -- create Stripe Checkout session
- New Edge Function: `stripe-webhook` -- handle Stripe events (subscription created/updated/deleted)
- New Edge Function: `stripe-portal` -- create Stripe Customer Portal session
- DB: new `subscriptions` table, new columns on `users` table

## Approaches

### Approach A: Stripe Checkout (Redirect) + Webhook + DB State

**Description**: Use Stripe Checkout Sessions (redirect mode) for payments. A `stripe-webhook` Edge Function processes events and writes subscription state to a `subscriptions` table. Frontend reads subscription state from DB (via AuthContext or a dedicated context).

**Flow**:
1. User registers -> DB trigger sets `trial_ends_at = now() + 14 days` on `users`
2. During trial, full access. Frontend shows "X days left" banner.
3. When trial expires (or user clicks "Upgrade"), redirect to Stripe Checkout via Edge Function that creates a session.
4. Stripe redirects back to `/checkout/success?session_id=...`
5. `stripe-webhook` Edge Function receives `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` events -> updates `subscriptions` table.
6. Frontend reads `subscriptions` row (joined with user) to determine active plan.
7. Feature gating: a `useSubscription()` hook exposes `plan`, `canAccess(feature)`, `isTrialing`, `trialDaysLeft`, `isExempt`.

- Pros: Battle-tested Stripe pattern, minimal frontend payment UI, PCI-compliant by default, supports monthly/yearly toggle, customer portal for self-service management
- Cons: Redirect breaks flow (user leaves the app), requires webhook reliability
- Effort: Medium-High

### Approach B: Stripe Embedded Checkout + Same Backend

**Description**: Same as Approach A but uses Stripe's embedded checkout (iframe) instead of redirect. User stays in the app.

- Pros: Better UX (no redirect), still PCI-compliant
- Cons: More frontend code (embed component), Stripe embedded checkout has limitations on mobile/PWA, slightly more complex error handling
- Effort: High

### Approach C: Stripe Payment Links (Simplest)

**Description**: Use Stripe Payment Links (preconfigured in Stripe Dashboard). Each plan has a fixed URL. After payment, webhook updates DB.

- Pros: Simplest implementation, no Edge Function for checkout creation, works immediately
- Cons: Less control over the checkout experience, harder to pass user metadata (must use client_reference_id), no dynamic pricing, can't customize per-user
- Effort: Low-Medium

## Recommendation

**Approach A (Stripe Checkout Redirect)** is the recommended path.

Rationale:
1. It is the standard Stripe integration pattern with the most documentation and community support.
2. Redirect-based checkout is fully supported in PWA/mobile browsers (embedded has known issues).
3. It cleanly separates payment from the app -- Stripe handles all payment UI, 3D Secure, etc.
4. The redirect "break" is minimal (user clicks upgrade -> Stripe page -> returns to success page).
5. Stripe Customer Portal handles subscription management (cancel, change plan, update payment) with zero custom UI.

### Proposed DB Schema

```sql
-- Add to users table
ALTER TABLE users ADD COLUMN trial_ends_at timestamptz DEFAULT (now() + interval '14 days');
ALTER TABLE users ADD COLUMN is_exempt boolean DEFAULT false;
ALTER TABLE users ADD COLUMN stripe_customer_id text UNIQUE;

-- New subscriptions table
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  stripe_subscription_id text UNIQUE NOT NULL,
  stripe_price_id text NOT NULL,
  plan_key text NOT NULL,  -- 'coach_free', 'coach_pro', 'coach_team', 'athlete_free', 'athlete_premium'
  status text NOT NULL DEFAULT 'active',  -- 'active', 'past_due', 'canceled', 'incomplete'
  billing_interval text NOT NULL,  -- 'month', 'year'
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
```

### Proposed Plan-to-Feature Mapping

Stored as a config constant (not in DB) since plan definitions rarely change:

```js
const PLAN_FEATURES = {
  coach_free:    { max_athletes: 3,   ai_reports: false, strava_webhook: false, tests: false, export: false, mesocycles: false, gym_pdfs: false, push: false, predictions: false, competitions: false },
  coach_pro:     { max_athletes: 20,  ai_reports: true,  strava_webhook: true,  tests: true,  export: true,  mesocycles: true,  gym_pdfs: false, push: false, predictions: false, competitions: false },
  coach_team:    { max_athletes: 999, ai_reports: true,  strava_webhook: true,  tests: true,  export: true,  mesocycles: true,  gym_pdfs: true,  push: true,  predictions: true,  competitions: true  },
  athlete_free:  { ai_plans: 1, hermes_chat: false, advanced_metrics: false, gamification: false },
  athlete_premium: { ai_plans: 'weekly', hermes_chat: true, advanced_metrics: true, gamification: true },
};
```

### Trial Logic

- On user registration, `trial_ends_at` is set 14 days in the future (DB trigger or signup Edge Function).
- During trial: user has full access to their role's highest plan (coach_team / athlete_premium).
- When `trial_ends_at < now()` AND no active subscription AND `is_exempt = false`: user is on the free plan (limited features).
- The frontend detects this via `useSubscription()` hook and shows an upgrade prompt.

### Exempt Users

- `is_exempt = true` on the `users` table.
- Admin panel toggle (in UserDetail.jsx).
- When exempt: bypass all plan checks, full access forever. No trial countdown shown.
- Useful for: beta testers, partners, internal accounts.

### Downgrade Behavior

- When a user downgrades (cancels paid plan, reverts to free): all data is KEPT but access is restricted.
- Example: Coach on Free can see all athletes but cannot add new ones beyond 3. AI reports stop generating but past reports remain visible.
- No data deletion on downgrade.

### Edge Functions Needed

1. **`stripe-checkout`**: Creates a Checkout Session. Input: plan_key, billing_interval, user_id. Looks up or creates Stripe customer. Returns session URL.
2. **`stripe-webhook`**: Receives Stripe events. Updates `subscriptions` table. Handles: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
3. **`stripe-portal`**: Creates a Customer Portal session for self-service management. Returns portal URL.

### Frontend Feature Gating Strategy

Two levels:
1. **Route-level**: Layouts check subscription status. If trial expired + no paid plan + not exempt -> show paywall overlay / redirect to pricing page.
2. **Component-level**: Individual features check `canAccess('feature_name')`. Show lock icon + "Upgrade to Pro" tooltip for gated features. Feature still visible but not interactive.

This avoids hiding features entirely (which would confuse users who had them during trial) and instead shows what they're missing.

## Risks

1. **Webhook reliability**: If Stripe webhook fails to deliver, subscription state in DB goes stale. Mitigation: add a periodic sync job (Edge Function on cron) that reconciles Stripe subscriptions with DB.
2. **Race condition on checkout**: User could complete Stripe payment but webhook arrives before the success page loads. Mitigation: success page polls subscription status for up to 10 seconds.
3. **Existing beta users migration**: Current users have no `trial_ends_at` or `stripe_customer_id`. Migration needed: set `trial_ends_at` for existing users (e.g., 30 days from deployment date, or set them as exempt).
4. **Coach plan names mismatch**: Current admin uses starter/professional/elite. Must migrate to free/pro/team. This affects the `coaches.subscription_plan` column and admin UI.
5. **Stripe test vs live mode**: Need separate Stripe keys for dev/staging vs production. Edge Functions must use env-based config.
6. **Currency**: All prices in EUR. Stripe must be configured for EUR billing.
7. **VAT/Tax handling**: EU customers may need VAT. Stripe Tax or manual tax setup may be required.
8. **Double-subscription prevention**: Must ensure a user can only have one active subscription at a time. Stripe handles this if using a single customer per user.

## Ready for Proposal

Yes -- the exploration covers all eight questions from the brief. The recommended approach (Stripe Checkout Redirect + Webhook + DB state) is well-defined with clear schema, Edge Function boundaries, and frontend gating strategy. The orchestrator can proceed to the proposal phase (`sdd-propose`) with this exploration as input.

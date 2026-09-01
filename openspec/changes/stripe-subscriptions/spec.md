# Spec: Stripe Subscriptions

## 1. Database

### Req: Trial Columns on Users

The system MUST add `trial_ends_at` (timestamptz, default now()+14d), `is_exempt` (boolean, default false), and `stripe_customer_id` (text, unique) to `users`.

#### Scenario: New user registration

- GIVEN a new user signs up
- WHEN the DB trigger creates the `users` row
- THEN `trial_ends_at` MUST be set to `now() + interval '14 days'`
- AND `is_exempt` MUST be `false`

### Req: Subscriptions Table

The system MUST create a `subscriptions` table with: `id` (uuid PK), `user_id` (FK users, unique), `stripe_subscription_id` (text, unique), `stripe_price_id`, `plan_key` (enum: coach_free/coach_pro/coach_team/athlete_free/athlete_premium), `status` (active/past_due/canceled/incomplete), `billing_interval` (month/year), `current_period_start`, `current_period_end`, `cancel_at_period_end`, `created_at`, `updated_at`.

#### Scenario: One subscription per user

- GIVEN a user already has an active subscription row
- WHEN a second subscription insert is attempted for the same `user_id`
- THEN the DB MUST reject it (unique constraint on `user_id`)

### Req: RLS on Subscriptions

Users MUST only read their own subscription. Service-role MUST have full access for webhook writes.

#### Scenario: User reads own subscription

- GIVEN an authenticated user
- WHEN they SELECT from `subscriptions`
- THEN only rows where `user_id = auth.uid()` are returned

### Req: Plan Enforcement (Max Athletes)

The system SHOULD enforce `max_athletes` per plan via RLS on `coach_athlete_relationship`. Free=3, Pro=20, Team=unlimited.

#### Scenario: Free coach exceeds athlete limit

- GIVEN a coach on `coach_free` with 3 active athletes
- WHEN they try to INSERT a new `coach_athlete_relationship`
- THEN the INSERT MUST be rejected

## 2. Edge Functions

### Req: create-checkout-session

MUST accept `{ plan_key, billing_interval }` with JWT auth. MUST look up or create Stripe customer (using `stripe_customer_id`). MUST return `{ url }` for Stripe Checkout redirect. MUST set `client_reference_id` to user ID and `metadata.plan_key`.

#### Scenario: Authenticated user creates checkout

- GIVEN a logged-in user with no active subscription
- WHEN POST `/stripe-checkout` with `{ plan_key: "coach_pro", billing_interval: "month" }`
- THEN response MUST contain `{ url: "https://checkout.stripe.com/..." }`

#### Scenario: Unauthenticated request

- GIVEN no valid JWT
- WHEN POST `/stripe-checkout`
- THEN response MUST be 401

### Req: stripe-webhook

MUST verify Stripe signature. MUST handle events: `checkout.session.completed` (upsert subscription), `customer.subscription.updated` (sync status/period), `customer.subscription.deleted` (set status=canceled), `invoice.payment_failed` (set status=past_due). MUST NOT require JWT (Stripe calls it directly).

#### Scenario: Checkout completed

- GIVEN Stripe sends `checkout.session.completed`
- WHEN the webhook processes it
- THEN a row MUST be upserted in `subscriptions` with status=active
- AND `stripe_customer_id` MUST be set on `users`

#### Scenario: Invalid signature

- GIVEN a request with invalid `Stripe-Signature`
- WHEN the webhook receives it
- THEN response MUST be 400

### Req: create-portal-session

MUST accept JWT auth. MUST return `{ url }` for Stripe Customer Portal. MUST use the user's existing `stripe_customer_id`.

#### Scenario: User opens portal

- GIVEN a user with `stripe_customer_id` set
- WHEN POST `/stripe-portal`
- THEN response MUST contain a portal URL

#### Scenario: No Stripe customer

- GIVEN a user with no `stripe_customer_id`
- WHEN POST `/stripe-portal`
- THEN response MUST be 400 with error message

## 3. Frontend

### Req: useSubscription Hook

MUST return: `{ plan, status, isTrialing, trialDaysLeft, isExempt, canAccess(feature), isLoading }`. During trial, `plan` MUST equal the role's highest tier. When exempt, `canAccess()` MUST always return true.

#### Scenario: Active trial user

- GIVEN user with `trial_ends_at` in 5 days, no subscription, not exempt
- WHEN `useSubscription()` is called
- THEN `isTrialing=true`, `trialDaysLeft=5`, `plan="coach_team"` (or `athlete_premium`)

#### Scenario: Expired trial, no subscription

- GIVEN user with `trial_ends_at` in the past, no subscription, not exempt
- WHEN `useSubscription()` is called
- THEN `plan="coach_free"`, `isTrialing=false`, `canAccess("ai_reports")=false`

### Req: Trial Banner

MUST show "Te quedan X dias de prueba" banner when `isTrialing && trialDaysLeft <= 7`. MUST show "Tu prueba ha expirado" when trial ended and no subscription. MUST NOT show for exempt users.

#### Scenario: 3 days left

- GIVEN `isTrialing=true`, `trialDaysLeft=3`
- WHEN dashboard loads
- THEN banner MUST show "Te quedan 3 dias de prueba. Elige tu plan"

### Req: Feature Gating

Locked features MUST be visible but disabled with lock icon and tooltip "Disponible en plan {plan_name}". Route-level paywall MUST redirect expired free users to pricing for premium-only routes. Data MUST NOT be deleted on downgrade.

#### Scenario: Free coach clicks AI reports

- GIVEN coach on `coach_free`
- WHEN they click "Informes IA"
- THEN a PaywallModal MUST show with upgrade CTA

### Req: Pricing Checkout Integration

Pricing page CTAs MUST call `create-checkout-session` for logged-in users and redirect to `/register` for anonymous users. Success page MUST poll subscription status for up to 10s.

#### Scenario: Logged-in user selects Pro monthly

- GIVEN authenticated coach on pricing page
- WHEN they click "Elegir Plan" on Pro monthly
- THEN browser MUST redirect to Stripe Checkout with correct price

## 4. Admin

### Req: Exempt Toggle

Admin MUST be able to toggle `is_exempt` on any user via UserDetail page. Toggle MUST call `admin-api` with `toggle_exempt` action.

#### Scenario: Admin exempts beta user

- GIVEN admin viewing a user with `is_exempt=false`
- WHEN they toggle the exempt switch
- THEN `is_exempt` MUST become `true` and user gets full access

### Req: Subscription Display

Admin Users list MUST show subscription status column (plan + status). UserDetail MUST show: plan, status, billing interval, period end, cancel_at_period_end.

#### Scenario: Admin views subscribed user

- GIVEN a user with active Pro subscription
- WHEN admin opens UserDetail
- THEN MUST display "Plan: Pro", "Estado: Activo", next billing date

### Req: Beta Migration

Existing users at deployment MUST be set `is_exempt=true` via migration. The migration MUST update `coaches.subscription_plan` from starter/professional/elite to free/pro/team.

#### Scenario: Migration runs

- GIVEN existing beta users with `subscription_plan='professional'`
- WHEN migration executes
- THEN `subscription_plan` MUST be updated to `'pro'`
- AND `is_exempt` MUST be set to `true`

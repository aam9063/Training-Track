-- =============================================================================
-- Migration: plan_selection_required (UP)
-- Change:    plan-selection-required
-- Date:      2026-04-10
-- Project:   lusirdkixfliydimemre
-- =============================================================================
--
-- Purpose:
--   Introduce explicit plan selection during registration. Every user must
--   commit a plan_key via the commit_plan_selection RPC before entering the
--   app. Existing users are grandfathered (plan_selected_at := created_at) in
--   the same transaction so no request ever sees a NULL value on a pre-existing
--   row (ADR 4 in design.md).
--
-- Scope (all atomic — single transaction):
--   1. Add users.plan_selected_at timestamptz (nullable)
--   2. Add users.selected_plan text (nullable) + CHECK constraint
--   3. Backfill plan_selected_at = created_at for existing users
--   4. Partial index on users(id) WHERE plan_selected_at IS NULL
--   5. BEFORE UPDATE trigger blocking client writes to the new columns
--   6. commit_plan_selection RPC (SECURITY DEFINER)
--
-- NOT in scope:
--   - ALTER COLUMN ... DROP NOT NULL on subscriptions columns.
--     Verified 2026-04-10: stripe_subscription_id, stripe_price_id,
--     billing_interval, current_period_start, current_period_end are ALREADY
--     nullable. stripe_customer_id does not exist on subscriptions (it lives
--     on users). No relaxation needed.
--
-- Rollback: supabase/migrations/20260410090000_plan_selection_required_rollback.sql
-- Verify:   supabase/migrations/20260410090000_plan_selection_required_verify.sql
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Add plan_selected_at column
--    Nullable by design: NULL = user hasn't committed a plan yet → guard
--    redirects them to /select-plan (spec scenarios 26, 27).
--    Rollback counterpart: rollback step 7 (DROP COLUMN plan_selected_at).
-- -----------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS plan_selected_at timestamptz;

COMMENT ON COLUMN public.users.plan_selected_at IS
  'Timestamp when user committed a plan choice via commit_plan_selection RPC. '
  'NULL = not yet selected → PlanSelectionGuard redirects to /select-plan. '
  'Written only by commit_plan_selection RPC (enforced by users_block_plan_cols_trg).';

-- -----------------------------------------------------------------------------
-- 2. Add selected_plan column
--    Informational: which plan_key the user picked. Mirrors subscriptions.plan_key
--    for free plans; set without a subscriptions row for paid-intent users (trial).
--    Rollback counterpart: rollback step 6 (DROP COLUMN selected_plan).
-- -----------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS selected_plan text;

COMMENT ON COLUMN public.users.selected_plan IS
  'Plan key chosen by user during registration/select-plan. '
  'Values match planFeatures.js keys. Written only by commit_plan_selection RPC.';

-- -----------------------------------------------------------------------------
-- 2b. Whitelist CHECK constraint
--     Mirrors PLAN_FEATURES keys from src/lib/planFeatures.js.
--     Defensive: RPC also validates, but DB is the source of truth.
--     Rollback counterpart: rollback step 6 (constraint dropped with column).
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_selected_plan_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_selected_plan_check
      CHECK (
        selected_plan IS NULL OR selected_plan IN (
          'coach_free','coach_pro','coach_team',
          'athlete_free','athlete_premium'
        )
      );
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Grandfather existing users (ADR 4)
--    Runs in the same transaction as the ADD COLUMN so there is zero window
--    in which an existing row is visible with plan_selected_at = NULL.
--    Spec scenario 22, 45, 46.
--    Rollback counterpart: N/A (column is dropped entirely on rollback).
-- -----------------------------------------------------------------------------
UPDATE public.users
   SET plan_selected_at = created_at
 WHERE plan_selected_at IS NULL
   AND created_at IS NOT NULL;

-- Safety net: any user with a NULL created_at (should be 0 rows — verified)
-- gets now() to avoid leaving them blocked by the guard.
UPDATE public.users
   SET plan_selected_at = now()
 WHERE plan_selected_at IS NULL;

-- -----------------------------------------------------------------------------
-- 4. Partial index for the guard hot path (ADR 6)
--    PlanSelectionGuard reads users.plan_selected_at on every protected route.
--    Once grandfather + future commits complete, this index shrinks to 0 rows
--    and costs nothing. Partial index name is idempotent (IF NOT EXISTS).
--    Rollback counterpart: rollback step 4 (DROP INDEX).
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_plan_selected_at_null
  ON public.users (id)
  WHERE plan_selected_at IS NULL;

-- -----------------------------------------------------------------------------
-- 5. BEFORE UPDATE trigger function: users_block_plan_cols (ADR 2)
--    Blocks direct client writes to plan_selected_at and selected_plan.
--    The commit_plan_selection RPC runs as SECURITY DEFINER with owner
--    (postgres), so current_user = 'postgres' and the trigger lets it through.
--    The service_role JWT claim is also allowed for admin-api edge function.
--    Spec scenarios 39, 8.11.
--    Rollback counterpart: rollback steps 1-2 (DROP TRIGGER + DROP FUNCTION).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.users_block_plan_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_jwt_role text;
BEGIN
  -- Allow when invoked from a SECURITY DEFINER function owned by a superuser
  -- (commit_plan_selection) or from a direct DB superuser connection.
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  -- Allow service_role calls (admin-api edge function, stripe webhook, etc.)
  BEGIN
    v_jwt_role := current_setting('request.jwt.claims', true)::jsonb->>'role';
  EXCEPTION WHEN OTHERS THEN
    v_jwt_role := NULL;
  END;

  IF v_jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Any other role (authenticated, anon) must not touch the two protected cols.
  IF OLD.plan_selected_at IS DISTINCT FROM NEW.plan_selected_at
     OR OLD.selected_plan IS DISTINCT FROM NEW.selected_plan THEN
    RAISE EXCEPTION 'plan_selection_readonly'
      USING ERRCODE = '42501',
            HINT    = 'Use commit_plan_selection RPC to set these columns.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.users_block_plan_cols() IS
  'Trigger function: raises plan_selection_readonly if a non-privileged role '
  'attempts to change users.plan_selected_at or users.selected_plan. '
  'commit_plan_selection RPC (SECURITY DEFINER) bypasses via current_user check.';

-- Drop-then-create to make the trigger attachment idempotent
DROP TRIGGER IF EXISTS users_block_plan_cols_trg ON public.users;
CREATE TRIGGER users_block_plan_cols_trg
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.users_block_plan_cols();

-- -----------------------------------------------------------------------------
-- 6. commit_plan_selection RPC (ADR 1, 7)
--    Single server-side writer for plan_selected_at + selected_plan.
--    Atomic UPDATE users + conditional INSERT subscriptions for free plans.
--    SECURITY DEFINER: runs as function owner, bypasses RLS on subscriptions
--    and bypasses the block trigger via current_user = 'postgres'.
--    SET search_path = public, auth: needed because auth.uid() lives in auth.
--    Spec scenarios 1, 3, 4, 8, 9, 10, 18, 41, 42, 47.
--    Rollback counterpart: rollback step 3 (REVOKE + DROP FUNCTION).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.commit_plan_selection(
  p_plan_key         text,
  p_billing_interval text DEFAULT 'month'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id      uuid;
  v_role         text;
  v_already      boolean;
  v_committed_at timestamptz := now();
BEGIN
  -- --- Authentication --------------------------------------------------------
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
  END IF;

  -- --- Input validation ------------------------------------------------------
  IF p_plan_key IS NULL
     OR p_plan_key NOT IN (
       'coach_free','coach_pro','coach_team',
       'athlete_free','athlete_premium'
     ) THEN
    RAISE EXCEPTION 'invalid_plan_key' USING ERRCODE = '22023';
  END IF;

  IF p_billing_interval IS NULL
     OR p_billing_interval NOT IN ('month','year') THEN
    RAISE EXCEPTION 'invalid_billing_interval' USING ERRCODE = '22023';
  END IF;

  -- --- Idempotency guard -----------------------------------------------------
  -- A user may only commit a plan once. Subsequent commits are rejected so
  -- the client layer can silently refetch and navigate (spec scenario 47/15).
  SELECT (plan_selected_at IS NOT NULL), role
    INTO v_already, v_role
    FROM public.users
   WHERE id = v_user_id;

  IF v_already THEN
    RAISE EXCEPTION 'plan_already_selected' USING ERRCODE = '23505';
  END IF;

  IF v_role IS NULL THEN
    -- Row doesn't exist yet (handle_new_user trigger race). Surface as
    -- unauthorized so the client retries after profile fetch.
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
  END IF;

  -- --- Role/plan cross-validation --------------------------------------------
  IF v_role = 'coach' AND p_plan_key NOT LIKE 'coach\_%' ESCAPE '\' THEN
    RAISE EXCEPTION 'plan_role_mismatch' USING ERRCODE = '22023';
  END IF;

  IF v_role IN ('athlete','independent_athlete')
     AND p_plan_key NOT LIKE 'athlete\_%' ESCAPE '\' THEN
    RAISE EXCEPTION 'plan_role_mismatch' USING ERRCODE = '22023';
  END IF;

  -- --- Atomic commit ---------------------------------------------------------
  -- UPDATE users is allowed because SECURITY DEFINER runs as postgres, which
  -- passes the users_block_plan_cols trigger check.
  UPDATE public.users
     SET plan_selected_at = v_committed_at,
         selected_plan    = p_plan_key
   WHERE id = v_user_id;

  -- Free plans get a real subscriptions row so useSubscription can derive
  -- effective access from an active row (ADR 5). Paid pickers get NO row —
  -- they trial via users.trial_ends_at until Stripe webhook writes the row.
  IF p_plan_key IN ('coach_free','athlete_free') THEN
    INSERT INTO public.subscriptions (
      user_id, plan_key, status, billing_interval,
      stripe_subscription_id, stripe_price_id,
      current_period_start,   current_period_end,
      cancel_at_period_end
    )
    VALUES (
      v_user_id, p_plan_key, 'active', p_billing_interval,
      NULL, NULL, NULL, NULL, false
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN json_build_object(
    'success',      true,
    'plan_key',     p_plan_key,
    'committed_at', v_committed_at
  );
END;
$$;

COMMENT ON FUNCTION public.commit_plan_selection(text, text) IS
  'Server-side single writer for users.plan_selected_at and users.selected_plan. '
  'Validates plan_key + billing_interval + role match, then atomically updates '
  'users and inserts a free-plan subscriptions row (when applicable). '
  'Errors: unauthorized, invalid_plan_key, invalid_billing_interval, '
  'plan_already_selected, plan_role_mismatch.';

-- Lock down execution. authenticated users only (no anon, no public).
REVOKE ALL    ON FUNCTION public.commit_plan_selection(text, text) FROM public;
REVOKE ALL    ON FUNCTION public.commit_plan_selection(text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.commit_plan_selection(text, text) TO authenticated;

COMMIT;

-- =============================================================================
-- End of plan_selection_required UP migration
-- =============================================================================

-- =============================================================================
-- Migration: plan_selection_required (DOWN / ROLLBACK)
-- Change:    plan-selection-required
-- Date:      2026-04-10
-- Project:   lusirdkixfliydimemre
-- =============================================================================
--
-- Purpose:
--   Fully reverse supabase/migrations/20260410090000_plan_selection_required.sql
--
-- Notes:
--   - Idempotent: every statement uses IF EXISTS. Safe to run twice.
--   - Wrapped in a single transaction so a mid-rollback failure leaves the
--     schema in its pre-rollback state.
--   - Free-plan subscriptions rows created by commit_plan_selection DURING
--     the feature window are NOT deleted here. They are benign data (real
--     active subscriptions) and removing them would silently revoke access.
--     If you truly need a clean slate, manually delete those rows BEFORE
--     running this rollback.
--   - No subscriptions NOT-NULL constraints are restored because none were
--     dropped in the UP migration (pre-check confirmed all nullable).
--
-- Usage:
--   Run via Supabase SQL Editor or `supabase db push` after restoring this
--   file as the active migration.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Drop the BEFORE UPDATE trigger (counterpart of UP step 5)
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS users_block_plan_cols_trg ON public.users;

-- -----------------------------------------------------------------------------
-- 2. Drop the trigger function (counterpart of UP step 5)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.users_block_plan_cols();

-- -----------------------------------------------------------------------------
-- 3. Drop the commit_plan_selection RPC (counterpart of UP step 6)
--    REVOKE first for good hygiene, then DROP.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'commit_plan_selection'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    REVOKE ALL ON FUNCTION public.commit_plan_selection(text, text) FROM authenticated;
    REVOKE ALL ON FUNCTION public.commit_plan_selection(text, text) FROM anon;
    REVOKE ALL ON FUNCTION public.commit_plan_selection(text, text) FROM public;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.commit_plan_selection(text, text);

-- -----------------------------------------------------------------------------
-- 4. Drop the partial index (counterpart of UP step 4)
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_users_plan_selected_at_null;

-- -----------------------------------------------------------------------------
-- 5. Drop the CHECK constraint on selected_plan (counterpart of UP step 2b)
--    Dropped explicitly so the DROP COLUMN in step 6 doesn't rely on CASCADE.
-- -----------------------------------------------------------------------------
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_selected_plan_check;

-- -----------------------------------------------------------------------------
-- 6. Drop selected_plan column (counterpart of UP step 2)
-- -----------------------------------------------------------------------------
ALTER TABLE public.users
  DROP COLUMN IF EXISTS selected_plan;

-- -----------------------------------------------------------------------------
-- 7. Drop plan_selected_at column (counterpart of UP step 1)
-- -----------------------------------------------------------------------------
ALTER TABLE public.users
  DROP COLUMN IF EXISTS plan_selected_at;

-- -----------------------------------------------------------------------------
-- Subscriptions constraints (UP step intentionally skipped):
--   The UP migration did not drop any NOT NULL constraints on subscriptions
--   (pre-check confirmed all target columns were already nullable), so there
--   is nothing to restore here. Intentionally no-op.
-- -----------------------------------------------------------------------------

COMMIT;

-- =============================================================================
-- End of plan_selection_required ROLLBACK
-- =============================================================================

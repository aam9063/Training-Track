-- =========================================================================
-- Rollback: plan_adjustment_reactive_expiry (DOWN)
-- Drops the trigger first, then both functions. Existing 'pending'
-- suggestions stop expiring reactively (they still expire via the
-- date-based sweep, migration 3) — no data loss.
-- =========================================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_expire_plan_adjustments ON public.training_load_alerts;
DROP FUNCTION IF EXISTS public.tg_expire_plan_adjustments();
DROP FUNCTION IF EXISTS public.expire_plan_adjustments_for_alert(uuid);

COMMIT;

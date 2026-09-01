-- =========================================================================
-- Rollback: daily_training_load_baseline (DOWN)
-- Reverses 20260819140000_daily_training_load_baseline.sql.
--
-- NOTE: this only drops the temporary write policy and re-declares RLS as
-- disabled/no-op-safe; it deliberately does NOT drop the table or the
-- restated baseline policies (daily_training_load_select/_insert/_update),
-- since those mirror state that was ALREADY live before this migration
-- existed (task 1.3) — dropping them would remove access that predates
-- this change. Per the proposal's rollback plan: "flip flag -> unschedule
-- cron -> revert webhook -> revert frontend (new columns additive/
-- nullable)" — the baseline table/RLS themselves are not part of what
-- gets rolled back; only this change's additions are.
-- =========================================================================

BEGIN;

DROP POLICY IF EXISTS dtl_write_own_insert ON public.daily_training_load;
DROP POLICY IF EXISTS dtl_write_own_update ON public.daily_training_load;

COMMIT;

-- =========================================================================
-- Rollback: load_sweep_rpc (DOWN)
-- Reverses 20260819144000_load_sweep_rpc.sql.
-- New function introduced entirely by this migration — safe to drop.
-- =========================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.get_athletes_needing_load_refresh(date, timestamptz, date, smallint, integer, integer);

COMMIT;

-- =========================================================================
-- Rollback: planning_candidates_rpc (DOWN)
-- Drops both functions. No table/data impact — read/UPDATE-only RPCs.
-- =========================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.expire_stale_plan_adjustments(date);
DROP FUNCTION IF EXISTS public.get_planning_candidates(date, integer, integer);

COMMIT;

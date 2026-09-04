-- =========================================================================
-- Rollback: engagement_sweep_rpc (DOWN)
-- Reverses 20260901101000_engagement_sweep_rpc.sql. Indexes are left in
-- place: pure performance indexes with no behavioural coupling to this
-- function, matching Agent 1's rollback precedent for
-- idx_training_sessions_athlete_date.
-- =========================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.get_engagement_candidates(date, integer, integer, integer, integer);

COMMIT;

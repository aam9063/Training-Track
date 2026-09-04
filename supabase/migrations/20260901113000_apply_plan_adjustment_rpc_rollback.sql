-- =========================================================================
-- Rollback: apply_plan_adjustment_rpc (DOWN)
-- Drops the function. With it gone, nothing in the repo can write a patch
-- to training_sessions (proposal rollback plan step 4) — already-approved
-- patches are NOT reverted, they are legitimate coach-approved plan edits
-- (D4), and last_adjustment_id (migration 2) still records which rows
-- they were.
-- =========================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.apply_plan_adjustment(uuid);

COMMIT;

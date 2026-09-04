-- =========================================================================
-- Rollback: training_sessions_agent_provenance (DOWN)
-- Additive, nullable columns — safe to drop without a data-loss concern
-- beyond the provenance markers themselves (D4: already-approved patches
-- are not reverted, they are legitimate coach-approved plan edits; dropping
-- last_adjustment_id only removes the record of which rows they were).
-- =========================================================================

BEGIN;

ALTER TABLE public.training_sessions
  DROP COLUMN IF EXISTS last_adjustment_id;

ALTER TABLE public.training_sessions
  DROP COLUMN IF EXISTS adjusted_by_agent;

COMMIT;

-- =========================================================================
-- Rollback: training_load_alerts (DOWN)
-- Reverses 20260819142000_training_load_alerts.sql.
-- training_load_alerts is a new, isolated table (proposal rollback plan
-- step 3) — safe to drop entirely, nothing else references it.
-- The training_sessions index is left in place on rollback: it is a
-- pure performance index with no behavioural coupling to this table, and
-- dropping it would also undo 1.4's now-confirmed-safe no-op-if-present
-- guarantee for any other future consumer of that same index shape.
-- =========================================================================

BEGIN;

DROP TABLE IF EXISTS public.training_load_alerts CASCADE;

COMMIT;

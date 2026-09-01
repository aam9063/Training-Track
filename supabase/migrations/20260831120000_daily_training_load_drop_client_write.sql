-- =========================================================================
-- Migration: daily_training_load_drop_client_write (UP)
-- Drops the temporary `dtl_write_own_insert`/`dtl_write_own_update`
-- policies added in 20260819140000_daily_training_load_baseline.sql
-- (Migration Plan #1 / #7 in design.md). Slice 3 gate: the frontend no
-- longer writes daily_training_load directly — trainingLoadService.js's
-- `recalculateTrainingLoad` write path is superseded by
-- training-load-monitor (Phase 3), which writes as service_role and
-- bypasses RLS entirely, so it is unaffected by this drop.
--
-- The baseline `daily_training_load_insert`/`daily_training_load_update`
-- policies (self-scoped equivalents, restated from the live table in
-- migration 20260819140000) are NOT touched here — this only removes the
-- separate, explicitly-named temporary pair, per that migration's own
-- comment instructing a future drop to only touch dtl_write_own_*.
--
-- NOT APPLIED by this batch (task 4.5) — write-only, matching the
-- Slice 3 rollout note in design.md ("applied only in Slice 3, after the
-- frontend stops writing"). Apply once the frontend deploy that removes
-- the client write path is live.
-- See: openspec/changes/training-load-monitoring-agent/design.md
--      (Migration Plan #7)
-- =========================================================================

BEGIN;

DROP POLICY IF EXISTS dtl_write_own_insert ON public.daily_training_load;
DROP POLICY IF EXISTS dtl_write_own_update ON public.daily_training_load;

COMMIT;

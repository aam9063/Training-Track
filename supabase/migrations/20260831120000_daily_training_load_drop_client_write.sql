-- =========================================================================
-- Migration: daily_training_load_drop_client_write (UP)
-- Drops the temporary `dtl_write_own_insert`/`dtl_write_own_update`
-- policies added in 20260819140000_daily_training_load_baseline.sql
-- (Migration Plan #1 / #7 in design.md).
--
-- CORRECTION (2026-09-01, verified live before applying): PMCChart.jsx's
-- manual "Recalcular" button still calls trainingLoadService.js's
-- `recalculateTrainingLoad`, which STILL writes daily_training_load
-- directly from the client — that write path was never removed, contrary
-- to this migration's original header claim. User decision: leave it
-- (harmless — the client's upsert omits chronic_load_28/calc_version, so
-- inserted/touched rows get calc_version=1, lower than the agent's
-- CALC_VERSION=2, and the next sweep/webhook recompute self-heals them;
-- functionally safe, just not yet unified). Migrating that button onto
-- training-load-monitor is deferred, not urgent.
--
-- This migration is still safe to apply regardless: `dtl_write_own_*` was
-- always a REDUNDANT duplicate of the baseline `daily_training_load_insert`/
-- `daily_training_load_update` policies (self-scoped equivalents, restated
-- from the live table in migration 20260819140000, which already existed
-- before this SDD change) — dropping it removes a Supabase-advisor-flagged
-- duplicate-policy performance warning with ZERO permission change, since
-- the baseline policies grant the identical self-write access on their own.
-- See: openspec/changes/training-load-monitoring-agent/design.md
--      (Migration Plan #7)
-- =========================================================================

BEGIN;

DROP POLICY IF EXISTS dtl_write_own_insert ON public.daily_training_load;
DROP POLICY IF EXISTS dtl_write_own_update ON public.daily_training_load;

COMMIT;

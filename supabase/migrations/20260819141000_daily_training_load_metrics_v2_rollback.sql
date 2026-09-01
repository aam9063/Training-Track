-- =========================================================================
-- Rollback: daily_training_load_metrics_v2 (DOWN)
-- Reverses 20260819141000_daily_training_load_metrics_v2.sql.
-- Additive + nullable columns, so this is a safe, fully-reversible drop
-- (existing rows remain readable; the calc_version-driven recompute is
-- the only thing lost, and it is regenerable on demand — D3).
-- =========================================================================

BEGIN;

ALTER TABLE public.daily_training_load
  DROP COLUMN IF EXISTS chronic_load_28,
  DROP COLUMN IF EXISTS calc_version,
  DROP COLUMN IF EXISTS computed_at,
  DROP COLUMN IF EXISTS low_confidence;

COMMIT;

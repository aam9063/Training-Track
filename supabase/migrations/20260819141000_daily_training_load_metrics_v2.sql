-- =========================================================================
-- Migration: daily_training_load_metrics_v2 (UP)
-- Additive/nullable columns for D1 (independent 28-day ACWR chronic window)
-- and D3 (deterministic, version-tagged backfill).
-- See: openspec/changes/training-load-monitoring-agent/design.md
--      (Migration Plan #2)
-- =========================================================================

BEGIN;

ALTER TABLE public.daily_training_load
  ADD COLUMN IF NOT EXISTS chronic_load_28 numeric,
  ADD COLUMN IF NOT EXISTS calc_version smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS computed_at timestamptz,
  ADD COLUMN IF NOT EXISTS low_confidence boolean NOT NULL DEFAULT false;

COMMIT;

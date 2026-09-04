-- =========================================================================
-- Migration: training_sessions_agent_provenance (UP)
-- Additive, nullable-safe provenance columns on training_sessions marking
-- which sessions were last touched by an approved plan-adjustment patch.
-- No backfill: no agent has ever written a session before this change, so
-- `adjusted_by_agent = false` is factually correct for every existing row.
-- Must follow 20260901110000_plan_adjustment_suggestions.sql for the FK.
-- See: openspec/changes/continuous-planning-agent/design.md
--      (Migration Plan #2)
--
-- V8 RESOLVED live 2026-09-01 (orchestrator, before this migration was
-- applied): training_sessions.training_type IS the stale-schema.sql ENUM
-- {running,gym,rest,cross_training} — confirmed via information_schema on
-- production, and confirmed no row has ever held 'descanso' (live data:
-- running=183, gym=24, cross_training=2, rest=1). AIPlanReviewModal.jsx's
-- 'descanso'/'carrera' are client-side draft-plan-JSON labels only, never
-- actually persisted — the real insert path (planningService.js's
-- assignPlanToAthletes) hardcodes training_type='running' for every
-- session regardless of type, a separate pre-existing bug, out of scope
-- here. planAdjustmentCore.js's REST_TYPE was WRONG at 'descanso' and has
-- been corrected to 'rest' (Phase 1, this same session, before Phase 2's
-- migrations were applied) — this migration and #4 were never at risk of
-- applying with the wrong value live.
-- =========================================================================

BEGIN;

ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS adjusted_by_agent boolean NOT NULL DEFAULT false;

ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS last_adjustment_id uuid
    REFERENCES public.plan_adjustment_suggestions(id) ON DELETE SET NULL;

COMMIT;

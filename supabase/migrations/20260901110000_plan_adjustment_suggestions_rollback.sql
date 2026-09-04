-- =========================================================================
-- Rollback: plan_adjustment_suggestions (DOWN)
-- Reverses 20260901110000_plan_adjustment_suggestions.sql. Drops the
-- upsert RPC first (depends on the table via its body, not a hard FK, but
-- dropping in this order keeps intent explicit), then the table.
-- New, isolated table — nothing outside this change references it yet at
-- rollback time IF migrations 2-6 have already been rolled back first (the
-- reverse of the apply order); the FK from training_sessions.
-- last_adjustment_id (migration 2) must be rolled back before this one.
-- =========================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.upsert_plan_adjustment_suggestion(
  uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb, text, date
);

DROP TABLE IF EXISTS public.plan_adjustment_suggestions CASCADE;

COMMIT;

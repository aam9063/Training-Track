-- =========================================================================
-- Rollback: pg_cron_planning_sweep (DOWN)
-- Unschedules the job. Does NOT drop pg_cron/pg_net (Agent 1 and Agent 2's
-- jobs depend on them) and does NOT touch the Vault secrets (shared with
-- Agents 1-2). Per the rollout plan's rollback step 2: the agent goes
-- silent immediately, no data loss, no code revert needed.
-- =========================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'planning-daily-sweep') THEN
    PERFORM cron.unschedule('planning-daily-sweep');
  END IF;
END;
$$;

COMMIT;

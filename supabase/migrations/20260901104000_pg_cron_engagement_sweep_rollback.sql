-- =========================================================================
-- Rollback: pg_cron_engagement_sweep (DOWN)
-- Unschedules the job. Does NOT drop pg_cron/pg_net (Agent 1's job and
-- other features depend on them) and does NOT touch the Vault secrets
-- (shared with Agent 1). Per the proposal's rollback plan step 1: the
-- agent goes silent immediately, no data loss, no code revert needed.
-- =========================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'engagement-daily-sweep') THEN
    PERFORM cron.unschedule('engagement-daily-sweep');
  END IF;
END;
$$;

COMMIT;

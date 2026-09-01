-- =========================================================================
-- Migration: pg_cron_schedules (ROLLBACK)
-- Unschedules both jobs. Does NOT drop pg_cron/pg_net (other jobs/features
-- may depend on them) and does NOT restore the original Dashboard-
-- configured `weekly-ai-reports` job — re-create that manually via the
-- Dashboard if rolling back past the point where this migration replaced
-- it, per task 3.12's sequencing (observe one Monday firing correctly
-- before removing the Dashboard config in the first place).
-- =========================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'training-load-daily-sweep') THEN
    PERFORM cron.unschedule('training-load-daily-sweep');
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-ai-reports-monday') THEN
    PERFORM cron.unschedule('weekly-ai-reports-monday');
  END IF;
END;
$$;

COMMIT;

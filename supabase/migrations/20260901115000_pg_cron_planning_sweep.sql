-- =========================================================================
-- Migration: pg_cron_planning_sweep (UP)
-- Declares the daily planning sweep as a versioned pg_cron job.
--
-- pg_cron / pg_net are already installed and active (Agent 1, migration
-- 20260819146000_pg_cron_schedules.sql). cron_secret / project_url are
-- already seeded in Supabase Vault by that migration's manual setup step
-- and reused verbatim by Agent 2 (20260901104000_pg_cron_engagement_
-- sweep.sql) — this migration does NOT call vault.create_secret, it only
-- reads the existing secrets and fails loudly if they are missing.
--
-- Scheduled 05:15 UTC daily — 30 minutes after Agent 2's engagement-daily-
-- sweep (04:45 UTC) and 60 minutes after Agent 1's training-load-daily-
-- sweep (04:15 UTC), so training_load_alerts are fresh before Agent 3
-- reads them via get_planning_candidates.
-- See: openspec/changes/continuous-planning-agent/design.md
--      (Migration Plan #6, Data Flow)
-- =========================================================================

BEGIN;

DO $$
DECLARE
  v_cron_secret text;
  v_project_url text;
BEGIN
  SELECT decrypted_secret INTO v_cron_secret
  FROM vault.decrypted_secrets WHERE name = 'cron_secret';

  SELECT decrypted_secret INTO v_project_url
  FROM vault.decrypted_secrets WHERE name = 'project_url';

  IF v_cron_secret IS NULL OR v_project_url IS NULL THEN
    RAISE EXCEPTION 'cron_secret / project_url not found in Vault — expected already seeded by migration 20260819146000_pg_cron_schedules.sql''s manual setup step';
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'planning-daily-sweep') THEN
    PERFORM cron.unschedule('planning-daily-sweep');
  END IF;

  PERFORM cron.schedule(
    'planning-daily-sweep',
    '15 5 * * *',
    format(
      $sql$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body := jsonb_build_object('mode', 'sweep', 'limit', 100, 'offset', 0)
      );
      $sql$,
      v_project_url || '/functions/v1/planning-agent',
      v_cron_secret
    )
  );
END;
$$;

COMMIT;

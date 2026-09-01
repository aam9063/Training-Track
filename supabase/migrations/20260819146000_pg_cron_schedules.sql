-- =========================================================================
-- Migration: pg_cron_schedules (UP)
-- Declares the daily training-load sweep as a versioned pg_cron job, and
-- migrates the existing Dashboard-configured `weekly-ai-reports` Monday job
-- into version control alongside it (design.md Migration Plan #6).
--
-- pg_cron / pg_net are already installed and active on this project
-- (task 3.1, verified live: pg_cron 1.6.4, pg_net 0.19.5 — pg_cron is what
-- already fires weekly-ai-reports today). The `CREATE EXTENSION IF NOT
-- EXISTS` calls below are confirming no-ops, not a fresh install.
--
-- Secrets: `cron.schedule` SQL cannot read Deno env, so the trigger secret
-- and project URL are read from Supabase Vault at schedule-definition time
-- (same pattern as migration 20260819143000_send_push_notification_rpc.sql
-- and 20260819145000_upsert_training_load_alert_rpc.sql's caller). Before
-- applying this migration, seed both secrets once, e.g.:
--
--   select vault.create_secret('<CRON_SECRET value>', 'cron_secret');
--   select vault.create_secret('https://lusirdkixfliydimemre.supabase.co', 'project_url');
--
-- (If either secret already exists from a prior manual setup, use
-- vault.update_secret(id, new_secret) instead — create_secret errors on a
-- duplicate name.)
--
-- =========================================================================
-- MANUAL VERIFICATION REQUIRED BEFORE APPLYING (flagged, not silently
-- assumed): this migration's `weekly-ai-reports` job name
-- ('weekly-ai-reports-monday') and schedule ('0 6 * * 1' — 06:00 UTC every
-- Monday) are this migration's best-effort match for "the existing
-- Dashboard-configured Monday job" (task 3.1/3.9, task 3.12's "before
-- removing the Dashboard-configured schedule"). Neither the exact job name
-- nor the exact cron expression Supabase's Dashboard UI currently uses was
-- available to this apply batch (no live Supabase query access in this
-- session). Before applying: run `select jobid, jobname, schedule, command
-- from cron.job;` and, if the live job's name/schedule differs from what's
-- below, edit this file to match EXACTLY before running it — the
-- `cron.unschedule` call is a targeted-by-name removal and will silently
-- no-op (not error) if the name doesn't match, leaving the old Dashboard
-- job and this migration's new job both active in parallel.
-- =========================================================================
-- =========================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

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
    RAISE EXCEPTION 'cron_secret / project_url not seeded in Vault — see migration header for the manual seeding step';
  END IF;

  -- -----------------------------------------------------------------------
  -- training-load-daily-sweep — new job, 04:15 UTC daily
  -- -----------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'training-load-daily-sweep') THEN
    PERFORM cron.unschedule('training-load-daily-sweep');
  END IF;

  PERFORM cron.schedule(
    'training-load-daily-sweep',
    '15 4 * * *',
    format(
      $sql$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body := jsonb_build_object('mode', 'sweep', 'limit', 200, 'offset', 0)
      );
      $sql$,
      v_project_url || '/functions/v1/training-load-monitor',
      v_cron_secret
    )
  );

  -- -----------------------------------------------------------------------
  -- weekly-ai-reports-monday — migrated from the Dashboard-configured job.
  -- weekly-ai-reports/index.ts does NOT check CRON_SECRET (unlike
  -- training-load-monitor / cleanup-gym-files) — it authorizes via
  -- `x-supabase-cron-job: true` OR `Authorization: Bearer <service_role_key>`
  -- OR a valid user JWT (see index.ts:446-462). Sending the `cron_secret`
  -- Vault value as a Bearer token here would be REJECTED by that function's
  -- own auth check. The Dashboard's built-in Cron Jobs UI sets
  -- `x-supabase-cron-job: true` on its scheduled invocations, which is why
  -- that header (no secret at all) is what this migration reproduces —
  -- do not "fix" this to use v_cron_secret, that would break auth.
  -- SEE MIGRATION HEADER: verify jobname/schedule against `cron.job`
  -- before applying; edit below if they differ from what's live today.
  -- -----------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-ai-reports-monday') THEN
    PERFORM cron.unschedule('weekly-ai-reports-monday');
  END IF;

  PERFORM cron.schedule(
    'weekly-ai-reports-monday',
    '0 6 * * 1',
    format(
      $sql$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-supabase-cron-job', 'true'
        ),
        body := jsonb_build_object()
      );
      $sql$,
      v_project_url || '/functions/v1/weekly-ai-reports'
    )
  );
END;
$$;

COMMIT;

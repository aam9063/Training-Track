-- Verification for pg_cron_planning_sweep. 1 row per check, OK / FAIL.
-- Read-only, safe to re-run.

SELECT 'cron_job.scheduled' AS check_name,
       CASE WHEN EXISTS (
         SELECT 1 FROM cron.job WHERE jobname = 'planning-daily-sweep'
       ) THEN 'OK' ELSE 'FAIL' END AS status
UNION ALL
SELECT 'cron_job.schedule_matches_0515_utc',
       CASE WHEN (
         SELECT schedule FROM cron.job WHERE jobname = 'planning-daily-sweep'
       ) = '15 5 * * *' THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'cron_job.active',
       CASE WHEN (
         SELECT active FROM cron.job WHERE jobname = 'planning-daily-sweep'
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'vault.cron_secret_present',
       CASE WHEN EXISTS (
         SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_secret'
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'vault.project_url_present',
       CASE WHEN EXISTS (
         SELECT 1 FROM vault.decrypted_secrets WHERE name = 'project_url'
       ) THEN 'OK' ELSE 'FAIL' END;

-- Manual follow-up: after the planning-agent Edge Function is deployed
-- (Phase 3), trigger a manual invocation of the scheduled command's
-- net.http_post body (or wait for 05:15 UTC) and inspect cron.job_run_
-- details for a 200 response and net._http_response for the sweep's JSON
-- summary — mirrors Agent 1/2's own pg_cron verification step.

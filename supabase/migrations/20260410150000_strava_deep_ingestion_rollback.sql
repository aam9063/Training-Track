-- =========================================================================
-- Rollback: strava-deep-ingestion (DOWN)
-- Reverses 20260410150000_strava_deep_ingestion.sql
-- =========================================================================

BEGIN;

DROP TABLE IF EXISTS public.athlete_gear CASCADE;
DROP TABLE IF EXISTS public.athlete_hr_zones CASCADE;
DROP TABLE IF EXISTS public.strava_activity_streams CASCADE;

DROP INDEX IF EXISTS public.idx_strava_activities_has_streams;
DROP INDEX IF EXISTS public.idx_strava_activities_not_deleted;

ALTER TABLE public.strava_activities
  DROP COLUMN IF EXISTS splits_metric,
  DROP COLUMN IF EXISTS laps,
  DROP COLUMN IF EXISTS suffer_score,
  DROP COLUMN IF EXISTS weighted_average_watts,
  DROP COLUMN IF EXISTS workout_type,
  DROP COLUMN IF EXISTS gear_id,
  DROP COLUMN IF EXISTS device_name,
  DROP COLUMN IF EXISTS has_streams,
  DROP COLUMN IF EXISTS deleted,
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS updated_at;

COMMIT;

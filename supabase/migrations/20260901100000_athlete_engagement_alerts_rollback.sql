-- =========================================================================
-- Rollback: athlete_engagement_alerts (DOWN)
-- Reverses 20260901100000_athlete_engagement_alerts.sql.
-- New, isolated table with no FKs pointing at it (proposal rollback plan
-- step 3) — safe to drop entirely.
-- =========================================================================

BEGIN;

DROP TABLE IF EXISTS public.athlete_engagement_alerts CASCADE;

COMMIT;

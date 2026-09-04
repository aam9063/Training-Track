-- =========================================================================
-- Rollback: upsert_engagement_alert_rpc (DOWN)
-- Reverses 20260901102000_upsert_engagement_alert_rpc.sql.
-- =========================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.upsert_engagement_alert(uuid, uuid, text, text, date, integer, jsonb, text);

COMMIT;

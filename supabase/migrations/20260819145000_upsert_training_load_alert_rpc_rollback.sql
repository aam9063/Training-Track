-- =========================================================================
-- Migration: upsert_training_load_alert_rpc (ROLLBACK)
-- =========================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.upsert_training_load_alert(uuid, uuid, text, text, date, jsonb, text);

COMMIT;

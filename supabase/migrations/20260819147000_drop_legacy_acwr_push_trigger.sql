-- =========================================================================
-- Migration: drop_legacy_acwr_push_trigger (UP)
-- Retires trg_push_acwr_alert / fn_push_acwr_alert (originally added by
-- 20260310100638_acwr_push_alert_trigger). Fully superseded by
-- training_load_alerts' acwr_zone signal, which has proper deduplication,
-- lifecycle, hysteresis, and respects TRAINING_LOAD_ALERTS_ENABLED.
--
-- INCIDENT (2026-08-31): this trigger fires on every INSERT (no crossing
-- guard on insert, only on UPDATE) when the row's atl/ctl > 1.3. The
-- training-load-monitoring-agent backfill (600 INSERTs across 5 athletes)
-- triggered it repeatedly during each athlete's EWMA ramp-up, sending
-- ~50 push notifications to the one affected coach within seconds.
-- Disabled the same day (`ALTER TABLE ... DISABLE TRIGGER`), dropped here
-- per user decision now that the new system fully covers this signal.
-- See: openspec/changes/training-load-monitoring-agent/tasks.md
-- =========================================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_push_acwr_alert ON public.daily_training_load;
DROP FUNCTION IF EXISTS public.fn_push_acwr_alert();

COMMIT;

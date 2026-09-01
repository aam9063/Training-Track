-- =========================================================================
-- Migration: upsert_training_load_alert_rpc (UP)
-- SECURITY DEFINER RPC performing the atomic
--   ON CONFLICT (athlete_id, alert_type) WHERE status = 'open' DO UPDATE
-- upsert that design.md's "Four independent signals, four independent
-- episode streams" decision (task 3.4) requires, and that PostgREST's
-- high-level `.upsert()` cannot express: Postgres's ON CONFLICT inference
-- for a *partial* unique index requires the predicate to be present in the
-- INSERT statement's own ON CONFLICT clause, which the supabase-js client
-- has no way to pass through. This is a small addition beyond the
-- design.md Migration Plan #1-#7 table (which did not anticipate this
-- gap) — flagged here rather than silently added; see task 3.4's
-- Postgres-gotcha note and design.md's matching callout for why the raw
-- SQL form is mandatory for correctness under the webhook/cron race.
--
-- Always refreshes last_seen_on/metrics/message_es/recipient_id/severity
-- to the current finding on every call for an already-open episode
-- (severity may move up OR down to track the live zone) — the caller
-- (training-load-monitor/index.ts) decides whether to actually deliver
-- (push) based on `escalated`, per design's "escalate only re-delivers"
-- rule. Insert vs. update-in-place is detected via `xmax = 0`, the
-- standard Postgres idiom for "this row was inserted, not updated" inside
-- a single RETURNING clause.
-- =========================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.upsert_training_load_alert(
  p_athlete_id   uuid,
  p_recipient_id uuid,
  p_alert_type   text,
  p_severity     text,
  p_metric_date  date,
  p_metrics      jsonb,
  p_message_es   text
)
RETURNS TABLE (
  alert_id  uuid,
  is_new    boolean,
  escalated boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old_severity text;
  v_id           uuid;
  v_is_new       boolean;
BEGIN
  -- Read the OLD severity BEFORE the upsert, as its own statement — a
  -- WITH-CTE version of this (SELECT...FOR UPDATE alongside the INSERT in
  -- the same statement) was tried first and empirically returned NULL for
  -- `escalated` due to snapshot/CTE-materialization interaction; plpgsql's
  -- strict statement-by-statement execution has no such ambiguity.
  SELECT severity INTO v_old_severity
  FROM public.training_load_alerts
  WHERE athlete_id = p_athlete_id
    AND alert_type = p_alert_type
    AND status = 'open'
  FOR UPDATE;

  INSERT INTO public.training_load_alerts (
    athlete_id, recipient_id, alert_type, severity, metric_date,
    metrics, message_es, status, episode_started_on, last_seen_on
  )
  VALUES (
    p_athlete_id, p_recipient_id, p_alert_type, p_severity, p_metric_date,
    p_metrics, p_message_es, 'open', p_metric_date, p_metric_date
  )
  ON CONFLICT (athlete_id, alert_type) WHERE status = 'open'
  DO UPDATE SET
    last_seen_on  = EXCLUDED.last_seen_on,
    metrics       = EXCLUDED.metrics,
    severity      = EXCLUDED.severity,
    message_es    = EXCLUDED.message_es,
    recipient_id  = EXCLUDED.recipient_id,
    metric_date   = EXCLUDED.metric_date,
    updated_at    = now()
  RETURNING id, (xmax = 0) INTO v_id, v_is_new;

  RETURN QUERY
  SELECT v_id, v_is_new,
    (NOT v_is_new AND v_old_severity = 'warning' AND p_severity = 'critical');
END;
$function$;

-- Backend-only, mirroring get_athletes_needing_load_refresh's grant shape:
-- invoked exclusively from training-load-monitor with service_role.
REVOKE EXECUTE ON FUNCTION public.upsert_training_load_alert(uuid, uuid, text, text, date, jsonb, text)
  FROM PUBLIC, anon, authenticated;

COMMIT;

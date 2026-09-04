-- =========================================================================
-- Migration: upsert_engagement_alert_rpc (UP)
-- SECURITY DEFINER RPC performing the atomic
--   ON CONFLICT (athlete_id, alert_type) WHERE status = 'open' DO UPDATE
-- upsert against the partial unique dedup index. Mirrors Agent 1's
-- upsert_training_load_alert shape exactly, including its mandatory
-- LANGUAGE plpgsql form: Agent 1 found empirically that expressing this as
-- LANGUAGE sql with a SELECT...FOR UPDATE CTE alongside the INSERT...ON
-- CONFLICT CTE in one statement returns `escalated: NULL` instead of the
-- correct boolean, due to snapshot/CTE-materialization interaction.
-- plpgsql's strict statement-by-statement execution has no such ambiguity:
-- read the old severity as its own statement, then upsert, then compare.
-- See: openspec/changes/adherence-detection-agent/design.md
--      (Migration Plan #3)
--
-- Always refreshes last_seen_on/silence_days/metrics/message_es/
-- recipient_id/metric_date on every call for an already-open episode.
-- `escalated` is true only for warning -> danger (the only escalation
-- direction that exists per athlete-engagement-alerts' "Danger-to-Warning
-- De-escalation Is Unreachable While Open" requirement — any de-escalating
-- signal resolves the alert entirely instead, via resolve_engagement_
-- alerts, not this function). Insert vs. update-in-place is detected via
-- `xmax = 0`, the standard Postgres idiom for "this row was inserted, not
-- updated" inside a single RETURNING clause.
-- =========================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.upsert_engagement_alert(
  p_athlete_id    uuid,
  p_recipient_id  uuid,
  p_alert_type    text,
  p_severity      text,
  p_metric_date   date,
  p_silence_days  integer,
  p_metrics       jsonb,
  p_message_es    text
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
  -- Read the OLD severity BEFORE the upsert, as its own statement — see
  -- migration header for why a single WITH-CTE statement is unsafe here.
  SELECT severity INTO v_old_severity
  FROM public.athlete_engagement_alerts
  WHERE athlete_id = p_athlete_id
    AND alert_type = p_alert_type
    AND status = 'open'
  FOR UPDATE;

  INSERT INTO public.athlete_engagement_alerts (
    athlete_id, recipient_id, alert_type, severity, metric_date,
    silence_days, metrics, message_es, status, episode_started_on, last_seen_on
  )
  VALUES (
    p_athlete_id, p_recipient_id, p_alert_type, p_severity, p_metric_date,
    p_silence_days, p_metrics, p_message_es, 'open', p_metric_date, p_metric_date
  )
  ON CONFLICT (athlete_id, alert_type) WHERE status = 'open'
  DO UPDATE SET
    last_seen_on  = EXCLUDED.last_seen_on,
    silence_days  = EXCLUDED.silence_days,
    metrics       = EXCLUDED.metrics,
    severity      = EXCLUDED.severity,
    message_es    = EXCLUDED.message_es,
    recipient_id  = EXCLUDED.recipient_id,
    metric_date   = EXCLUDED.metric_date,
    updated_at    = now()
  RETURNING id, (xmax = 0) INTO v_id, v_is_new;

  RETURN QUERY
  SELECT v_id, v_is_new,
    (NOT v_is_new AND v_old_severity = 'warning' AND p_severity = 'danger');
END;
$function$;

-- Backend-only: invoked exclusively from engagement-monitor with
-- service_role.
REVOKE EXECUTE ON FUNCTION public.upsert_engagement_alert(uuid, uuid, text, text, date, integer, jsonb, text)
  FROM PUBLIC, anon, authenticated;

COMMIT;

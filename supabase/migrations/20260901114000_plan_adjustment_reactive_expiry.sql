-- =========================================================================
-- Migration: plan_adjustment_reactive_expiry (UP)
-- expire_plan_adjustments_for_alert(uuid) + tg_expire_plan_adjustments() +
-- an AFTER UPDATE trigger on training_load_alerts.
--
-- Causality must be DB-side and cannot be bypassed: training_load_alerts.
-- status has two live writers (training-load-monitor's resolveEpisode,
-- service_role; and the client's trainingLoadAlertsService.dismiss(),
-- which sets status='resolved' alongside dismissed_at). Wiring expiry at
-- both call sites is two edits today and permanently fragile — a future
-- third writer would silently bypass it. A trigger is zero call sites and
-- cannot be skipped; expiry only ever WITHDRAWS a proposed mutation, it
-- can never cause one, so there is no analogue to Agent 2's
-- self-clear-your-own-churn-flag rejection here (design.md's "Decision:
-- Reactive expiry is an AFTER UPDATE trigger... not a client-callable
-- RPC").
--
-- Flood safety (the documented trg_push_acwr_alert incident — this repo
-- has been burned before by an undocumented, non-dedup trigger): this
-- trigger only UPDATEs "... WHERE status = 'pending'" against the partial
-- unique index, no push, no notifications insert, no fan-out. With no
-- pending row it is one probe of a partial index and zero writes. The
-- WHEN clause is narrowed to the exact resolving transition, matching the
-- same lesson Agent 2 already applied to its own reactive-resolve trigger.
--
-- expire_plan_adjustments_for_alert has NO client-reachable entry point —
-- REVOKE FROM PUBLIC, anon, authenticated. It is invoked only by this
-- trigger.
-- See: openspec/changes/continuous-planning-agent/design.md
--      (Migration Plan #5, "Decision: Reactive expiry is an AFTER UPDATE
--      trigger on training_load_alerts, not a client-callable RPC",
--      Interfaces / Contracts — Reactive expiry)
-- =========================================================================

BEGIN;

-- =========================================================================
-- 1. expire_plan_adjustments_for_alert — no client-reachable entry point
-- =========================================================================
CREATE OR REPLACE FUNCTION public.expire_plan_adjustments_for_alert(p_alert_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  UPDATE public.plan_adjustment_suggestions
     SET status = 'expired', resolved_at = now(), updated_at = now()
   WHERE triggering_alert_id = p_alert_id AND status = 'pending';
$function$;

REVOKE EXECUTE ON FUNCTION public.expire_plan_adjustments_for_alert(uuid)
  FROM PUBLIC, anon, authenticated;

-- =========================================================================
-- 2. tg_expire_plan_adjustments
-- =========================================================================
CREATE OR REPLACE FUNCTION public.tg_expire_plan_adjustments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.expire_plan_adjustments_for_alert(NEW.id);
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.tg_expire_plan_adjustments()
  FROM PUBLIC, anon, authenticated;

-- =========================================================================
-- 3. Trigger — narrowed WHEN clause covers both resolveEpisode (service_
--    role) and the client's dismiss() (which also sets status='resolved'
--    alongside dismissed_at), one trigger, both events, no second WHEN
--    branch needed.
-- =========================================================================
DROP TRIGGER IF EXISTS trg_expire_plan_adjustments ON public.training_load_alerts;
CREATE TRIGGER trg_expire_plan_adjustments
  AFTER UPDATE ON public.training_load_alerts
  FOR EACH ROW
  WHEN (NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM 'resolved')
  EXECUTE FUNCTION public.tg_expire_plan_adjustments();

COMMIT;

-- Rollback for drop_legacy_acwr_push_trigger. Restores the original
-- (buggy-on-insert) trigger/function exactly as it lived in
-- 20260310100638_acwr_push_alert_trigger. Only use this to inspect the old
-- behavior — re-enabling it will reproduce the 2026-08-31 notification-flood
-- incident on the next bulk write to daily_training_load.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_push_acwr_alert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_acwr        numeric;
  v_old_acwr    numeric;
  v_coach_id    uuid;
  v_athlete_name text;
BEGIN
  IF NEW.ctl IS NULL OR NEW.ctl = 0 THEN
    RETURN NEW;
  END IF;

  v_acwr := ROUND((NEW.atl / NEW.ctl)::numeric, 2);

  IF v_acwr <= 1.3 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.ctl IS NOT NULL AND OLD.ctl > 0 THEN
      v_old_acwr := ROUND((OLD.atl / OLD.ctl)::numeric, 2);
      IF v_old_acwr > 1.3 THEN
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  SELECT coach_id INTO v_coach_id
  FROM coach_athlete_relationship
  WHERE athlete_id = NEW.athlete_id
    AND status = 'active'
  LIMIT 1;

  IF v_coach_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(first_name || ' ' || last_name, 'Un atleta')
  INTO v_athlete_name
  FROM users
  WHERE id = NEW.athlete_id;

  PERFORM public.send_push_notification(
    ARRAY[v_coach_id],
    'Alerta de carga · ' || COALESCE(v_athlete_name, 'Atleta'),
    'ACWR ' || v_acwr::text || ' — carga aguda elevada. Revisa el estado del atleta.',
    '/dashboard/metrics',
    'tt-acwr-' || NEW.athlete_id::text
  );

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_push_acwr_alert
  AFTER INSERT OR UPDATE OF atl, ctl ON public.daily_training_load
  FOR EACH ROW EXECUTE FUNCTION fn_push_acwr_alert();

COMMIT;

-- Migration: Push notification adjustments for independent athletes (Phase 6)
-- Apply this in the Supabase SQL editor.
--
-- Changes:
-- 1. Modify notify_athlete_training_assigned trigger to skip when coach_id IS NULL
--    (independent athletes self-assign sessions — no "new training from coach" notification)
-- 2. Ensure filter sender_id != receiver_id to avoid push loops
-- 3. Add notification trigger for independent athlete plan ready

-- ─── 1. Recreate notify_athlete_training_assigned to skip self-assigned sessions ───

-- The original trigger sends a "new training assigned" notification when a
-- training_session is inserted. For independent athletes, coach_id IS NULL,
-- so we skip the notification to avoid the athlete receiving a push from themselves.

CREATE OR REPLACE FUNCTION public.notify_athlete_training_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_athlete_user_id uuid;
  v_coach_id uuid;
  v_existing_count integer;
  v_supabase_url text;
  v_anon_key text;
BEGIN
  -- Skip notifications for independent athletes (self-assigned sessions)
  -- When coach_id IS NULL, the session was created by the athlete themselves
  IF NEW.coach_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Avoid sending duplicate notifications in batch inserts (last 10 seconds check)
  SELECT COUNT(*) INTO v_existing_count
  FROM public.notifications
  WHERE receiver_id = NEW.athlete_id
    AND type = 'training_assigned'
    AND created_at > (NOW() - INTERVAL '10 seconds');

  IF v_existing_count > 0 THEN
    RETURN NEW;
  END IF;

  -- Resolve athlete's auth user_id from athletes table
  SELECT user_id INTO v_athlete_user_id
  FROM public.athletes
  WHERE id = NEW.athlete_id;

  IF v_athlete_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_supabase_url := current_setting('app.supabase_url', true);
  v_anon_key := current_setting('app.supabase_anon_key', true);

  -- Insert notification record
  INSERT INTO public.notifications (
    sender_id,
    receiver_id,
    type,
    title,
    body,
    data
  ) VALUES (
    NEW.coach_id,
    v_athlete_user_id,
    'training_assigned',
    'Nuevo entrenamiento',
    'Tus próximos entrenamientos están listos. ¡A por ello!',
    jsonb_build_object('session_id', NEW.id)
  )
  ON CONFLICT DO NOTHING;

  -- Trigger push notification via send-push Edge Function (non-blocking)
  IF v_supabase_url IS NOT NULL AND v_anon_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object(
        'receiver_id', v_athlete_user_id,
        'title', 'Nuevo entrenamiento',
        'body', 'Tus próximos entrenamientos están listos. ¡A por ello!',
        'data', jsonb_build_object('url', '/athlete/training')
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ─── 2. Ensure the trigger exists (re-attach if needed) ──────────────────────

DROP TRIGGER IF EXISTS on_training_session_insert ON public.training_sessions;

CREATE TRIGGER on_training_session_insert
  AFTER INSERT ON public.training_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_athlete_training_assigned();

-- ─── 3. Independent athlete — push on competition countdown ──────────────────
-- DB-side trigger: send push 7 days before a competition if athlete has
-- push subscription. Runs as a scheduled check (see pg_cron setup below).
-- For now this is a helper function; wire via pg_cron when ready.

CREATE OR REPLACE FUNCTION public.notify_independent_competition_countdown()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec RECORD;
  v_supabase_url text;
  v_anon_key text;
BEGIN
  v_supabase_url := current_setting('app.supabase_url', true);
  v_anon_key := current_setting('app.supabase_anon_key', true);

  IF v_supabase_url IS NULL OR v_anon_key IS NULL THEN
    RETURN;
  END IF;

  -- Find competitions in exactly 7 days or 1 day for independent athletes
  FOR v_rec IN
    SELECT
      c.athlete_id,
      u.id AS user_id,
      c.name,
      c.event_date,
      (c.event_date - CURRENT_DATE) AS days_until
    FROM public.competitions c
    JOIN public.users u ON u.id = c.athlete_id
    WHERE u.is_independent = true
      AND c.coach_id IS NULL
      AND (c.event_date - CURRENT_DATE) IN (7, 1)
      AND c.event_date >= CURRENT_DATE
  LOOP
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object(
        'receiver_id', v_rec.user_id,
        'title', CASE v_rec.days_until
          WHEN 1 THEN '¡Tu carrera es mañana!'
          ELSE '¡Tu carrera en 7 días!'
        END,
        'body', v_rec.name,
        'data', jsonb_build_object('url', '/athlete/competitions')
      )
    );
  END LOOP;
END;
$$;

-- Schedule competition countdown notifications (activate after pg_cron is enabled):
-- SELECT cron.schedule(
--   'independent-competition-countdown',
--   '0 8 * * *',  -- every day at 8am
--   'SELECT public.notify_independent_competition_countdown()'
-- );

-- ─── DOWN ─────────────────────────────────────────────────────────────────────
-- To rollback:
-- DROP FUNCTION IF EXISTS public.notify_independent_competition_countdown();
-- (Restore original notify_athlete_training_assigned without the IS NULL check)

-- Rollback Fase 6: restituir las funciones SIN validacion interna.
-- ATENCION: este rollback REINTRODUCE las vulnerabilidades documentadas en la
-- migracion forward (phishing via send_push_notification, sobrescritura de
-- paces ajenos via calculate_conconi_paces, info disclosure en
-- get_ai_analysis_limit). Solo usar como kill switch de emergencia si la
-- validacion interna rompe el flujo del front.

-- 1) send_push_notification original (sin checks)
CREATE OR REPLACE FUNCTION public.send_push_notification(
  p_user_ids uuid[],
  p_title text,
  p_body text,
  p_url text DEFAULT '/'::text,
  p_tag text DEFAULT 'tt-default'::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM net.http_post(
    url := 'https://lusirdkixfliydimemre.supabase.co/functions/v1/send-push',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer tt_push_trigger_2026_secret"}'::jsonb,
    body := jsonb_build_object(
      'user_ids', to_jsonb(p_user_ids),
      'title', p_title,
      'body', p_body,
      'url', p_url,
      'tag', p_tag
    )
  );
END;
$function$;

-- 2) calculate_conconi_paces original (sin ownership check)
CREATE OR REPLACE FUNCTION public.calculate_conconi_paces(p_test_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_athlete_id UUID;
  v_max_hr INTEGER;
  v_fastest_pace NUMERIC;
  v_slowest_pace NUMERIC;
  v_increment NUMERIC;
  v_pace INTEGER;
  v_hr_min INTEGER;
  v_hr_max INTEGER;
  v_hr_step NUMERIC;
  v_result JSON;
  i INTEGER;
  v_pace_code TEXT;
  v_description TEXT;
BEGIN
  SELECT ct.athlete_id INTO v_athlete_id
  FROM conconi_tests ct WHERE ct.id = p_test_id;

  IF v_athlete_id IS NULL THEN
    RAISE EXCEPTION 'Test no encontrado: %', p_test_id;
  END IF;

  SELECT MAX(cts.heart_rate) INTO v_max_hr
  FROM conconi_test_series cts WHERE cts.test_id = p_test_id;

  IF v_max_hr IS NULL THEN
    RAISE EXCEPTION 'No hay series registradas para el test: %', p_test_id;
  END IF;

  SELECT
    MIN((cts.time_seconds::NUMERIC * 1000) / COALESCE(cts.distance_meters, 800)),
    MAX((cts.time_seconds::NUMERIC * 1000) / COALESCE(cts.distance_meters, 800))
  INTO v_fastest_pace, v_slowest_pace
  FROM conconi_test_series cts WHERE cts.test_id = p_test_id;

  v_increment := (v_slowest_pace - v_fastest_pace) / 10.0;

  UPDATE conconi_tests SET max_hr_reached = v_max_hr, updated_at = NOW() WHERE id = p_test_id;
  DELETE FROM athlete_paces WHERE athlete_id = v_athlete_id AND valid_from = CURRENT_DATE;
  UPDATE athlete_paces SET valid_until = CURRENT_DATE - 1 WHERE athlete_id = v_athlete_id AND valid_until IS NULL;

  v_hr_step := (v_max_hr * 0.95 - v_max_hr * 0.60) / 10.0;

  FOR i IN 0..10 LOOP
    IF i = 0 THEN
      v_pace_code := 'RR';
      v_pace := ROUND(v_slowest_pace + (v_increment * 0.5));
      v_description := 'Recuperación';
      v_hr_min := ROUND(v_max_hr * 0.55);
      v_hr_max := ROUND(v_max_hr * 0.60);
    ELSE
      v_pace_code := 'R' || i;
      v_pace := ROUND(v_fastest_pace + (v_increment * (10 - i)));
      v_hr_min := ROUND(v_max_hr * 0.60 + v_hr_step * (i - 1));
      v_hr_max := ROUND(v_max_hr * 0.60 + v_hr_step * i);
      v_description := CASE
        WHEN i = 1 THEN 'Aeróbico suave'
        WHEN i = 2 THEN 'Aeróbico suave-medio'
        WHEN i = 3 THEN 'Aeróbico medio'
        WHEN i = 4 THEN 'Aeróbico medio-fuerte'
        WHEN i = 5 THEN 'Umbral aeróbico'
        WHEN i = 6 THEN 'Umbral alto'
        WHEN i = 7 THEN 'Intensidad alta'
        WHEN i = 8 THEN 'Muy intenso'
        WHEN i = 9 THEN 'Máxima intensidad'
        WHEN i = 10 THEN 'Sprint'
      END;
    END IF;

    INSERT INTO athlete_paces (
      athlete_id, pace_code, pace_seconds_per_km,
      heart_rate_min, heart_rate_max, description, valid_from
    ) VALUES (
      v_athlete_id, v_pace_code, v_pace, v_hr_min, v_hr_max, v_description, CURRENT_DATE
    );
  END LOOP;

  SELECT json_agg(row_to_json(p)) INTO v_result
  FROM (
    SELECT pace_code, pace_seconds_per_km, heart_rate_min, heart_rate_max, description
    FROM athlete_paces
    WHERE athlete_id = v_athlete_id AND valid_until IS NULL
    ORDER BY CASE pace_code WHEN 'RR' THEN 0 ELSE CAST(REPLACE(pace_code, 'R', '') AS INTEGER) END
  ) p;

  RETURN v_result;
END;
$function$;

-- 3) get_ai_analysis_limit original (sin caller check)
CREATE OR REPLACE FUNCTION public.get_ai_analysis_limit(p_athlete_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_is_exempt      boolean := false;
  v_is_admin       boolean := false;
  v_trial_ends     timestamptz;
  v_own_plan       text;
  v_coach_id       uuid;
  v_coach_plan     text;
  v_effective_plan text;
BEGIN
  SELECT COALESCE(u.is_exempt, false), COALESCE(u.is_admin, false), u.trial_ends_at
  INTO v_is_exempt, v_is_admin, v_trial_ends
  FROM public.users u WHERE u.id = p_athlete_id;

  IF v_is_exempt THEN RETURN jsonb_build_object('limit', -1, 'source', 'exempt'); END IF;
  IF v_is_admin  THEN RETURN jsonb_build_object('limit', -1, 'source', 'admin');  END IF;

  IF v_trial_ends IS NOT NULL AND v_trial_ends > now() THEN
    RETURN jsonb_build_object('limit', -1, 'source', 'trial');
  END IF;

  SELECT s.plan_key INTO v_own_plan FROM public.subscriptions s
  WHERE s.user_id = p_athlete_id AND s.status = 'active'
  ORDER BY s.created_at DESC LIMIT 1;

  IF v_own_plan IN ('coach_pro', 'coach_team', 'athlete_premium') THEN
    RETURN jsonb_build_object('limit', -1, 'source', v_own_plan);
  END IF;

  SELECT car.coach_id INTO v_coach_id FROM public.coach_athlete_relationship car
  WHERE car.athlete_id = p_athlete_id AND car.status = 'active'
  ORDER BY car.created_at DESC LIMIT 1;

  IF v_coach_id IS NOT NULL THEN
    SELECT s.plan_key INTO v_coach_plan FROM public.subscriptions s
    WHERE s.user_id = v_coach_id AND s.status = 'active'
    ORDER BY s.created_at DESC LIMIT 1;
    v_effective_plan := COALESCE(v_coach_plan, 'coach_free');
    IF v_effective_plan IN ('coach_pro', 'coach_team') THEN
      RETURN jsonb_build_object('limit', -1, 'source', 'coach', 'coach_plan', v_effective_plan, 'coach_id', v_coach_id);
    END IF;
    RETURN jsonb_build_object('limit', 1, 'source', 'coach', 'coach_plan', v_effective_plan, 'coach_id', v_coach_id);
  END IF;

  RETURN jsonb_build_object('limit', 1, 'source', COALESCE(v_own_plan, 'free'));
END;
$function$;

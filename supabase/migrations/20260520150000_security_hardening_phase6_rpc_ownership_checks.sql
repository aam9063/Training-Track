-- Fase 6: añadir validacion de ownership en RPC SECURITY DEFINER.
-- Estas funciones siguen accesibles a authenticated (uso legitimo del front),
-- pero ahora validan internamente que el caller solo opera sobre sus datos.
--
-- Vulnerabilidades cerradas:
-- 1. send_push_notification: cualquier authenticated podia enviar push a
--    cualquier user_id (phishing/spam). Ahora caller solo puede enviar a si
--    mismo o a atletas con relacion activa donde coach_id = caller.
--    Caller privilegiado (triggers/service_role) o admin: sin restriccion.
-- 2. calculate_conconi_paces: cualquier authenticated podia recalcular
--    paces de OTROS atletas (sobrescritura de datos). Ahora valida que
--    el test pertenece al caller, su coach o admin.
-- 3. get_ai_analysis_limit: info disclosure menor. Restringido a propio
--    athlete_id, su coach o admin.
--
-- Aplicada en prod (lusirdkixfliydimemre) el 2026-05-20 via apply_migration
-- (en dos pasos: 20260520150000 + 20260520160000_phase6b para relajar push
-- a coach->atletas tras detectar regresion en WeeklyTrainingModal/usePlanningData).

-- ─────────────────────────────────────────────────────────────
-- 1) send_push_notification: caller -> self o sus atletas
-- ─────────────────────────────────────────────────────────────
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
DECLARE
  v_caller uuid;
  v_is_privileged boolean;
  v_is_admin boolean := false;
  v_invalid_count int;
BEGIN
  v_caller := auth.uid();
  v_is_privileged := (v_caller IS NULL);

  IF NOT v_is_privileged THEN
    SELECT COALESCE(u.is_admin, false) INTO v_is_admin
    FROM public.users u WHERE u.id = v_caller;
  END IF;

  IF NOT v_is_privileged AND NOT v_is_admin THEN
    IF p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'empty_user_ids' USING ERRCODE = '22023';
    END IF;

    SELECT COUNT(*) INTO v_invalid_count
    FROM unnest(p_user_ids) AS uid
    WHERE uid <> v_caller
      AND NOT EXISTS (
        SELECT 1 FROM public.coach_athlete_relationship car
        WHERE car.coach_id = v_caller
          AND car.athlete_id = uid
          AND car.status = 'active'
      );

    IF v_invalid_count > 0 THEN
      RAISE EXCEPTION 'forbidden: can only send push to self or own athletes'
        USING ERRCODE = '42501';
    END IF;
  END IF;

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

-- ─────────────────────────────────────────────────────────────
-- 2) calculate_conconi_paces: caller debe ser dueño del test
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.calculate_conconi_paces(p_test_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid;
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
  v_is_admin boolean := false;
  v_is_coach_of boolean := false;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
  END IF;

  SELECT ct.athlete_id INTO v_athlete_id
  FROM conconi_tests ct
  WHERE ct.id = p_test_id;

  IF v_athlete_id IS NULL THEN
    RAISE EXCEPTION 'Test no encontrado: %', p_test_id;
  END IF;

  IF v_caller <> v_athlete_id THEN
    SELECT COALESCE(u.is_admin, false) INTO v_is_admin
    FROM public.users u WHERE u.id = v_caller;

    IF NOT v_is_admin THEN
      SELECT EXISTS (
        SELECT 1 FROM public.coach_athlete_relationship car
        WHERE car.coach_id = v_caller
          AND car.athlete_id = v_athlete_id
          AND car.status = 'active'
      ) INTO v_is_coach_of;

      IF NOT v_is_coach_of THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  SELECT MAX(cts.heart_rate) INTO v_max_hr
  FROM conconi_test_series cts
  WHERE cts.test_id = p_test_id;

  IF v_max_hr IS NULL THEN
    RAISE EXCEPTION 'No hay series registradas para el test: %', p_test_id;
  END IF;

  SELECT
    MIN((cts.time_seconds::NUMERIC * 1000) / COALESCE(cts.distance_meters, 800)),
    MAX((cts.time_seconds::NUMERIC * 1000) / COALESCE(cts.distance_meters, 800))
  INTO v_fastest_pace, v_slowest_pace
  FROM conconi_test_series cts
  WHERE cts.test_id = p_test_id;

  v_increment := (v_slowest_pace - v_fastest_pace) / 10.0;

  UPDATE conconi_tests
  SET max_hr_reached = v_max_hr, updated_at = NOW()
  WHERE id = p_test_id;

  DELETE FROM athlete_paces
  WHERE athlete_id = v_athlete_id AND valid_from = CURRENT_DATE;

  UPDATE athlete_paces
  SET valid_until = CURRENT_DATE - 1
  WHERE athlete_id = v_athlete_id AND valid_until IS NULL;

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
      v_athlete_id, v_pace_code, v_pace,
      v_hr_min, v_hr_max, v_description, CURRENT_DATE
    );
  END LOOP;

  SELECT json_agg(row_to_json(p))
  INTO v_result
  FROM (
    SELECT pace_code, pace_seconds_per_km, heart_rate_min, heart_rate_max, description
    FROM athlete_paces
    WHERE athlete_id = v_athlete_id AND valid_until IS NULL
    ORDER BY
      CASE pace_code
        WHEN 'RR' THEN 0
        ELSE CAST(REPLACE(pace_code, 'R', '') AS INTEGER)
      END
  ) p;

  RETURN v_result;
END;
$function$;

-- ─────────────────────────────────────────────────────────────
-- 3) get_ai_analysis_limit: solo propio atleta, su coach o admin
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_ai_analysis_limit(p_athlete_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_caller uuid;
  v_is_exempt      boolean := false;
  v_is_admin       boolean := false;
  v_trial_ends     timestamptz;
  v_own_plan       text;
  v_coach_id       uuid;
  v_coach_plan     text;
  v_effective_plan text;
  v_caller_is_admin boolean := false;
  v_caller_is_coach boolean := false;
BEGIN
  v_caller := auth.uid();

  IF v_caller IS NOT NULL AND v_caller <> p_athlete_id THEN
    SELECT COALESCE(u.is_admin, false) INTO v_caller_is_admin
    FROM public.users u WHERE u.id = v_caller;

    IF NOT v_caller_is_admin THEN
      SELECT EXISTS (
        SELECT 1 FROM public.coach_athlete_relationship car
        WHERE car.coach_id = v_caller
          AND car.athlete_id = p_athlete_id
          AND car.status = 'active'
      ) INTO v_caller_is_coach;

      IF NOT v_caller_is_coach THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  SELECT COALESCE(u.is_exempt, false), COALESCE(u.is_admin, false), u.trial_ends_at
  INTO v_is_exempt, v_is_admin, v_trial_ends
  FROM public.users u WHERE u.id = p_athlete_id;

  IF v_is_exempt THEN RETURN jsonb_build_object('limit', -1, 'source', 'exempt'); END IF;
  IF v_is_admin  THEN RETURN jsonb_build_object('limit', -1, 'source', 'admin');  END IF;

  IF v_trial_ends IS NOT NULL AND v_trial_ends > now() THEN
    RETURN jsonb_build_object('limit', -1, 'source', 'trial');
  END IF;

  SELECT s.plan_key INTO v_own_plan
  FROM public.subscriptions s
  WHERE s.user_id = p_athlete_id AND s.status = 'active'
  ORDER BY s.created_at DESC LIMIT 1;

  IF v_own_plan IN ('coach_pro', 'coach_team', 'athlete_premium') THEN
    RETURN jsonb_build_object('limit', -1, 'source', v_own_plan);
  END IF;

  SELECT car.coach_id INTO v_coach_id
  FROM public.coach_athlete_relationship car
  WHERE car.athlete_id = p_athlete_id AND car.status = 'active'
  ORDER BY car.created_at DESC LIMIT 1;

  IF v_coach_id IS NOT NULL THEN
    SELECT s.plan_key INTO v_coach_plan
    FROM public.subscriptions s
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

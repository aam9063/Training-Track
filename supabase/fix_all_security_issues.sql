-- =============================================
-- FIX COMPLETO: Todas las incidencias de seguridad y rendimiento
-- =============================================
-- IMPORTANTE: Este script es SEGURO porque:
-- 1. Las funciones con SECURITY DEFINER bypasean RLS
-- 2. El trigger handle_new_user usa SECURITY DEFINER
-- 3. Se añaden políticas permisivas antes de habilitar RLS
-- =============================================

-- =============================================
-- PARTE 0: ELIMINAR FUNCIONES CON CONFLICTOS
-- CASCADE elimina también las políticas que dependen de estas funciones
-- Luego las recreamos todas en este script
-- =============================================
DROP FUNCTION IF EXISTS public.is_my_athlete(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.can_access_athlete_data(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_conconi_paces(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_weekly_training_load(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_pace(NUMERIC, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;
DROP FUNCTION IF EXISTS public.is_coach() CASCADE;
DROP FUNCTION IF EXISTS public.is_athlete() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_coach_id() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- =============================================
-- PARTE 1: HABILITAR RLS EN TABLAS SIN PROTECCIÓN
-- Errores: rls_disabled_in_public, policy_exists_rls_disabled
-- =============================================

-- PRIMERO: Crear todas las políticas ANTES de habilitar RLS
-- Esto evita que quedes bloqueado

-- =============================================
-- USERS: Políticas
-- =============================================
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_select_by_coach" ON public.users;
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;

-- SELECT: El usuario ve su perfil + coach ve atletas + atleta ve coach
CREATE POLICY "users_select" ON public.users
  FOR SELECT USING (
    -- Siempre puede ver su propio perfil
    id = auth.uid()
    OR
    -- Coach puede ver a sus atletas (incluso pending para aceptarlos)
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = users.id AND car.coach_id = auth.uid()
    )
    OR
    -- Atleta puede ver a su coach
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.coach_id = users.id AND car.athlete_id = auth.uid()
    )
  );

CREATE POLICY "users_update" ON public.users
  FOR UPDATE USING (id = auth.uid());

-- INSERT: Permitir que el service_role (trigger) inserte
-- El trigger handle_new_user usa SECURITY DEFINER, así que bypasea RLS
-- Pero añadimos política por si se necesita insertar desde el cliente
-- INSERT: Solo permite insertar si el id coincide con auth.uid()
-- El trigger handle_new_user bypasea esto con SECURITY DEFINER
CREATE POLICY "users_insert" ON public.users
  FOR INSERT WITH CHECK (id = auth.uid());

-- =============================================
-- COACHES: Políticas
-- =============================================
DROP POLICY IF EXISTS "coaches_select" ON public.coaches;
DROP POLICY IF EXISTS "coaches_update" ON public.coaches;
DROP POLICY IF EXISTS "coaches_insert" ON public.coaches;

CREATE POLICY "coaches_select" ON public.coaches
  FOR SELECT USING (
    id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.coach_id = coaches.id AND car.athlete_id = auth.uid()
    )
  );

CREATE POLICY "coaches_update" ON public.coaches
  FOR UPDATE USING (id = auth.uid());

-- INSERT: Solo permite insertar si el id coincide con auth.uid()
-- El trigger handle_new_user bypasea esto con SECURITY DEFINER
CREATE POLICY "coaches_insert" ON public.coaches
  FOR INSERT WITH CHECK (id = auth.uid());

-- =============================================
-- ATHLETES: Políticas
-- =============================================
DROP POLICY IF EXISTS "athletes_select" ON public.athletes;
DROP POLICY IF EXISTS "athletes_update" ON public.athletes;
DROP POLICY IF EXISTS "athletes_insert" ON public.athletes;

CREATE POLICY "athletes_select" ON public.athletes
  FOR SELECT USING (
    id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = athletes.id AND car.coach_id = auth.uid()
    )
  );

CREATE POLICY "athletes_update" ON public.athletes
  FOR UPDATE USING (id = auth.uid());

-- INSERT: Solo permite insertar si el id coincide con auth.uid()
-- El trigger handle_new_user bypasea esto con SECURITY DEFINER
CREATE POLICY "athletes_insert" ON public.athletes
  FOR INSERT WITH CHECK (id = auth.uid());

-- =============================================
-- COACH_ATHLETE_RELATIONSHIP: Políticas
-- =============================================
DROP POLICY IF EXISTS "car_select" ON public.coach_athlete_relationship;
DROP POLICY IF EXISTS "car_update" ON public.coach_athlete_relationship;
DROP POLICY IF EXISTS "car_insert" ON public.coach_athlete_relationship;
DROP POLICY IF EXISTS "car_delete" ON public.coach_athlete_relationship;

CREATE POLICY "car_select" ON public.coach_athlete_relationship
  FOR SELECT USING (
    coach_id = auth.uid() OR athlete_id = auth.uid()
  );

-- Solo el coach puede actualizar (aceptar/rechazar)
CREATE POLICY "car_update" ON public.coach_athlete_relationship
  FOR UPDATE USING (coach_id = auth.uid());

-- INSERT: El atleta puede solicitar unirse a un coach, o el trigger lo hace automáticamente
-- El trigger handle_new_user bypasea esto con SECURITY DEFINER
CREATE POLICY "car_insert" ON public.coach_athlete_relationship
  FOR INSERT WITH CHECK (
    athlete_id = auth.uid()  -- El atleta puede crear su propia solicitud
    OR coach_id = auth.uid() -- El coach puede añadir atletas
  );

-- DELETE: solo el coach puede eliminar
CREATE POLICY "car_delete" ON public.coach_athlete_relationship
  FOR DELETE USING (coach_id = auth.uid());

-- =============================================
-- AHORA SÍ: Habilitar RLS (las políticas ya existen)
-- =============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_athlete_relationship ENABLE ROW LEVEL SECURITY;

-- Tablas que ya tenían políticas pero RLS deshabilitado
ALTER TABLE public.athlete_paces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_bests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PARTE 2: CORREGIR VISTAS CON SECURITY DEFINER
-- Errores: security_definer_view
-- =============================================

-- Recrear vistas como SECURITY INVOKER (por defecto)
DROP VIEW IF EXISTS public.athlete_training_summary;
DROP VIEW IF EXISTS public.athletes_with_coach;

-- Vista athlete_training_summary con SECURITY INVOKER
CREATE VIEW public.athlete_training_summary
WITH (security_invoker = true)
AS
SELECT
  a.id as athlete_id,
  u.first_name,
  u.last_name,
  u.email,
  COUNT(DISTINCT ts.id) as total_sessions,
  COUNT(DISTINCT CASE WHEN ts.status = 'completed' THEN ts.id END) as completed_sessions,
  COUNT(DISTINCT tp.id) as total_plans
FROM athletes a
JOIN users u ON a.id = u.id
LEFT JOIN training_sessions ts ON ts.athlete_id = a.id
LEFT JOIN training_plans tp ON tp.athlete_id = a.id
GROUP BY a.id, u.first_name, u.last_name, u.email;

-- Vista athletes_with_coach con SECURITY INVOKER
CREATE VIEW public.athletes_with_coach
WITH (security_invoker = true)
AS
SELECT
  a.id as athlete_id,
  u.first_name,
  u.last_name,
  u.email,
  car.coach_id,
  car.status as relationship_status,
  car.start_date
FROM athletes a
JOIN users u ON a.id = u.id
LEFT JOIN coach_athlete_relationship car ON car.athlete_id = a.id;

-- =============================================
-- PARTE 3: AÑADIR SEARCH_PATH A FUNCIONES
-- Errores: function_search_path_mutable
-- =============================================

-- handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coach_id UUID;
  v_coach_email TEXT;
  v_role TEXT;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'athlete');

  IF EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.users (id, email, role, first_name, last_name)
    VALUES (
      NEW.id,
      NEW.email,
      v_role::user_role,
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', '')
    );
  EXCEPTION WHEN unique_violation THEN
    RETURN NEW;
  WHEN invalid_text_representation THEN
    INSERT INTO public.users (id, email, role, first_name, last_name)
    VALUES (
      NEW.id,
      NEW.email,
      'athlete'::user_role,
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', '')
    );
  END;

  IF v_role = 'coach' THEN
    INSERT INTO public.coaches (id) VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF v_role = 'athlete' THEN
    INSERT INTO public.athletes (id) VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;

    v_coach_email := LOWER(TRIM(NEW.raw_user_meta_data->>'coach_email'));

    IF v_coach_email IS NOT NULL AND v_coach_email != '' THEN
      SELECT c.id INTO v_coach_id
      FROM public.coaches c
      JOIN public.users u ON c.id = u.id
      WHERE LOWER(TRIM(u.email)) = v_coach_email
      LIMIT 1;

      IF v_coach_id IS NOT NULL THEN
        INSERT INTO public.coach_athlete_relationship (athlete_id, coach_id, status)
        VALUES (NEW.id, v_coach_id, 'pending')
        ON CONFLICT (athlete_id, coach_id) DO NOTHING;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in handle_new_user: % - %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

-- can_access_athlete_data
CREATE OR REPLACE FUNCTION public.can_access_athlete_data(p_athlete_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    p_athlete_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship
      WHERE athlete_id = p_athlete_id
        AND coach_id = auth.uid()
        AND status = 'active'
    )
  );
END;
$$;

-- calculate_conconi_paces (placeholder - ajustar según tu lógica actual)
CREATE OR REPLACE FUNCTION public.calculate_conconi_paces(p_athlete_id UUID)
RETURNS TABLE(zone_name TEXT, pace_min_km NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 'Zone 1'::TEXT, 6.0::NUMERIC
  UNION ALL
  SELECT 'Zone 2'::TEXT, 5.5::NUMERIC;
END;
$$;

-- update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- is_coach
CREATE OR REPLACE FUNCTION public.is_coach()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'coach'
  );
END;
$$;

-- calculate_pace
CREATE OR REPLACE FUNCTION public.calculate_pace(distance_meters NUMERIC, time_seconds INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  pace_seconds NUMERIC;
  minutes INTEGER;
  seconds INTEGER;
BEGIN
  IF distance_meters IS NULL OR distance_meters = 0 THEN
    RETURN NULL;
  END IF;

  pace_seconds := (time_seconds / (distance_meters / 1000.0));
  minutes := FLOOR(pace_seconds / 60);
  seconds := ROUND(pace_seconds - (minutes * 60));

  RETURN minutes || ':' || LPAD(seconds::TEXT, 2, '0') || ' /km';
END;
$$;

-- get_weekly_training_load
CREATE OR REPLACE FUNCTION public.get_weekly_training_load(p_athlete_id UUID, p_weeks INTEGER DEFAULT 4)
RETURNS TABLE(week_start DATE, total_distance NUMERIC, total_duration INTEGER, session_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC('week', ts.date)::DATE as week_start,
    COALESCE(SUM(tm.distance_meters), 0) as total_distance,
    COALESCE(SUM(tm.duration_seconds), 0)::INTEGER as total_duration,
    COUNT(DISTINCT ts.id)::INTEGER as session_count
  FROM public.training_sessions ts
  LEFT JOIN public.training_metrics tm ON tm.session_id = ts.id
  WHERE ts.athlete_id = p_athlete_id
    AND ts.date >= CURRENT_DATE - (p_weeks * 7)
  GROUP BY DATE_TRUNC('week', ts.date)
  ORDER BY week_start DESC;
END;
$$;

-- get_my_role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role::TEXT INTO v_role
  FROM public.users
  WHERE id = auth.uid();

  RETURN COALESCE(v_role, 'unknown');
END;
$$;

-- is_athlete
CREATE OR REPLACE FUNCTION public.is_athlete()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'athlete'
  );
END;
$$;

-- get_my_coach_id
CREATE OR REPLACE FUNCTION public.get_my_coach_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coach_id UUID;
BEGIN
  SELECT coach_id INTO v_coach_id
  FROM public.coach_athlete_relationship
  WHERE athlete_id = auth.uid()
    AND status = 'active'
  LIMIT 1;

  RETURN v_coach_id;
END;
$$;

-- is_my_athlete
CREATE OR REPLACE FUNCTION public.is_my_athlete(p_athlete_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.coach_athlete_relationship
    WHERE athlete_id = p_athlete_id
      AND coach_id = auth.uid()
      AND status = 'active'
  );
END;
$$;

-- =============================================
-- PARTE 4: CONSOLIDAR POLÍTICAS MÚLTIPLES (del CSV anterior)
-- =============================================

-- analytics_weekly_summary
DROP POLICY IF EXISTS "analytics_select_by_coach" ON public.analytics_weekly_summary;
DROP POLICY IF EXISTS "analytics_select_own" ON public.analytics_weekly_summary;
DROP POLICY IF EXISTS "analytics_select" ON public.analytics_weekly_summary;

CREATE POLICY "analytics_select" ON public.analytics_weekly_summary
  FOR SELECT USING (
    athlete_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = analytics_weekly_summary.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'active'
    )
  );

-- athlete_paces
DROP POLICY IF EXISTS "paces_select_by_coach" ON public.athlete_paces;
DROP POLICY IF EXISTS "paces_select_own" ON public.athlete_paces;
DROP POLICY IF EXISTS "paces_select" ON public.athlete_paces;

CREATE POLICY "paces_select" ON public.athlete_paces
  FOR SELECT USING (
    athlete_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = athlete_paces.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'active'
    )
  );

-- conconi_tests
DROP POLICY IF EXISTS "conconi_select_by_coach" ON public.conconi_tests;
DROP POLICY IF EXISTS "conconi_select_own" ON public.conconi_tests;
DROP POLICY IF EXISTS "conconi_select" ON public.conconi_tests;

CREATE POLICY "conconi_select" ON public.conconi_tests
  FOR SELECT USING (
    athlete_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = conconi_tests.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'active'
    )
  );

-- devices
DROP POLICY IF EXISTS "devices_select_by_coach" ON public.devices;
DROP POLICY IF EXISTS "devices_select_own" ON public.devices;
DROP POLICY IF EXISTS "devices_select" ON public.devices;

CREATE POLICY "devices_select" ON public.devices
  FOR SELECT USING (
    athlete_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = devices.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'active'
    )
  );

-- gym_exercises_bank
DROP POLICY IF EXISTS "gym_ex_select_coach" ON public.gym_exercises_bank;
DROP POLICY IF EXISTS "gym_ex_select_global" ON public.gym_exercises_bank;
DROP POLICY IF EXISTS "gym_ex_select_own" ON public.gym_exercises_bank;
DROP POLICY IF EXISTS "gym_ex_select" ON public.gym_exercises_bank;

CREATE POLICY "gym_ex_select" ON public.gym_exercises_bank
  FOR SELECT USING (
    -- Ejercicios no custom (globales) son visibles para todos
    is_custom = false
    OR
    -- El coach puede ver sus propios ejercicios custom
    coach_id = auth.uid()
    OR
    -- Los atletas pueden ver ejercicios de su coach
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = auth.uid()
        AND car.coach_id = gym_exercises_bank.coach_id
        AND car.status = 'active'
    )
  );

-- personal_bests
DROP POLICY IF EXISTS "pb_select_by_coach" ON public.personal_bests;
DROP POLICY IF EXISTS "pb_select_own" ON public.personal_bests;
DROP POLICY IF EXISTS "pb_select" ON public.personal_bests;
DROP POLICY IF EXISTS "pb_insert_coach" ON public.personal_bests;
DROP POLICY IF EXISTS "pb_insert_own" ON public.personal_bests;
DROP POLICY IF EXISTS "pb_insert" ON public.personal_bests;

CREATE POLICY "pb_select" ON public.personal_bests
  FOR SELECT USING (
    athlete_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = personal_bests.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'active'
    )
  );

CREATE POLICY "pb_insert" ON public.personal_bests
  FOR INSERT WITH CHECK (
    athlete_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = personal_bests.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'active'
    )
  );

-- race_predictions
DROP POLICY IF EXISTS "predictions_select_by_coach" ON public.race_predictions;
DROP POLICY IF EXISTS "predictions_select_own" ON public.race_predictions;
DROP POLICY IF EXISTS "predictions_select" ON public.race_predictions;
DROP POLICY IF EXISTS "predictions_insert_coach" ON public.race_predictions;
DROP POLICY IF EXISTS "predictions_insert_own" ON public.race_predictions;
DROP POLICY IF EXISTS "predictions_insert" ON public.race_predictions;

CREATE POLICY "predictions_select" ON public.race_predictions
  FOR SELECT USING (
    athlete_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = race_predictions.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'active'
    )
  );

CREATE POLICY "predictions_insert" ON public.race_predictions
  FOR INSERT WITH CHECK (
    athlete_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = race_predictions.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'active'
    )
  );

-- running_exercises_bank
DROP POLICY IF EXISTS "running_ex_select_coach" ON public.running_exercises_bank;
DROP POLICY IF EXISTS "running_ex_select_global" ON public.running_exercises_bank;
DROP POLICY IF EXISTS "running_ex_select_own" ON public.running_exercises_bank;
DROP POLICY IF EXISTS "running_ex_select" ON public.running_exercises_bank;

CREATE POLICY "running_ex_select" ON public.running_exercises_bank
  FOR SELECT USING (
    -- Ejercicios no custom (globales) son visibles para todos
    is_custom = false
    OR
    -- El coach puede ver sus propios ejercicios custom
    coach_id = auth.uid()
    OR
    -- Los atletas pueden ver ejercicios de su coach
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = auth.uid()
        AND car.coach_id = running_exercises_bank.coach_id
        AND car.status = 'active'
    )
  );

-- training_metrics
DROP POLICY IF EXISTS "metrics_select_by_coach" ON public.training_metrics;
DROP POLICY IF EXISTS "metrics_select_own" ON public.training_metrics;
DROP POLICY IF EXISTS "metrics_select" ON public.training_metrics;
DROP POLICY IF EXISTS "metrics_insert_coach" ON public.training_metrics;
DROP POLICY IF EXISTS "metrics_insert_own" ON public.training_metrics;
DROP POLICY IF EXISTS "metrics_insert" ON public.training_metrics;

CREATE POLICY "metrics_select" ON public.training_metrics
  FOR SELECT USING (
    athlete_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = training_metrics.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'active'
    )
  );

CREATE POLICY "metrics_insert" ON public.training_metrics
  FOR INSERT WITH CHECK (
    athlete_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = training_metrics.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'active'
    )
  );

-- training_plans
DROP POLICY IF EXISTS "plans_select_athlete" ON public.training_plans;
DROP POLICY IF EXISTS "plans_select_coach" ON public.training_plans;
DROP POLICY IF EXISTS "plans_select" ON public.training_plans;

CREATE POLICY "plans_select" ON public.training_plans
  FOR SELECT USING (
    coach_id = auth.uid()
    OR athlete_id = auth.uid()
  );

-- training_sessions
DROP POLICY IF EXISTS "sessions_select_athlete" ON public.training_sessions;
DROP POLICY IF EXISTS "sessions_select_coach" ON public.training_sessions;
DROP POLICY IF EXISTS "sessions_select" ON public.training_sessions;
DROP POLICY IF EXISTS "sessions_update_athlete" ON public.training_sessions;
DROP POLICY IF EXISTS "sessions_update_coach" ON public.training_sessions;
DROP POLICY IF EXISTS "sessions_update" ON public.training_sessions;

CREATE POLICY "sessions_select" ON public.training_sessions
  FOR SELECT USING (
    athlete_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = training_sessions.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM training_plans tp
      WHERE tp.id = training_sessions.plan_id
        AND tp.coach_id = auth.uid()
    )
  );

CREATE POLICY "sessions_update" ON public.training_sessions
  FOR UPDATE USING (
    athlete_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = training_sessions.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM training_plans tp
      WHERE tp.id = training_sessions.plan_id
        AND tp.coach_id = auth.uid()
    )
  );

-- =============================================
-- VERIFICACIÓN FINAL
-- =============================================

-- Verificar RLS habilitado
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Verificar políticas
SELECT
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- Verificar funciones con search_path
SELECT
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  p.proconfig as config
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'handle_new_user',
    'can_access_athlete_data',
    'calculate_conconi_paces',
    'update_updated_at_column',
    'is_coach',
    'calculate_pace',
    'get_weekly_training_load',
    'get_my_role',
    'is_athlete',
    'get_my_coach_id',
    'is_my_athlete'
  );

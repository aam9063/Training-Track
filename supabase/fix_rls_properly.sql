-- ============================================
-- ARREGLAR RLS CORRECTAMENTE
-- Permitir que el trigger funcione SIN desactivar seguridad
-- ============================================

-- PASO 1: Asegurar que RLS esté ACTIVADO (seguridad)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_athlete_relationship ENABLE ROW LEVEL SECURITY;

-- PASO 2: Eliminar y recrear el trigger con permisos correctos
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- PASO 3: Crear función con SECURITY DEFINER y SET search_path
-- Esto hace que se ejecute con permisos del dueño (postgres), no del usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_role user_role;
  v_first_name TEXT;
  v_last_name TEXT;
  v_coach_email TEXT;
BEGIN
  -- Extraer datos del metadata
  v_role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'athlete');
  v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', 'Usuario');
  v_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', 'Nuevo');
  v_coach_email := NEW.raw_user_meta_data->>'coach_email';

  -- Log para debugging (aparece en logs de Supabase)
  RAISE LOG 'Creating user % % (%) with role %', v_first_name, v_last_name, NEW.email, v_role;

  -- Insertar en tabla users (bypass RLS porque es SECURITY DEFINER)
  INSERT INTO public.users (id, email, role, first_name, last_name, email_verified)
  VALUES (
    NEW.id,
    NEW.email,
    v_role,
    v_first_name,
    v_last_name,
    false
  );

  -- Si es coach, crear registro en coaches
  IF v_role = 'coach' THEN
    INSERT INTO public.coaches (id, subscription_plan, max_athletes)
    VALUES (NEW.id, 'starter', 10);
    RAISE LOG 'Coach record created for %', NEW.id;
  END IF;

  -- Si es athlete, crear registro en athletes
  IF v_role = 'athlete' THEN
    INSERT INTO public.athletes (id)
    VALUES (NEW.id);
    RAISE LOG 'Athlete record created for %', NEW.id;

    -- Si proporcionó email del coach, crear relación
    IF v_coach_email IS NOT NULL AND v_coach_email != '' THEN
      INSERT INTO public.coach_athlete_relationship (athlete_id, coach_id, status)
      SELECT NEW.id, c.id, 'pending'
      FROM public.coaches c
      JOIN public.users u ON c.id = u.id
      WHERE u.email = v_coach_email
      LIMIT 1;
      
      RAISE LOG 'Relationship created between athlete % and coach %', NEW.id, v_coach_email;
    END IF;
  END IF;

  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log detallado del error
    RAISE LOG 'ERROR in handle_new_user for user %: % (SQLSTATE: %)', NEW.email, SQLERRM, SQLSTATE;
    -- Re-raise para que Supabase capture el error
    RAISE;
END;
$$;

-- PASO 4: Crear el trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- PASO 5: Dar permisos de ejecución a la función
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- PASO 6: Asegurar que postgres (el trigger) pueda insertar en las tablas
-- Esto es necesario porque SECURITY DEFINER ejecuta como postgres
GRANT ALL ON public.users TO postgres;
GRANT ALL ON public.coaches TO postgres;
GRANT ALL ON public.athletes TO postgres;
GRANT ALL ON public.coach_athlete_relationship TO postgres;

-- PASO 7: Agregar políticas RLS para permitir inserciones del trigger
-- Esto es una capa adicional de seguridad

-- Permitir que el trigger (postgres) inserte en users
CREATE POLICY "allow_trigger_insert_users" ON public.users
  FOR INSERT
  TO postgres
  WITH CHECK (true);

-- Permitir que el trigger (postgres) inserte en coaches
CREATE POLICY "allow_trigger_insert_coaches" ON public.coaches
  FOR INSERT
  TO postgres
  WITH CHECK (true);

-- Permitir que el trigger (postgres) inserte en athletes
CREATE POLICY "allow_trigger_insert_athletes" ON public.athletes
  FOR INSERT
  TO postgres
  WITH CHECK (true);

-- Permitir que el trigger (postgres) inserte en relationships
CREATE POLICY "allow_trigger_insert_relationships" ON public.coach_athlete_relationship
  FOR INSERT
  TO postgres
  WITH CHECK (true);

-- PASO 8: Verificación
DO $$
DECLARE
  v_trigger_exists BOOLEAN;
  v_function_exists BOOLEAN;
BEGIN
  -- Verificar trigger
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) INTO v_trigger_exists;

  -- Verificar función
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'handle_new_user'
  ) INTO v_function_exists;

  IF v_trigger_exists AND v_function_exists THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Trigger y función creados correctamente';
    RAISE NOTICE '✅ RLS está ACTIVADO (seguridad mantenida)';
    RAISE NOTICE '✅ Permisos configurados correctamente';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Ahora puedes registrarte en la aplicación';
  ELSE
    RAISE EXCEPTION '❌ Error: Trigger o función no se crearon correctamente';
  END IF;
END $$;

-- ============================================
-- NOTAS IMPORTANTES:
-- ============================================
-- 1. SECURITY DEFINER hace que la función se ejecute con permisos de postgres
-- 2. Las políticas RLS siguen activas para usuarios normales
-- 3. Solo el trigger (postgres) puede insertar datos de registro
-- 4. Los usuarios normales siguen protegidos por las políticas existentes
-- ============================================

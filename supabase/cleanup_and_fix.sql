-- ============================================
-- LIMPIEZA Y ARREGLO COMPLETO
-- Ejecuta este script COMPLETO en Supabase SQL Editor
-- ============================================

-- PASO 1: Limpiar políticas conflictivas existentes
DROP POLICY IF EXISTS "allow_trigger_insert_users" ON public.users;
DROP POLICY IF EXISTS "allow_trigger_insert_coaches" ON public.coaches;
DROP POLICY IF EXISTS "allow_trigger_insert_athletes" ON public.athletes;
DROP POLICY IF EXISTS "allow_trigger_insert_relationships" ON public.coach_athlete_relationship;

-- PASO 2: Eliminar trigger y función antiguos
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- PASO 3: Activar RLS en todas las tablas
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_athlete_relationship ENABLE ROW LEVEL SECURITY;

-- PASO 4: Crear función optimizada con SECURITY DEFINER
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
  v_coach_id UUID;
BEGIN
  -- Extraer y validar datos
  v_role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'athlete');
  v_first_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), ''), 'Usuario');
  v_last_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'), ''), 'Nuevo');
  v_coach_email := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'coach_email', '')), '');

  -- Insertar usuario base
  INSERT INTO public.users (id, email, role, first_name, last_name, email_verified)
  VALUES (NEW.id, NEW.email, v_role, v_first_name, v_last_name, false);

  -- Crear registro según rol
  IF v_role = 'coach' THEN
    INSERT INTO public.coaches (id, subscription_plan, max_athletes)
    VALUES (NEW.id, 'starter', 10);
    
  ELSIF v_role = 'athlete' THEN
    INSERT INTO public.athletes (id)
    VALUES (NEW.id);

    -- Buscar y crear relación con coach si existe
    IF v_coach_email IS NOT NULL THEN
      SELECT u.id INTO v_coach_id
      FROM public.users u
      JOIN public.coaches c ON c.id = u.id
      WHERE u.email = v_coach_email
      AND u.role = 'coach'
      LIMIT 1;

      IF v_coach_id IS NOT NULL THEN
        INSERT INTO public.coach_athlete_relationship (athlete_id, coach_id, status)
        VALUES (NEW.id, v_coach_id, 'pending');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
  
EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error en handle_new_user: % - SQLSTATE: %', SQLERRM, SQLSTATE;
    RAISE;
END;
$$;

-- PASO 5: Crear trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- PASO 6: Dar permisos necesarios
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role;
GRANT ALL ON public.users TO postgres, service_role;
GRANT ALL ON public.coaches TO postgres, service_role;
GRANT ALL ON public.athletes TO postgres, service_role;
GRANT ALL ON public.coach_athlete_relationship TO postgres, service_role;

-- PASO 7: Verificar instalación
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    RAISE NOTICE '╔════════════════════════════════════════╗';
    RAISE NOTICE '║  ✅ INSTALACIÓN COMPLETADA             ║';
    RAISE NOTICE '╠════════════════════════════════════════╣';
    RAISE NOTICE '║  ✓ Trigger creado                     ║';
    RAISE NOTICE '║  ✓ Función optimizada                 ║';
    RAISE NOTICE '║  ✓ RLS activo y funcional             ║';
    RAISE NOTICE '║  ✓ Permisos configurados              ║';
    RAISE NOTICE '╚════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Ahora puedes registrarte en la app';
  ELSE
    RAISE EXCEPTION '❌ Error en la instalación';
  END IF;
END $$;

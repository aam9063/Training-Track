-- ============================================
-- FIX: Reparar trigger de registro de usuarios
-- Ejecuta este script en Supabase SQL Editor
-- ============================================

-- 1. Eliminar trigger existente si hay
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Eliminar función existente si hay
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- 3. Crear función mejorada con manejo de errores
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
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

  -- Log para debugging
  RAISE NOTICE 'Creating user: % % with role: %', v_first_name, v_last_name, v_role;

  -- Insertar en tabla users
  INSERT INTO public.users (id, email, role, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    v_role,
    v_first_name,
    v_last_name
  );

  -- Si es coach, crear registro en coaches
  IF v_role = 'coach' THEN
    INSERT INTO public.coaches (id) VALUES (NEW.id);
    RAISE NOTICE 'Coach record created for user %', NEW.id;
  END IF;

  -- Si es athlete, crear registro en athletes
  IF v_role = 'athlete' THEN
    INSERT INTO public.athletes (id) VALUES (NEW.id);
    RAISE NOTICE 'Athlete record created for user %', NEW.id;

    -- Si proporcionó email del coach, crear relación
    IF v_coach_email IS NOT NULL AND v_coach_email != '' THEN
      INSERT INTO public.coach_athlete_relationship (athlete_id, coach_id, status)
      SELECT NEW.id, c.id, 'pending'
      FROM public.coaches c
      JOIN public.users u ON c.id = u.id
      WHERE u.email = v_coach_email
      LIMIT 1;
      
      RAISE NOTICE 'Coach relationship created for athlete % with coach email %', NEW.id, v_coach_email;
    END IF;
  END IF;

  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log del error
    RAISE WARNING 'Error in handle_new_user: % %', SQLERRM, SQLSTATE;
    -- Re-raise para que Supabase lo capture
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Crear el trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 5. Verificar que el trigger existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    RAISE NOTICE '✅ Trigger creado correctamente!';
  ELSE
    RAISE EXCEPTION '❌ Error: El trigger no se creó';
  END IF;
END $$;

-- ============================================
-- VERIFICACIÓN ADICIONAL: Políticas RLS
-- ============================================

-- Asegurarse de que la tabla users permite inserciones desde el trigger
-- (El trigger usa SECURITY DEFINER así que debería funcionar)

-- Si aún tienes problemas, descomenta estas líneas:
-- ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.coaches DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.athletes DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.coach_athlete_relationship DISABLE ROW LEVEL SECURITY;

-- ============================================
-- NOTA: Después de ejecutar este script,
-- intenta registrarte de nuevo en la aplicación
-- ============================================

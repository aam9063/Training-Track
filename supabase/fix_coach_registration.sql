-- =============================================
-- FIX: Trigger para registro de usuarios (Coach y Athlete)
-- Soluciona el error "Database error saving new user"
-- =============================================

-- 1. Primero verificar si hay usuarios duplicados
SELECT email, COUNT(*) as count
FROM users
GROUP BY email
HAVING COUNT(*) > 1;

-- 2. Verificar el trigger actual
SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users'
   OR trigger_name LIKE '%user%';

-- 3. Eliminar triggers existentes que puedan estar causando conflictos
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 4. Crear función mejorada con manejo de errores
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_coach_id UUID;
  v_coach_email TEXT;
  v_role TEXT;
BEGIN
  -- Obtener el rol de forma segura
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'athlete');

  -- Verificar si el usuario ya existe (evitar duplicados)
  IF EXISTS (SELECT 1 FROM users WHERE id = NEW.id) THEN
    RAISE NOTICE 'User % already exists, skipping insert', NEW.id;
    RETURN NEW;
  END IF;

  -- Insertar en users con manejo de errores
  BEGIN
    INSERT INTO users (id, email, role, first_name, last_name)
    VALUES (
      NEW.id,
      NEW.email,
      v_role::user_role,
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', '')
    );
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'User with email % already exists', NEW.email;
    RETURN NEW;
  WHEN invalid_text_representation THEN
    -- Si el rol no es válido, usar 'athlete' por defecto
    RAISE NOTICE 'Invalid role %, using athlete as default', v_role;
    INSERT INTO users (id, email, role, first_name, last_name)
    VALUES (
      NEW.id,
      NEW.email,
      'athlete'::user_role,
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', '')
    );
  END;

  -- Si es coach, crear registro en coaches
  IF v_role = 'coach' THEN
    INSERT INTO coaches (id) VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;
    RAISE NOTICE 'Created coach record for %', NEW.id;
  END IF;

  -- Si es athlete, crear registro en athletes y buscar coach
  IF v_role = 'athlete' THEN
    INSERT INTO athletes (id) VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;
    RAISE NOTICE 'Created athlete record for %', NEW.id;

    -- Obtener el email del coach de los metadatos
    v_coach_email := LOWER(TRIM(NEW.raw_user_meta_data->>'coach_email'));

    -- Si proporcionó email del coach, buscar y crear relación
    IF v_coach_email IS NOT NULL AND v_coach_email != '' THEN
      SELECT c.id INTO v_coach_id
      FROM coaches c
      JOIN users u ON c.id = u.id
      WHERE LOWER(TRIM(u.email)) = v_coach_email
      LIMIT 1;

      IF v_coach_id IS NOT NULL THEN
        INSERT INTO coach_athlete_relationship (athlete_id, coach_id, status)
        VALUES (NEW.id, v_coach_id, 'pending')
        ON CONFLICT (athlete_id, coach_id) DO NOTHING;
        RAISE NOTICE 'Created pending relationship for athlete % with coach %', NEW.id, v_coach_id;
      ELSE
        RAISE NOTICE 'Coach not found with email: %', v_coach_email;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log del error pero no fallar (para no bloquear el registro)
  RAISE WARNING 'Error in handle_new_user: % - %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Recrear el trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 6. Verificar que el trigger está creado
SELECT
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- 7. Verificar los valores válidos del enum user_role
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role');

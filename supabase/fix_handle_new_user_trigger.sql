-- =============================================
-- FIX: Trigger mejorado para handle_new_user
-- Este trigger crea la relación coach-athlete cuando un atleta se registra
-- =============================================

-- Primero eliminamos el trigger existente si lo hay
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recreamos la función con mejor manejo
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_coach_id UUID;
  v_coach_email TEXT;
BEGIN
  -- Insertar en users
  INSERT INTO users (id, email, role, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'athlete'),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );

  -- Si es coach, crear registro en coaches
  IF (NEW.raw_user_meta_data->>'role') = 'coach' THEN
    INSERT INTO coaches (id) VALUES (NEW.id);
  END IF;

  -- Si es athlete, crear registro en athletes
  IF (NEW.raw_user_meta_data->>'role') = 'athlete' THEN
    INSERT INTO athletes (id) VALUES (NEW.id);

    -- Obtener el email del coach de los metadatos
    v_coach_email := LOWER(TRIM(NEW.raw_user_meta_data->>'coach_email'));

    -- Si proporcionó email del coach, buscar y crear invitación
    IF v_coach_email IS NOT NULL AND v_coach_email != '' THEN
      -- Buscar el coach por email (case insensitive)
      SELECT c.id INTO v_coach_id
      FROM coaches c
      JOIN users u ON c.id = u.id
      WHERE LOWER(TRIM(u.email)) = v_coach_email
      LIMIT 1;

      -- Si encontramos el coach, crear la relación
      IF v_coach_id IS NOT NULL THEN
        INSERT INTO coach_athlete_relationship (athlete_id, coach_id, status)
        VALUES (NEW.id, v_coach_id, 'pending')
        ON CONFLICT (athlete_id, coach_id) DO NOTHING;

        RAISE NOTICE 'Created pending relationship for athlete % with coach %', NEW.id, v_coach_id;
      ELSE
        -- Log para debugging - el coach no existe
        RAISE NOTICE 'Coach not found with email: %', v_coach_email;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear el trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Verificar que el trigger está creado
SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- =============================================
-- OPCIONAL: Crear la relación para Hector manualmente
-- Ejecuta esto DESPUÉS de verificar los IDs correctos
-- =============================================

-- Primero verifica tu ID de coach:
-- SELECT id, email FROM users WHERE role = 'coach';

-- Luego crea la relación (reemplaza TU_COACH_ID con el ID real):
-- INSERT INTO coach_athlete_relationship (athlete_id, coach_id, status)
-- VALUES ('80191242-dc3b-4e7a-b7a5-4cd6c6914945', 'TU_COACH_ID', 'pending');

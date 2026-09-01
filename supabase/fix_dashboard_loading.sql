-- ============================================
-- ARREGLAR DASHBOARD - Permitir lectura de perfil
-- ============================================

-- El problema: Los usuarios no pueden leer su propio perfil
-- Solución: Agregar políticas SELECT para lectura

-- PASO 1: Verificar que RLS está activo
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;

-- PASO 2: Eliminar políticas SELECT existentes que puedan estar mal
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "coaches_select_own" ON public.coaches;
DROP POLICY IF EXISTS "athletes_select_own" ON public.athletes;

-- PASO 3: Crear políticas SELECT correctas

-- Usuarios pueden leer su propio registro
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Coaches pueden leer su propio registro
CREATE POLICY "coaches_select_own" ON public.coaches
  FOR SELECT
  USING (auth.uid() = id);

-- Athletes pueden leer su propio registro
CREATE POLICY "athletes_select_own" ON public.athletes
  FOR SELECT
  USING (auth.uid() = id);

-- PASO 4: Verificar que las políticas existen
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('users', 'coaches', 'athletes')
  AND cmd = 'SELECT'
ORDER BY tablename;

-- Si ves las 3 políticas, está todo OK ✅

-- PASO 5: Verificación adicional
DO $$
DECLARE
  v_user_policy_exists BOOLEAN;
  v_coach_policy_exists BOOLEAN;
  v_athlete_policy_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' AND policyname = 'users_select_own'
  ) INTO v_user_policy_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'coaches' AND policyname = 'coaches_select_own'
  ) INTO v_coach_policy_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'athletes' AND policyname = 'athletes_select_own'
  ) INTO v_athlete_policy_exists;

  IF v_user_policy_exists AND v_coach_policy_exists AND v_athlete_policy_exists THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ POLÍTICAS DE LECTURA CREADAS';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ Users: Usuarios pueden leer su perfil';
    RAISE NOTICE '✓ Coaches: Coaches pueden leer su info';
    RAISE NOTICE '✓ Athletes: Athletes pueden leer su info';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🚀 Recarga el dashboard ahora';
  ELSE
    RAISE WARNING 'Algunas políticas no se crearon correctamente';
  END IF;
END $$;

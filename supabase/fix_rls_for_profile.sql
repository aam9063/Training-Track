-- ============================================
-- FIX: Políticas RLS para que funcione fetchProfile
-- ============================================

-- PASO 1: Ver políticas actuales
SELECT 
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename IN ('users', 'coaches', 'athletes')
ORDER BY tablename, policyname;

-- PASO 2: Eliminar políticas antiguas problemáticas
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "coaches_select_own" ON public.coaches;
DROP POLICY IF EXISTS "athletes_select_own" ON public.athletes;

-- PASO 3: Crear políticas RLS para que los usuarios puedan ver su propio perfil
-- Usuarios pueden ver su propio registro
CREATE POLICY "users_select_own" 
ON public.users 
FOR SELECT 
USING (auth.uid() = id);

-- Usuarios pueden actualizar su propio registro
CREATE POLICY "users_update_own" 
ON public.users 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Coaches pueden ver su propio registro de coach
CREATE POLICY "coaches_select_own" 
ON public.coaches 
FOR SELECT 
USING (auth.uid() = id);

-- Coaches pueden actualizar su propio registro
CREATE POLICY "coaches_update_own" 
ON public.coaches 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Atletas pueden ver su propio registro
CREATE POLICY "athletes_select_own" 
ON public.athletes 
FOR SELECT 
USING (auth.uid() = id);

-- Atletas pueden actualizar su propio registro
CREATE POLICY "athletes_update_own" 
ON public.athletes 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- PASO 4: Permitir que coaches vean a sus atletas
CREATE POLICY "users_select_coach_athletes" 
ON public.users 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.coach_athlete_relationship car
    WHERE car.athlete_id = users.id
    AND car.coach_id = auth.uid()
    AND car.status = 'active'
  )
);

-- PASO 5: Permitir que atletas vean a sus coaches
CREATE POLICY "users_select_athlete_coach" 
ON public.users 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.coach_athlete_relationship car
    WHERE car.coach_id = users.id
    AND car.athlete_id = auth.uid()
    AND car.status = 'active'
  )
);

-- PASO 6: Verificar que RLS está habilitado
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename IN ('users', 'coaches', 'athletes')
ORDER BY tablename;

-- PASO 7: Test - Verificar que el usuario actual puede ver su propio perfil
-- Ejecuta esto después de recargar la app
SELECT 
  u.id,
  u.email,
  u.role,
  u.first_name,
  u.last_name,
  c.id as coach_id,
  c.specialization
FROM public.users u
LEFT JOIN public.coaches c ON u.id = c.id
WHERE u.id = auth.uid();

-- ============================================
-- INSTRUCCIONES:
-- ============================================
-- 1. Ejecuta PASO 1 para ver las políticas actuales
-- 2. Ejecuta PASOS 2-5 para eliminar y recrear políticas
-- 3. Ejecuta PASO 6 para verificar que RLS está habilitado
-- 4. Ejecuta PASO 7 para probar que funciona
-- 5. Recarga la app y verifica que carga el profile
-- ============================================

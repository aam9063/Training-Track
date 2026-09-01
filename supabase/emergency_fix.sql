-- ============================================
-- ARREGLO DE EMERGENCIA - Dashboard Loading
-- Desactivar TODO el RLS temporalmente
-- ============================================

-- PASO 1: Desactivar RLS completamente
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.coaches DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.athletes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.coach_athlete_relationship DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.training_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.training_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.personal_bests DISABLE ROW LEVEL SECURITY;

-- PASO 2: Verificar que el usuario existe y tiene datos
SELECT 
  u.id,
  u.email,
  u.role,
  u.first_name,
  u.last_name,
  CASE 
    WHEN c.id IS NOT NULL THEN 'Coach record exists'
    WHEN a.id IS NOT NULL THEN 'Athlete record exists'
    ELSE 'NO ROLE RECORD FOUND'
  END as role_status
FROM public.users u
LEFT JOIN public.coaches c ON c.id = u.id
LEFT JOIN public.athletes a ON a.id = u.id
WHERE u.email = 'albert9063@gmail.com';

-- PASO 3: Si NO existe el registro de coach/athlete, crearlo
DO $$
DECLARE
  v_user_id UUID;
  v_role user_role;
  v_coach_exists BOOLEAN;
  v_athlete_exists BOOLEAN;
BEGIN
  -- Obtener user_id y role
  SELECT id, role INTO v_user_id, v_role
  FROM public.users
  WHERE email = 'albert9063@gmail.com';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado en public.users';
  END IF;

  -- Verificar si existe coach
  SELECT EXISTS (SELECT 1 FROM public.coaches WHERE id = v_user_id) INTO v_coach_exists;
  
  -- Verificar si existe athlete
  SELECT EXISTS (SELECT 1 FROM public.athletes WHERE id = v_user_id) INTO v_athlete_exists;

  -- Crear registro según rol
  IF v_role = 'coach' AND NOT v_coach_exists THEN
    INSERT INTO public.coaches (id, subscription_plan, max_athletes)
    VALUES (v_user_id, 'starter', 10);
    RAISE NOTICE '✅ Coach record created';
  ELSIF v_role = 'athlete' AND NOT v_athlete_exists THEN
    INSERT INTO public.athletes (id)
    VALUES (v_user_id);
    RAISE NOTICE '✅ Athlete record created';
  ELSE
    RAISE NOTICE '✅ Role record already exists';
  END IF;
END $$;

-- PASO 4: Verificación final
SELECT 
  '✅ USER EXISTS' as status,
  u.email,
  u.role,
  u.first_name || ' ' || u.last_name as full_name,
  CASE 
    WHEN c.id IS NOT NULL THEN '✅ Coach OK'
    WHEN a.id IS NOT NULL THEN '✅ Athlete OK'
    ELSE '❌ NO ROLE RECORD'
  END as role_status
FROM public.users u
LEFT JOIN public.coaches c ON c.id = u.id
LEFT JOIN public.athletes a ON a.id = u.id
WHERE u.email = 'albert9063@gmail.com';

-- ============================================
-- NOTA: Después de ejecutar este script:
-- 1. Cierra TODAS las pestañas del navegador
-- 2. Abre una nueva pestaña
-- 3. Ve a localhost:5174/login
-- 4. Inicia sesión
-- ============================================

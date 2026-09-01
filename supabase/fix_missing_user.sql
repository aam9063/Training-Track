-- ============================================
-- FIX: Usuario faltante en public.users
-- ============================================
-- Este script sincroniza auth.users con public.users

-- PASO 1: Ver usuarios en auth.users que no están en public.users
SELECT 
  au.id,
  au.email,
  au.raw_user_meta_data->>'role' as role,
  au.raw_user_meta_data->>'first_name' as first_name,
  au.raw_user_meta_data->>'last_name' as last_name,
  au.created_at,
  CASE 
    WHEN pu.id IS NULL THEN '❌ FALTA en public.users'
    ELSE '✅ Existe en public.users'
  END as status
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
ORDER BY au.created_at DESC;

-- PASO 2: Insertar usuarios faltantes en public.users
-- Descomenta y ejecuta solo si ves usuarios faltantes arriba
/*
INSERT INTO public.users (id, email, role, first_name, last_name, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE((au.raw_user_meta_data->>'role')::user_role, 'coach'),
  COALESCE(au.raw_user_meta_data->>'first_name', 'Usuario'),
  COALESCE(au.raw_user_meta_data->>'last_name', 'Nuevo'),
  au.created_at,
  NOW()
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;
*/

-- PASO 3: Verificar coaches faltantes
SELECT 
  u.id,
  u.email,
  u.role,
  u.first_name,
  u.last_name,
  CASE 
    WHEN c.id IS NULL AND u.role = 'coach' THEN '❌ FALTA en coaches'
    WHEN c.id IS NOT NULL THEN '✅ Existe en coaches'
    ELSE '⚪ No es coach'
  END as coach_status
FROM public.users u
LEFT JOIN public.coaches c ON u.id = c.id
WHERE u.role = 'coach'
ORDER BY u.created_at DESC;

-- PASO 4: Insertar coaches faltantes
-- Descomenta y ejecuta solo si ves coaches faltantes arriba
/*
INSERT INTO public.coaches (id, specialization, created_at, updated_at)
SELECT 
  u.id,
  ARRAY['general']::text[],
  NOW(),
  NOW()
FROM public.users u
LEFT JOIN public.coaches c ON u.id = c.id
WHERE u.role = 'coach' AND c.id IS NULL
ON CONFLICT (id) DO NOTHING;
*/

-- PASO 5: Verificar atletas faltantes
SELECT 
  u.id,
  u.email,
  u.role,
  u.first_name,
  u.last_name,
  CASE 
    WHEN a.id IS NULL AND u.role = 'athlete' THEN '❌ FALTA en athletes'
    WHEN a.id IS NOT NULL THEN '✅ Existe en athletes'
    ELSE '⚪ No es atleta'
  END as athlete_status
FROM public.users u
LEFT JOIN public.athletes a ON u.id = a.id
WHERE u.role = 'athlete'
ORDER BY u.created_at DESC;

-- PASO 6: Insertar atletas faltantes
-- Descomenta y ejecuta solo si ves atletas faltantes arriba
/*
INSERT INTO public.athletes (id, created_at, updated_at)
SELECT 
  u.id,
  NOW(),
  NOW()
FROM public.users u
LEFT JOIN public.athletes a ON u.id = a.id
WHERE u.role = 'athlete' AND a.id IS NULL
ON CONFLICT (id) DO NOTHING;
*/

-- PASO 7: Crear relaciones coach-atleta faltantes
-- Reemplaza 'coach@email.com' y 'athlete@email.com' con los emails reales
/*
INSERT INTO public.coach_athlete_relationship (athlete_id, coach_id, status, start_date, created_at, updated_at)
SELECT 
  (SELECT id FROM public.users WHERE email = 'athlete@email.com' AND role = 'athlete'),
  (SELECT id FROM public.users WHERE email = 'coach@email.com' AND role = 'coach'),
  'active',
  CURRENT_DATE,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.coach_athlete_relationship
  WHERE athlete_id = (SELECT id FROM public.users WHERE email = 'athlete@email.com')
  AND coach_id = (SELECT id FROM public.users WHERE email = 'coach@email.com')
);
*/

-- PASO 8: Verificación final
SELECT 
  'Total usuarios en auth.users' as descripcion,
  COUNT(*) as cantidad
FROM auth.users
UNION ALL
SELECT 
  'Total usuarios en public.users',
  COUNT(*)
FROM public.users
UNION ALL
SELECT 
  'Total coaches',
  COUNT(*)
FROM public.coaches
UNION ALL
SELECT 
  'Total atletas',
  COUNT(*)
FROM public.athletes
UNION ALL
SELECT 
  'Total relaciones coach-atleta',
  COUNT(*)
FROM public.coach_athlete_relationship
UNION ALL
SELECT 
  'Relaciones activas',
  COUNT(*)
FROM public.coach_athlete_relationship
WHERE status = 'active';

-- ============================================
-- INSTRUCCIONES:
-- ============================================
-- 1. Ejecuta PASO 1 para ver si faltan usuarios
-- 2. Si ves usuarios con "❌ FALTA", descomenta y ejecuta PASO 2
-- 3. Ejecuta PASO 3 para ver si faltan coaches
-- 4. Si ves "❌ FALTA en coaches", descomenta y ejecuta PASO 4
-- 5. Ejecuta PASO 5 para ver si faltan atletas
-- 6. Si ves "❌ FALTA en athletes", descomenta y ejecuta PASO 6
-- 7. Si necesitas crear la relación manualmente, edita y ejecuta PASO 7
-- 8. Ejecuta PASO 8 para verificación final
-- ============================================

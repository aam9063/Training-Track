-- ============================================
-- DEBUG: Coach-Athlete Relationship
-- ============================================

-- 1. Ver todos los usuarios con su rol
SELECT 
  id,
  email,
  role,
  first_name,
  last_name,
  created_at
FROM public.users
ORDER BY created_at DESC;

-- 2. Ver todos los coaches
SELECT 
  c.id as coach_id,
  u.email as coach_email,
  u.first_name,
  u.last_name,
  c.specialization,
  c.certifications
FROM public.coaches c
JOIN public.users u ON c.id = u.id
ORDER BY c.created_at DESC;

-- 3. Ver todos los atletas
SELECT 
  a.id as athlete_id,
  u.email as athlete_email,
  u.first_name,
  u.last_name,
  a.specialties,
  a.vo2_max
FROM public.athletes a
JOIN public.users u ON a.id = u.id
ORDER BY a.created_at DESC;

-- 4. Ver todas las relaciones coach-atleta
SELECT 
  car.id as relationship_id,
  car.coach_id,
  cu.email as coach_email,
  cu.first_name || ' ' || cu.last_name as coach_name,
  car.athlete_id,
  au.email as athlete_email,
  au.first_name || ' ' || au.last_name as athlete_name,
  car.status,
  car.start_date,
  car.created_at
FROM public.coach_athlete_relationship car
JOIN public.users cu ON car.coach_id = cu.id
JOIN public.users au ON car.athlete_id = au.id
ORDER BY car.created_at DESC;

-- 5. Ver relaciones por coach específico (reemplaza el email)
-- Cambia 'tu@email.com' por el email del coach
SELECT 
  car.id as relationship_id,
  car.coach_id,
  car.athlete_id,
  au.email as athlete_email,
  au.first_name || ' ' || au.last_name as athlete_name,
  car.status,
  car.created_at
FROM public.coach_athlete_relationship car
JOIN public.users cu ON car.coach_id = cu.id
JOIN public.users au ON car.athlete_id = au.id
WHERE cu.email = 'tu@email.com'  -- ⚠️ CAMBIAR ESTO
ORDER BY car.created_at DESC;

-- 6. Verificar si un atleta tiene coach asignado
-- Cambia 'atleta@email.com' por el email del atleta
SELECT 
  au.email as athlete_email,
  au.first_name || ' ' || au.last_name as athlete_name,
  car.coach_id,
  cu.email as coach_email,
  cu.first_name || ' ' || cu.last_name as coach_name,
  car.status,
  car.created_at
FROM public.users au
LEFT JOIN public.coach_athlete_relationship car ON au.id = car.athlete_id
LEFT JOIN public.users cu ON car.coach_id = cu.id
WHERE au.email = 'atleta@email.com'  -- ⚠️ CAMBIAR ESTO
AND au.role = 'athlete';

-- 7. Contar atletas por coach
SELECT 
  cu.email as coach_email,
  cu.first_name || ' ' || cu.last_name as coach_name,
  COUNT(car.id) as total_athletes,
  COUNT(CASE WHEN car.status = 'active' THEN 1 END) as active_athletes,
  COUNT(CASE WHEN car.status = 'pending' THEN 1 END) as pending_athletes
FROM public.users cu
JOIN public.coaches c ON cu.id = c.id
LEFT JOIN public.coach_athlete_relationship car ON c.id = car.coach_id
WHERE cu.role = 'coach'
GROUP BY cu.id, cu.email, cu.first_name, cu.last_name
ORDER BY total_athletes DESC;

-- 8. Verificar permisos RLS (debe estar habilitado)
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('users', 'coaches', 'athletes', 'coach_athlete_relationship')
AND schemaname = 'public';

-- 9. Ver políticas RLS activas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('coach_athlete_relationship')
AND schemaname = 'public';

-- ============================================
-- INSTRUCCIONES:
-- ============================================
-- 1. Ejecuta queries 1-4 para ver todos los datos
-- 2. En query 5, reemplaza 'tu@email.com' con el email del coach
-- 3. En query 6, reemplaza 'atleta@email.com' con el email del atleta
-- 4. Revisa los resultados en la consola
-- ============================================

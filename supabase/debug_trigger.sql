-- ============================================
-- SCRIPT DE DEBUG
-- Verificar el estado del trigger y las tablas
-- ============================================

-- 1. Verificar que el trigger existe
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- 2. Verificar que las tablas tienen las columnas correctas
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'coaches', 'athletes')
ORDER BY table_name, ordinal_position;

-- 3. Verificar estado de RLS
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users', 'coaches', 'athletes', 'coach_athlete_relationship');

-- 4. Ver las políticas RLS activas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('users', 'coaches', 'athletes')
ORDER BY tablename;

-- 5. Verificar permisos de la función
SELECT 
  proname,
  prosecdef,
  provolatile
FROM pg_proc
WHERE proname = 'handle_new_user';

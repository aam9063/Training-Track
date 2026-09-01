-- =============================================
-- TEST: Verificar estado actual ANTES de aplicar cambios
-- Ejecuta esto primero para ver qué tienes configurado
-- =============================================

-- 1. Ver qué tablas tienen RLS habilitado/deshabilitado
SELECT
  tablename,
  CASE WHEN rowsecurity THEN '✅ RLS ON' ELSE '❌ RLS OFF' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. Ver todas las políticas existentes
SELECT
  tablename,
  policyname,
  permissive,
  cmd as action,
  qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- 3. Ver funciones con SECURITY DEFINER (estas bypasean RLS)
SELECT
  p.proname as function_name,
  CASE
    WHEN p.prosecdef THEN '✅ SECURITY DEFINER (bypasea RLS)'
    ELSE '❌ SECURITY INVOKER'
  END as security_mode
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'handle_new_user',
    'can_access_athlete_data',
    'is_coach',
    'is_athlete',
    'get_my_role',
    'get_my_coach_id',
    'is_my_athlete'
  );

-- 4. Verificar el trigger de registro
SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- =============================================
-- Si todo se ve bien, puedes proceder con fix_all_security_issues.sql
-- Si algo falla después, usa rollback_rls.sql
-- =============================================

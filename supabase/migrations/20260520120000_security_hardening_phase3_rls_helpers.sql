-- Fase 3 hardening SECURITY DEFINER: RLS helpers.
-- Verificado via pg_policies que SOLO is_admin se usa en RLS hoy.
-- Las otras 6 (is_coach, is_athlete, is_my_athlete, get_my_role,
-- get_my_coach_id, can_access_athlete_data) no aparecen en ninguna
-- politica RLS ni se invocan desde el codigo. Las cerramos a solo
-- postgres/service_role.
--
-- Aplicada en prod (lusirdkixfliydimemre) el 2026-05-20 via apply_migration.

-- is_admin: SE USA en RLS de athletes, coaches, users, coach_athlete_relationship.
-- Conservar authenticated (RLS lo evalua bajo el rol del usuario logueado).
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;

-- Las siguientes NO se usan en RLS ni en codigo (verificado con grep):
REVOKE EXECUTE ON FUNCTION public.is_coach() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_athlete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_my_athlete(p_athlete_id uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_coach_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_access_athlete_data(p_athlete_id uuid) FROM PUBLIC, anon, authenticated;

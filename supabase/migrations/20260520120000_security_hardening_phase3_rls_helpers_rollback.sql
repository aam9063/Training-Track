-- Rollback Fase 3: restituir EXECUTE original a las RLS helpers.

GRANT EXECUTE ON FUNCTION public.is_admin() TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_coach() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_athlete() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_my_athlete(p_athlete_id uuid) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_coach_id() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_athlete_data(p_athlete_id uuid) TO PUBLIC, anon, authenticated;

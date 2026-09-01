-- Rollback de Fase 2: re-otorga EXECUTE a PUBLIC en las 6 funciones RPC.

GRANT EXECUTE ON FUNCTION public.get_coach_public_info(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_conconi_paces(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_push_notification(uuid[], text, text, text, text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_analysis_limit(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_auth_provider(text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_athlete_planned_km(uuid, date, date) TO PUBLIC, anon, authenticated;

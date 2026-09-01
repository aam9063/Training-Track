-- Fase 2 hardening: revocar PUBLIC en las funciones RPC legitimas y otorgar
-- EXECUTE solo a los roles que realmente las usan (segun grep de codigo).
-- Aplicada en prod (lusirdkixfliydimemre) el 2026-05-19 via apply_migration.

-- ── RPC autenticado: llamadas desde frontend (authenticated) y/o Edge Functions (service_role)
REVOKE EXECUTE ON FUNCTION public.get_coach_public_info(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calculate_conconi_paces(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.send_push_notification(uuid[], text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_ai_analysis_limit(uuid) FROM PUBLIC, anon;

-- commit_plan_selection: ya estaba sin PUBLIC, no requiere accion adicional.

-- ── RPC pre-login: check_auth_provider necesita anon (se llama antes del login)
REVOKE EXECUTE ON FUNCTION public.check_auth_provider(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_auth_provider(text) TO anon, authenticated;

-- ── RPC solo backend: get_athlete_planned_km solo se invoca desde Edge Function weekly-ai-reports
-- usando cliente service_role. No debe ser accesible desde la app.
REVOKE EXECUTE ON FUNCTION public.get_athlete_planned_km(uuid, date, date) FROM PUBLIC, anon, authenticated;

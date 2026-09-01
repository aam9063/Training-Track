-- Fase 2 hardening SECURITY DEFINER: RPC legitimos.
-- Revocar PUBLIC y anon donde no son necesarios. Conservar authenticated.
--
-- Aplicada en prod (lusirdkixfliydimemre) el 2026-05-20 via apply_migration.

-- check_auth_provider: usado en el formulario de login (antes de login) => anon SI necesita
REVOKE EXECUTE ON FUNCTION public.check_auth_provider(p_email text) FROM PUBLIC;

-- commit_plan_selection: usuario logueado seleccionando plan
REVOKE EXECUTE ON FUNCTION public.commit_plan_selection(p_plan_key text, p_billing_interval text) FROM PUBLIC;

-- get_coach_public_info: atleta logueado consulta info de su coach
REVOKE EXECUTE ON FUNCTION public.get_coach_public_info(coach_uuid uuid) FROM PUBLIC, anon;

-- calculate_conconi_paces: atleta logueado tras hacer test Conconi
REVOKE EXECUTE ON FUNCTION public.calculate_conconi_paces(p_test_id uuid) FROM PUBLIC, anon;

-- send_push_notification: invocada desde triggers SECURITY DEFINER y Edge Functions.
-- Los triggers se ejecutan con permisos del owner (postgres), no del rol caller.
-- authenticated puede llamarla via REST en contextos legitimos (Edge Functions con JWT).
REVOKE EXECUTE ON FUNCTION public.send_push_notification(p_user_ids uuid[], p_title text, p_body text, p_url text, p_tag text) FROM PUBLIC;

-- get_ai_analysis_limit: hook useAiAnalysisQuota + Edge Function analyze-metric-chart
REVOKE EXECUTE ON FUNCTION public.get_ai_analysis_limit(p_athlete_id uuid) FROM PUBLIC;

-- get_athlete_planned_km: SOLO Edge Function weekly-ai-reports con service_role
REVOKE EXECUTE ON FUNCTION public.get_athlete_planned_km(p_athlete_id uuid, p_week_start date, p_week_end date) FROM PUBLIC, anon, authenticated;

-- get_weekly_training_load: sin uso detectado en el codigo
REVOKE EXECUTE ON FUNCTION public.get_weekly_training_load(p_athlete_id uuid, p_weeks integer) FROM PUBLIC, anon, authenticated;

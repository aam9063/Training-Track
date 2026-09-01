-- Rollback Fase 2: restituir EXECUTE original.

GRANT EXECUTE ON FUNCTION public.check_auth_provider(p_email text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.commit_plan_selection(p_plan_key text, p_billing_interval text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_coach_public_info(coach_uuid uuid) TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_conconi_paces(p_test_id uuid) TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_push_notification(p_user_ids uuid[], p_title text, p_body text, p_url text, p_tag text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_analysis_limit(p_athlete_id uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_athlete_planned_km(p_athlete_id uuid, p_week_start date, p_week_end date) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_weekly_training_load(p_athlete_id uuid, p_weeks integer) TO PUBLIC, anon, authenticated;

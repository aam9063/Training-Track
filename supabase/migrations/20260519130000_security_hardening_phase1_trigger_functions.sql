-- Fase 1 hardening: revocar EXECUTE de PUBLIC/anon/authenticated en las 10 funciones
-- que solo se ejecutan como triggers internos.
-- Postgres no chequea EXECUTE para triggers, asi que NO deberian ser invocables via REST API.
-- postgres y service_role conservan EXECUTE por seguridad operacional.
-- Aplicada en prod (lusirdkixfliydimemre) el 2026-05-19 via apply_migration.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_trial_on_signup() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_athlete_training_assigned() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_chat_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_coach_training_completed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_competition_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_gym_file_uploaded() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_athlete_profile_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_weekly_diary_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_push_acwr_alert() FROM PUBLIC, anon, authenticated;

-- Fase 1 hardening SECURITY DEFINER: revocar EXECUTE publico
-- en funciones que SOLO se ejecutan via triggers internos.
-- Los triggers no chequean grants en su ejecucion, asi que esto es seguro.
-- Si una funcion del grupo se invoca por accidente como RPC, ahora dara 403.
--
-- Aplicada en prod (lusirdkixfliydimemre) el 2026-05-20 via apply_migration.

-- Triggers de notificaciones (DB triggers internos)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_trial_on_signup() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_athlete_training_assigned() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_chat_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_coach_training_completed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_competition_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_gym_file_uploaded() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_push_acwr_alert() FROM PUBLIC, anon, authenticated;

-- Triggers de timestamps (BEFORE UPDATE)
REVOKE EXECUTE ON FUNCTION public.update_athlete_profile_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_weekly_diary_updated_at() FROM PUBLIC, anon, authenticated;

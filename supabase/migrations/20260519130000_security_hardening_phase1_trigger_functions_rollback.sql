-- Rollback de Fase 1: re-otorga EXECUTE a authenticated para las 10 funciones-trigger.
-- NOTA: no se restituye a PUBLIC explicitamente; PUBLIC se hereda automaticamente cuando
-- una funcion se crea, pero al haber sido revocado explicitamente conviene re-grant explicito.

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_trial_on_signup() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_athlete_training_assigned() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_chat_message() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_coach_training_completed() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_competition_created() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_gym_file_uploaded() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_athlete_profile_updated_at() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_weekly_diary_updated_at() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_push_acwr_alert() TO PUBLIC, anon, authenticated;

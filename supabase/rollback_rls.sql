-- =============================================
-- ROLLBACK: Desactivar RLS si algo falla
-- Ejecuta esto si la app deja de funcionar después del fix
-- =============================================

-- Desactivar RLS en todas las tablas
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.athletes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_athlete_relationship DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_paces DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_bests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_weekly_summary DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.conconi_tests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_exercises_bank DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.race_predictions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.running_exercises_bank DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_plans DISABLE ROW LEVEL SECURITY;

-- Verificar que está desactivado
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

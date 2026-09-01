-- ============================================
-- DESHABILITAR RLS EN TODAS LAS TABLAS
-- ============================================
-- ⚠️ SOLO PARA DESARROLLO

-- Deshabilitar RLS
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.athletes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_athlete_relationship DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_paces DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_bests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_metrics DISABLE ROW LEVEL SECURITY;

-- Verificar que se deshabilitó
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename IN (
  'users', 
  'coaches', 
  'athletes', 
  'coach_athlete_relationship',
  'athlete_paces',
  'personal_bests',
  'training_sessions',
  'training_metrics'
)
ORDER BY tablename;

-- Debe mostrar "false" en todas las filas

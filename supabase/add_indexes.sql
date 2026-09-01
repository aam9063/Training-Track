-- ============================================
-- AGREGAR ÍNDICES PARA MEJORAR PERFORMANCE
-- ============================================

-- Índices para coach_athlete_relationship
CREATE INDEX IF NOT EXISTS idx_car_coach_status 
ON public.coach_athlete_relationship(coach_id, status);

CREATE INDEX IF NOT EXISTS idx_car_athlete_status 
ON public.coach_athlete_relationship(athlete_id, status);

-- Índices para users
CREATE INDEX IF NOT EXISTS idx_users_email 
ON public.users(email);

CREATE INDEX IF NOT EXISTS idx_users_role 
ON public.users(role);

-- Índices para athletes
CREATE INDEX IF NOT EXISTS idx_athletes_id 
ON public.athletes(id);

-- Índices para coaches
CREATE INDEX IF NOT EXISTS idx_coaches_id 
ON public.coaches(id);

-- Verificar índices creados
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('coach_athlete_relationship', 'users', 'athletes', 'coaches')
ORDER BY tablename, indexname;

-- VACUUM para optimizar
VACUUM ANALYZE public.coach_athlete_relationship;
VACUUM ANALYZE public.users;
VACUUM ANALYZE public.athletes;
VACUUM ANALYZE public.coaches;

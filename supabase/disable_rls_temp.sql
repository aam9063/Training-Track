-- ============================================
-- DESACTIVAR RLS TEMPORALMENTE
-- Para permitir que el trigger funcione
-- ============================================

-- Desactivar RLS en las tablas críticas para el registro
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.athletes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_athlete_relationship DISABLE ROW LEVEL SECURITY;

-- Verificar que se desactivó
DO $$
BEGIN
  RAISE NOTICE '✅ RLS desactivado temporalmente en users, coaches, athletes';
  RAISE NOTICE '⚠️ Recuerda reactivarlo después de que funcione el registro';
END $$;

-- ============================================
-- NOTA: Después de que el registro funcione,
-- puedes reactivar RLS con este comando:
-- 
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.coach_athlete_relationship ENABLE ROW LEVEL SECURITY;
-- ============================================

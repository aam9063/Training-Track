-- Rollback Fase 4: restituir EXECUTE original.

GRANT EXECUTE ON FUNCTION public.block_new_signups() TO PUBLIC, anon, authenticated;

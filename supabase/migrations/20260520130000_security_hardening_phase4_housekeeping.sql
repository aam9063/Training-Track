-- Fase 4 hardening SECURITY DEFINER: housekeeping.
-- block_new_signups: SECURITY DEFINER huerfana (sin triggers, sin callers).
-- search_path mutable en slugify_es y coach_exercise_notes_touch ya fue
-- corregido por el linter en migraciones previas (search_path=public, pg_temp).
--
-- Aplicada en prod (lusirdkixfliydimemre) el 2026-05-20 via apply_migration.

REVOKE EXECUTE ON FUNCTION public.block_new_signups() FROM PUBLIC, anon, authenticated;

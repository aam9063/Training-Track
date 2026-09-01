-- Migration: create_gym_files
-- Applied: 2026-02-27
-- Adds gym_files table for coach PDF uploads visible to athletes

CREATE TABLE public.gym_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  storage_path text NOT NULL,     -- {coachId}/{uuid}_{originalName}.pdf
  file_size integer,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_gym_files_coach ON public.gym_files(coach_id);
CREATE INDEX idx_gym_files_expires ON public.gym_files(expires_at);

ALTER TABLE public.gym_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach gestiona sus archivos"
  ON public.gym_files FOR ALL
  USING ((SELECT auth.uid()) = coach_id)
  WITH CHECK ((SELECT auth.uid()) = coach_id);

CREATE POLICY "Atleta ve archivos de su entrenador"
  ON public.gym_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship car
      WHERE car.coach_id = gym_files.coach_id
        AND car.athlete_id = (SELECT auth.uid())
        AND car.status = 'active'
    )
  );

-- Storage bucket: gym-files (private, PDF only, 10MB limit)
-- Created via SQL:
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES ('gym-files', 'gym-files', false, 10485760, ARRAY['application/pdf']);

-- Storage RLS policies applied separately (see apply_migration output)

-- TO ROLLBACK:
-- DROP TABLE public.gym_files;
-- DELETE FROM storage.buckets WHERE id = 'gym-files';

-- Edge Function: cleanup-gym-files (deployed, verify_jwt=false)
-- Activate pg_cron AFTER testing:
-- SELECT cron.schedule(
--   'cleanup-gym-files', '0 3 * * 0',
--   $$ SELECT net.http_post(
--        url := 'https://lusirdkixfliydimemre.supabase.co/functions/v1/cleanup-gym-files',
--        headers := '{"Authorization":"Bearer <SERVICE_ROLE_KEY>","Content-Type":"application/json"}'::jsonb,
--        body := '{}'::jsonb
--      ); $$
-- );

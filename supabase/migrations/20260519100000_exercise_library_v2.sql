-- Exercise library v2: enriquecer banks + ampliar enums + slugs
-- Aplicada en prod (lusirdkixfliydimemre) el 2026-05-19 via apply_migration.
-- Archivos hermanos:
--   20260519100000_exercise_library_v2_rollback.sql
--   20260519100000_exercise_library_v2_verify.sql

-- ============================================================================
-- 1. Enriquecer running_exercises_bank
-- ============================================================================
ALTER TABLE running_exercises_bank
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'todos',
  ADD COLUMN IF NOT EXISTS body_region text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS common_errors text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS kpi jsonb,
  ADD COLUMN IF NOT EXISTS slug text;

ALTER TABLE running_exercises_bank
  ADD CONSTRAINT running_exercises_bank_level_chk
  CHECK (level IN ('principiante','intermedio','avanzado','todos'));

-- ============================================================================
-- 2. Enriquecer gym_exercises_bank (video_url e image_url ya existian)
-- ============================================================================
ALTER TABLE gym_exercises_bank
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'todos',
  ADD COLUMN IF NOT EXISTS body_region text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS common_errors text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS instructions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS slug text;

ALTER TABLE gym_exercises_bank
  ADD CONSTRAINT gym_exercises_bank_level_chk
  CHECK (level IN ('principiante','intermedio','avanzado','todos'));

-- ============================================================================
-- 3. Indices GIN para filtros por arrays
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_running_ex_tags ON running_exercises_bank USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_running_ex_body ON running_exercises_bank USING GIN (body_region);
CREATE INDEX IF NOT EXISTS idx_running_ex_level ON running_exercises_bank (level);

CREATE INDEX IF NOT EXISTS idx_gym_ex_tags ON gym_exercises_bank USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_gym_ex_body ON gym_exercises_bank USING GIN (body_region);
CREATE INDEX IF NOT EXISTS idx_gym_ex_level ON gym_exercises_bank (level);

-- ============================================================================
-- 4. Ampliar enums running_category y gym_category
--    NOTA: ALTER TYPE ... ADD VALUE necesita su propia transaccion. En Supabase
--    apply_migration cada llamada va en una transaccion, asi que aqui esta OK
--    porque este archivo se aplica como un solo statement por la CLI.
--    Si se aplica con psql, ejecutar esta seccion DESPUES de hacer COMMIT.
-- ============================================================================
ALTER TYPE running_category ADD VALUE IF NOT EXISTS 'technical_drill';
ALTER TYPE running_category ADD VALUE IF NOT EXISTS 'recovery_run';
ALTER TYPE running_category ADD VALUE IF NOT EXISTS 'progressive_run';
ALTER TYPE running_category ADD VALUE IF NOT EXISTS 'tempo_run';
ALTER TYPE running_category ADD VALUE IF NOT EXISTS 'test';

ALTER TYPE gym_category ADD VALUE IF NOT EXISTS 'core';
ALTER TYPE gym_category ADD VALUE IF NOT EXISTS 'mobility';
ALTER TYPE gym_category ADD VALUE IF NOT EXISTS 'plyometrics';
ALTER TYPE gym_category ADD VALUE IF NOT EXISTS 'injury_prevention';

-- ============================================================================
-- 5. Slugify + backfill + UNIQUE NOT NULL en slug
-- ============================================================================
CREATE OR REPLACE FUNCTION public.slugify_es(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT regexp_replace(
           regexp_replace(
             lower(
               translate(
                 coalesce(input,''),
                 'ÁÀÄÂáàäâÉÈËÊéèëêÍÌÏÎíìïîÓÒÖÔóòöôÚÙÜÛúùüûÑñÇç',
                 'aaaaaaaaeeeeeeeeiiiiiiiiooooooooouuuuuuuunncc'
               )
             ),
             '[^a-z0-9]+', '-', 'g'
           ),
           '(^-+|-+$)', '', 'g'
         );
$$;

UPDATE running_exercises_bank SET slug = slugify_es(name) WHERE slug IS NULL;

WITH dups AS (
  SELECT id, slug, row_number() OVER (PARTITION BY slug ORDER BY created_at, id) AS rn
  FROM running_exercises_bank
)
UPDATE running_exercises_bank r
SET slug = r.slug || '-' || substr(r.id::text, 1, 6)
FROM dups
WHERE dups.id = r.id AND dups.rn > 1;

UPDATE gym_exercises_bank SET slug = slugify_es(name) WHERE slug IS NULL;

WITH dups AS (
  SELECT id, slug, row_number() OVER (PARTITION BY slug ORDER BY created_at, id) AS rn
  FROM gym_exercises_bank
)
UPDATE gym_exercises_bank g
SET slug = g.slug || '-' || substr(g.id::text, 1, 6)
FROM dups
WHERE dups.id = g.id AND dups.rn > 1;

ALTER TABLE running_exercises_bank
  ALTER COLUMN slug SET NOT NULL,
  ADD CONSTRAINT running_exercises_bank_slug_key UNIQUE (slug);

ALTER TABLE gym_exercises_bank
  ALTER COLUMN slug SET NOT NULL,
  ADD CONSTRAINT gym_exercises_bank_slug_key UNIQUE (slug);

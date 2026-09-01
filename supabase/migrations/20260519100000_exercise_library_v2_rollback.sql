-- Rollback de exercise_library_v2.
-- NOTA: los valores anadidos a los enums NO se pueden quitar en Postgres
-- (ALTER TYPE ... DROP VALUE no existe). Si fuera imprescindible revertir, hay
-- que recrear el tipo de cero. Esto NO es parte del rollback normal.

-- 1. Quitar UNIQUE y NOT NULL en slug
ALTER TABLE running_exercises_bank DROP CONSTRAINT IF EXISTS running_exercises_bank_slug_key;
ALTER TABLE gym_exercises_bank DROP CONSTRAINT IF EXISTS gym_exercises_bank_slug_key;

ALTER TABLE running_exercises_bank ALTER COLUMN slug DROP NOT NULL;
ALTER TABLE gym_exercises_bank ALTER COLUMN slug DROP NOT NULL;

-- 2. Quitar indices
DROP INDEX IF EXISTS idx_running_ex_tags;
DROP INDEX IF EXISTS idx_running_ex_body;
DROP INDEX IF EXISTS idx_running_ex_level;
DROP INDEX IF EXISTS idx_gym_ex_tags;
DROP INDEX IF EXISTS idx_gym_ex_body;
DROP INDEX IF EXISTS idx_gym_ex_level;

-- 3. Quitar constraints de CHECK
ALTER TABLE running_exercises_bank DROP CONSTRAINT IF EXISTS running_exercises_bank_level_chk;
ALTER TABLE gym_exercises_bank DROP CONSTRAINT IF EXISTS gym_exercises_bank_level_chk;

-- 4. Quitar columnas nuevas
ALTER TABLE running_exercises_bank
  DROP COLUMN IF EXISTS tags,
  DROP COLUMN IF EXISTS level,
  DROP COLUMN IF EXISTS body_region,
  DROP COLUMN IF EXISTS common_errors,
  DROP COLUMN IF EXISTS kpi,
  DROP COLUMN IF EXISTS slug;

ALTER TABLE gym_exercises_bank
  DROP COLUMN IF EXISTS tags,
  DROP COLUMN IF EXISTS level,
  DROP COLUMN IF EXISTS body_region,
  DROP COLUMN IF EXISTS common_errors,
  DROP COLUMN IF EXISTS instructions,
  DROP COLUMN IF EXISTS slug;

-- 5. Quitar funcion helper
DROP FUNCTION IF EXISTS public.slugify_es(text);

-- 6. (Manual) Enum values: si fuera imprescindible quitar 'technical_drill',
--    'recovery_run', 'progressive_run', 'tempo_run', 'test' (running_category)
--    o 'core','mobility','plyometrics','injury_prevention' (gym_category):
--      a. Crear nuevo tipo con los valores antiguos
--      b. ALTER TABLE ... ALTER COLUMN category TYPE nuevo_tipo USING category::text::nuevo_tipo
--      c. DROP TYPE viejo_tipo
--    Asegurarse antes de que no existen filas con los valores nuevos.

-- ============================================================
-- UP: athlete_profile table + RLS policies + indexes
-- ============================================================

CREATE TABLE IF NOT EXISTS athlete_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identidad
  nombre text NOT NULL,
  sexo text NOT NULL CHECK (sexo IN ('M', 'F')),
  fecha_nacimiento date NOT NULL,

  -- Fisico
  peso_kg numeric(5,1),
  altura_cm integer,

  -- Enfoque
  modalidad text NOT NULL CHECK (modalidad IN ('800m','1500m','5K','10K','media_maraton','maraton','trail')),
  objetivo text NOT NULL CHECK (objetivo IN ('empezar','completar','mejorar_marca','salud')),
  marca_actual text,
  competicion_objetivo text,
  competicion_fecha date,

  -- Disponibilidad
  dias_disponibles jsonb NOT NULL DEFAULT '{}',
  horas_por_dia jsonb,
  acceso_gimnasio boolean NOT NULL DEFAULT false,
  acceso_pista boolean NOT NULL DEFAULT false,

  -- Motor
  km_semanales numeric(5,1) NOT NULL DEFAULT 0,
  ritmo_comodo text,
  fc_max integer,
  vo2max numeric(4,1),
  lesiones text,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index on user_id (unique constraint already creates one, but explicit for clarity)
CREATE INDEX IF NOT EXISTS idx_athlete_profile_user_id ON athlete_profile(user_id);

-- Enable RLS
ALTER TABLE athlete_profile ENABLE ROW LEVEL SECURITY;

-- Athlete can do everything with their own row
CREATE POLICY "athlete_own" ON athlete_profile
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Coach can read profiles of athletes they have an active relationship with
CREATE POLICY "coach_read_via_rel" ON athlete_profile
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.coach_id = (select auth.uid())
        AND car.athlete_id = athlete_profile.user_id
        AND car.status = 'active'
    )
  );

-- Auto-update updated_at on modification
CREATE OR REPLACE FUNCTION update_athlete_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_athlete_profile_updated_at
  BEFORE UPDATE ON athlete_profile
  FOR EACH ROW
  EXECUTE FUNCTION update_athlete_profile_updated_at();


-- ============================================================
-- DOWN: rollback (run manually if needed)
-- ============================================================
-- DROP TRIGGER IF EXISTS trg_athlete_profile_updated_at ON athlete_profile;
-- DROP FUNCTION IF EXISTS update_athlete_profile_updated_at();
-- DROP POLICY IF EXISTS "coach_read_via_rel" ON athlete_profile;
-- DROP POLICY IF EXISTS "athlete_own" ON athlete_profile;
-- DROP TABLE IF EXISTS athlete_profile;

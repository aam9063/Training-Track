-- =============================================
-- COMPETITIONS TABLE
-- Tabla para almacenar competiciones/eventos de atletas
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- TABLE
-- =============================================

CREATE TABLE competitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,

  -- Información del evento
  name VARCHAR(255) NOT NULL,
  event_date DATE NOT NULL,
  location VARCHAR(255),

  -- Detalles de la carrera
  distance_km DECIMAL(6,2), -- Distancia en km
  distance_name VARCHAR(50), -- '5k', '10k', 'media', 'maratón', etc.
  event_type VARCHAR(50) DEFAULT 'race', -- 'race', 'time_trial', 'fun_run'
  surface VARCHAR(50), -- 'road', 'trail', 'track'

  -- Objetivos
  target_time_seconds INTEGER, -- Tiempo objetivo en segundos
  target_pace_seconds INTEGER, -- Ritmo objetivo en seg/km

  -- Resultados (se rellenan después de la competición)
  result_time_seconds INTEGER, -- Tiempo final
  result_pace_seconds INTEGER, -- Ritmo final
  result_position INTEGER, -- Posición general
  result_category_position INTEGER, -- Posición en categoría
  result_notes TEXT, -- Notas post-carrera

  -- Estado
  status VARCHAR(20) DEFAULT 'upcoming', -- 'upcoming', 'completed', 'cancelled', 'dns'
  priority VARCHAR(20) DEFAULT 'A', -- 'A' (principal), 'B' (secundaria), 'C' (preparatoria)

  -- Metadatos
  notes TEXT, -- Notas generales
  registration_url TEXT,
  registration_deadline DATE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_competitions_athlete ON competitions(athlete_id);
CREATE INDEX idx_competitions_coach ON competitions(coach_id);
CREATE INDEX idx_competitions_date ON competitions(event_date);
CREATE INDEX idx_competitions_status ON competitions(status);

-- =============================================
-- TRIGGER for updated_at
-- =============================================

CREATE TRIGGER update_competitions_updated_at
  BEFORE UPDATE ON competitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;

-- Coaches can manage competitions for their athletes
CREATE POLICY "Coaches can view their athletes competitions"
  ON competitions FOR SELECT
  USING (
    coach_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = competitions.athlete_id
        AND car.coach_id = (SELECT auth.uid())
        AND car.status = 'active'
    )
  );

CREATE POLICY "Coaches can insert competitions for their athletes"
  ON competitions FOR INSERT
  WITH CHECK (
    coach_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = competitions.athlete_id
        AND car.coach_id = (SELECT auth.uid())
        AND car.status = 'active'
    )
  );

CREATE POLICY "Coaches can update their competitions"
  ON competitions FOR UPDATE
  USING (coach_id = (SELECT auth.uid()))
  WITH CHECK (coach_id = (SELECT auth.uid()));

CREATE POLICY "Coaches can delete their competitions"
  ON competitions FOR DELETE
  USING (coach_id = (SELECT auth.uid()));

-- Athletes can view their own competitions
CREATE POLICY "Athletes can view their own competitions"
  ON competitions FOR SELECT
  USING (athlete_id = (SELECT auth.uid()));

-- Athletes can update results of their own competitions
CREATE POLICY "Athletes can update their competition results"
  ON competitions FOR UPDATE
  USING (athlete_id = (SELECT auth.uid()))
  WITH CHECK (athlete_id = (SELECT auth.uid()));

-- =============================================
-- SUCCESS MESSAGE
-- =============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Competitions table created successfully!';
  RAISE NOTICE '📊 Indexes and RLS policies applied';
END $$;

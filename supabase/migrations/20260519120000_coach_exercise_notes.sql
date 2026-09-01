-- Notas globales del coach sobre un ejercicio del banco (running o gym).
-- Una nota por (coach, ejercicio). La ven todos los atletas del coach activos.
-- Aplicada en prod (lusirdkixfliydimemre) el 2026-05-19 via apply_migration.

CREATE TABLE IF NOT EXISTS coach_exercise_notes (
  coach_id uuid NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  exercise_kind text NOT NULL CHECK (exercise_kind IN ('running','gym')),
  running_exercise_id uuid REFERENCES running_exercises_bank(id) ON DELETE CASCADE,
  gym_exercise_id uuid REFERENCES gym_exercises_bank(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coach_exercise_notes_kind_fk_chk CHECK (
    (exercise_kind = 'running' AND running_exercise_id IS NOT NULL AND gym_exercise_id IS NULL)
    OR
    (exercise_kind = 'gym' AND gym_exercise_id IS NOT NULL AND running_exercise_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS coach_exercise_notes_running_uniq
  ON coach_exercise_notes (coach_id, running_exercise_id)
  WHERE running_exercise_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS coach_exercise_notes_gym_uniq
  ON coach_exercise_notes (coach_id, gym_exercise_id)
  WHERE gym_exercise_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS coach_exercise_notes_coach_idx
  ON coach_exercise_notes (coach_id);

CREATE OR REPLACE FUNCTION coach_exercise_notes_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coach_exercise_notes_touch_trg ON coach_exercise_notes;
CREATE TRIGGER coach_exercise_notes_touch_trg
  BEFORE UPDATE ON coach_exercise_notes
  FOR EACH ROW EXECUTE FUNCTION coach_exercise_notes_touch();

ALTER TABLE coach_exercise_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY coach_exercise_notes_select ON coach_exercise_notes
  FOR SELECT
  USING (
    coach_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = (SELECT auth.uid())
        AND car.coach_id = coach_exercise_notes.coach_id
        AND car.status = 'active'::relationship_status
    )
  );

CREATE POLICY coach_exercise_notes_insert ON coach_exercise_notes
  FOR INSERT
  WITH CHECK (coach_id = (SELECT auth.uid()));

CREATE POLICY coach_exercise_notes_update ON coach_exercise_notes
  FOR UPDATE
  USING (coach_id = (SELECT auth.uid()))
  WITH CHECK (coach_id = (SELECT auth.uid()));

CREATE POLICY coach_exercise_notes_delete ON coach_exercise_notes
  FOR DELETE
  USING (coach_id = (SELECT auth.uid()));

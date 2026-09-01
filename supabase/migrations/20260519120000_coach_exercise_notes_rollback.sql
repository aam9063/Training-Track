-- Rollback de coach_exercise_notes.
DROP TRIGGER IF EXISTS coach_exercise_notes_touch_trg ON coach_exercise_notes;
DROP FUNCTION IF EXISTS coach_exercise_notes_touch();
DROP TABLE IF EXISTS coach_exercise_notes;

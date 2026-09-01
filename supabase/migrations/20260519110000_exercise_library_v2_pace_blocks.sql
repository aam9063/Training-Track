-- Exercise library v2 — anade categoria 'pace_blocks' al enum running_category.
-- Aplicada en prod (lusirdkixfliydimemre) el 2026-05-19 via apply_migration.
-- Para: ejercicios tipo "Ritmos" con bloques de ritmo alternados (ej. 2km 60% + 1km 80% + 2km 60% + 1km 80%).

ALTER TYPE running_category ADD VALUE IF NOT EXISTS 'pace_blocks';

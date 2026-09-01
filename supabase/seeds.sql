-- ============================================
-- TRACKPRO - SEEDS v2.0
-- Banco de ejercicios SIN ritmos pre-asignados
-- Los ritmos (R) se asignan al planificar
-- ============================================

-- ============================================
-- EJERCICIOS DE RUNNING
-- Sin pace fijo - El entrenador asigna el R al planificar
-- ============================================

-- ========== SERIES CORTAS (Tecnica/Velocidad) 80-150m ==========
INSERT INTO running_exercises_bank (name, category, distance_meters, default_reps, default_rest_seconds, description)
VALUES
  ('Series de 80m', 'series_short', 80, 6, 60, 'Series cortas progresivas despues de rodaje'),
  ('Series de 100m', 'series_short', 100, 6, 90, 'Series cortas progresivas despues de rodaje'),
  ('Series de 120m', 'series_short', 120, 8, 90, 'Series cortas de velocidad'),
  ('Series de 150m', 'series_short', 150, 8, 120, 'Series cortas de velocidad');

-- ========== SERIES MEDIAS (200m - 1000m) ==========
INSERT INTO running_exercises_bank (name, category, distance_meters, default_reps, default_rest_seconds, description)
VALUES
  ('Series de 200m', 'series_medium', 200, 10, 60, 'Series de 200 metros'),
  ('Series de 300m', 'series_medium', 300, 8, 90, 'Series de 300 metros'),
  ('Series de 400m', 'series_medium', 400, 8, 120, 'Series de 400 metros'),
  ('Series de 500m', 'series_medium', 500, 6, 120, 'Series de 500 metros'),
  ('Series de 600m', 'series_medium', 600, 6, 150, 'Series de 600 metros'),
  ('Series de 800m', 'series_medium', 800, 6, 180, 'Series de 800 metros - base para test de Conconi'),
  ('Series de 1000m', 'series_medium', 1000, 5, 180, 'Series de 1000 metros');

-- ========== SERIES LARGAS (1500m+) ==========
INSERT INTO running_exercises_bank (name, category, distance_meters, default_reps, default_rest_seconds, description)
VALUES
  ('Series de 1500m', 'series_long', 1500, 4, 240, 'Series de 1500 metros'),
  ('Series de 2000m', 'series_long', 2000, 4, 300, 'Series de 2000 metros'),
  ('Series de 3000m', 'series_long', 3000, 3, 300, 'Series de 3000 metros'),
  ('Series de 4000m', 'series_long', 4000, 2, 360, 'Series de 4000 metros'),
  ('Series de 5000m', 'series_long', 5000, 2, 420, 'Series de 5000 metros');

-- ========== RODAJES DE CALENTAMIENTO (3-5km) ==========
INSERT INTO running_exercises_bank (name, category, distance_meters, default_reps, description)
VALUES
  ('Rodaje de calentamiento 3km', 'warmup_run', 3000, 1, 'Rodaje suave de calentamiento'),
  ('Rodaje de calentamiento 4km', 'warmup_run', 4000, 1, 'Rodaje suave de calentamiento'),
  ('Rodaje de calentamiento 5km', 'warmup_run', 5000, 1, 'Rodaje suave de calentamiento');

-- ========== RODAJES NORMALES (4-10km) ==========
INSERT INTO running_exercises_bank (name, category, distance_meters, default_reps, description)
VALUES
  ('Rodaje 4km', 'easy_run', 4000, 1, 'Rodaje continuo 4km'),
  ('Rodaje 5km', 'easy_run', 5000, 1, 'Rodaje continuo 5km'),
  ('Rodaje 6km', 'easy_run', 6000, 1, 'Rodaje continuo 6km'),
  ('Rodaje 7km', 'easy_run', 7000, 1, 'Rodaje continuo 7km'),
  ('Rodaje 8km', 'easy_run', 8000, 1, 'Rodaje continuo 8km'),
  ('Rodaje 9km', 'easy_run', 9000, 1, 'Rodaje continuo 9km'),
  ('Rodaje 10km', 'easy_run', 10000, 1, 'Rodaje continuo 10km');

-- ========== TIRADAS LARGAS (12-32km) ==========
INSERT INTO running_exercises_bank (name, category, distance_meters, default_reps, description)
VALUES
  ('Tirada larga 12km', 'long_run', 12000, 1, 'Tirada larga dominical'),
  ('Tirada larga 14km', 'long_run', 14000, 1, 'Tirada larga dominical'),
  ('Tirada larga 16km', 'long_run', 16000, 1, 'Tirada larga dominical'),
  ('Tirada larga 18km', 'long_run', 18000, 1, 'Tirada larga dominical'),
  ('Tirada larga 20km', 'long_run', 20000, 1, 'Tirada larga dominical'),
  ('Tirada larga 22km', 'long_run', 22000, 1, 'Tirada larga dominical'),
  ('Tirada larga 24km', 'long_run', 24000, 1, 'Tirada larga dominical'),
  ('Tirada larga 26km', 'long_run', 26000, 1, 'Tirada larga dominical'),
  ('Tirada larga 28km', 'long_run', 28000, 1, 'Tirada larga dominical'),
  ('Tirada larga 30km', 'long_run', 30000, 1, 'Tirada larga dominical'),
  ('Tirada larga 32km', 'long_run', 32000, 1, 'Tirada larga dominical');

-- ========== FARTLEKS POR TIEMPO ==========
-- Los segmentos especificos se crearan en fartlek_segments al planificar
INSERT INTO running_exercises_bank (name, category, duration_seconds, default_reps, description)
VALUES
  ('Fartlek 20 minutos', 'fartlek_time', 1200, 1, 'Cambios de ritmo por tiempo durante 20 minutos'),
  ('Fartlek 30 minutos', 'fartlek_time', 1800, 1, 'Cambios de ritmo por tiempo durante 30 minutos'),
  ('Fartlek 40 minutos', 'fartlek_time', 2400, 1, 'Cambios de ritmo por tiempo durante 40 minutos'),
  ('Fartlek 50 minutos', 'fartlek_time', 3000, 1, 'Cambios de ritmo por tiempo durante 50 minutos'),
  ('Fartlek 60 minutos', 'fartlek_time', 3600, 1, 'Cambios de ritmo por tiempo durante 60 minutos');

-- ========== FARTLEKS POR DISTANCIA ==========
INSERT INTO running_exercises_bank (name, category, distance_meters, default_reps, description)
VALUES
  ('Fartlek 5km', 'fartlek_distance', 5000, 1, 'Cambios de ritmo por distancia - 5km total'),
  ('Fartlek 6km', 'fartlek_distance', 6000, 1, 'Cambios de ritmo por distancia - 6km total'),
  ('Fartlek 8km', 'fartlek_distance', 8000, 1, 'Cambios de ritmo por distancia - 8km total'),
  ('Fartlek 10km', 'fartlek_distance', 10000, 1, 'Cambios de ritmo por distancia - 10km total');

-- ========== CUESTAS ==========
INSERT INTO running_exercises_bank (name, category, distance_meters, default_reps, default_rest_seconds, description)
VALUES
  ('Cuestas 100m', 'hill_repeats', 100, 10, 120, 'Repeticiones de cuestas de 100m'),
  ('Cuestas 150m', 'hill_repeats', 150, 8, 150, 'Repeticiones de cuestas de 150m'),
  ('Cuestas 200m', 'hill_repeats', 200, 8, 180, 'Repeticiones de cuestas de 200m'),
  ('Cuestas 300m', 'hill_repeats', 300, 6, 180, 'Repeticiones de cuestas de 300m'),
  ('Cuestas 400m', 'hill_repeats', 400, 6, 240, 'Repeticiones de cuestas de 400m');

-- ============================================
-- EJERCICIOS DE GIMNASIO
-- ============================================

-- ========== FUERZA MAXIMA (MAX STRENGTH) ==========
INSERT INTO gym_exercises_bank (name, category, muscle_groups, equipment, description)
VALUES
  ('Sentadillas', 'max_strength', ARRAY['legs', 'core'], ARRAY['barbell', 'rack'], 'Sentadillas traseras con barra'),
  ('Sentadillas frontales', 'max_strength', ARRAY['legs', 'core'], ARRAY['barbell', 'rack'], 'Sentadillas frontales con barra'),
  ('Cargada (Clean)', 'max_strength', ARRAY['legs', 'back', 'shoulders'], ARRAY['barbell'], 'Cargada olimpica completa'),
  ('Cargada de potencia', 'max_strength', ARRAY['legs', 'back', 'shoulders'], ARRAY['barbell'], 'Cargada de potencia (power clean)'),
  ('Envion (Jerk)', 'max_strength', ARRAY['legs', 'shoulders', 'arms'], ARRAY['barbell'], 'Envion desde los hombros'),
  ('Press banca', 'max_strength', ARRAY['chest', 'shoulders', 'arms'], ARRAY['barbell', 'bench'], 'Press de banca horizontal'),
  ('Subida al cajon', 'max_strength', ARRAY['legs', 'glutes'], ARRAY['box', 'dumbbells'], 'Step-ups con peso en cajon'),
  ('Prensa', 'max_strength', ARRAY['legs', 'glutes'], ARRAY['machine'], 'Prensa de piernas'),
  ('Puntillas de gemelos', 'max_strength', ARRAY['calves'], ARRAY['barbell', 'machine'], 'Elevaciones de gemelos con peso');

-- ========== FUERZA GENERAL (GENERAL STRENGTH) ==========
INSERT INTO gym_exercises_bank (name, category, muscle_groups, equipment, description)
VALUES
  ('Extensiones de cuadriceps', 'general_strength', ARRAY['legs'], ARRAY['machine'], 'Extensiones de rodilla en maquina'),
  ('Curl femoral', 'general_strength', ARRAY['legs'], ARRAY['machine'], 'Curl femoral tumbado'),
  ('Curl femoral sentado', 'general_strength', ARRAY['legs'], ARRAY['machine'], 'Curl femoral en posicion sentada'),
  ('Jalon al pecho', 'general_strength', ARRAY['back', 'arms'], ARRAY['cable', 'machine'], 'Jalon con agarre amplio'),
  ('Jalon agarre neutro', 'general_strength', ARRAY['back', 'arms'], ARRAY['cable', 'machine'], 'Jalon con agarre paralelo'),
  ('Press de hombros', 'general_strength', ARRAY['shoulders', 'arms'], ARRAY['dumbbells', 'barbell'], 'Press militar de hombros'),
  ('Press Arnold', 'general_strength', ARRAY['shoulders'], ARRAY['dumbbells'], 'Press de hombros con rotacion'),
  ('Elevaciones laterales', 'general_strength', ARRAY['shoulders'], ARRAY['dumbbells'], 'Elevaciones laterales de hombros'),
  ('Psoas', 'general_strength', ARRAY['core', 'hip_flexors'], ARRAY['bodyweight'], 'Elevaciones de rodilla colgado o en paralelas'),
  ('Psoas en banco', 'general_strength', ARRAY['core', 'hip_flexors'], ARRAY['bench'], 'Elevaciones de piernas en banco'),
  ('Patada de gluteo', 'general_strength', ARRAY['glutes'], ARRAY['machine', 'cable'], 'Extension de cadera (glute kickback)'),
  ('Hip thrust', 'general_strength', ARRAY['glutes', 'legs'], ARRAY['barbell', 'bench'], 'Empuje de cadera con barra'),
  ('Peso muerto rumano', 'general_strength', ARRAY['legs', 'back', 'glutes'], ARRAY['barbell'], 'Romanian deadlift'),
  ('Zancadas', 'general_strength', ARRAY['legs', 'glutes'], ARRAY['dumbbells', 'barbell'], 'Lunges o zancadas'),
  ('Zancadas bulgaras', 'general_strength', ARRAY['legs', 'glutes'], ARRAY['dumbbells'], 'Split squats con pierna trasera elevada'),
  ('Abdominales', 'general_strength', ARRAY['core'], ARRAY['bodyweight'], 'Crunch abdominal'),
  ('Plancha frontal', 'general_strength', ARRAY['core'], ARRAY['bodyweight'], 'Plank estatico'),
  ('Plancha lateral', 'general_strength', ARRAY['core'], ARRAY['bodyweight'], 'Side plank estatico'),
  ('Remo con mancuerna', 'general_strength', ARRAY['back', 'arms'], ARRAY['dumbbell'], 'Remo a una mano apoyado'),
  ('Remo en polea baja', 'general_strength', ARRAY['back', 'arms'], ARRAY['cable', 'machine'], 'Remo sentado en polea'),
  ('Aductores', 'general_strength', ARRAY['legs'], ARRAY['machine'], 'Ejercicio de aductores en maquina'),
  ('Abductores', 'general_strength', ARRAY['legs'], ARRAY['machine'], 'Ejercicio de abductores en maquina');

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
DECLARE
  running_count INTEGER;
  gym_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO running_count FROM running_exercises_bank;
  SELECT COUNT(*) INTO gym_count FROM gym_exercises_bank;

  RAISE NOTICE '============================================';
  RAISE NOTICE 'Seeds v2.0 cargados correctamente!';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Ejercicios de running: %', running_count;
  RAISE NOTICE 'Ejercicios de gimnasio: %', gym_count;
  RAISE NOTICE 'Total: %', running_count + gym_count;
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'RESUMEN DE CATEGORIAS:';
  RAISE NOTICE '  Running:';
  RAISE NOTICE '    - series_short (80-150m)';
  RAISE NOTICE '    - series_medium (200-1000m)';
  RAISE NOTICE '    - series_long (1500-5000m)';
  RAISE NOTICE '    - warmup_run (calentamiento 3-5km)';
  RAISE NOTICE '    - easy_run (rodajes 4-10km)';
  RAISE NOTICE '    - long_run (tiradas largas 12-32km)';
  RAISE NOTICE '    - fartlek_time (fartleks por tiempo)';
  RAISE NOTICE '    - fartlek_distance (fartleks por distancia)';
  RAISE NOTICE '    - hill_repeats (cuestas)';
  RAISE NOTICE '';
  RAISE NOTICE '  Gimnasio:';
  RAISE NOTICE '    - max_strength (fuerza maxima)';
  RAISE NOTICE '    - general_strength (fuerza general)';
  RAISE NOTICE '============================================';
END $$;

-- ============================================
-- NOTA IMPORTANTE:
-- ============================================
-- Los ejercicios NO tienen pace_code pre-asignado.
-- El entrenador asigna el ritmo (R1-R10) al momento
-- de planificar cada sesion de entrenamiento.
--
-- Los segmentos de fartlek se crean dinamicamente
-- en la tabla fartlek_segments cuando se planifica.
-- ============================================

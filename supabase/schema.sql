-- =============================================
-- TrackPro Database Schema v2.0
-- Basado en AthleteHub con mejoras
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- ENUM TYPES
-- =============================================

CREATE TYPE user_role AS ENUM ('coach', 'athlete');

CREATE TYPE device_type AS ENUM (
  'garmin', 'coros', 'polar', 'suunto', 'wahoo', 'apple_watch', 'other'
);

CREATE TYPE training_type AS ENUM (
  'running', 'gym', 'rest', 'cross_training'
);

CREATE TYPE training_status AS ENUM (
  'planned', 'in_progress', 'completed', 'skipped'
);

CREATE TYPE effort_level AS ENUM (
  'very_light', 'light', 'moderate', 'hard', 'very_hard', 'maximum'
);

CREATE TYPE running_category AS ENUM (
  'series_short',      -- 80m-150m
  'series_medium',     -- 200m-1000m
  'series_long',       -- 1500m-5000m
  'warmup_run',        -- 3-5km
  'easy_run',          -- 4-10km
  'long_run',          -- 12-32km
  'tempo_run',         -- Ritmo controlado
  'fartlek_time',      -- Por tiempo
  'fartlek_distance',  -- Por distancia
  'hill_repeats',      -- Cuestas
  'recovery_run',      -- Regenerativo
  'race',              -- Competición
  'test'               -- Test (Conconi, etc.)
);

CREATE TYPE gym_category AS ENUM (
  'max_strength',      -- Fuerza máxima
  'general_strength',  -- Fuerza general
  'core',              -- Core/abdominales
  'mobility',          -- Movilidad/flexibilidad
  'plyometrics'        -- Pliometría
);

CREATE TYPE relationship_status AS ENUM (
  'pending', 'active', 'inactive'
);

-- =============================================
-- USERS TABLE (Base para todos los usuarios)
-- =============================================

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255), -- Solo si no usan OAuth
  role user_role NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  profile_image TEXT,
  phone VARCHAR(20),
  email_verified BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- COACHES TABLE
-- =============================================

CREATE TABLE coaches (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  specialties VARCHAR(50)[] DEFAULT '{}', -- ['middle-distance', 'marathon', etc.]
  certifications JSONB DEFAULT '{}',
  years_experience INTEGER DEFAULT 0,
  max_athletes INTEGER DEFAULT 10, -- Según plan de suscripción
  subscription_plan VARCHAR(50) DEFAULT 'starter',
  subscription_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- ATHLETES TABLE
-- =============================================

CREATE TABLE athletes (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  date_of_birth DATE,
  gender VARCHAR(20),
  height DECIMAL(5,2), -- cm
  weight DECIMAL(5,2), -- kg
  specialties VARCHAR(50)[] DEFAULT '{}', -- ['800m', '1500m', etc.]

  -- Datos fisiológicos
  vo2_max DECIMAL(5,2),
  resting_heart_rate INTEGER,
  max_heart_rate INTEGER,
  lactate_threshold_hr INTEGER,
  lactate_threshold_pace INTEGER, -- segundos por km

  -- Preferencias
  preferred_training_days INTEGER[] DEFAULT '{1,2,3,4,5}', -- 1=Lunes
  notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- COACH-ATHLETE RELATIONSHIP
-- =============================================

CREATE TABLE coach_athlete_relationship (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  status relationship_status DEFAULT 'pending',
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(coach_id, athlete_id)
);

-- =============================================
-- ATHLETE PACES (Ritmos R1-R10 del Test Conconi)
-- =============================================

CREATE TABLE athlete_paces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  pace_code VARCHAR(10) NOT NULL, -- 'RR', 'R1', 'R2', ..., 'R10'
  pace_seconds_per_km INTEGER NOT NULL, -- Ritmo en seg/km
  heart_rate_min INTEGER,
  heart_rate_max INTEGER,
  description TEXT,
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_until DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(athlete_id, pace_code, valid_from)
);

-- =============================================
-- CONCONI TESTS
-- =============================================

CREATE TABLE conconi_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES coaches(id) ON DELETE SET NULL,
  test_date DATE NOT NULL,
  location VARCHAR(255),
  weather_conditions TEXT,
  notes TEXT,

  -- Resultados calculados
  deflection_point_hr INTEGER, -- FC del punto de deflexión
  deflection_point_pace INTEGER, -- Ritmo del punto de deflexión (seg/km)
  max_hr_reached INTEGER,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE conconi_test_series (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID NOT NULL REFERENCES conconi_tests(id) ON DELETE CASCADE,
  series_number INTEGER NOT NULL,
  distance_meters INTEGER DEFAULT 200,
  time_seconds INTEGER NOT NULL,
  heart_rate INTEGER NOT NULL,
  recovery_time_seconds INTEGER, -- Tiempo para bajar a 120 ppm
  max_heart_rate_reached BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(test_id, series_number)
);

-- =============================================
-- PERSONAL BESTS (Marcas Personales)
-- =============================================

CREATE TABLE personal_bests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  distance VARCHAR(50) NOT NULL, -- '800m', '1500m', '5k', 'half-marathon', 'marathon'
  time_seconds INTEGER NOT NULL,
  date DATE,
  location VARCHAR(255),
  race_name VARCHAR(255),
  official BOOLEAN DEFAULT FALSE, -- Homologada
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(athlete_id, distance, date)
);

-- =============================================
-- RUNNING EXERCISES BANK
-- =============================================

CREATE TABLE running_exercises_bank (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  category running_category NOT NULL,
  description TEXT,

  -- Distancia O Duración (mutuamente excluyentes)
  distance_meters INTEGER,
  duration_seconds INTEGER,

  -- Para series
  default_sets INTEGER,
  default_reps INTEGER,
  default_rest_seconds INTEGER,

  -- Metadata
  pace_description TEXT, -- Descripción del ritmo (ej: "ritmo de umbral")
  is_custom BOOLEAN DEFAULT FALSE,
  coach_id UUID REFERENCES coaches(id) ON DELETE CASCADE, -- NULL = ejercicio global

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- GYM EXERCISES BANK
-- =============================================

CREATE TABLE gym_exercises_bank (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  category gym_category NOT NULL,
  description TEXT,
  muscle_groups VARCHAR(50)[] DEFAULT '{}',
  equipment VARCHAR(50)[] DEFAULT '{}',
  video_url TEXT,
  image_url TEXT,

  -- Defaults
  default_sets INTEGER,
  default_reps INTEGER,
  default_rest_seconds INTEGER,

  is_custom BOOLEAN DEFAULT FALSE,
  coach_id UUID REFERENCES coaches(id) ON DELETE CASCADE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TRAINING PLANS
-- =============================================

CREATE TABLE training_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  athlete_id UUID REFERENCES athletes(id) ON DELETE CASCADE, -- NULL = plantilla
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Objetivo
  target_race VARCHAR(100),
  race_date DATE,
  race_name VARCHAR(255),

  -- Duración
  start_date DATE,
  end_date DATE,
  weeks INTEGER,

  is_template BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TRAINING SESSIONS
-- =============================================

CREATE TABLE training_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES training_plans(id) ON DELETE SET NULL,
  coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,

  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  training_type training_type NOT NULL,
  status training_status DEFAULT 'planned',

  title VARCHAR(255) NOT NULL,
  description TEXT,
  notes_coach TEXT, -- Instrucciones del coach
  notes_athlete TEXT, -- Feedback del atleta

  -- Duración
  estimated_duration_minutes INTEGER,
  actual_duration_minutes INTEGER,

  -- Completado
  completed_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TRAINING SESSION EXERCISES
-- =============================================

CREATE TABLE training_session_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  exercise_order INTEGER NOT NULL,

  -- Referencia al ejercicio (uno u otro)
  running_exercise_id UUID REFERENCES running_exercises_bank(id) ON DELETE SET NULL,
  gym_exercise_id UUID REFERENCES gym_exercises_bank(id) ON DELETE SET NULL,

  -- Ritmo asignado dinámicamente (para running)
  pace_code VARCHAR(10), -- 'R5', 'R8', etc.
  pace_description TEXT, -- 'progresivo', 'últimos 2 más rápidos'
  target_heart_rate_min INTEGER,
  target_heart_rate_max INTEGER,

  -- Planificado
  planned_sets INTEGER,
  planned_reps INTEGER,
  planned_distance_meters INTEGER,
  planned_duration_seconds INTEGER,
  planned_weight_kg DECIMAL(5,2), -- Para gym
  rest_seconds INTEGER,

  -- Completado
  completed_sets INTEGER,
  completed_reps INTEGER,
  completed_distance_meters INTEGER,
  completed_duration_seconds INTEGER,
  completed_weight_kg DECIMAL(5,2),

  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT one_exercise_type CHECK (
    (running_exercise_id IS NOT NULL AND gym_exercise_id IS NULL) OR
    (running_exercise_id IS NULL AND gym_exercise_id IS NOT NULL) OR
    (running_exercise_id IS NULL AND gym_exercise_id IS NULL)
  )
);

-- =============================================
-- FARTLEK SEGMENTS (Para fartleks complejos)
-- =============================================

CREATE TABLE fartlek_segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_exercise_id UUID NOT NULL REFERENCES training_session_exercises(id) ON DELETE CASCADE,
  segment_order INTEGER NOT NULL,

  -- Por distancia O por tiempo
  distance_meters INTEGER,
  duration_seconds INTEGER,

  -- Ritmo del segmento
  pace_code VARCHAR(10),
  target_heart_rate_min INTEGER,
  target_heart_rate_max INTEGER,

  -- Valores completados
  completed_distance_meters INTEGER,
  completed_duration_seconds INTEGER,
  avg_heart_rate INTEGER,
  max_heart_rate INTEGER,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_exercise_id, segment_order)
);

-- =============================================
-- TRAINING METRICS (Métricas de sesión completada)
-- =============================================

CREATE TABLE training_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,

  -- Métricas de rendimiento
  total_distance_meters INTEGER,
  total_duration_seconds INTEGER,
  average_pace_seconds INTEGER, -- seg/km
  best_pace_seconds INTEGER,

  -- Cardio
  average_heart_rate INTEGER,
  max_heart_rate INTEGER,
  heart_rate_zones JSONB, -- {"z1": 10, "z2": 25, "z3": 15, ...}

  -- Otros
  calories_burned INTEGER,
  elevation_gain INTEGER,
  elevation_loss INTEGER,
  cadence_avg INTEGER,
  stride_length_avg DECIMAL(4,2), -- metros
  ground_contact_time_avg INTEGER, -- ms
  vertical_oscillation_avg DECIMAL(4,2), -- cm

  -- RPE y sensaciones
  rpe_score INTEGER CHECK (rpe_score BETWEEN 1 AND 10),
  perceived_effort effort_level,
  muscle_soreness INTEGER CHECK (muscle_soreness BETWEEN 1 AND 10),
  mood_rating INTEGER CHECK (mood_rating BETWEEN 1 AND 10),
  sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 10),
  sleep_hours DECIMAL(3,1),
  stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 10),

  -- Datos externos (Garmin, etc.)
  external_activity_id VARCHAR(255),
  external_source device_type,
  raw_data JSONB,

  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- ANALYTICS WEEKLY SUMMARY
-- =============================================

CREATE TABLE analytics_weekly_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  week_start DATE NOT NULL, -- Siempre lunes

  -- Volumen
  total_distance_km DECIMAL(6,2),
  total_duration_hours DECIMAL(5,2),
  total_sessions INTEGER,
  completed_sessions INTEGER,
  skipped_sessions INTEGER,

  -- Intensidad
  avg_pace_seconds INTEGER,
  fastest_pace_seconds INTEGER,
  avg_heart_rate INTEGER,
  max_heart_rate INTEGER,

  -- Carga de entrenamiento
  training_load DECIMAL(8,2), -- Σ(duración × RPE)
  acute_load DECIMAL(8,2), -- Última semana
  chronic_load DECIMAL(8,2), -- Promedio 4 semanas
  acwr DECIMAL(4,2), -- Acute:Chronic Workload Ratio

  -- Bienestar promedio
  avg_rpe DECIMAL(3,1),
  avg_sleep_quality DECIMAL(3,1),
  avg_stress_level DECIMAL(3,1),
  avg_mood DECIMAL(3,1),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(athlete_id, week_start)
);

-- =============================================
-- RACE PREDICTIONS (Predicciones de tiempos)
-- =============================================

CREATE TABLE race_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Basado en
  based_on_distance VARCHAR(50), -- La distancia usada para calcular
  based_on_time_seconds INTEGER,
  vdot DECIMAL(5,2),

  -- Predicciones
  predicted_800m INTEGER,
  predicted_1500m INTEGER,
  predicted_3000m INTEGER,
  predicted_5k INTEGER,
  predicted_10k INTEGER,
  predicted_half_marathon INTEGER,
  predicted_marathon INTEGER,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- DEVICES (Dispositivos conectados)
-- =============================================

CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  device_type device_type NOT NULL,
  device_name VARCHAR(255),

  -- OAuth tokens
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,

  -- Sync
  last_sync TIMESTAMP WITH TIME ZONE,
  sync_enabled BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(athlete_id, device_type)
);

-- =============================================
-- MESSAGES (Chat coach-atleta)
-- =============================================

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- COMMENTS (Comentarios en sesiones)
-- =============================================

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- NOTIFICATIONS
-- =============================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'session_reminder', 'comment', 'invitation', etc.
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSONB, -- Datos adicionales
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Athletes
CREATE INDEX idx_athletes_specialties ON athletes USING GIN(specialties);

-- Relationships
CREATE INDEX idx_car_coach ON coach_athlete_relationship(coach_id);
CREATE INDEX idx_car_athlete ON coach_athlete_relationship(athlete_id);
CREATE INDEX idx_car_status ON coach_athlete_relationship(status);

-- Training sessions
CREATE INDEX idx_sessions_athlete ON training_sessions(athlete_id);
CREATE INDEX idx_sessions_coach ON training_sessions(coach_id);
CREATE INDEX idx_sessions_date ON training_sessions(scheduled_date);
CREATE INDEX idx_sessions_status ON training_sessions(status);

-- Session exercises
CREATE INDEX idx_session_exercises_session ON training_session_exercises(session_id);

-- Training metrics
CREATE INDEX idx_metrics_athlete ON training_metrics(athlete_id);
CREATE INDEX idx_metrics_session ON training_metrics(session_id);

-- Messages
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- Notifications
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read_at);

-- Personal bests
CREATE INDEX idx_pb_athlete ON personal_bests(athlete_id);

-- Analytics
CREATE INDEX idx_analytics_athlete ON analytics_weekly_summary(athlete_id);
CREATE INDEX idx_analytics_week ON analytics_weekly_summary(week_start);

-- Exercise banks
CREATE INDEX idx_running_exercises_category ON running_exercises_bank(category);
CREATE INDEX idx_gym_exercises_category ON gym_exercises_bank(category);
CREATE INDEX idx_gym_exercises_muscles ON gym_exercises_bank USING GIN(muscle_groups);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Calcular ritmo (pace)
CREATE OR REPLACE FUNCTION calculate_pace(distance_meters INTEGER, duration_seconds INTEGER)
RETURNS INTEGER AS $$
BEGIN
  IF distance_meters IS NULL OR distance_meters = 0 THEN
    RETURN NULL;
  END IF;
  RETURN (duration_seconds * 1000) / distance_meters;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Obtener carga de entrenamiento semanal
CREATE OR REPLACE FUNCTION get_weekly_training_load(p_athlete_id UUID, p_week_start DATE)
RETURNS DECIMAL AS $$
DECLARE
  v_load DECIMAL;
BEGIN
  SELECT COALESCE(SUM(
    COALESCE(tm.total_duration_seconds / 60.0, ts.actual_duration_minutes, ts.estimated_duration_minutes, 0)
    * COALESCE(tm.rpe_score, 5)
  ), 0)
  INTO v_load
  FROM training_sessions ts
  LEFT JOIN training_metrics tm ON ts.id = tm.session_id
  WHERE ts.athlete_id = p_athlete_id
    AND ts.scheduled_date >= p_week_start
    AND ts.scheduled_date < p_week_start + INTERVAL '7 days'
    AND ts.status = 'completed';

  RETURN v_load;
END;
$$ LANGUAGE plpgsql;

-- Función para manejar nuevo usuario
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insertar en users
  INSERT INTO users (id, email, role, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'athlete'),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );

  -- Si es coach, crear registro en coaches
  IF (NEW.raw_user_meta_data->>'role') = 'coach' THEN
    INSERT INTO coaches (id) VALUES (NEW.id);
  END IF;

  -- Si es athlete, crear registro en athletes
  IF (NEW.raw_user_meta_data->>'role') = 'athlete' THEN
    INSERT INTO athletes (id) VALUES (NEW.id);

    -- Si proporcionó email del coach, crear invitación
    IF NEW.raw_user_meta_data->>'coach_email' IS NOT NULL THEN
      INSERT INTO coach_athlete_relationship (athlete_id, coach_id, status)
      SELECT NEW.id, c.id, 'pending'
      FROM coaches c
      JOIN users u ON c.id = u.id
      WHERE u.email = NEW.raw_user_meta_data->>'coach_email';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calcular ritmos desde test de Conconi
CREATE OR REPLACE FUNCTION calculate_conconi_paces(p_test_id UUID)
RETURNS VOID AS $$
DECLARE
  v_athlete_id UUID;
  v_deflection_hr INTEGER;
  v_deflection_pace INTEGER;
  v_max_hr INTEGER;
  v_rr_pace INTEGER;
  v_r10_pace INTEGER;
  i INTEGER;
BEGIN
  -- Obtener datos del test
  SELECT
    ct.athlete_id,
    ct.deflection_point_hr,
    ct.deflection_point_pace,
    ct.max_hr_reached
  INTO v_athlete_id, v_deflection_hr, v_deflection_pace, v_max_hr
  FROM conconi_tests ct
  WHERE ct.id = p_test_id;

  IF v_athlete_id IS NULL THEN
    RAISE EXCEPTION 'Test no encontrado';
  END IF;

  -- Si no hay punto de deflexión calculado, calcularlo
  IF v_deflection_hr IS NULL THEN
    -- Encontrar el punto donde la FC deja de subir linealmente
    SELECT
      cts.heart_rate,
      calculate_pace(cts.distance_meters, cts.time_seconds)
    INTO v_deflection_hr, v_deflection_pace
    FROM conconi_test_series cts
    WHERE cts.test_id = p_test_id
      AND cts.max_heart_rate_reached = TRUE
    ORDER BY cts.series_number
    LIMIT 1;
  END IF;

  -- Calcular ritmos (simplificado)
  -- RR = ritmo muy suave (60% esfuerzo)
  -- R10 = ritmo máximo

  -- Invalidar ritmos anteriores
  UPDATE athlete_paces
  SET valid_until = CURRENT_DATE - 1
  WHERE athlete_id = v_athlete_id AND valid_until IS NULL;

  -- Calcular R10 (el más rápido del test)
  SELECT calculate_pace(distance_meters, time_seconds)
  INTO v_r10_pace
  FROM conconi_test_series
  WHERE test_id = p_test_id
  ORDER BY time_seconds ASC
  LIMIT 1;

  -- RR es aproximadamente 40% más lento que R10
  v_rr_pace := v_r10_pace * 1.4;

  -- Insertar ritmos interpolados
  FOR i IN 0..10 LOOP
    INSERT INTO athlete_paces (athlete_id, pace_code, pace_seconds_per_km, description)
    VALUES (
      v_athlete_id,
      CASE WHEN i = 0 THEN 'RR' ELSE 'R' || i END,
      v_rr_pace - ((v_rr_pace - v_r10_pace) * i / 10),
      CASE
        WHEN i = 0 THEN 'Regenerativo'
        WHEN i <= 3 THEN 'Aeróbico suave'
        WHEN i <= 5 THEN 'Aeróbico medio'
        WHEN i <= 7 THEN 'Umbral'
        WHEN i <= 9 THEN 'VO2max'
        ELSE 'Máximo'
      END
    );
  END LOOP;

END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger para nuevos usuarios
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Triggers para updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coaches_updated_at BEFORE UPDATE ON coaches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_athletes_updated_at BEFORE UPDATE ON athletes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_car_updated_at BEFORE UPDATE ON coach_athlete_relationship
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_training_plans_updated_at BEFORE UPDATE ON training_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_training_sessions_updated_at BEFORE UPDATE ON training_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_personal_bests_updated_at BEFORE UPDATE ON personal_bests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analytics_updated_at BEFORE UPDATE ON analytics_weekly_summary
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- VIEWS
-- =============================================

-- Vista de atletas con su coach
CREATE VIEW athletes_with_coach AS
SELECT
  a.*,
  u.email,
  u.first_name,
  u.last_name,
  u.profile_image,
  car.coach_id,
  car.status as relationship_status,
  cu.first_name as coach_first_name,
  cu.last_name as coach_last_name
FROM athletes a
JOIN users u ON a.id = u.id
LEFT JOIN coach_athlete_relationship car ON a.id = car.athlete_id AND car.status = 'active'
LEFT JOIN users cu ON car.coach_id = cu.id;

-- Vista de resumen de entrenamientos por semana
CREATE VIEW athlete_training_summary AS
SELECT
  ts.athlete_id,
  DATE_TRUNC('week', ts.scheduled_date)::DATE as week_start,
  COUNT(*) as total_sessions,
  COUNT(*) FILTER (WHERE ts.status = 'completed') as completed_sessions,
  COUNT(*) FILTER (WHERE ts.status = 'skipped') as skipped_sessions,
  SUM(COALESCE(ts.actual_duration_minutes, ts.estimated_duration_minutes)) as total_minutes
FROM training_sessions ts
GROUP BY ts.athlete_id, DATE_TRUNC('week', ts.scheduled_date);

-- =============================================
-- SUCCESS MESSAGE
-- =============================================

DO $$
BEGIN
  RAISE NOTICE '✅ TrackPro schema v2.0 created successfully!';
  RAISE NOTICE '📊 Tables: users, coaches, athletes, training_sessions, etc.';
  RAISE NOTICE '🏃 Exercise banks ready for seeds';
  RAISE NOTICE '🔐 RLS policies pending (run rls_policies.sql next)';
END $$;

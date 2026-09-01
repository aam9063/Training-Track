-- =============================================
-- FIX: Consolidar políticas RLS para mejorar rendimiento
-- Problema: Múltiples políticas permissivas para la misma acción causan
--           que Supabase ejecute TODAS las políticas para cada query
-- Solución: Combinar políticas en una sola con OR
-- =============================================

-- =============================================
-- 1. ANALYTICS_WEEKLY_SUMMARY
-- Políticas actuales: analytics_select_by_coach, analytics_select_own
-- =============================================
DROP POLICY IF EXISTS "analytics_select_by_coach" ON public.analytics_weekly_summary;
DROP POLICY IF EXISTS "analytics_select_own" ON public.analytics_weekly_summary;

CREATE POLICY "analytics_select" ON public.analytics_weekly_summary
  FOR SELECT USING (
    -- El atleta puede ver sus propios analytics
    athlete_id = auth.uid()
    OR
    -- El coach puede ver analytics de sus atletas
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = analytics_weekly_summary.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'active'
    )
  );

-- =============================================
-- 2. ATHLETE_PACES
-- Políticas actuales: paces_select_by_coach, paces_select_own
-- =============================================
DROP POLICY IF EXISTS "paces_select_by_coach" ON public.athlete_paces;
DROP POLICY IF EXISTS "paces_select_own" ON public.athlete_paces;

CREATE POLICY "paces_select" ON public.athlete_paces
  FOR SELECT USING (
    athlete_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = athlete_paces.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'active'
    )
  );

-- =============================================
-- 3. CONCONI_TESTS
-- Políticas actuales: conconi_select_by_coach, conconi_select_own
-- =============================================
DROP POLICY IF EXISTS "conconi_select_by_coach" ON public.conconi_tests;
DROP POLICY IF EXISTS "conconi_select_own" ON public.conconi_tests;

CREATE POLICY "conconi_select" ON public.conconi_tests
  FOR SELECT USING (
    athlete_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = conconi_tests.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'active'
    )
  );

-- =============================================
-- 4. DEVICES
-- Políticas actuales: devices_select_by_coach, devices_select_own
-- =============================================
DROP POLICY IF EXISTS "devices_select_by_coach" ON public.devices;
DROP POLICY IF EXISTS "devices_select_own" ON public.devices;

CREATE POLICY "devices_select" ON public.devices
  FOR SELECT USING (
    athlete_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = devices.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'active'
    )
  );

-- =============================================
-- 5. GYM_EXERCISES_BANK
-- Políticas actuales: gym_ex_select_coach, gym_ex_select_global, gym_ex_select_own
-- =============================================
DROP POLICY IF EXISTS "gym_ex_select_coach" ON public.gym_exercises_bank;
DROP POLICY IF EXISTS "gym_ex_select_global" ON public.gym_exercises_bank;
DROP POLICY IF EXISTS "gym_ex_select_own" ON public.gym_exercises_bank;

CREATE POLICY "gym_ex_select" ON public.gym_exercises_bank
  FOR SELECT USING (
    -- Ejercicios globales (visibles para todos)
    is_global = true
    OR
    -- Ejercicios propios
    created_by = auth.uid()
    OR
    -- Ejercicios del coach del atleta
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = auth.uid()
        AND car.coach_id = gym_exercises_bank.created_by
        AND car.status = 'active'
    )
  );

-- =============================================
-- 6. PERSONAL_BESTS - SELECT
-- Políticas actuales: pb_select_by_coach, pb_select_own
-- =============================================
DROP POLICY IF EXISTS "pb_select_by_coach" ON public.personal_bests;
DROP POLICY IF EXISTS "pb_select_own" ON public.personal_bests;

CREATE POLICY "pb_select" ON public.personal_bests
  FOR SELECT USING (
    athlete_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = personal_bests.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'active'
    )
  );

-- PERSONAL_BESTS - INSERT
DROP POLICY IF EXISTS "pb_insert_coach" ON public.personal_bests;
DROP POLICY IF EXISTS "pb_insert_own" ON public.personal_bests;

CREATE POLICY "pb_insert" ON public.personal_bests
  FOR INSERT WITH CHECK (
    athlete_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = personal_bests.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'active'
    )
  );

-- =============================================
-- 7. RACE_PREDICTIONS - SELECT
-- Políticas actuales: predictions_select_by_coach, predictions_select_own
-- =============================================
DROP POLICY IF EXISTS "predictions_select_by_coach" ON public.race_predictions;
DROP POLICY IF EXISTS "predictions_select_own" ON public.race_predictions;

CREATE POLICY "predictions_select" ON public.race_predictions
  FOR SELECT USING (
    athlete_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = race_predictions.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'active'
    )
  );

-- RACE_PREDICTIONS - INSERT
DROP POLICY IF EXISTS "predictions_insert_coach" ON public.race_predictions;
DROP POLICY IF EXISTS "predictions_insert_own" ON public.race_predictions;

CREATE POLICY "predictions_insert" ON public.race_predictions
  FOR INSERT WITH CHECK (
    athlete_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = race_predictions.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'active'
    )
  );

-- =============================================
-- 8. RUNNING_EXERCISES_BANK
-- Políticas actuales: running_ex_select_coach, running_ex_select_global, running_ex_select_own
-- =============================================
DROP POLICY IF EXISTS "running_ex_select_coach" ON public.running_exercises_bank;
DROP POLICY IF EXISTS "running_ex_select_global" ON public.running_exercises_bank;
DROP POLICY IF EXISTS "running_ex_select_own" ON public.running_exercises_bank;

CREATE POLICY "running_ex_select" ON public.running_exercises_bank
  FOR SELECT USING (
    -- Ejercicios globales
    is_global = true
    OR
    -- Ejercicios propios
    created_by = auth.uid()
    OR
    -- Ejercicios del coach del atleta
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = auth.uid()
        AND car.coach_id = running_exercises_bank.created_by
        AND car.status = 'active'
    )
  );

-- =============================================
-- 9. TRAINING_METRICS - SELECT
-- Políticas actuales: metrics_select_by_coach, metrics_select_own
-- =============================================
DROP POLICY IF EXISTS "metrics_select_by_coach" ON public.training_metrics;
DROP POLICY IF EXISTS "metrics_select_own" ON public.training_metrics;

CREATE POLICY "metrics_select" ON public.training_metrics
  FOR SELECT USING (
    athlete_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = training_metrics.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'active'
    )
  );

-- TRAINING_METRICS - INSERT
DROP POLICY IF EXISTS "metrics_insert_coach" ON public.training_metrics;
DROP POLICY IF EXISTS "metrics_insert_own" ON public.training_metrics;

CREATE POLICY "metrics_insert" ON public.training_metrics
  FOR INSERT WITH CHECK (
    athlete_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = training_metrics.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'active'
    )
  );

-- =============================================
-- 10. TRAINING_PLANS
-- Políticas actuales: plans_select_athlete, plans_select_coach
-- =============================================
DROP POLICY IF EXISTS "plans_select_athlete" ON public.training_plans;
DROP POLICY IF EXISTS "plans_select_coach" ON public.training_plans;

CREATE POLICY "plans_select" ON public.training_plans
  FOR SELECT USING (
    -- El coach puede ver planes que ha creado
    coach_id = auth.uid()
    OR
    -- El atleta puede ver sus planes asignados
    athlete_id = auth.uid()
  );

-- =============================================
-- 11. TRAINING_SESSIONS - SELECT
-- Políticas actuales: sessions_select_athlete, sessions_select_coach
-- =============================================
DROP POLICY IF EXISTS "sessions_select_athlete" ON public.training_sessions;
DROP POLICY IF EXISTS "sessions_select_coach" ON public.training_sessions;

CREATE POLICY "sessions_select" ON public.training_sessions
  FOR SELECT USING (
    -- El atleta puede ver sus sesiones
    athlete_id = auth.uid()
    OR
    -- El coach puede ver sesiones de sus atletas
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = training_sessions.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'active'
    )
    OR
    -- El coach que creó el plan puede ver las sesiones
    EXISTS (
      SELECT 1 FROM training_plans tp
      WHERE tp.id = training_sessions.plan_id
        AND tp.coach_id = auth.uid()
    )
  );

-- TRAINING_SESSIONS - UPDATE
DROP POLICY IF EXISTS "sessions_update_athlete" ON public.training_sessions;
DROP POLICY IF EXISTS "sessions_update_coach" ON public.training_sessions;

CREATE POLICY "sessions_update" ON public.training_sessions
  FOR UPDATE USING (
    -- El atleta puede actualizar sus sesiones
    athlete_id = auth.uid()
    OR
    -- El coach puede actualizar sesiones de sus atletas
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = training_sessions.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'active'
    )
    OR
    -- El coach que creó el plan puede actualizar
    EXISTS (
      SELECT 1 FROM training_plans tp
      WHERE tp.id = training_sessions.plan_id
        AND tp.coach_id = auth.uid()
    )
  );

-- =============================================
-- VERIFICACIÓN: Listar políticas por tabla
-- =============================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'analytics_weekly_summary',
    'athlete_paces',
    'conconi_tests',
    'devices',
    'gym_exercises_bank',
    'personal_bests',
    'race_predictions',
    'running_exercises_bank',
    'training_metrics',
    'training_plans',
    'training_sessions'
  )
ORDER BY tablename, cmd;

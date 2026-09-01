-- =============================================
-- ADD MISSING RLS POLICIES
-- Tables actively used in code that lack RLS definitions
-- Run in Supabase SQL Editor
-- Date: 2026-03-06
-- =============================================

-- =============================================
-- 1. chat_messages (chatService.js)
-- =============================================
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages_select" ON public.chat_messages
  FOR SELECT USING (
    sender_id = (SELECT auth.uid())
    OR receiver_id = (SELECT auth.uid())
  );

CREATE POLICY "chat_messages_insert" ON public.chat_messages
  FOR INSERT WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND (
      -- Coach sending to their athlete
      EXISTS (
        SELECT 1 FROM public.coach_athlete_relationship car
        WHERE car.coach_id = (SELECT auth.uid())
          AND car.athlete_id = chat_messages.receiver_id
          AND car.status = 'active'
      )
      OR
      -- Athlete sending to their coach
      EXISTS (
        SELECT 1 FROM public.coach_athlete_relationship car
        WHERE car.athlete_id = (SELECT auth.uid())
          AND car.coach_id = chat_messages.receiver_id
          AND car.status = 'active'
      )
    )
  );

CREATE POLICY "chat_messages_update" ON public.chat_messages
  FOR UPDATE USING (
    receiver_id = (SELECT auth.uid())
  );

-- =============================================
-- 2. push_subscriptions (pushNotifications.js)
-- =============================================
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_select" ON public.push_subscriptions
  FOR SELECT USING (
    user_id = (SELECT auth.uid())
  );

CREATE POLICY "push_subscriptions_insert" ON public.push_subscriptions
  FOR INSERT WITH CHECK (
    user_id = (SELECT auth.uid())
  );

CREATE POLICY "push_subscriptions_update" ON public.push_subscriptions
  FOR UPDATE USING (
    user_id = (SELECT auth.uid())
  );

CREATE POLICY "push_subscriptions_delete" ON public.push_subscriptions
  FOR DELETE USING (
    user_id = (SELECT auth.uid())
  );

-- =============================================
-- 3. strava_activities (stravaCacheService.js)
-- =============================================
ALTER TABLE public.strava_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "strava_activities_select" ON public.strava_activities
  FOR SELECT USING (
    athlete_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship car
      WHERE car.athlete_id = strava_activities.athlete_id
        AND car.coach_id = (SELECT auth.uid())
        AND car.status = 'active'
    )
  );

CREATE POLICY "strava_activities_insert" ON public.strava_activities
  FOR INSERT WITH CHECK (
    athlete_id = (SELECT auth.uid())
  );

CREATE POLICY "strava_activities_update" ON public.strava_activities
  FOR UPDATE USING (
    athlete_id = (SELECT auth.uid())
  );

CREATE POLICY "strava_activities_delete" ON public.strava_activities
  FOR DELETE USING (
    athlete_id = (SELECT auth.uid())
  );

-- =============================================
-- 4. vam_tests (athleteService.js, conconiService.js)
-- =============================================
ALTER TABLE public.vam_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vam_tests_select" ON public.vam_tests
  FOR SELECT USING (
    athlete_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship car
      WHERE car.athlete_id = vam_tests.athlete_id
        AND car.coach_id = (SELECT auth.uid())
        AND car.status = 'active'
    )
  );

CREATE POLICY "vam_tests_insert" ON public.vam_tests
  FOR INSERT WITH CHECK (
    athlete_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship car
      WHERE car.athlete_id = vam_tests.athlete_id
        AND car.coach_id = (SELECT auth.uid())
        AND car.status = 'active'
    )
  );

CREATE POLICY "vam_tests_update" ON public.vam_tests
  FOR UPDATE USING (
    athlete_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship car
      WHERE car.athlete_id = vam_tests.athlete_id
        AND car.coach_id = (SELECT auth.uid())
        AND car.status = 'active'
    )
  );

CREATE POLICY "vam_tests_delete" ON public.vam_tests
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship car
      WHERE car.athlete_id = vam_tests.athlete_id
        AND car.coach_id = (SELECT auth.uid())
        AND car.status = 'active'
    )
  );

-- =============================================
-- 5. ai_reports (aiReportService.js)
-- =============================================
ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_reports_select" ON public.ai_reports
  FOR SELECT USING (
    athlete_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship car
      WHERE car.athlete_id = ai_reports.athlete_id
        AND car.coach_id = (SELECT auth.uid())
        AND car.status = 'active'
    )
  );

CREATE POLICY "ai_reports_insert" ON public.ai_reports
  FOR INSERT WITH CHECK (
    athlete_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship car
      WHERE car.athlete_id = ai_reports.athlete_id
        AND car.coach_id = (SELECT auth.uid())
        AND car.status = 'active'
    )
  );

CREATE POLICY "ai_reports_delete" ON public.ai_reports
  FOR DELETE USING (
    athlete_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship car
      WHERE car.athlete_id = ai_reports.athlete_id
        AND car.coach_id = (SELECT auth.uid())
        AND car.status = 'active'
    )
  );

-- =============================================
-- 6. weekly_ai_reports (aiReportService.js)
-- =============================================
ALTER TABLE public.weekly_ai_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_ai_reports_select" ON public.weekly_ai_reports
  FOR SELECT USING (
    athlete_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship car
      WHERE car.athlete_id = weekly_ai_reports.athlete_id
        AND car.coach_id = (SELECT auth.uid())
        AND car.status = 'active'
    )
  );

CREATE POLICY "weekly_ai_reports_insert" ON public.weekly_ai_reports
  FOR INSERT WITH CHECK (
    athlete_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship car
      WHERE car.athlete_id = weekly_ai_reports.athlete_id
        AND car.coach_id = (SELECT auth.uid())
        AND car.status = 'active'
    )
  );

-- =============================================
-- 7. mesocycles (planningService.js, trainingLoadService.js)
-- =============================================
ALTER TABLE public.mesocycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mesocycles_select" ON public.mesocycles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.training_plans tp
      WHERE tp.id = mesocycles.plan_id
        AND (
          tp.coach_id = (SELECT auth.uid())
          OR tp.athlete_id = (SELECT auth.uid())
        )
    )
  );

CREATE POLICY "mesocycles_insert" ON public.mesocycles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.training_plans tp
      WHERE tp.id = mesocycles.plan_id
        AND tp.coach_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "mesocycles_update" ON public.mesocycles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.training_plans tp
      WHERE tp.id = mesocycles.plan_id
        AND tp.coach_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "mesocycles_delete" ON public.mesocycles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.training_plans tp
      WHERE tp.id = mesocycles.plan_id
        AND tp.coach_id = (SELECT auth.uid())
    )
  );

-- =============================================
-- 8. microcycles (planningService.js, trainingLoadService.js)
-- =============================================
ALTER TABLE public.microcycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "microcycles_select" ON public.microcycles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.mesocycles m
      JOIN public.training_plans tp ON tp.id = m.plan_id
      WHERE m.id = microcycles.mesocycle_id
        AND (
          tp.coach_id = (SELECT auth.uid())
          OR tp.athlete_id = (SELECT auth.uid())
        )
    )
  );

CREATE POLICY "microcycles_insert" ON public.microcycles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mesocycles m
      JOIN public.training_plans tp ON tp.id = m.plan_id
      WHERE m.id = microcycles.mesocycle_id
        AND tp.coach_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "microcycles_update" ON public.microcycles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.mesocycles m
      JOIN public.training_plans tp ON tp.id = m.plan_id
      WHERE m.id = microcycles.mesocycle_id
        AND tp.coach_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "microcycles_delete" ON public.microcycles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.mesocycles m
      JOIN public.training_plans tp ON tp.id = m.plan_id
      WHERE m.id = microcycles.mesocycle_id
        AND tp.coach_id = (SELECT auth.uid())
    )
  );

-- =============================================
-- 9. plan_assignments (planningService.js)
-- =============================================
ALTER TABLE public.plan_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_assignments_select" ON public.plan_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.training_plans tp
      WHERE tp.id = plan_assignments.plan_id
        AND tp.coach_id = (SELECT auth.uid())
    )
    OR athlete_id = (SELECT auth.uid())
  );

CREATE POLICY "plan_assignments_insert" ON public.plan_assignments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.training_plans tp
      WHERE tp.id = plan_assignments.plan_id
        AND tp.coach_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "plan_assignments_update" ON public.plan_assignments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.training_plans tp
      WHERE tp.id = plan_assignments.plan_id
        AND tp.coach_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "plan_assignments_delete" ON public.plan_assignments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.training_plans tp
      WHERE tp.id = plan_assignments.plan_id
        AND tp.coach_id = (SELECT auth.uid())
    )
  );

-- =============================================
-- 10. daily_training_load (trainingLoadService.js)
-- =============================================
ALTER TABLE public.daily_training_load ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_training_load_select" ON public.daily_training_load
  FOR SELECT USING (
    athlete_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship car
      WHERE car.athlete_id = daily_training_load.athlete_id
        AND car.coach_id = (SELECT auth.uid())
        AND car.status = 'active'
    )
  );

CREATE POLICY "daily_training_load_insert" ON public.daily_training_load
  FOR INSERT WITH CHECK (
    athlete_id = (SELECT auth.uid())
  );

CREATE POLICY "daily_training_load_update" ON public.daily_training_load
  FOR UPDATE USING (
    athlete_id = (SELECT auth.uid())
  );

-- =============================================
-- 11. activity_splits (trainingLoadService.js)
-- =============================================
ALTER TABLE public.activity_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_splits_select" ON public.activity_splits
  FOR SELECT USING (
    athlete_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship car
      WHERE car.athlete_id = activity_splits.athlete_id
        AND car.coach_id = (SELECT auth.uid())
        AND car.status = 'active'
    )
  );

CREATE POLICY "activity_splits_insert" ON public.activity_splits
  FOR INSERT WITH CHECK (
    athlete_id = (SELECT auth.uid())
  );

CREATE POLICY "activity_splits_update" ON public.activity_splits
  FOR UPDATE USING (
    athlete_id = (SELECT auth.uid())
  );

-- =============================================
-- 12. wellness_log (trainingLoadService.js)
-- =============================================
ALTER TABLE public.wellness_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wellness_log_select" ON public.wellness_log
  FOR SELECT USING (
    athlete_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship car
      WHERE car.athlete_id = wellness_log.athlete_id
        AND car.coach_id = (SELECT auth.uid())
        AND car.status = 'active'
    )
  );

CREATE POLICY "wellness_log_insert" ON public.wellness_log
  FOR INSERT WITH CHECK (
    athlete_id = (SELECT auth.uid())
  );

CREATE POLICY "wellness_log_update" ON public.wellness_log
  FOR UPDATE USING (
    athlete_id = (SELECT auth.uid())
  );

-- =============================================
-- 13. training_zones (trainingLoadService.js)
-- =============================================
ALTER TABLE public.training_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_zones_select" ON public.training_zones
  FOR SELECT USING (
    athlete_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship car
      WHERE car.athlete_id = training_zones.athlete_id
        AND car.coach_id = (SELECT auth.uid())
        AND car.status = 'active'
    )
  );

CREATE POLICY "training_zones_insert" ON public.training_zones
  FOR INSERT WITH CHECK (
    athlete_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship car
      WHERE car.athlete_id = training_zones.athlete_id
        AND car.coach_id = (SELECT auth.uid())
        AND car.status = 'active'
    )
  );

CREATE POLICY "training_zones_update" ON public.training_zones
  FOR UPDATE USING (
    athlete_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship car
      WHERE car.athlete_id = training_zones.athlete_id
        AND car.coach_id = (SELECT auth.uid())
        AND car.status = 'active'
    )
  );

-- =============================================
-- 14. activity_rpe (rpeService.js)
-- =============================================
ALTER TABLE public.activity_rpe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_rpe_select" ON public.activity_rpe
  FOR SELECT USING (
    athlete_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship car
      WHERE car.athlete_id = activity_rpe.athlete_id
        AND car.coach_id = (SELECT auth.uid())
        AND car.status = 'active'
    )
  );

CREATE POLICY "activity_rpe_insert" ON public.activity_rpe
  FOR INSERT WITH CHECK (
    athlete_id = (SELECT auth.uid())
  );

CREATE POLICY "activity_rpe_update" ON public.activity_rpe
  FOR UPDATE USING (
    athlete_id = (SELECT auth.uid())
  );

-- =============================================
-- VERIFICATION QUERY
-- Run this after applying to confirm all tables have RLS:
-- =============================================
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;

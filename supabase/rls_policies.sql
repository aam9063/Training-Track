-- =============================================
-- TrackPro Row Level Security (RLS) Policies v2.0
-- Run AFTER schema.sql in Supabase SQL Editor
--
-- OPTIMIZED: Uses (select auth.uid()) pattern for
-- better performance (cached per query vs per row)
--
-- Multi-tenancy: Coaches only see their athletes
-- =============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_athlete_relationship ENABLE ROW LEVEL SECURITY;
ALTER TABLE athlete_paces ENABLE ROW LEVEL SECURITY;
ALTER TABLE conconi_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE conconi_test_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_bests ENABLE ROW LEVEL SECURITY;
ALTER TABLE running_exercises_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_exercises_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_session_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE fartlek_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_weekly_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- =============================================
-- HELPER FUNCTIONS (Optimized)
-- =============================================

-- Get current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = (select auth.uid());
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is a coach
CREATE OR REPLACE FUNCTION is_coach()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = (select auth.uid()) AND role = 'coach'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is an athlete
CREATE OR REPLACE FUNCTION is_athlete()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = (select auth.uid()) AND role = 'athlete'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get my coach's ID (for athletes)
CREATE OR REPLACE FUNCTION get_my_coach_id()
RETURNS UUID AS $$
  SELECT coach_id FROM coach_athlete_relationship
  WHERE athlete_id = (select auth.uid()) AND status = 'active'
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if athlete belongs to current coach
CREATE OR REPLACE FUNCTION is_my_athlete(athlete_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM coach_athlete_relationship
    WHERE coach_id = (select auth.uid())
    AND athlete_id = athlete_uuid
    AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is coach OR the athlete themselves
CREATE OR REPLACE FUNCTION can_access_athlete_data(athlete_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT
    athlete_uuid = (select auth.uid()) -- Es el propio atleta
    OR
    EXISTS ( -- Es el coach del atleta
      SELECT 1 FROM coach_athlete_relationship
      WHERE coach_id = (select auth.uid())
      AND athlete_id = athlete_uuid
      AND status = 'active'
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================
-- USERS POLICIES
-- =============================================

-- Users can view their own profile
CREATE POLICY "users_select_own"
  ON users FOR SELECT
  USING (id = (select auth.uid()));

-- Coaches can view their athletes' user records
CREATE POLICY "users_select_coach_athletes"
  ON users FOR SELECT
  USING (
    is_coach() AND
    EXISTS (
      SELECT 1 FROM coach_athlete_relationship car
      WHERE car.athlete_id = users.id
      AND car.coach_id = (select auth.uid())
      AND car.status = 'active'
    )
  );

-- Athletes can view their coach's user record
CREATE POLICY "users_select_athlete_coach"
  ON users FOR SELECT
  USING (
    is_athlete() AND
    id = get_my_coach_id()
  );

-- Users can update their own record
CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- =============================================
-- COACHES POLICIES
-- =============================================

-- Coaches can view their own record
CREATE POLICY "coaches_select_own"
  ON coaches FOR SELECT
  USING (id = (select auth.uid()));

-- Athletes can view their coach's record
CREATE POLICY "coaches_select_by_athlete"
  ON coaches FOR SELECT
  USING (id = get_my_coach_id());

-- Coaches can update their own record
CREATE POLICY "coaches_update_own"
  ON coaches FOR UPDATE
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- =============================================
-- ATHLETES POLICIES
-- =============================================

-- Athletes can view their own record
CREATE POLICY "athletes_select_own"
  ON athletes FOR SELECT
  USING (id = (select auth.uid()));

-- Coaches can view their athletes
CREATE POLICY "athletes_select_by_coach"
  ON athletes FOR SELECT
  USING (is_my_athlete(id));

-- Athletes can update their own record
CREATE POLICY "athletes_update_own"
  ON athletes FOR UPDATE
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- Coaches can update their athletes (limited fields via app logic)
CREATE POLICY "athletes_update_by_coach"
  ON athletes FOR UPDATE
  USING (is_my_athlete(id))
  WITH CHECK (is_my_athlete(id));

-- =============================================
-- COACH-ATHLETE RELATIONSHIP POLICIES
-- =============================================

-- Coaches can see relationships where they are the coach
CREATE POLICY "car_select_coach"
  ON coach_athlete_relationship FOR SELECT
  USING (coach_id = (select auth.uid()));

-- Athletes can see their own relationships
CREATE POLICY "car_select_athlete"
  ON coach_athlete_relationship FOR SELECT
  USING (athlete_id = (select auth.uid()));

-- Coaches can insert relationships (invite athletes)
CREATE POLICY "car_insert_coach"
  ON coach_athlete_relationship FOR INSERT
  WITH CHECK (
    coach_id = (select auth.uid()) AND
    is_coach()
  );

-- Athletes can insert relationships (request to join coach)
CREATE POLICY "car_insert_athlete"
  ON coach_athlete_relationship FOR INSERT
  WITH CHECK (
    athlete_id = (select auth.uid()) AND
    is_athlete()
  );

-- Coaches can update their relationships
CREATE POLICY "car_update_coach"
  ON coach_athlete_relationship FOR UPDATE
  USING (coach_id = (select auth.uid()))
  WITH CHECK (coach_id = (select auth.uid()));

-- Athletes can update their relationships (accept/reject)
CREATE POLICY "car_update_athlete"
  ON coach_athlete_relationship FOR UPDATE
  USING (athlete_id = (select auth.uid()))
  WITH CHECK (athlete_id = (select auth.uid()));

-- Coaches can delete relationships
CREATE POLICY "car_delete_coach"
  ON coach_athlete_relationship FOR DELETE
  USING (coach_id = (select auth.uid()));

-- Athletes can delete their relationships
CREATE POLICY "car_delete_athlete"
  ON coach_athlete_relationship FOR DELETE
  USING (athlete_id = (select auth.uid()));

-- =============================================
-- ATHLETE PACES POLICIES
-- =============================================

-- Athletes can view their own paces
CREATE POLICY "paces_select_own"
  ON athlete_paces FOR SELECT
  USING (athlete_id = (select auth.uid()));

-- Coaches can view their athletes' paces
CREATE POLICY "paces_select_by_coach"
  ON athlete_paces FOR SELECT
  USING (is_my_athlete(athlete_id));

-- Coaches can manage paces for their athletes
CREATE POLICY "paces_insert_coach"
  ON athlete_paces FOR INSERT
  WITH CHECK (is_my_athlete(athlete_id));

CREATE POLICY "paces_update_coach"
  ON athlete_paces FOR UPDATE
  USING (is_my_athlete(athlete_id))
  WITH CHECK (is_my_athlete(athlete_id));

CREATE POLICY "paces_delete_coach"
  ON athlete_paces FOR DELETE
  USING (is_my_athlete(athlete_id));

-- =============================================
-- CONCONI TESTS POLICIES
-- =============================================

-- Athletes can view their own tests
CREATE POLICY "conconi_select_own"
  ON conconi_tests FOR SELECT
  USING (athlete_id = (select auth.uid()));

-- Coaches can view their athletes' tests
CREATE POLICY "conconi_select_by_coach"
  ON conconi_tests FOR SELECT
  USING (is_my_athlete(athlete_id));

-- Coaches can manage tests for their athletes
CREATE POLICY "conconi_insert_coach"
  ON conconi_tests FOR INSERT
  WITH CHECK (
    is_my_athlete(athlete_id) AND
    coach_id = (select auth.uid())
  );

CREATE POLICY "conconi_update_coach"
  ON conconi_tests FOR UPDATE
  USING (coach_id = (select auth.uid()))
  WITH CHECK (coach_id = (select auth.uid()));

CREATE POLICY "conconi_delete_coach"
  ON conconi_tests FOR DELETE
  USING (coach_id = (select auth.uid()));

-- =============================================
-- CONCONI TEST SERIES POLICIES
-- =============================================

-- Access through parent test
CREATE POLICY "conconi_series_select"
  ON conconi_test_series FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conconi_tests ct
      WHERE ct.id = conconi_test_series.test_id
      AND (
        ct.athlete_id = (select auth.uid())
        OR ct.coach_id = (select auth.uid())
        OR is_my_athlete(ct.athlete_id)
      )
    )
  );

CREATE POLICY "conconi_series_insert"
  ON conconi_test_series FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conconi_tests ct
      WHERE ct.id = conconi_test_series.test_id
      AND ct.coach_id = (select auth.uid())
    )
  );

CREATE POLICY "conconi_series_update"
  ON conconi_test_series FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM conconi_tests ct
      WHERE ct.id = conconi_test_series.test_id
      AND ct.coach_id = (select auth.uid())
    )
  );

CREATE POLICY "conconi_series_delete"
  ON conconi_test_series FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM conconi_tests ct
      WHERE ct.id = conconi_test_series.test_id
      AND ct.coach_id = (select auth.uid())
    )
  );

-- =============================================
-- PERSONAL BESTS POLICIES
-- =============================================

-- Athletes can manage their own PBs
CREATE POLICY "pb_select_own"
  ON personal_bests FOR SELECT
  USING (athlete_id = (select auth.uid()));

CREATE POLICY "pb_insert_own"
  ON personal_bests FOR INSERT
  WITH CHECK (athlete_id = (select auth.uid()));

CREATE POLICY "pb_update_own"
  ON personal_bests FOR UPDATE
  USING (athlete_id = (select auth.uid()))
  WITH CHECK (athlete_id = (select auth.uid()));

CREATE POLICY "pb_delete_own"
  ON personal_bests FOR DELETE
  USING (athlete_id = (select auth.uid()));

-- Coaches can view their athletes' PBs
CREATE POLICY "pb_select_by_coach"
  ON personal_bests FOR SELECT
  USING (is_my_athlete(athlete_id));

-- Coaches can add PBs for athletes
CREATE POLICY "pb_insert_coach"
  ON personal_bests FOR INSERT
  WITH CHECK (is_my_athlete(athlete_id));

-- =============================================
-- RUNNING EXERCISES BANK POLICIES
-- =============================================

-- Everyone can view global exercises (coach_id IS NULL)
CREATE POLICY "running_ex_select_global"
  ON running_exercises_bank FOR SELECT
  USING (coach_id IS NULL);

-- Coaches can view their custom exercises
CREATE POLICY "running_ex_select_own"
  ON running_exercises_bank FOR SELECT
  USING (coach_id = (select auth.uid()));

-- Athletes can view their coach's custom exercises
CREATE POLICY "running_ex_select_coach"
  ON running_exercises_bank FOR SELECT
  USING (coach_id = get_my_coach_id());

-- Coaches can manage their custom exercises
CREATE POLICY "running_ex_insert"
  ON running_exercises_bank FOR INSERT
  WITH CHECK (
    coach_id = (select auth.uid()) AND
    is_custom = TRUE
  );

CREATE POLICY "running_ex_update"
  ON running_exercises_bank FOR UPDATE
  USING (coach_id = (select auth.uid()))
  WITH CHECK (coach_id = (select auth.uid()));

CREATE POLICY "running_ex_delete"
  ON running_exercises_bank FOR DELETE
  USING (coach_id = (select auth.uid()));

-- =============================================
-- GYM EXERCISES BANK POLICIES
-- =============================================

-- Everyone can view global exercises
CREATE POLICY "gym_ex_select_global"
  ON gym_exercises_bank FOR SELECT
  USING (coach_id IS NULL);

-- Coaches can view their custom exercises
CREATE POLICY "gym_ex_select_own"
  ON gym_exercises_bank FOR SELECT
  USING (coach_id = (select auth.uid()));

-- Athletes can view their coach's custom exercises
CREATE POLICY "gym_ex_select_coach"
  ON gym_exercises_bank FOR SELECT
  USING (coach_id = get_my_coach_id());

-- Coaches can manage their custom exercises
CREATE POLICY "gym_ex_insert"
  ON gym_exercises_bank FOR INSERT
  WITH CHECK (
    coach_id = (select auth.uid()) AND
    is_custom = TRUE
  );

CREATE POLICY "gym_ex_update"
  ON gym_exercises_bank FOR UPDATE
  USING (coach_id = (select auth.uid()))
  WITH CHECK (coach_id = (select auth.uid()));

CREATE POLICY "gym_ex_delete"
  ON gym_exercises_bank FOR DELETE
  USING (coach_id = (select auth.uid()));

-- =============================================
-- TRAINING PLANS POLICIES
-- =============================================

-- Coaches have full access to their own plans
CREATE POLICY "plans_select_coach"
  ON training_plans FOR SELECT
  USING (coach_id = (select auth.uid()));

CREATE POLICY "plans_insert_coach"
  ON training_plans FOR INSERT
  WITH CHECK (coach_id = (select auth.uid()));

CREATE POLICY "plans_update_coach"
  ON training_plans FOR UPDATE
  USING (coach_id = (select auth.uid()))
  WITH CHECK (coach_id = (select auth.uid()));

CREATE POLICY "plans_delete_coach"
  ON training_plans FOR DELETE
  USING (coach_id = (select auth.uid()));

-- Athletes can view their assigned plans
CREATE POLICY "plans_select_athlete"
  ON training_plans FOR SELECT
  USING (athlete_id = (select auth.uid()));

-- =============================================
-- TRAINING SESSIONS POLICIES
-- =============================================

-- Coaches have full access to their sessions
CREATE POLICY "sessions_select_coach"
  ON training_sessions FOR SELECT
  USING (coach_id = (select auth.uid()));

CREATE POLICY "sessions_insert_coach"
  ON training_sessions FOR INSERT
  WITH CHECK (
    coach_id = (select auth.uid()) AND
    is_my_athlete(athlete_id)
  );

CREATE POLICY "sessions_update_coach"
  ON training_sessions FOR UPDATE
  USING (coach_id = (select auth.uid()))
  WITH CHECK (coach_id = (select auth.uid()));

CREATE POLICY "sessions_delete_coach"
  ON training_sessions FOR DELETE
  USING (coach_id = (select auth.uid()));

-- Athletes can view their sessions
CREATE POLICY "sessions_select_athlete"
  ON training_sessions FOR SELECT
  USING (athlete_id = (select auth.uid()));

-- Athletes can update their sessions (status, notes)
CREATE POLICY "sessions_update_athlete"
  ON training_sessions FOR UPDATE
  USING (athlete_id = (select auth.uid()))
  WITH CHECK (athlete_id = (select auth.uid()));

-- =============================================
-- TRAINING SESSION EXERCISES POLICIES
-- =============================================

-- Access based on parent session
CREATE POLICY "session_ex_select"
  ON training_session_exercises FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM training_sessions ts
      WHERE ts.id = training_session_exercises.session_id
      AND (
        ts.coach_id = (select auth.uid())
        OR ts.athlete_id = (select auth.uid())
      )
    )
  );

CREATE POLICY "session_ex_insert"
  ON training_session_exercises FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM training_sessions ts
      WHERE ts.id = training_session_exercises.session_id
      AND ts.coach_id = (select auth.uid())
    )
  );

CREATE POLICY "session_ex_update"
  ON training_session_exercises FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM training_sessions ts
      WHERE ts.id = training_session_exercises.session_id
      AND (
        ts.coach_id = (select auth.uid())
        OR ts.athlete_id = (select auth.uid())
      )
    )
  );

CREATE POLICY "session_ex_delete"
  ON training_session_exercises FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM training_sessions ts
      WHERE ts.id = training_session_exercises.session_id
      AND ts.coach_id = (select auth.uid())
    )
  );

-- =============================================
-- FARTLEK SEGMENTS POLICIES
-- =============================================

-- Access based on parent session exercise
CREATE POLICY "fartlek_select"
  ON fartlek_segments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM training_session_exercises tse
      JOIN training_sessions ts ON ts.id = tse.session_id
      WHERE tse.id = fartlek_segments.session_exercise_id
      AND (
        ts.coach_id = (select auth.uid())
        OR ts.athlete_id = (select auth.uid())
      )
    )
  );

CREATE POLICY "fartlek_insert"
  ON fartlek_segments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM training_session_exercises tse
      JOIN training_sessions ts ON ts.id = tse.session_id
      WHERE tse.id = fartlek_segments.session_exercise_id
      AND ts.coach_id = (select auth.uid())
    )
  );

CREATE POLICY "fartlek_update"
  ON fartlek_segments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM training_session_exercises tse
      JOIN training_sessions ts ON ts.id = tse.session_id
      WHERE tse.id = fartlek_segments.session_exercise_id
      AND (
        ts.coach_id = (select auth.uid())
        OR ts.athlete_id = (select auth.uid())
      )
    )
  );

CREATE POLICY "fartlek_delete"
  ON fartlek_segments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM training_session_exercises tse
      JOIN training_sessions ts ON ts.id = tse.session_id
      WHERE tse.id = fartlek_segments.session_exercise_id
      AND ts.coach_id = (select auth.uid())
    )
  );

-- =============================================
-- TRAINING METRICS POLICIES
-- =============================================

-- Athletes can manage their own metrics
CREATE POLICY "metrics_select_own"
  ON training_metrics FOR SELECT
  USING (athlete_id = (select auth.uid()));

CREATE POLICY "metrics_insert_own"
  ON training_metrics FOR INSERT
  WITH CHECK (athlete_id = (select auth.uid()));

CREATE POLICY "metrics_update_own"
  ON training_metrics FOR UPDATE
  USING (athlete_id = (select auth.uid()))
  WITH CHECK (athlete_id = (select auth.uid()));

-- Coaches can view their athletes' metrics
CREATE POLICY "metrics_select_by_coach"
  ON training_metrics FOR SELECT
  USING (is_my_athlete(athlete_id));

-- Coaches can add metrics for their athletes
CREATE POLICY "metrics_insert_coach"
  ON training_metrics FOR INSERT
  WITH CHECK (is_my_athlete(athlete_id));

-- =============================================
-- ANALYTICS WEEKLY SUMMARY POLICIES
-- =============================================

-- Athletes can view their own analytics
CREATE POLICY "analytics_select_own"
  ON analytics_weekly_summary FOR SELECT
  USING (athlete_id = (select auth.uid()));

-- Coaches can view their athletes' analytics
CREATE POLICY "analytics_select_by_coach"
  ON analytics_weekly_summary FOR SELECT
  USING (is_my_athlete(athlete_id));

-- System/trigger can insert (no user insert policy needed)
-- Analytics are typically generated by scheduled jobs or triggers

-- =============================================
-- RACE PREDICTIONS POLICIES
-- =============================================

-- Athletes can view their own predictions
CREATE POLICY "predictions_select_own"
  ON race_predictions FOR SELECT
  USING (athlete_id = (select auth.uid()));

-- Coaches can view their athletes' predictions
CREATE POLICY "predictions_select_by_coach"
  ON race_predictions FOR SELECT
  USING (is_my_athlete(athlete_id));

-- Athletes can insert their own predictions
CREATE POLICY "predictions_insert_own"
  ON race_predictions FOR INSERT
  WITH CHECK (athlete_id = (select auth.uid()));

-- Coaches can insert for their athletes
CREATE POLICY "predictions_insert_coach"
  ON race_predictions FOR INSERT
  WITH CHECK (is_my_athlete(athlete_id));

-- Athletes can delete their own predictions (needed for sync: delete + re-insert)
CREATE POLICY "predictions_delete_own"
  ON race_predictions FOR DELETE
  USING (athlete_id = (select auth.uid()));

-- =============================================
-- DEVICES POLICIES
-- =============================================

-- Athletes can fully manage their own devices
CREATE POLICY "devices_select_own"
  ON devices FOR SELECT
  USING (athlete_id = (select auth.uid()));

CREATE POLICY "devices_insert_own"
  ON devices FOR INSERT
  WITH CHECK (athlete_id = (select auth.uid()));

CREATE POLICY "devices_update_own"
  ON devices FOR UPDATE
  USING (athlete_id = (select auth.uid()))
  WITH CHECK (athlete_id = (select auth.uid()));

CREATE POLICY "devices_delete_own"
  ON devices FOR DELETE
  USING (athlete_id = (select auth.uid()));

-- Coaches can check athletes' device connection status (safe columns only).
-- IMPORTANT: access_token and refresh_token are hidden via devices_safe_view.
-- Coach frontend must use devices_safe_view instead of the devices table directly.
CREATE POLICY "devices_select_by_coach"
  ON devices FOR SELECT
  USING (is_my_athlete(athlete_id));

-- =============================================
-- MESSAGES POLICIES
-- =============================================

-- Users can view messages where they are sender or receiver
CREATE POLICY "messages_select"
  ON messages FOR SELECT
  USING (
    sender_id = (select auth.uid())
    OR receiver_id = (select auth.uid())
  );

-- Users can send messages to their coach or athletes
CREATE POLICY "messages_insert"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = (select auth.uid())
    AND (
      -- Coach sending to their athlete
      (is_coach() AND is_my_athlete(receiver_id))
      OR
      -- Athlete sending to their coach
      (is_athlete() AND receiver_id = get_my_coach_id())
    )
  );

-- Receivers can update read status
CREATE POLICY "messages_update_read"
  ON messages FOR UPDATE
  USING (receiver_id = (select auth.uid()))
  WITH CHECK (receiver_id = (select auth.uid()));

-- =============================================
-- COMMENTS POLICIES
-- =============================================

-- Access based on parent session
CREATE POLICY "comments_select"
  ON comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM training_sessions ts
      WHERE ts.id = comments.session_id
      AND (
        ts.coach_id = (select auth.uid())
        OR ts.athlete_id = (select auth.uid())
      )
    )
  );

-- Users can add comments to sessions they have access to
CREATE POLICY "comments_insert"
  ON comments FOR INSERT
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM training_sessions ts
      WHERE ts.id = comments.session_id
      AND (
        ts.coach_id = (select auth.uid())
        OR ts.athlete_id = (select auth.uid())
      )
    )
  );

-- Users can update their own comments
CREATE POLICY "comments_update"
  ON comments FOR UPDATE
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- Users can delete their own comments
CREATE POLICY "comments_delete"
  ON comments FOR DELETE
  USING (user_id = (select auth.uid()));

-- =============================================
-- NOTIFICATIONS POLICIES
-- =============================================

-- Users can view their own notifications
CREATE POLICY "notifications_select"
  ON notifications FOR SELECT
  USING (user_id = (select auth.uid()));

-- System can insert (typically via triggers/functions)
-- No direct user insert needed

-- Users can update their notifications (mark as read)
CREATE POLICY "notifications_update"
  ON notifications FOR UPDATE
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- Users can delete their notifications
CREATE POLICY "notifications_delete"
  ON notifications FOR DELETE
  USING (user_id = (select auth.uid()));

-- =============================================
-- SUCCESS MESSAGE
-- =============================================

DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ RLS Policies v2.0 created successfully!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '🔒 Multi-tenancy enabled:';
  RAISE NOTICE '   - Coaches can only see their own athletes';
  RAISE NOTICE '   - Athletes can only see their own data + coach';
  RAISE NOTICE '   - Complete data isolation between teams';
  RAISE NOTICE '';
  RAISE NOTICE '⚡ Performance optimizations:';
  RAISE NOTICE '   - Uses (select auth.uid()) pattern';
  RAISE NOTICE '   - Helper functions with STABLE marker';
  RAISE NOTICE '   - SECURITY DEFINER for safe subqueries';
  RAISE NOTICE '============================================';
END $$;

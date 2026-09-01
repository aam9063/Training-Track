-- Migration: Independent Athlete feature (UP)
-- Apply this migration in the Supabase SQL editor.
-- NOTE: Set is_independent to true only when the independent athlete module is enabled.
-- By default, users.is_independent = false. The registration flow sets it to true
-- when an independent athlete registers. The "block_new_signups" trigger will prevent
-- new independent signups until this feature is officially launched.

-- 1. Independent flag on users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_independent boolean DEFAULT false NOT NULL;

-- 2. Nullable coach_id on training_sessions (independent athletes create sessions without a coach)
ALTER TABLE public.training_sessions ALTER COLUMN coach_id DROP NOT NULL;

-- 3. Session completion fields on training_sessions
ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS actual_distance_km numeric(6,2),
  ADD COLUMN IF NOT EXISTS actual_time_minutes integer,
  ADD COLUMN IF NOT EXISTS rpe smallint CHECK (rpe BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS completion_notes text;

-- 4. Nullable coach_id on competitions (independent athletes manage their own competitions)
ALTER TABLE public.competitions ALTER COLUMN coach_id DROP NOT NULL;

-- 5. Nullable coach_id on training_plans + created_by column
ALTER TABLE public.training_plans ALTER COLUMN coach_id DROP NOT NULL;
ALTER TABLE public.training_plans ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- 6. RLS: independent athlete full CRUD on own training_sessions (where coach_id IS NULL)
CREATE POLICY "independent_athlete_own_sessions"
  ON public.training_sessions FOR ALL
  USING (
    athlete_id = (select auth.uid())
    AND (select is_independent from public.users where id = (select auth.uid()))
  )
  WITH CHECK (
    athlete_id = (select auth.uid())
    AND coach_id IS NULL
  );

-- 7. RLS: independent athlete full CRUD on own competitions (where coach_id IS NULL)
CREATE POLICY "independent_athlete_own_competitions"
  ON public.competitions FOR ALL
  USING (
    athlete_id = (select auth.uid())
    AND (select is_independent from public.users where id = (select auth.uid()))
  )
  WITH CHECK (
    athlete_id = (select auth.uid())
    AND coach_id IS NULL
  );

-- 8. RLS: independent athlete full CRUD on own training_plans
CREATE POLICY "independent_athlete_own_plans"
  ON public.training_plans FOR ALL
  USING (
    created_by = (select auth.uid())
    AND (select is_independent from public.users where id = (select auth.uid()))
  )
  WITH CHECK (
    created_by = (select auth.uid())
    AND coach_id IS NULL
  );

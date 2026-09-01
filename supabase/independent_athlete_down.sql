-- Migration: Independent Athlete feature (DOWN / Rollback)
-- Run this to revert the independent athlete migration.
-- WARNING: This is destructive. Ensure no independent athlete data exists before reverting.

DROP POLICY IF EXISTS "independent_athlete_own_sessions" ON public.training_sessions;
DROP POLICY IF EXISTS "independent_athlete_own_competitions" ON public.competitions;
DROP POLICY IF EXISTS "independent_athlete_own_plans" ON public.training_plans;

ALTER TABLE public.training_plans DROP COLUMN IF EXISTS created_by;

ALTER TABLE public.training_sessions DROP COLUMN IF EXISTS completion_notes;
ALTER TABLE public.training_sessions DROP COLUMN IF EXISTS rpe;
ALTER TABLE public.training_sessions DROP COLUMN IF EXISTS actual_time_minutes;
ALTER TABLE public.training_sessions DROP COLUMN IF EXISTS actual_distance_km;
ALTER TABLE public.training_sessions DROP COLUMN IF EXISTS completed_at;

-- WARNING: reverting NOT NULL requires all existing rows to have a non-null coach_id.
-- Only uncomment after verifying no NULL coach_id rows exist:
-- ALTER TABLE public.training_sessions ALTER COLUMN coach_id SET NOT NULL;
-- ALTER TABLE public.competitions ALTER COLUMN coach_id SET NOT NULL;
-- ALTER TABLE public.training_plans ALTER COLUMN coach_id SET NOT NULL;

ALTER TABLE public.users DROP COLUMN IF EXISTS is_independent;

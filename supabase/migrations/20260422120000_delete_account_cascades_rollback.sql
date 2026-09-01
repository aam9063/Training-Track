-- Rollback for 20260422120000_delete_account_cascades.sql

BEGIN;

-- Revert vam_tests FK to NO ACTION (original state)
ALTER TABLE public.vam_tests
  DROP CONSTRAINT IF EXISTS vam_tests_coach_id_fkey;

ALTER TABLE public.vam_tests
  ADD CONSTRAINT vam_tests_coach_id_fkey
  FOREIGN KEY (coach_id) REFERENCES public.coaches(id);

-- Revert training_plans.created_by to NO ACTION
ALTER TABLE public.training_plans
  DROP CONSTRAINT IF EXISTS training_plans_created_by_fkey;

ALTER TABLE public.training_plans
  ADD CONSTRAINT training_plans_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id);

-- Drop audit log table
DROP POLICY IF EXISTS deleted_accounts_log_service_role ON public.deleted_accounts_log;
DROP INDEX IF EXISTS public.deleted_accounts_log_deleted_at_idx;
DROP TABLE IF EXISTS public.deleted_accounts_log;

COMMIT;

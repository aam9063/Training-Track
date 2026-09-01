-- Migration: delete_account_cascades
-- Purpose: enable clean account deletion (GDPR) by
--   1) Fixing 2 FKs that are NOT CASCADE / NOT SET NULL and would block
--      deletion of an auth.users row or a public.coaches row.
--   2) Creating a public.deleted_accounts_log audit table (GDPR-safe:
--      email is stored only as SHA-256 hash).
--
-- Audit results (see audit_cascades.sql):
--   - All FKs → auth.users.id are already ON DELETE CASCADE.
--   - All FKs → public.users.id are already ON DELETE CASCADE.
--   - All FKs → public.coaches.id / public.athletes.id are already CASCADE
--     EXCEPT:
--       * public.vam_tests.coach_id   → NO ACTION  (blocks coach delete)
--       * public.training_plans.created_by → auth.users NO ACTION
--         (blocks auth.users delete when a training plan was created by user)
--   - public.conconi_tests.coach_id is SET NULL (already fine).
--
-- Rollback: see 20260422120000_delete_account_cascades_rollback.sql

BEGIN;

-- 1) vam_tests.coach_id: switch NO ACTION → SET NULL (the athlete's own
--    test must survive if the coach disappears, since athlete_id is CASCADE
--    from athletes → we want test rows to remain, just unlinked from coach).
ALTER TABLE public.vam_tests
  DROP CONSTRAINT IF EXISTS vam_tests_coach_id_fkey;

ALTER TABLE public.vam_tests
  ADD CONSTRAINT vam_tests_coach_id_fkey
  FOREIGN KEY (coach_id) REFERENCES public.coaches(id) ON DELETE SET NULL;

-- 2) training_plans.created_by: switch default NO ACTION → SET NULL so
--    deleting the auth.users row does not fail if that user once created
--    a plan. (The plan itself is cascaded via coach_id/athlete_id, but
--    if created_by points to some other user, we simply null it out.)
ALTER TABLE public.training_plans
  DROP CONSTRAINT IF EXISTS training_plans_created_by_fkey;

ALTER TABLE public.training_plans
  ADD CONSTRAINT training_plans_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3) Audit log (GDPR: never persist the raw email).
CREATE TABLE IF NOT EXISTS public.deleted_accounts_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_user_id uuid NOT NULL,
  email_hash text,                 -- SHA-256 hex of lowercased email
  role text,                       -- 'coach' | 'athlete'
  had_subscription boolean DEFAULT false,
  stripe_customer_id text,
  stripe_subscription_id text,
  reason text,                     -- optional free-text reason from user
  deleted_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.deleted_accounts_log IS
  'Audit trail of deleted accounts. Email stored only as SHA-256 hash (GDPR).';

CREATE INDEX IF NOT EXISTS deleted_accounts_log_deleted_at_idx
  ON public.deleted_accounts_log (deleted_at DESC);

ALTER TABLE public.deleted_accounts_log ENABLE ROW LEVEL SECURITY;

-- Only service_role may read/write. No user-facing policies.
DROP POLICY IF EXISTS deleted_accounts_log_service_role ON public.deleted_accounts_log;
CREATE POLICY deleted_accounts_log_service_role
  ON public.deleted_accounts_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;

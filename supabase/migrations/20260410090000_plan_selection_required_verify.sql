-- =============================================================================
-- Verify: plan_selection_required
-- Run these queries AFTER applying the UP migration to confirm everything
-- landed correctly. All queries are READ-ONLY. Expected results are noted
-- inline. Do NOT run the statements in section "Manual smoke tests" via
-- automation — they are example payloads for human testing.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Columns exist with correct types
-- -----------------------------------------------------------------------------
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'users'
   AND column_name IN ('plan_selected_at', 'selected_plan')
 ORDER BY column_name;
-- Expected: 2 rows
--   plan_selected_at | timestamp with time zone | YES
--   selected_plan    | text                     | YES


-- -----------------------------------------------------------------------------
-- 2. Grandfather backfill applied to ALL existing users
-- -----------------------------------------------------------------------------
SELECT count(*) AS null_count
  FROM public.users
 WHERE plan_selected_at IS NULL;
-- Expected: 0


-- -----------------------------------------------------------------------------
-- 3. Backfill values equal created_at for existing users (sanity)
-- -----------------------------------------------------------------------------
SELECT count(*) AS mismatched
  FROM public.users
 WHERE plan_selected_at IS DISTINCT FROM created_at
   AND created_at IS NOT NULL;
-- Expected: 0 (only rows where we fell through to now() would differ, and
-- the live DB has 0 rows with NULL created_at)


-- -----------------------------------------------------------------------------
-- 4. CHECK constraint exists
-- -----------------------------------------------------------------------------
SELECT conname, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
 WHERE conrelid = 'public.users'::regclass
   AND conname  = 'users_selected_plan_check';
-- Expected: 1 row, definition contains the 5 plan keys


-- -----------------------------------------------------------------------------
-- 5. Partial index exists
-- -----------------------------------------------------------------------------
SELECT indexname, indexdef
  FROM pg_indexes
 WHERE schemaname = 'public'
   AND tablename  = 'users'
   AND indexname  = 'idx_users_plan_selected_at_null';
-- Expected: 1 row, indexdef ends with "WHERE (plan_selected_at IS NULL)"


-- -----------------------------------------------------------------------------
-- 6. Trigger exists and is enabled
-- -----------------------------------------------------------------------------
SELECT tgname,
       tgenabled,
       pg_get_triggerdef(oid) AS definition
  FROM pg_trigger
 WHERE tgrelid = 'public.users'::regclass
   AND tgname  = 'users_block_plan_cols_trg';
-- Expected: 1 row, tgenabled = 'O' (origin, enabled)


-- -----------------------------------------------------------------------------
-- 7. Trigger function exists with correct signature
-- -----------------------------------------------------------------------------
SELECT proname, prosecdef, prolang::regtype
  FROM pg_proc
 WHERE proname = 'users_block_plan_cols'
   AND pronamespace = 'public'::regnamespace;
-- Expected: 1 row, prosecdef = false (SECURITY INVOKER)


-- -----------------------------------------------------------------------------
-- 8. commit_plan_selection RPC exists with SECURITY DEFINER
-- -----------------------------------------------------------------------------
SELECT proname,
       prosecdef                                           AS security_definer,
       pg_get_function_identity_arguments(oid)             AS args,
       pg_get_function_result(oid)                         AS returns
  FROM pg_proc
 WHERE proname = 'commit_plan_selection'
   AND pronamespace = 'public'::regnamespace;
-- Expected: 1 row
--   commit_plan_selection | t | p_plan_key text, p_billing_interval text | json


-- -----------------------------------------------------------------------------
-- 9. RPC execute grants (authenticated only)
-- -----------------------------------------------------------------------------
SELECT grantee, privilege_type
  FROM information_schema.routine_privileges
 WHERE routine_schema = 'public'
   AND routine_name   = 'commit_plan_selection'
 ORDER BY grantee;
-- Expected: includes { authenticated, EXECUTE }. Should NOT include public or anon.


-- -----------------------------------------------------------------------------
-- 10. Subscriptions nullability unchanged (no accidental side effect)
-- -----------------------------------------------------------------------------
SELECT column_name, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'subscriptions'
   AND column_name IN (
     'stripe_subscription_id','stripe_price_id','billing_interval',
     'current_period_start','current_period_end'
   )
 ORDER BY column_name;
-- Expected: all rows is_nullable = YES


-- =============================================================================
-- Manual smoke tests (DO NOT automate — run each by hand and observe)
-- =============================================================================
--
-- Test A: Direct client UPDATE must be blocked by trigger.
--   As an authenticated Supabase user (JWT role = 'authenticated'), run:
--
--     UPDATE public.users
--        SET plan_selected_at = now()
--      WHERE id = auth.uid();
--
--   Expected: ERROR  plan_selection_readonly (SQLSTATE 42501)
--
-- ---------------------------------------------------------------------------
--
-- Test B: Direct client UPDATE on selected_plan must be blocked.
--
--     UPDATE public.users
--        SET selected_plan = 'coach_pro'
--      WHERE id = auth.uid();
--
--   Expected: ERROR  plan_selection_readonly (SQLSTATE 42501)
--
-- ---------------------------------------------------------------------------
--
-- Test C: RPC happy path for a NEW (not grandfathered) coach free user.
--   Assuming a fresh auth.users + public.users row with role = 'coach' and
--   plan_selected_at IS NULL, run as that user:
--
--     SELECT public.commit_plan_selection('coach_free', 'month');
--
--   Expected:
--     - JSON result: { "success": true, "plan_key": "coach_free", ... }
--     - users.plan_selected_at populated, users.selected_plan = 'coach_free'
--     - A new row in subscriptions (plan_key = 'coach_free', status = 'active')
--
-- ---------------------------------------------------------------------------
--
-- Test D: RPC idempotency — second call must fail.
--
--     SELECT public.commit_plan_selection('coach_free', 'month');
--
--   Expected: ERROR  plan_already_selected (SQLSTATE 23505)
--
-- ---------------------------------------------------------------------------
--
-- Test E: RPC invalid plan_key.
--
--     SELECT public.commit_plan_selection('hacker_ultra', 'month');
--
--   Expected: ERROR  invalid_plan_key (SQLSTATE 22023)
--
-- ---------------------------------------------------------------------------
--
-- Test F: RPC role/plan mismatch (athlete calling coach_pro).
--   As an athlete-role user with plan_selected_at IS NULL:
--
--     SELECT public.commit_plan_selection('coach_pro', 'month');
--
--   Expected: ERROR  plan_role_mismatch (SQLSTATE 22023)
--
-- ---------------------------------------------------------------------------
--
-- Test G: RPC paid plan — no subscriptions row inserted.
--
--     SELECT public.commit_plan_selection('coach_pro', 'month');
--     SELECT count(*) FROM subscriptions WHERE user_id = auth.uid();
--
--   Expected: count = 0 (paid plans don't insert; Stripe webhook writes the
--   real row later).
--
-- =============================================================================
-- End of verification queries
-- =============================================================================

-- Verification for apply_plan_adjustment. 1 row per check, OK / FAIL.
-- Read-only static checks; the integration scenarios (drift refusal,
-- happy-path apply, numeric 70 vs 70.0 non-false-refusal) require seeded
-- fixture data and real JWTs — documented below, not automated here.

SELECT 'function.exists' AS check_name,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'apply_plan_adjustment'
       ) THEN 'OK' ELSE 'FAIL' END AS status
UNION ALL
SELECT 'function.language_plpgsql',
       CASE WHEN (
         SELECT l.lanname FROM pg_proc p
         JOIN pg_language l ON l.oid = p.prolang
         WHERE p.proname = 'apply_plan_adjustment'
           AND p.pronamespace = 'public'::regnamespace
       ) = 'plpgsql' THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'function.security_definer',
       CASE WHEN (
         SELECT p.prosecdef FROM pg_proc p
         WHERE p.proname = 'apply_plan_adjustment'
           AND p.pronamespace = 'public'::regnamespace
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'function.revoked_from_public',
       CASE WHEN NOT EXISTS (
         SELECT 1 FROM information_schema.routine_privileges
         WHERE routine_schema = 'public'
           AND routine_name = 'apply_plan_adjustment'
           AND grantee = 'PUBLIC'
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'function.revoked_from_anon',
       CASE WHEN NOT EXISTS (
         SELECT 1 FROM information_schema.routine_privileges
         WHERE routine_schema = 'public'
           AND routine_name = 'apply_plan_adjustment'
           AND grantee = 'anon'
       ) THEN 'OK' ELSE 'FAIL' END
UNION ALL
SELECT 'function.granted_to_authenticated',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.routine_privileges
         WHERE routine_schema = 'public'
           AND routine_name = 'apply_plan_adjustment'
           AND grantee = 'authenticated'
       ) THEN 'OK' ELSE 'FAIL' END;

-- Manual integration follow-up (documented, requires seeded fixture data
-- and real JWTs — spec's "Snapshot-Drift Guard on Apply" requirement):
--   1. Drift refusal: seed a pending suggestion whose snapshot targets a
--      real training_sessions row, then mutate that row's
--      estimated_duration_minutes directly (simulating a coach edit made
--      after the suggestion was computed). Call
--      apply_plan_adjustment(<suggestion_id>) as the active coach ->
--      expect (applied=false, refusal_reason='snapshot_drift',
--      session_ids='{}'), suggestion.status='superseded', and ZERO rows
--      changed in training_sessions besides the pre-existing mutation.
--   2. Happy path: seed a pending suggestion whose snapshot matches live
--      data exactly, call as the active coach -> expect (applied=true,
--      refusal_reason=NULL, session_ids=<all target ids>), every target's
--      adjusted_by_agent=true and last_adjustment_id=<suggestion_id>,
--      suggestion.status='approved'.
--   3. Numeric non-false-refusal: seed snapshot.sessions.<id>.
--      estimated_duration_minutes = 70 (jsonb integer) against a live row
--      with estimated_duration_minutes = 70 -- expect NOT drifted (the cast
--      to numeric on both sides must compare equal regardless of jsonb
--      70 vs 70.0 textual representation).
--   4. Unauthorized: call as a coach with no active
--      coach_athlete_relationship to the suggestion's athlete -> expect a
--      RAISEd insufficient_privilege exception, not a refusal row.
--   5. Missing suggestion: call with a random uuid -> expect a RAISEd
--      exception ("not found"), not a refusal row.

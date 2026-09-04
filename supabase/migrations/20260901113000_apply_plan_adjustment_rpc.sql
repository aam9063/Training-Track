-- =========================================================================
-- Migration: apply_plan_adjustment_rpc (UP)
-- apply_plan_adjustment(p_suggestion_id uuid) — the ONLY code path in this
-- change (and, per design.md's Technical Approach, in the whole repo for
-- this feature) that writes training_sessions. LANGUAGE plpgsql,
-- statement-by-statement — never a LANGUAGE sql CTE (this repo has twice
-- found that form unreliable for read-old-value-then-write: Agent 1's
-- upsert_training_load_alert, Agent 2's upsert_engagement_alert).
--
-- On snapshot drift this function RETURNs a refusal row
-- (applied=false, refusal_reason='snapshot_drift') and still durably marks
-- the suggestion 'superseded' — it does NOT RAISE for drift, because a
-- RAISE would abort the transaction and roll back the 'superseded'
-- marking along with everything else. Only genuinely exceptional
-- conditions (missing suggestion, unauthorized caller, a patch field
-- outside the whitelist, or a patch that would increase a volume field —
-- both of which would mean the persisted suggestion itself was malformed,
-- not a live-data problem) RAISE.
--
-- No DELETE path exists here or anywhere in this change: "removing" a
-- session means setting training_type='rest' (planAdjustmentCore.js's
-- REST_TYPE — confirmed live 2026-09-01 as the correct value: the
-- training_type ENUM is {running,gym,rest,cross_training}; 'descanso' is
-- only ever a client-side/draft-plan-JSON label in AIPlanReviewModal.jsx,
-- never a value actually persisted to this column) + both volume-adjacent
-- fields understood as "recovery" (estimated_duration_minutes -> 0,
-- title/description -> the rest-day copy). The interaction pattern
-- (convert to a visible rest day rather than delete) mirrors
-- AIPlanReviewModal.jsx's deleteSession (lines ~153-172); only the literal
-- value differs from that component's in-memory draft state. The patch
-- itself (computed by planAdjustmentCore.js's shared toRestDay/buildPatch
-- helpers, Phase 1) already only ever contains PATCHABLE_FIELDS values;
-- this RPC re-enforces that whitelist independently as a security
-- property, not merely trusting the caller's patch shape.
--
-- Granted to `authenticated` (the coach's PlanAdjustmentReviewModal calls
-- it directly via supabase.rpc) — authorization is enforced INSIDE the
-- body via an active coach_athlete_relationship check, not by the grant.
-- `service_role` is also accepted (session_user = 'service_role', NOT
-- current_user — see the in-body comment above the authorization check)
-- for backend/administrative callers, matching design.md's step-2
-- pseudocode. This branch has no actual caller in this change's scope.
--
-- CORRECTION (found during this batch, no live DB access to verify but
-- fixed in design.md too — see that file's Interfaces section): design.md's
-- apply_plan_adjustment pseudocode step 3 references "p_today" as if it
-- were a function parameter, but both the function's own signature
-- (`apply_plan_adjustment(p_suggestion_id uuid)`) and the frontend's call
-- site (`supabase.rpc('apply_plan_adjustment', {p_suggestion_id})`) pass
-- only the suggestion id — no today parameter exists anywhere else in the
-- design. This function resolves "today" internally via
-- `(now() AT TIME ZONE 'Europe/Madrid')::date`, consistent with this
-- project's established Europe/Madrid local-date rule (never
-- server-timezone CURRENT_DATE, mirroring the JS-side
-- Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Madrid'}) convention used
-- throughout Agents 1-3's Edge Functions) rather than accepting an
-- unused/undocumented extra parameter.
--
-- See: openspec/changes/continuous-planning-agent/design.md
--      (Migration Plan #4, "Decision: The apply RPC is LANGUAGE plpgsql
--      and returns a refusal — it never RAISEs one", "Decision: 'Removing'
--      a session means converting it to a rest day", Interfaces / Contracts
--      — apply_plan_adjustment)
-- =========================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.apply_plan_adjustment(p_suggestion_id uuid)
RETURNS TABLE (
  applied         boolean,
  refusal_reason  text,
  session_ids     uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_suggestion    public.plan_adjustment_suggestions%ROWTYPE;
  v_today         date := (now() AT TIME ZONE 'Europe/Madrid')::date;
  v_is_authorized boolean;
  v_session_key   text;
  v_session_id    uuid;
  v_snap          jsonb;
  v_patch         jsonb;
  v_field         text;
  v_row           public.training_sessions%ROWTYPE;
  v_drifted       boolean := false;
  v_old_duration  numeric;
  v_new_duration  numeric;
  v_session_ids   uuid[] := '{}'::uuid[];
BEGIN
  -- 1. Lock and load the suggestion.
  SELECT * INTO v_suggestion
  FROM public.plan_adjustment_suggestions
  WHERE id = p_suggestion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_adjustment_suggestion % not found', p_suggestion_id;
  END IF;

  IF v_suggestion.status <> 'pending' THEN
    RETURN QUERY SELECT false, 'not_pending'::text, ARRAY[]::uuid[];
    RETURN;
  END IF;

  -- 2. Authorize: service_role (backend/administrative caller) OR the
  --    athlete's currently active coach.
  --    session_user, NOT current_user (found live 2026-09-01): this
  --    function is SECURITY DEFINER, so current_user is always the
  --    function's OWNER for the duration of the call (standard Postgres
  --    semantics — confirmed empirically: a scratch SECURITY DEFINER probe
  --    reported current_user as the owning role even when called under a
  --    different active role). current_user = 'service_role' would make
  --    this branch permanently unreachable regardless of who actually
  --    called it. session_user is at least not overridden by SECURITY
  --    DEFINER, which current_user provably is — no prior Agent 1/2 RPC
  --    used this exact "service_role OR coach" combined check to catch
  --    this earlier.
  --    CAVEAT, not fully verified live: this branch has no actual caller
  --    in this change's current scope (only the coach's authenticated
  --    approve() action calls this RPC — the auth.uid() branch below,
  --    already proven correct by Agents 1/2's identical pattern). Whether
  --    session_user resolves to literally 'service_role' for a genuine
  --    service_role-authenticated call through Supabase's connection
  --    architecture was not confirmable from this session (insufficient
  --    privilege to SET SESSION AUTHORIZATION for a live test). Verify
  --    against a real service_role call before anything is built that
  --    depends on this branch.
  v_is_authorized := (
    session_user = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.coach_athlete_relationship car
      WHERE car.athlete_id = v_suggestion.athlete_id
        AND car.coach_id   = (select auth.uid())
        AND car.status     = 'active'
    )
  );

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'not authorized: caller is not the active coach for suggestion %''s athlete', p_suggestion_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3. Verify every target session against its snapshot, one statement at
  --    a time (see migration header — never a single-statement CTE here).
  --    SNAPSHOT_FIELDS = scheduled_date, status, training_type,
  --    estimated_duration_minutes, title. description is patchable but
  --    deliberately NOT snapshotted/drift-checked (design.md's
  --    SNAPSHOT_FIELDS list).
  FOR v_session_key IN SELECT jsonb_object_keys(v_suggestion.snapshot -> 'sessions')
  LOOP
    v_session_id := v_session_key::uuid;
    v_snap := v_suggestion.snapshot -> 'sessions' -> v_session_key;

    SELECT * INTO v_row
    FROM public.training_sessions
    WHERE id = v_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_drifted := true;
      EXIT;
    END IF;

    -- Numeric-comparison gotcha: cast out of jsonb to numeric, never
    -- compare as jsonb/text — jsonb 70 and 70.0 are distinct as text and
    -- equal as numeric; a false drift refusal is a silent feature failure.
    v_old_duration := (v_snap ->> 'estimated_duration_minutes')::numeric;
    v_new_duration := v_row.estimated_duration_minutes::numeric;

    IF v_row.status::text IS DISTINCT FROM (v_snap ->> 'status')
       OR v_row.scheduled_date <= v_today
       OR v_row.scheduled_date IS DISTINCT FROM (v_snap ->> 'scheduled_date')::date
       OR v_row.training_type::text IS DISTINCT FROM (v_snap ->> 'training_type')
       OR COALESCE(v_row.title, '') IS DISTINCT FROM COALESCE(v_snap ->> 'title', '')
       OR v_new_duration IS DISTINCT FROM v_old_duration
    THEN
      v_drifted := true;
      EXIT;
    END IF;
  END LOOP;

  -- 4. Drift -> refuse, but still durably mark the suggestion superseded.
  --    RETURNing here (not RAISEing) is deliberate: an exception would
  --    roll back this UPDATE along with everything else.
  IF v_drifted THEN
    UPDATE public.plan_adjustment_suggestions
       SET status = 'superseded',
           refusal_reason = 'snapshot_drift',
           resolved_at = now(),
           decided_at = now(),
           updated_at = now()
     WHERE id = p_suggestion_id;

    RETURN QUERY SELECT false, 'snapshot_drift'::text, ARRAY[]::uuid[];
    RETURN;
  END IF;

  -- 5. Clean — apply the patch. Every target session is already locked
  --    (FOR UPDATE, step 3) within this same transaction. Whitelist +
  --    reduction-only invariant are re-enforced here independently of
  --    planAdjustmentCore.js's own guarantees (defense in depth: the core
  --    computing only reductions is a correctness property, this RPC
  --    refusing to write an increase is a security property).
  FOR v_session_key IN SELECT jsonb_object_keys(v_suggestion.patch -> 'sessions')
  LOOP
    v_session_id := v_session_key::uuid;
    v_patch := v_suggestion.patch -> 'sessions' -> v_session_key;
    v_snap := v_suggestion.snapshot -> 'sessions' -> v_session_key;

    IF v_snap IS NULL THEN
      RAISE EXCEPTION 'malformed suggestion %: patch references session % absent from snapshot',
        p_suggestion_id, v_session_id;
    END IF;

    -- Field whitelist.
    FOR v_field IN SELECT jsonb_object_keys(v_patch)
    LOOP
      IF v_field NOT IN ('estimated_duration_minutes', 'training_type', 'title', 'description') THEN
        RAISE EXCEPTION 'malformed suggestion %: patch field % is outside the whitelist for session %',
          p_suggestion_id, v_field, v_session_id;
      END IF;
    END LOOP;

    -- Reduction-only invariant, numeric comparison.
    IF v_patch ? 'estimated_duration_minutes' THEN
      v_old_duration := (v_snap ->> 'estimated_duration_minutes')::numeric;
      v_new_duration := (v_patch ->> 'estimated_duration_minutes')::numeric;
      IF v_new_duration > v_old_duration THEN
        RAISE EXCEPTION 'malformed suggestion %: patch would increase estimated_duration_minutes for session % (snapshot %, patch %)',
          p_suggestion_id, v_session_id, v_old_duration, v_new_duration;
      END IF;
    END IF;

    -- training_type needs an explicit ::training_type cast on its THEN
    -- branch (found live 2026-09-01): Postgres has no implicit text->enum
    -- cast, and a CASE expression's branches must share a type — without
    -- the cast this raised "CASE types training_type and text cannot be
    -- matched" (42804) the first time the function actually ran, since
    -- plpgsql function bodies aren't type-checked until first execution,
    -- not at CREATE FUNCTION time. estimated_duration_minutes/title/
    -- description don't need one: integer and text both have the needed
    -- implicit/unknown-literal coercions the enum lacks.
    UPDATE public.training_sessions
       SET estimated_duration_minutes = CASE WHEN v_patch ? 'estimated_duration_minutes'
                                              THEN (v_patch ->> 'estimated_duration_minutes')::integer
                                              ELSE estimated_duration_minutes END,
           training_type              = CASE WHEN v_patch ? 'training_type'
                                              THEN (v_patch ->> 'training_type')::training_type
                                              ELSE training_type END,
           title                      = CASE WHEN v_patch ? 'title'
                                              THEN v_patch ->> 'title'
                                              ELSE title END,
           description                = CASE WHEN v_patch ? 'description'
                                              THEN v_patch ->> 'description'
                                              ELSE description END,
           adjusted_by_agent          = true,
           last_adjustment_id         = p_suggestion_id,
           updated_at                 = now()
     WHERE id = v_session_id;

    v_session_ids := array_append(v_session_ids, v_session_id);
  END LOOP;

  UPDATE public.plan_adjustment_suggestions
     SET status = 'approved',
         decided_at = now(),
         resolved_at = now(),
         updated_at = now()
   WHERE id = p_suggestion_id;

  RETURN QUERY SELECT true, NULL::text, v_session_ids;
END;
$function$;

-- Coach-callable directly (via PlanAdjustmentReviewModal -> approve()),
-- authorization enforced inside the body, not by the grant.
REVOKE EXECUTE ON FUNCTION public.apply_plan_adjustment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_plan_adjustment(uuid) TO authenticated;

COMMIT;

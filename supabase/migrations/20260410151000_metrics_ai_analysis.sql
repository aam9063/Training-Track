-- =========================================================================
-- Migration: metrics-ai-analysis (UP)
-- Adds ai_analysis_usage + ai_analysis_cache tables and
-- get_ai_analysis_limit(uuid) RPC that resolves the effective monthly quota
-- considering exempt, trial, own plan and (for coached athletes) coach plan.
-- See: openspec/changes/metrics-ai-analysis/design.md
-- =========================================================================

BEGIN;

-- Monthly usage counter per user (athlete or coach, depending on source)
CREATE TABLE IF NOT EXISTS public.ai_analysis_usage (
  athlete_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  year_month    text NOT NULL CHECK (year_month ~ '^[0-9]{4}-[0-9]{2}$'),
  usage_count   integer NOT NULL DEFAULT 0,
  last_used_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (athlete_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_month
  ON public.ai_analysis_usage(year_month);

ALTER TABLE public.ai_analysis_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_usage_select_own ON public.ai_analysis_usage;
CREATE POLICY ai_usage_select_own ON public.ai_analysis_usage
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = athlete_id);

DROP POLICY IF EXISTS ai_usage_service_all ON public.ai_analysis_usage;
CREATE POLICY ai_usage_service_all ON public.ai_analysis_usage
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 24h response cache
CREATE TABLE IF NOT EXISTS public.ai_analysis_cache (
  input_hash  text PRIMARY KEY,
  athlete_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  chart_type  text NOT NULL,
  response    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_athlete
  ON public.ai_analysis_cache(athlete_id);

CREATE INDEX IF NOT EXISTS idx_ai_cache_expires
  ON public.ai_analysis_cache(expires_at);

ALTER TABLE public.ai_analysis_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_cache_select_own ON public.ai_analysis_cache;
CREATE POLICY ai_cache_select_own ON public.ai_analysis_cache
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = athlete_id);

DROP POLICY IF EXISTS ai_cache_service_all ON public.ai_analysis_cache;
CREATE POLICY ai_cache_service_all ON public.ai_analysis_cache
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- RPC: effective monthly AI analysis limit
-- Returns jsonb: { limit: int (-1 = unlimited), source: text, coach_id?: uuid }
CREATE OR REPLACE FUNCTION public.get_ai_analysis_limit(p_athlete_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_exempt      boolean := false;
  v_is_admin       boolean := false;
  v_trial_ends     timestamptz;
  v_own_plan       text;
  v_own_status     text;
  v_coach_id       uuid;
  v_coach_plan     text;
  v_coach_status   text;
  v_effective_plan text;
BEGIN
  -- Exempt / admin win outright
  SELECT
    COALESCE(u.is_exempt, false),
    COALESCE(u.is_admin, false),
    u.trial_ends_at
  INTO v_is_exempt, v_is_admin, v_trial_ends
  FROM public.users u
  WHERE u.id = p_athlete_id;

  IF v_is_exempt THEN
    RETURN jsonb_build_object('limit', -1, 'source', 'exempt');
  END IF;

  IF v_is_admin THEN
    RETURN jsonb_build_object('limit', -1, 'source', 'admin');
  END IF;

  -- Trial active → unlimited
  IF v_trial_ends IS NOT NULL AND v_trial_ends > now() THEN
    RETURN jsonb_build_object('limit', -1, 'source', 'trial');
  END IF;

  -- Athlete's own active subscription
  SELECT s.plan_key, s.status INTO v_own_plan, v_own_status
  FROM public.subscriptions s
  WHERE s.user_id = p_athlete_id AND s.status = 'active'
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_own_plan IS NOT NULL
    AND v_own_plan IN ('coach_pro', 'coach_team', 'athlete_premium', 'athlete_indep_premium')
  THEN
    RETURN jsonb_build_object('limit', -1, 'source', v_own_plan);
  END IF;

  -- Coached athlete? → inherit coach plan
  SELECT car.coach_id INTO v_coach_id
  FROM public.coach_athlete_relationship car
  WHERE car.athlete_id = p_athlete_id AND car.status = 'active'
  ORDER BY car.created_at DESC
  LIMIT 1;

  IF v_coach_id IS NOT NULL THEN
    SELECT s.plan_key, s.status INTO v_coach_plan, v_coach_status
    FROM public.subscriptions s
    WHERE s.user_id = v_coach_id AND s.status = 'active'
    ORDER BY s.created_at DESC
    LIMIT 1;

    v_effective_plan := COALESCE(v_coach_plan, 'coach_free');

    IF v_effective_plan IN ('coach_pro', 'coach_team') THEN
      RETURN jsonb_build_object(
        'limit', -1,
        'source', 'coach',
        'coach_plan', v_effective_plan,
        'coach_id', v_coach_id
      );
    END IF;

    -- Coach on free plan → coach-level quota (shared)
    RETURN jsonb_build_object(
      'limit', 1,
      'source', 'coach',
      'coach_plan', v_effective_plan,
      'coach_id', v_coach_id
    );
  END IF;

  -- Default: independent / solo free
  RETURN jsonb_build_object('limit', 1, 'source', COALESCE(v_own_plan, 'free'));
END;
$$;

REVOKE ALL ON FUNCTION public.get_ai_analysis_limit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_analysis_limit(uuid)
  TO authenticated, service_role;

COMMIT;

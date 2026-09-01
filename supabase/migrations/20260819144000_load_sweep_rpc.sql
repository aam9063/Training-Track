-- =========================================================================
-- Migration: load_sweep_rpc (UP)
-- get_athletes_needing_load_refresh(...) — SECURITY DEFINER candidate query
-- for the daily training-load sweep (task 3.2, next phase). Follows the
-- repo's existing SECURITY DEFINER RPC pattern (search_path pinned,
-- REVOKE FROM PUBLIC, grant only to the roles that call it).
-- See: openspec/changes/training-load-monitoring-agent/design.md
--      (Migration Plan #5, "sweep candidate predicate must widen")
--
-- p_since threshold (documented, per task 1.12 — this is explicitly
-- "unresolved in spec", not silently assumed):
--   The candidate query's Strava-activity branch is a coarse "is this
--   athlete plausibly still active" pre-filter, not itself a freshness
--   gate (that's `d.computed_at < now() - interval '20 hours'` below,
--   which already governs actual re-compute cadence). Using too narrow a
--   p_since (e.g. "yesterday only") risks silently skipping athletes who
--   trained a few days ago but not literally in the last 24h, while a
--   truly-dormant athlete's stale row causes no harm (their CTL/ATL would
--   just decay toward 0, already reflected by the last real compute).
--   CALLERS (training-load-monitor's sweep mode, task 3.2) SHOULD pass
--   `p_since = today - 30 days`: generous enough to never silently miss a
--   recently-active athlete, while still excluding long-dormant accounts
--   from indefinite re-sweeping. This value is a documented DEFAULT
--   recommendation for the caller, not hardcoded in the SQL below (the
--   function takes p_since as a parameter, per design's exact signature) —
--   revisit if Phase 3 profiling shows a different threshold is warranted.
-- =========================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_athletes_needing_load_refresh(
  p_today date,
  p_since timestamptz,
  p_week_start date,
  p_calc_version smallint,
  p_limit integer DEFAULT 200,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (athlete_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT a.id
  FROM public.athletes a
  LEFT JOIN public.daily_training_load d
    ON d.athlete_id = a.id AND d.date = p_today
  WHERE (
      EXISTS (
        SELECT 1 FROM public.strava_activities sa
        WHERE sa.athlete_id = a.id
          AND sa.deleted = false
          AND sa.start_date_local >= p_since -- uses idx_strava_activities_not_deleted
      )
      OR EXISTS (
        SELECT 1 FROM public.training_sessions ts -- session-only athletes (no Strava data)
        WHERE ts.athlete_id = a.id
          AND ts.scheduled_date >= p_week_start -- uses idx_training_sessions_athlete_date
      )
    )
    AND (
      d.athlete_id IS NULL
      OR d.calc_version < p_calc_version
      OR d.computed_at < now() - interval '20 hours'
    )
  ORDER BY a.id
  LIMIT p_limit OFFSET p_offset;
$function$;

-- Backend-only, mirroring get_athlete_planned_km's grant shape: invoked
-- exclusively from training-load-monitor with service_role, never from the
-- client.
REVOKE EXECUTE ON FUNCTION public.get_athletes_needing_load_refresh(date, timestamptz, date, smallint, integer, integer)
  FROM PUBLIC, anon, authenticated;

COMMIT;

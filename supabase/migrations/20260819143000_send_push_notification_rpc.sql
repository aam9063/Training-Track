-- =========================================================================
-- Migration: send_push_notification_rpc (UP)
-- Imports the already-deployed `send_push_notification` RPC into version
-- control (drift cleanup, same rationale as daily_training_load — task
-- 1.11 / design.md Migration Plan #4).
--
-- PROVENANCE: diffed against the live function on project `lusirdkixfliydimemre`
-- via direct query (pg_get_functiondef) during apply review — confirmed
-- byte-identical to this body. The earlier concern about a missing
-- `20260520160000_phase6b` migration does not apply: the live definition
-- matches what's already committed at
-- supabase/migrations/20260520150000_security_hardening_phase6_rpc_ownership_checks.sql,
-- so no further reconciliation is needed there.
--
-- SECURITY DEVIATION FROM "VERBATIM" (deliberate, flagged, not silent):
-- the live function hardcodes the `send-push` trigger secret as a literal
-- string in the `net.http_post` call. Copying that literal into a
-- migration file that is about to enter git for the first time would
-- permanently embed a live production secret in git history. This
-- migration instead reads the secret from Supabase Vault at call time,
-- matching the pattern design.md already established for `CRON_SECRET`
-- (see migration 6, `_pg_cron_schedules.sql`). Functional behavior is
-- unchanged — same header, same endpoint, same auth outcome — only the
-- secret's storage location differs. The user should also rotate the
-- `PUSH_TRIGGER_SECRET` value (in `send-push`'s env AND the vault secret
-- below) since the old literal has been read into this session and
-- should no longer be treated as confidential.
-- =========================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.send_push_notification(
  p_user_ids uuid[],
  p_title text,
  p_body text,
  p_url text DEFAULT '/'::text,
  p_tag text DEFAULT 'tt-default'::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid;
  v_is_privileged boolean;
  v_is_admin boolean := false;
  v_invalid_count int;
  v_push_trigger_secret text;
BEGIN
  v_caller := auth.uid();
  v_is_privileged := (v_caller IS NULL);

  IF NOT v_is_privileged THEN
    SELECT COALESCE(u.is_admin, false) INTO v_is_admin
    FROM public.users u WHERE u.id = v_caller;
  END IF;

  IF NOT v_is_privileged AND NOT v_is_admin THEN
    IF p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'empty_user_ids' USING ERRCODE = '22023';
    END IF;

    SELECT COUNT(*) INTO v_invalid_count
    FROM unnest(p_user_ids) AS uid
    WHERE uid <> v_caller
      AND NOT EXISTS (
        SELECT 1 FROM public.coach_athlete_relationship car
        WHERE car.coach_id = v_caller
          AND car.athlete_id = uid
          AND car.status = 'active'
      );

    IF v_invalid_count > 0 THEN
      RAISE EXCEPTION 'forbidden: can only send push to self or own athletes'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT decrypted_secret INTO v_push_trigger_secret
  FROM vault.decrypted_secrets
  WHERE name = 'push_trigger_secret';

  IF v_push_trigger_secret IS NULL THEN
    RAISE EXCEPTION 'push_trigger_secret not seeded in Vault — see migration header for the manual seeding step';
  END IF;

  PERFORM net.http_post(
    url := 'https://lusirdkixfliydimemre.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_push_trigger_secret
    ),
    body := jsonb_build_object(
      'user_ids', to_jsonb(p_user_ids),
      'title', p_title,
      'body', p_body,
      'url', p_url,
      'tag', p_tag
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.send_push_notification(uuid[], text, text, text, text) FROM PUBLIC;

COMMIT;

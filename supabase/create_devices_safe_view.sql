-- =============================================
-- DEVICES SAFE VIEW
-- Exposes device connection info WITHOUT sensitive tokens.
-- Coaches should query this view instead of the devices table directly.
-- =============================================

CREATE OR REPLACE VIEW public.devices_safe_view
WITH (security_invoker = true)
AS
SELECT
  id,
  athlete_id,
  device_type,
  strava_athlete_id,
  token_expires_at,
  created_at,
  updated_at
FROM public.devices;

-- The view inherits RLS from the underlying devices table,
-- so coaches can only see their athletes' rows.
-- But even if they do, tokens are not exposed.

COMMENT ON VIEW public.devices_safe_view IS
  'Safe view of devices table excluding access_token and refresh_token. Use this for coach-facing queries.';

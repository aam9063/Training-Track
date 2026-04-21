/**
 * Helpers for dealing with the dual id system used by `strava_activities`:
 *
 *   - `id`         → UUID (internal PK, used by FKs on related tables such as
 *                    `strava_activity_streams.activity_id`).
 *   - `strava_id`  → bigint (the id Strava itself gives us; unique per athlete).
 *
 * Several charts/services historically expected the UUID but the caller may
 * pass the bigint (e.g. `activity.id` from `formatStravaActivity` is the
 * bigint, while `activity.internal_id` is the UUID). These helpers let the
 * query side defensively pick the right column so we never throw a
 * PostgREST 400 "invalid input syntax for type uuid".
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True when `value` looks like a canonical 36-char UUID.
 */
export const isUuid = (value) => {
  if (value == null) return false;
  return typeof value === 'string' && UUID_RE.test(value);
};

/**
 * Apply the right equality filter for a strava_activities id, regardless of
 * whether the caller provided the internal UUID or the Strava bigint.
 *
 * Usage:
 *   const query = supabase.from('strava_activities').select('...');
 *   const { data } = await filterStravaActivityId(query, id).maybeSingle();
 */
export const filterStravaActivityId = (query, value) => {
  if (isUuid(value)) return query.eq('id', value);
  return query.eq('strava_id', value);
};

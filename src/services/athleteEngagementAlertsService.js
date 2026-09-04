/**
 * Athlete Engagement Alerts Service
 * Read/lifecycle CRUD for `athlete_engagement_alerts` (the engagement-agent's
 * output — see supabase/functions/_shared/engagementCore.js and
 * supabase/functions/engagement-monitor/). RLS is coach-via-active-relationship
 * + service_role ONLY — no self-select (see design.md's RLS decision) — this
 * service never widens or narrows that, it just reads/writes the columns a
 * caller with valid RLS access is already allowed to touch. For a supervised
 * athlete querying their own id, RLS returns `[]` here by design.
 */
import { supabase } from '../lib/supabase';

/**
 * Get engagement alerts for an athlete. A coach viewing a supervised
 * athlete's alerts sees rows; the athlete querying their own id sees none
 * (no self-select policy) — RLS decides what's actually visible, this just
 * shapes the query.
 *
 * @param {string} athleteId
 * @param {{status?: 'open'|'resolved', includeDismissed?: boolean}} [options]
 * @returns {Promise<Array>}
 */
export const getEngagementAlerts = async (athleteId, options = {}) => {
  const { status = 'open', includeDismissed = false } = options;

  let query = supabase
    .from('athlete_engagement_alerts')
    .select(
      'id, athlete_id, recipient_id, alert_type, severity, metric_date, silence_days, metrics, message_es, status, episode_started_on, last_seen_on, resolved_at, read_at, dismissed_at, created_at, updated_at',
    )
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (!includeDismissed) query = query.is('dismissed_at', null);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

/**
 * Mark an engagement alert as read (does not affect its open/resolved
 * lifecycle — `read_at`/`dismissed_at` are orthogonal to `status`, same
 * convention as `training_load_alerts`).
 * @param {string} alertId
 */
export const markRead = async (alertId) => {
  const { data, error } = await supabase
    .from('athlete_engagement_alerts')
    .update({ read_at: new Date().toISOString() })
    .eq('id', alertId)
    .is('read_at', null)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
};

/**
 * Dismiss an engagement alert. Frees the dedup slot for that
 * (athlete_id, alert_type) — the next sweep that still finds the athlete
 * silent will create a new alert. Sets `status: 'resolved'` in addition to
 * `dismissed_at` (the fix confirmed necessary in Agent 1's `sdd-verify`
 * pass for `training_load_alerts`'s `dismiss()` — carried over here so the
 * same bug is not reintroduced).
 * @param {string} alertId
 */
export const dismiss = async (alertId) => {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('athlete_engagement_alerts')
    .update({ dismissed_at: nowIso, status: 'resolved', resolved_at: nowIso })
    .eq('id', alertId)
    .is('dismissed_at', null)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
};

/**
 * Training Load Alerts Service
 * Read/lifecycle CRUD for `training_load_alerts` (the single alert
 * rulebook's output — see supabase/functions/_shared/trainingLoadCore.js
 * and supabase/functions/training-load-monitor/). RLS enforces visibility
 * (self-select, coach-select via active relationship, service_role) —
 * this service never widens or narrows that, it just reads/writes the
 * columns a caller with valid RLS access is already allowed to touch.
 */
import { supabase } from '../lib/supabase';

/**
 * Get alerts for an athlete. Works for both an athlete viewing their own
 * alerts and a coach viewing a supervised athlete's alerts — RLS decides
 * what's actually visible, this just shapes the query.
 *
 * @param {string} athleteId
 * @param {{status?: 'open'|'resolved', includeDismissed?: boolean}} [options]
 * @returns {Promise<Array>}
 */
export const getAlerts = async (athleteId, options = {}) => {
  const { status = 'open', includeDismissed = false } = options;

  let query = supabase
    .from('training_load_alerts')
    .select(
      'id, athlete_id, recipient_id, alert_type, severity, metric_date, metrics, message_es, status, episode_started_on, last_seen_on, resolved_at, read_at, dismissed_at, created_at, updated_at',
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
 * Mark an alert as read (does not affect its open/resolved lifecycle —
 * `read_at`/`dismissed_at` are orthogonal to `status`, per design.md).
 * @param {string} alertId
 */
export const markRead = async (alertId) => {
  const { data, error } = await supabase
    .from('training_load_alerts')
    .update({ read_at: new Date().toISOString() })
    .eq('id', alertId)
    .is('read_at', null)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
};

/**
 * Dismiss an alert. Per the "Alert Lifecycle" requirement, dismissing
 * frees the dedup slot for that (athlete_id, alert_type) — the next
 * evaluation that still finds the condition true will create a new alert.
 * @param {string} alertId
 */
export const dismiss = async (alertId) => {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('training_load_alerts')
    .update({ dismissed_at: nowIso, status: 'resolved', resolved_at: nowIso })
    .eq('id', alertId)
    .is('dismissed_at', null)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
};

/**
 * Plan Adjustment Suggestions Service
 * Read/lifecycle CRUD for `plan_adjustment_suggestions` (Agent 3's output —
 * see supabase/functions/_shared/planAdjustmentCore.js and
 * supabase/functions/planning-agent/). RLS is coach-via-active-relationship
 * + service_role ONLY — no self-select (see design.md's RLS decision) —
 * this service never widens or narrows that, it just reads/writes the
 * columns a caller with valid RLS access is already allowed to touch. For a
 * supervised athlete querying their own id, RLS returns `[]` here by
 * design — the exact same precedent Agent 2's
 * `athleteEngagementAlertsService.js` established.
 */
import { supabase } from '../lib/supabase';

/**
 * Get plan adjustment suggestions for an athlete. A coach viewing a
 * supervised athlete's suggestions sees rows; the athlete querying their
 * own id sees none (no self-select policy) — RLS decides what's actually
 * visible, this just shapes the query.
 *
 * @param {string} athleteId
 * @param {{status?: 'pending'|'approved'|'rejected'|'expired'|'superseded'}} [options]
 * @returns {Promise<Array>}
 */
export const getPlanAdjustments = async (athleteId, options = {}) => {
  const { status = 'pending' } = options;

  let query = supabase
    .from('plan_adjustment_suggestions')
    .select(
      'id, athlete_id, coach_id, triggering_alert_id, finding_source, patch_type, patch, snapshot, metrics, message_es, status, refusal_reason, earliest_target_date, created_at, decided_at, resolved_at, read_at, updated_at',
    )
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

/**
 * Mark a plan adjustment suggestion as read (does not affect its
 * pending/terminal lifecycle — `read_at` is orthogonal to `status`, same
 * convention as `training_load_alerts`/`athlete_engagement_alerts`).
 * @param {string} suggestionId
 */
export const markRead = async (suggestionId) => {
  const { data, error } = await supabase
    .from('plan_adjustment_suggestions')
    .update({ read_at: new Date().toISOString() })
    .eq('id', suggestionId)
    .is('read_at', null)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
};

/**
 * Approve a pending suggestion — the ONLY code path in this feature that
 * can write `training_sessions` (see design.md's "APPLY" data-flow). Calls
 * the `SECURITY DEFINER` RPC, which re-authorizes the caller as the active
 * coach and re-diffs every target session against the suggestion's own
 * snapshot before writing anything.
 *
 * `apply_plan_adjustment` is `RETURNS TABLE (applied boolean,
 * refusal_reason text, session_ids uuid[])` — PostgREST returns
 * `RETURNS TABLE` functions as an array of row objects, so this unwraps
 * the single row before handing the caller a flat result.
 *
 * Three possible outcomes for the caller to branch on:
 *   - `{applied: true, refusalReason: null, sessionIds: [...]}` — success.
 *   - `{applied: false, refusalReason: 'snapshot_drift', sessionIds: []}` —
 *     the live plan changed since this suggestion was computed; zero
 *     sessions were written and the suggestion is now `superseded`.
 *   - a thrown error — a hard failure (missing suggestion id, coach has no
 *     active relationship with the athlete, etc.).
 *
 * @param {string} suggestionId
 * @returns {Promise<{applied: boolean, refusalReason: string|null, sessionIds: string[]}>}
 */
export const approve = async (suggestionId) => {
  const { data, error } = await supabase.rpc('apply_plan_adjustment', {
    p_suggestion_id: suggestionId,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return {
    applied: row?.applied ?? false,
    refusalReason: row?.refusal_reason ?? null,
    sessionIds: row?.session_ids ?? [],
  };
};

/**
 * Reject a pending suggestion. Plain client-side UPDATE under the coach
 * UPDATE policy — no RPC, because rejecting writes no `training_sessions`
 * row (only `apply_plan_adjustment`'s approval path does, per design.md's
 * "the RPC is the enforcement point for every invariant" decision).
 * @param {string} suggestionId
 */
export const reject = async (suggestionId) => {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('plan_adjustment_suggestions')
    .update({ status: 'rejected', decided_at: nowIso, resolved_at: nowIso })
    .eq('id', suggestionId)
    .eq('status', 'pending')
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
};

import { supabase } from '../lib/supabase';

/**
 * Create a Stripe Checkout session and return the redirect URL.
 * @param {string} planKey - e.g. 'coach_pro', 'athlete_premium'
 * @param {string} billingInterval - 'month' or 'year'
 * @returns {Promise<{url: string} | {error: string}>}
 */
export const createCheckout = async (planKey, billingInterval) => {
  const { data, error } = await supabase.functions.invoke('stripe-checkout', {
    body: { plan_key: planKey, billing_interval: billingInterval },
  });

  if (error) return { error: error.message || 'Error al crear la sesión de pago' };
  if (data?.error) return { error: data.error };
  return { url: data.url };
};

/**
 * Create a Stripe Customer Portal session and return the redirect URL.
 * @returns {Promise<{url: string} | {error: string}>}
 */
export const createPortalSession = async () => {
  const { data, error } = await supabase.functions.invoke('stripe-portal', {
    body: {},
  });

  if (error) return { error: error.message || 'Error al abrir el portal' };
  if (data?.error) return { error: data.error };
  return { url: data.url };
};

/**
 * Get the current user's subscription from the DB.
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
export const getSubscription = async (userId) => {
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  return data;
};

/**
 * Commit a plan selection via the commit_plan_selection RPC.
 * Writes users.plan_selected_at + users.selected_plan and, for free plans,
 * inserts a row in subscriptions. The RPC is SECURITY DEFINER and idempotent.
 *
 * @param {string} planKey - one of coach_free|coach_pro|coach_team|athlete_free|athlete_premium
 * @param {'month'|'year'} [billingInterval='month']
 * @returns {Promise<{ data: object|null, error: { code: string, message: string } | null }>}
 */
export const commitPlanSelection = async (planKey, billingInterval = 'month') => {
  const { data, error } = await supabase.rpc('commit_plan_selection', {
    p_plan_key: planKey,
    p_billing_interval: billingInterval,
  });

  if (error) {
    // Map known RPC error messages. We MUST match on the message text because
    // SQLSTATE 23505 is shared with regular unique_violation errors.
    const msg = (error.message || '').toLowerCase();
    let code = 'unknown';
    if (msg.includes('plan_already_selected')) code = 'plan_already_selected';
    else if (msg.includes('invalid_plan_key')) code = 'invalid_plan_key';
    else if (msg.includes('invalid_billing_interval')) code = 'invalid_billing_interval';
    else if (msg.includes('plan_role_mismatch')) code = 'plan_role_mismatch';
    else if (msg.includes('unauthorized')) code = 'unauthorized';
    return { data: null, error: { code, message: error.message } };
  }

  return { data, error: null };
};

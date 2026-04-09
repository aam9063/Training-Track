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

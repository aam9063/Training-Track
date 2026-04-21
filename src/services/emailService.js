import { supabase } from '../lib/supabase';

/**
 * Invoke the `send-email` Supabase Edge Function.
 *
 * @param {Object} params
 * @param {string} params.to - Recipient email address.
 * @param {string} params.template - Template key (welcome-coach, welcome-athlete,
 *   coach-invite, trial-ending, payment-failed).
 * @param {Object} [params.vars] - Template variables.
 * @returns {Promise<{ data: any|null, error: { code: string, message: string }|null }>}
 */
export async function sendEmail({ to, template, vars = {} }) {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: { to, template, vars },
    });
    if (error) {
      return {
        data: null,
        error: { code: 'invoke_error', message: error.message },
      };
    }
    if (data?.ok === false) {
      return {
        data: null,
        error: {
          code: data.error || 'unknown',
          message: data.detail || data.error || 'Error desconocido',
        },
      };
    }
    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { code: 'unexpected', message: err?.message || 'Error inesperado' },
    };
  }
}

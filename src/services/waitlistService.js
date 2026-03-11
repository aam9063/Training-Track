import { supabase } from '../lib/supabase';

/**
 * Subscribe an email to the waitlist.
 * @param {string} email
 * @param {string} source - where the signup came from (hero, footer, cta, promo)
 * @returns {{ success: boolean, alreadyExists?: boolean, error?: any }}
 */
export const joinWaitlist = async (email, source = 'landing') => {
  if (!email || !email.includes('@')) {
    return { success: false, error: 'Email inválido' };
  }

  const { error } = await supabase
    .from('waitlist')
    .insert({ email: email.trim().toLowerCase(), source });

  if (error) {
    // Unique constraint violation → already subscribed
    if (error.code === '23505') {
      return { success: true, alreadyExists: true };
    }
    console.error('Waitlist error:', error);
    return { success: false, error };
  }

  return { success: true, alreadyExists: false };
};

import { supabase } from '../lib/supabase';

/**
 * Permanently delete the current user's account.
 *
 * Calls the `delete-account` Edge Function, which:
 *  - Cancels any active Stripe subscription (immediate, no refund).
 *  - Inactivates coach_athlete_relationship rows.
 *  - Removes user objects from Storage (profile-images, gym-files).
 *  - Writes an audit row to `deleted_accounts_log` (GDPR-safe hash).
 *  - Deletes the auth.users row (cascades across the schema).
 *
 * After this call the JWT is still valid in-memory; the caller MUST
 * sign the user out and redirect to `/`.
 *
 * @param {{ reason?: string }} [opts]
 * @returns {Promise<{ ok: true } | { error: string }>}
 */
export async function deleteAccount(opts = {}) {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    body: {
      confirmation: 'ELIMINAR',
      reason: opts.reason || null,
    },
  });
  if (error) return { error: error.message || String(error) };
  if (data?.error) return { error: data.error };
  return { ok: true, steps: data?.steps };
}

// delete-account Edge Function
//
// Permanent account deletion flow (GDPR).
// - Requires a valid user JWT (the account-owner performs the deletion).
// - Confirmation string "ELIMINAR" must be sent in the body.
// - Cancels any active Stripe subscription (immediate, no refund).
// - Inactivates coach_athlete_relationship rows (does NOT delete the other party).
// - Removes the user's objects from Storage buckets (profile-images, gym-files).
// - Writes an audit row to public.deleted_accounts_log (GDPR-safe hash).
// - Deletes the auth.users row (ON DELETE CASCADE propagates to public.users
//   and the rest of the schema thanks to existing FKs + migration
//   20260422120000_delete_account_cascades.sql).
//
// Deploy:
//   npx supabase functions deploy delete-account --project-ref lusirdkixfliydimemre
// verify_jwt defaults to true → only logged-in users can call it.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || '';

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function cancelStripeSubscription(subscriptionId: string): Promise<{ ok: boolean; error?: string }> {
  if (!stripeSecretKey) return { ok: false, error: 'STRIPE_SECRET_KEY missing' };
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/subscriptions/${subscriptionId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${stripeSecretKey}` },
      }
    );
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `stripe ${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function removeAllFromBucket(bucket: string, prefix: string): Promise<number> {
  // List everything under `${prefix}/` recursively and remove in batches.
  let removed = 0;
  try {
    const { data: list, error } = await admin.storage.from(bucket).list(prefix, {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error || !list) return 0;

    const paths: string[] = [];
    for (const item of list) {
      if (!item.name) continue;
      // Folder entries have no id and no metadata.
      if (item.id) {
        paths.push(`${prefix}/${item.name}`);
      } else {
        // Nested folder — recurse one level (sufficient for our buckets).
        const sub = await admin.storage.from(bucket).list(`${prefix}/${item.name}`, { limit: 1000 });
        if (sub.data) {
          for (const s of sub.data) {
            if (s.id) paths.push(`${prefix}/${item.name}/${s.name}`);
          }
        }
      }
    }

    if (paths.length > 0) {
      const { data: del } = await admin.storage.from(bucket).remove(paths);
      removed = del?.length ?? 0;
    }
  } catch (_err) {
    // swallow — we continue best-effort
  }
  return removed;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // -------- Auth --------
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  const token = authHeader.replace('Bearer ', '');
  let userId = '';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    userId = payload.sub;
    if (!userId) throw new Error('no sub');
  } catch {
    return json({ error: 'invalid_token' }, 401);
  }

  // -------- Body --------
  let body: { confirmation?: string; reason?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  if (body.confirmation !== 'ELIMINAR') {
    return json({ error: 'invalid_confirmation' }, 400);
  }

  // -------- Fetch user info --------
  const { data: userRow, error: userErr } = await admin
    .from('users')
    .select('id, email, role, stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();

  if (userErr || !userRow) {
    return json({ error: 'user_not_found' }, 404);
  }

  const role: string = userRow.role || 'athlete';
  const email: string = userRow.email || '';
  const stripeCustomerId: string | null = userRow.stripe_customer_id || null;

  const steps: Record<string, unknown> = {};

  // -------- Cancel Stripe subscription (immediate) --------
  const { data: subRow } = await admin
    .from('subscriptions')
    .select('stripe_subscription_id, status')
    .eq('user_id', userId)
    .maybeSingle();

  let stripeSubscriptionId: string | null = null;
  let hadSubscription = false;
  if (subRow?.stripe_subscription_id) {
    stripeSubscriptionId = subRow.stripe_subscription_id;
    hadSubscription = true;
    const stripeResult = await cancelStripeSubscription(stripeSubscriptionId);
    steps.stripe = stripeResult;
  } else {
    steps.stripe = { skipped: 'no_subscription' };
  }

  // -------- Inactivate coach_athlete_relationship --------
  try {
    if (role === 'coach') {
      // Coach leaving — unlink all active athletes (do NOT delete the athletes).
      const { data: updated } = await admin
        .from('coach_athlete_relationship')
        .update({ status: 'inactive' })
        .eq('coach_id', userId)
        .eq('status', 'active')
        .select('athlete_id');
      steps.unlinked_athletes = updated?.length ?? 0;
    } else {
      // Athlete leaving — unlink from any active coach.
      const { data: updated } = await admin
        .from('coach_athlete_relationship')
        .update({ status: 'inactive' })
        .eq('athlete_id', userId)
        .eq('status', 'active')
        .select('coach_id');
      steps.unlinked_coaches = updated?.length ?? 0;
    }
  } catch (err) {
    steps.relationship_error = String(err);
  }

  // -------- Storage cleanup --------
  try {
    const profRemoved = await removeAllFromBucket('profile-images', userId);
    steps.profile_images_removed = profRemoved;
  } catch (err) {
    steps.profile_images_error = String(err);
  }

  if (role === 'coach') {
    try {
      const gymRemoved = await removeAllFromBucket('gym-files', userId);
      steps.gym_files_removed = gymRemoved;
    } catch (err) {
      steps.gym_files_error = String(err);
    }
  }

  // -------- Audit log --------
  try {
    const emailHash = email ? await sha256Hex(email.toLowerCase().trim()) : null;
    await admin.from('deleted_accounts_log').insert({
      deleted_user_id: userId,
      email_hash: emailHash,
      role,
      had_subscription: hadSubscription,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      reason: body.reason ? String(body.reason).slice(0, 500) : null,
    });
    steps.audit_logged = true;
  } catch (err) {
    steps.audit_error = String(err);
  }

  // -------- Delete auth.users (cascade to public.users and the rest) --------
  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) {
    return json(
      {
        error: 'auth_delete_failed',
        message: delErr.message,
        partial: steps,
      },
      500
    );
  }

  return json({ ok: true, steps });
});

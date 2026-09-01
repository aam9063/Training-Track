import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Verify Stripe webhook signature (using Web Crypto API)
async function verifySignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  const parts = sigHeader.split(',').reduce((acc: Record<string, string>, part: string) => {
    const [key, val] = part.split('=');
    acc[key.trim()] = val;
    return acc;
  }, {});

  const timestamp = parts['t'];
  const signature = parts['v1'];
  if (!timestamp || !signature) return false;

  // Check timestamp tolerance (5 minutes)
  const tolerance = 300;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > tolerance) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');

  return expected === signature;
}

// Map Stripe price ID to plan_key
function resolvePlanKey(priceId: string): string {
  const map: Record<string, string> = {};
  const envPairs = [
    ['STRIPE_PRICE_COACH_PRO_MONTHLY', 'coach_pro'],
    ['STRIPE_PRICE_COACH_PRO_YEARLY', 'coach_pro'],
    ['STRIPE_PRICE_COACH_TEAM_MONTHLY', 'coach_team'],
    ['STRIPE_PRICE_COACH_TEAM_YEARLY', 'coach_team'],
    ['STRIPE_PRICE_ATHLETE_PREMIUM_MONTHLY', 'athlete_premium'],
    ['STRIPE_PRICE_ATHLETE_PREMIUM_YEARLY', 'athlete_premium'],
  ];
  for (const [envKey, plan] of envPairs) {
    const id = Deno.env.get(envKey);
    if (id) map[id] = plan;
  }
  return map[priceId] || 'unknown';
}

function resolveBillingInterval(priceId: string): string {
  const monthlyKeys = [
    'STRIPE_PRICE_COACH_PRO_MONTHLY',
    'STRIPE_PRICE_COACH_TEAM_MONTHLY',
    'STRIPE_PRICE_ATHLETE_PREMIUM_MONTHLY',
  ];
  for (const key of monthlyKeys) {
    if (Deno.env.get(key) === priceId) return 'month';
  }
  return 'year';
}

// Safely convert a Stripe unix timestamp (seconds) to an ISO string, or null
// if the value is missing / not a finite number. Needed because Stripe API
// 2025+ moved period boundaries off the Subscription object and into each
// subscription item, so reading `sub.current_period_start` directly returns
// undefined and would throw RangeError.
function toIsoOrNull(unixSeconds: unknown): string | null {
  if (typeof unixSeconds !== 'number' || !Number.isFinite(unixSeconds)) return null;
  return new Date(unixSeconds * 1000).toISOString();
}

// Read the current billing period from a Stripe Subscription. Newer API
// versions expose these on the subscription item, older ones on the root.
function readPeriod(sub: Record<string, unknown>): { start: string | null; end: string | null } {
  const item = ((sub.items as Record<string, unknown> | undefined)?.data as Array<Record<string, unknown>> | undefined)?.[0];
  const startRaw = (item?.current_period_start as number | undefined) ?? (sub.current_period_start as number | undefined);
  const endRaw = (item?.current_period_end as number | undefined) ?? (sub.current_period_end as number | undefined);
  return { start: toIsoOrNull(startRaw), end: toIsoOrNull(endRaw) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200 });
  }

  try {
    const body = await req.text();
    const sigHeader = req.headers.get('stripe-signature') || '';

    // Verify webhook signature
    const isValid = await verifySignature(body, sigHeader, webhookSecret);
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 });
    }

    const event = JSON.parse(body);
    const eventType = event.type;

    switch (eventType) {
      // Checkout completed — create/update subscription
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode !== 'subscription') break;

        const userId = session.metadata?.supabase_user_id;
        const subscriptionId = session.subscription;
        if (!userId || !subscriptionId) break;

        // Fetch subscription details from Stripe
        const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
          headers: { 'Authorization': `Bearer ${stripeSecretKey}` },
        });
        const sub = await subRes.json();

        const priceId = sub.items?.data?.[0]?.price?.id || '';
        const planKey = session.metadata?.plan_key || resolvePlanKey(priceId);

        // Save stripe_customer_id on user, and commit the plan selection if
        // the user had not picked one before (covers the edge case where a
        // user registered without a plan committed and then paid via Stripe).
        // plan_selected_at / selected_plan writes bypass the block trigger
        // because this runs under the service_role JWT.
        await supabase.from('users')
          .update({
            stripe_customer_id: session.customer,
            plan_selected_at: new Date().toISOString(),
            selected_plan: planKey,
          })
          .eq('id', userId)
          .is('plan_selected_at', null);

        // Always ensure stripe_customer_id is up to date, even if a plan was
        // already committed (e.g. user upgraded later).
        await supabase.from('users')
          .update({ stripe_customer_id: session.customer })
          .eq('id', userId);

        // Upsert subscription
        const period1 = readPeriod(sub);
        await supabase.from('subscriptions').upsert({
          user_id: userId,
          stripe_subscription_id: subscriptionId,
          stripe_price_id: priceId,
          plan_key: planKey,
          status: sub.status || 'active',
          billing_interval: resolveBillingInterval(priceId),
          current_period_start: period1.start,
          current_period_end: period1.end,
          cancel_at_period_end: sub.cancel_at_period_end || false,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

        break;
      }

      // Subscription created
      case 'customer.subscription.created':
      // Subscription updated (plan change, renewal, cancel toggle)
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const userId = sub.metadata?.supabase_user_id;
        if (!userId) break;

        const priceId = sub.items?.data?.[0]?.price?.id || '';
        const planKey = sub.metadata?.plan_key || resolvePlanKey(priceId);

        const period2 = readPeriod(sub);
        await supabase.from('subscriptions').upsert({
          user_id: userId,
          stripe_subscription_id: sub.id,
          stripe_price_id: priceId,
          plan_key: planKey,
          status: sub.status,
          billing_interval: resolveBillingInterval(priceId),
          current_period_start: period2.start,
          current_period_end: period2.end,
          cancel_at_period_end: sub.cancel_at_period_end || false,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

        break;
      }

      // Subscription deleted (fully canceled)
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = sub.metadata?.supabase_user_id;
        if (!userId) break;

        await supabase.from('subscriptions')
          .update({
            status: 'canceled',
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        break;
      }

      // Invoice paid — subscription renewed
      case 'invoice.paid': {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        if (!subscriptionId) break;

        // Fetch fresh subscription data
        const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
          headers: { 'Authorization': `Bearer ${stripeSecretKey}` },
        });
        const sub = await subRes.json();
        const userId = sub.metadata?.supabase_user_id;
        if (!userId) break;

        const period3 = readPeriod(sub);
        await supabase.from('subscriptions')
          .update({
            status: 'active',
            current_period_start: period3.start,
            current_period_end: period3.end,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        break;
      }

      // Payment failed
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        if (!subscriptionId) break;

        const { data: sub } = await supabase.from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscriptionId)
          .maybeSingle();

        if (sub?.user_id) {
          await supabase.from('subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('user_id', sub.user_id);

          // Fire payment-failed email (best-effort; never throw from webhook).
          try {
            const amountDueCents = typeof invoice.amount_due === 'number'
              ? invoice.amount_due
              : 0;
            const amount = (amountDueCents / 100).toFixed(2);

            const { data: userRow } = await supabase
              .from('users')
              .select('email, first_name')
              .eq('id', sub.user_id)
              .maybeSingle();

            let recipientEmail = userRow?.email as string | undefined;
            let firstName = userRow?.first_name as string | undefined;

            // Fallback to auth admin lookup if email is missing on users row.
            if (!recipientEmail) {
              const { data: authUser } = await supabase.auth.admin.getUserById(sub.user_id);
              recipientEmail = authUser?.user?.email ?? undefined;
            }

            if (recipientEmail) {
              const userName = firstName || recipientEmail.split('@')[0] || 'Usuario';
              const billingPortalUrl = 'https://trainingtrack.es/dashboard/billing';
              const retryUrl = billingPortalUrl;

              await fetch(`${supabaseUrl}/functions/v1/send-email`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${serviceRoleKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  to: recipientEmail,
                  template: 'payment-failed',
                  vars: { userName, amount, retryUrl, billingPortalUrl },
                }),
              });
            }
          } catch (emailErr) {
            console.warn('[stripe-webhook] payment-failed email failed', emailErr);
          }
        }

        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

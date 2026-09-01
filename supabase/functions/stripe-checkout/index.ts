import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Price ID mapping from secrets
const PRICE_MAP: Record<string, string> = {
  coach_pro_month: Deno.env.get('STRIPE_PRICE_COACH_PRO_MONTHLY') || '',
  coach_pro_year: Deno.env.get('STRIPE_PRICE_COACH_PRO_YEARLY') || '',
  coach_team_month: Deno.env.get('STRIPE_PRICE_COACH_TEAM_MONTHLY') || '',
  coach_team_year: Deno.env.get('STRIPE_PRICE_COACH_TEAM_YEARLY') || '',
  athlete_premium_month: Deno.env.get('STRIPE_PRICE_ATHLETE_PREMIUM_MONTHLY') || '',
  athlete_premium_year: Deno.env.get('STRIPE_PRICE_ATHLETE_PREMIUM_YEARLY') || '',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    // Auth: verify JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    let userId: string;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.sub;
      if (!userId) throw new Error('No sub');
    } catch {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Parse body
    const { plan_key, billing_interval } = await req.json();

    if (!plan_key || !billing_interval) {
      return new Response(JSON.stringify({ error: 'plan_key y billing_interval son requeridos' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Check exempt
    const { data: user } = await supabase
      .from('users')
      .select('email, first_name, is_exempt, stripe_customer_id')
      .eq('id', userId)
      .maybeSingle();

    if (user?.is_exempt) {
      return new Response(JSON.stringify({ error: 'Usuario exento de pago' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Resolve price ID
    const priceKey = `${plan_key}_${billing_interval}`;
    const priceId = PRICE_MAP[priceKey];
    if (!priceId) {
      return new Response(JSON.stringify({ error: `Plan no válido: ${priceKey}` }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Get or create Stripe customer
    let customerId = user?.stripe_customer_id;

    if (!customerId) {
      const customerRes = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: user?.email || '',
          name: user?.first_name || '',
          'metadata[supabase_user_id]': userId,
        }),
      });
      const customer = await customerRes.json();
      if (customer.error) throw new Error(customer.error.message);

      customerId = customer.id;

      // Save customer ID to users table
      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
    }

    // Create Checkout Session
    const origin = req.headers.get('origin') || 'https://trainingtrack.es';
    const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: customerId,
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        mode: 'subscription',
        success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/pricing`,
        'metadata[supabase_user_id]': userId,
        'metadata[plan_key]': plan_key,
        'subscription_data[metadata][supabase_user_id]': userId,
        'subscription_data[metadata][plan_key]': plan_key,
      }),
    });

    const session = await sessionRes.json();
    if (session.error) throw new Error(session.error.message);

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});

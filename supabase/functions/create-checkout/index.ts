import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@18.5.0';
import { createClient } from "npm:@supabase/supabase-js@2";
import { PUBLIC_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '../_shared/env.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2025-08-27.basil',
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { planType, billingInterval = 'monthly' } = await req.json();

    if (!planType) {
      return new Response(JSON.stringify({ error: 'Plan type is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get or create Stripe customer
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    let customerId = subscription?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;

      // Persist immediately so webhook events that arrive by customer id
      // (subscription.updated/deleted) can resolve this user, and so we
      // don't create a duplicate Stripe customer on the next checkout.
      const { error: persistError } = await supabase
        .from('subscriptions')
        .upsert(
          { user_id: user.id, stripe_customer_id: customerId },
          { onConflict: 'user_id' }
        );
      if (persistError) {
        console.error('Failed to persist stripe_customer_id:', persistError);
      }
    }

    // Map plan types to Stripe price IDs
    const priceMap: Record<string, { monthly?: string; yearly?: string }> = {
      starter: {
        monthly: 'price_1Sef4fEcpqMQq8izNGWUTkjA',
        yearly: 'price_1Sef79EcpqMQq8izlqzHKPMX',
      },
      pro: {
        monthly: 'price_1Sef5DEcpqMQq8izTmThqQ8F',
        yearly: 'price_1Sef9EEcpqMQq8iz0jUcmPiI',
      },
      agency_plus: {
        monthly: 'price_1Sef5dEcpqMQq8iz5R8HWXKv',
        yearly: 'price_1Sef8WEcpqMQq8izdydF10wI',
      },
    };

    const plan = priceMap[planType];
    if (!plan) {
      return new Response(JSON.stringify({ error: 'Invalid plan type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const priceId = billingInterval === 'yearly' ? plan.yearly : plan.monthly;

    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Price not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Checkout Session
    const origin = req.headers.get('origin') || PUBLIC_URL || 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/billing?success=true`,
      cancel_url: `${origin}/pricing?canceled=true`,
      metadata: {
        user_id: user.id,
        plan_type: planType,
      },
    });

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('Error creating checkout session:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

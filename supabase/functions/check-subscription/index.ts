import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Map Stripe price IDs to plan types
const PRICE_TO_PLAN_MAP: { [key: string]: string } = {
  // Starter plan
  "price_1Sef4fEcpqMQq8izNGWUTkjA": "starter", // monthly
  "price_1Sef79EcpqMQq8izlqzHKPMX": "starter", // yearly
  // Growth plan
  "price_1Sef5DEcpqMQq8izTmThqQ8F": "pro", // monthly
  "price_1Sef9EEcpqMQq8iz0jUcmPiI": "pro", // yearly
  // Agency Plus plan
  "price_1Sef5dEcpqMQq8iz5R8HWXKv": "agency_plus", // monthly
  "price_1Sef8WEcpqMQq8izdydF10wI": "agency_plus", // yearly
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    // Find customer by email
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, ensuring free plan exists");
      
      // Upsert free plan subscription
      const { error: upsertError } = await supabaseClient
        .from("subscriptions")
        .upsert({
          user_id: user.id,
          plan_type: "free",
          status: "active",
          storage_used: 0,
        }, {
          onConflict: "user_id"
        });

      if (upsertError) {
        logStep("Error upserting free subscription", { error: upsertError });
      }

      return new Response(JSON.stringify({ 
        subscribed: false,
        plan_type: "free",
        status: "active"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Get active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      logStep("No active subscription found, setting to free plan");
      
      // Update to free plan
      const { error: updateError } = await supabaseClient
        .from("subscriptions")
        .upsert({
          user_id: user.id,
          plan_type: "free",
          status: "active",
          stripe_customer_id: customerId,
          stripe_subscription_id: null,
          current_period_end: null,
        }, {
          onConflict: "user_id"
        });

      if (updateError) {
        logStep("Error updating to free plan", { error: updateError });
      }

      return new Response(JSON.stringify({ 
        subscribed: false,
        plan_type: "free",
        status: "active"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0].price.id;
    const planType = PRICE_TO_PLAN_MAP[priceId] || "free";
    const subscriptionEnd = subscription.current_period_end 
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;

    logStep("Active subscription found", { 
      subscriptionId: subscription.id, 
      priceId,
      planType,
      endDate: subscriptionEnd 
    });

    // Update subscription in database
    const { error: updateError } = await supabaseClient
      .from("subscriptions")
      .upsert({
        user_id: user.id,
        plan_type: planType,
        status: "active",
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        current_period_end: subscriptionEnd,
      }, {
        onConflict: "user_id"
      });

    if (updateError) {
      logStep("Error updating subscription", { error: updateError });
      throw new Error(`Failed to update subscription: ${updateError.message}`);
    }

    logStep("Subscription updated successfully");

    return new Response(JSON.stringify({
      subscribed: true,
      plan_type: planType,
      status: "active",
      subscription_end: subscriptionEnd
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain, agency_id } = await req.json();

    if (!domain || !agency_id) {
      return new Response(
        JSON.stringify({ error: "Domain and agency_id are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify DNS records by attempting to resolve the domain
    try {
      const response = await fetch(`https://${domain}`, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      });

      const verified = response.ok;

      // Update verification status in database
      const { error: updateError } = await supabaseClient
        .from("agency_branding")
        .update({ 
          custom_domain: domain,
          // You could add a verified field: domain_verified: verified
        })
        .eq("agency_id", agency_id);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ 
          verified,
          message: verified 
            ? "Domain verified successfully" 
            : "Domain not yet accessible. Please check DNS settings."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ 
          verified: false,
          message: "Domain could not be verified. Please check DNS settings and try again."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
  } catch (error) {
    console.error("Error in verify-custom-domain function:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

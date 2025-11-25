import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const JWT_SECRET = Deno.env.get("CLIENT_PORTAL_JWT_SECRET");

if (!JWT_SECRET) {
  console.error("CLIENT_PORTAL_JWT_SECRET is not configured");
  throw new Error("CLIENT_PORTAL_JWT_SECRET environment variable is required");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reset_token, new_password } = await req.json();

    if (!reset_token || !new_password) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find user with valid reset token
    const { data: user, error: userError } = await supabaseAdmin
      .from("client_users")
      .select("*")
      .eq("password_reset_token", reset_token)
      .gt("password_reset_expires_at", new Date().toISOString())
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired reset token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash new password
    const encoder = new TextEncoder();
    const data = encoder.encode(new_password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const password_hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Update password and clear reset token
    await supabaseAdmin
      .from("client_users")
      .update({
        password_hash,
        password_reset_token: null,
        password_reset_expires_at: null
      })
      .eq("id", user.id);

    // Generate JWT token for auto-login
    const header = { alg: "HS256", typ: "JWT" };
    const payload = {
      sub: user.id,
      email: user.email,
      client_id: user.client_id,
      agency_id: user.agency_id,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    };

    const encodedHeader = btoa(JSON.stringify(header));
    const encodedPayload = btoa(JSON.stringify(payload));
    const signature = await crypto.subtle.sign(
      "HMAC",
      await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(JWT_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      ),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    );
    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)));
    const token = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;

    return new Response(
      JSON.stringify({
        token,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          client_id: user.client_id,
          agency_id: user.agency_id,
          role: user.role
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Reset password error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

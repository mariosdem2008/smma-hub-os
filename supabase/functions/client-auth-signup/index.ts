import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const JWT_SECRET = Deno.env.get("SUPABASE_JWT_SECRET") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Signup request received");
    const { invite_token, password, full_name } = await req.json();
    console.log("Request data:", { invite_token: invite_token?.substring(0, 10), has_password: !!password, full_name });

    if (!invite_token || !password) {
      console.error("Missing required fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Validate invite token
    console.log("Validating invite token");
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("client_invites")
      .select("*")
      .eq("invite_token", invite_token)
      .eq("accepted", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (inviteError || !invite) {
      console.error("Invalid invite:", inviteError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired invitation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("Invite validated for email:", invite.email);

    // Check if user already exists
    console.log("Checking for existing user");
    const { data: existingUser } = await supabaseAdmin
      .from("client_users")
      .select("id")
      .eq("email", invite.email)
      .eq("client_id", invite.client_id)
      .single();

    if (existingUser) {
      console.error("User already exists");
      return new Response(
        JSON.stringify({ error: "User already exists" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("No existing user found");

    // Hash password using Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const password_hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Create client user
    console.log("Creating client user");
    const { data: newUser, error: createError } = await supabaseAdmin
      .from("client_users")
      .insert({
        agency_id: invite.agency_id,
        client_id: invite.client_id,
        email: invite.email,
        full_name: full_name || invite.full_name || null,
        role: invite.role,
        password_hash,
        invitation_status: 'accepted'
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating user:", createError);
      return new Response(
        JSON.stringify({ error: "Failed to create user", details: createError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("User created successfully:", newUser.id);

    // Mark invite as accepted
    await supabaseAdmin
      .from("client_invites")
      .update({ accepted: true })
      .eq("id", invite.id);

    // Generate JWT token
    const header = { alg: "HS256", typ: "JWT" };
    const payload = {
      sub: newUser.id,
      email: newUser.email,
      client_id: newUser.client_id,
      agency_id: newUser.agency_id,
      role: newUser.role,
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
          id: newUser.id,
          email: newUser.email,
          full_name: newUser.full_name,
          client_id: newUser.client_id,
          agency_id: newUser.agency_id,
          role: newUser.role
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    const { invite_token } = await req.json();

    if (!invite_token) {
      return new Response(
        JSON.stringify({ error: "Missing invite token" }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // First check if invite exists (regardless of accepted status)
    const { data: invite, error } = await supabaseAdmin
      .from("client_invites")
      .select("*, clients!inner(name, portal_slug)")
      .eq("invite_token", invite_token)
      .single();

    if (error || !invite) {
      return new Response(
        JSON.stringify({ error: "Invalid invitation token" }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Check if invite was already accepted
    if (invite.accepted) {
      return new Response(
        JSON.stringify({
          already_accepted: true,
          portal_slug: invite.clients.portal_slug,
          message: "This invitation has already been accepted"
        }),
        { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Check if invite has expired
    if (new Date(invite.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Invitation has expired" }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Valid, unaccepted invite
    return new Response(
      JSON.stringify({
        email: invite.email,
        full_name: invite.full_name,
        role: invite.role,
        client_id: invite.client_id,
        client_name: invite.clients.name,
        portal_slug: invite.clients.portal_slug,
      }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Validate invite error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});

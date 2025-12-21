import { createClient } from "npm:@supabase/supabase-js@2";
import { portalCors } from "../_shared/cors_portal.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

const FN_VERSION = "client-auth-validate-invite_2025-12-21_3";

Deno.serve(async (req) => {
  const { allowed, headers: cors } = portalCors(req);
  const headers = { ...cors, "Content-Type": "application/json", "X-FN-VERSION": FN_VERSION };

  if (!allowed) {
    return new Response(JSON.stringify({ success: false, code: "E403_ORIGIN", error: "Origin not allowed", v: FN_VERSION }), {
      status: 403,
      headers,
    });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...cors, "X-FN-VERSION": FN_VERSION } });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed", v: FN_VERSION }),
        { status: 405, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    const { invite_token } = await req.json();

    if (!invite_token) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing invite token", v: FN_VERSION }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    });

    // First check if invite exists (regardless of accepted status)
    const { data: invite, error } = await supabaseAdmin
      .from("client_invites")
      .select("*, clients!inner(name, portal_slug)")
      .eq("invite_token", invite_token)
      .single();

    if (error || !invite) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid invitation token", v: FN_VERSION }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Check if invite was already accepted
    if (invite.accepted) {
      return new Response(
        JSON.stringify({
          success: true,
          already_accepted: true,
          portal_slug: invite.clients.portal_slug,
          message: "This invitation has already been accepted",
          v: FN_VERSION,
        }),
        { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Check if invite has expired
    if (new Date(invite.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: "Invitation has expired", v: FN_VERSION }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Valid, unaccepted invite
    return new Response(
      JSON.stringify({
        success: true,
        email: invite.email,
        full_name: invite.full_name,
        role: invite.role,
        client_id: invite.client_id,
        client_name: invite.clients.name,
        portal_slug: invite.clients.portal_slug,
        v: FN_VERSION,
      }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Validate invite error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error", v: FN_VERSION }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});

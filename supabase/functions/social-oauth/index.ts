import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, PUBLIC_URL } from "../_shared/env.ts";

interface OAuthRequest {
  platform: string;
  clientId: string;
  source?: string;
}

function toBase64Url(input: Uint8Array): string {
  const b64 = btoa(String.fromCharCode(...input));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signState(payloadB64Url: string): Promise<string> {
  const secret = Deno.env.get("OAUTH_STATE_SECRET") || SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Missing OAUTH_STATE_SECRET/SUPABASE_SERVICE_ROLE_KEY");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64Url));
  return toBase64Url(new Uint8Array(sig));
}

serve(async (req: Request) => {
  const headers = corsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const { platform, clientId, source = 'agency' } = await req.json() as OAuthRequest;
    
    console.log('[OAUTH] social-oauth called with:', { platform, clientId });

    if (!platform || !clientId) {
      console.error('[OAUTH] Missing platform or clientId');
      return new Response(
        JSON.stringify({ error: 'Missing platform or clientId' }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Supabase env not configured" }),
        { headers: { ...headers, "Content-Type": "application/json" }, status: 500 },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/bearer\s+/i, "");
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const actingUserId = user.id;

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: clientRow, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("agency_id")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError || !clientRow?.agency_id) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const { data: membership } = await supabaseAdmin
      .from("agency_members")
      .select("role")
      .eq("agency_id", clientRow.agency_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a member" }), {
        status: 403,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const META_APP_ID = Deno.env.get('META_APP_ID');
    const META_REDIRECT_URI = Deno.env.get('META_REDIRECT_URI') || `${SUPABASE_URL}/functions/v1/social-oauth-callback`;
    const GRAPH_API_VERSION = Deno.env.get('GRAPH_API_VERSION') || 'v21.0';

    if (!META_APP_ID) {
      console.error('[OAUTH] Missing META_APP_ID');
      return new Response(
        JSON.stringify({ error: 'Missing META_APP_ID environment variable' }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('[OAUTH] Using redirect URI:', META_REDIRECT_URI);

    const statePayload = { clientId, platform, source, userId: actingUserId };
    const statePayloadB64Url = toBase64Url(new TextEncoder().encode(JSON.stringify(statePayload)));
    const stateSigB64Url = await signState(statePayloadB64Url);
    const state = `${statePayloadB64Url}.${stateSigB64Url}`;
    console.log('[OAUTH] STATE:', state);

    const scopes = [
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_insights',
      'pages_show_list',
      'pages_read_engagement',
      'pages_read_user_content',
      'pages_manage_posts',
      'read_insights',
      'ads_read',
      'ads_management',
      'business_management'
    ].join(',');

    console.log('[OAUTH] Requesting scopes:', scopes);

    const url = 
      `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth` +
      `?client_id=${META_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&response_type=code` +
      `&state=${encodeURIComponent(state)}`;

    console.log('[OAUTH] Generated OAuth URL:', url);

    return new Response(
      JSON.stringify({ url }),
      { headers: { ...headers, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[OAUTH] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

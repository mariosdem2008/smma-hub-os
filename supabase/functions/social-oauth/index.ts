import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, PUBLIC_URL } from "../_shared/env.ts";

interface OAuthRequest {
  platform: string;
  clientId: string;
  source?: string;
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = corsHeaders(origin);

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

    const statePayload = { clientId, platform, source };
    const state = btoa(JSON.stringify(statePayload));
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
        headers: { ...corsHeaders(req.headers.get("Origin")), 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

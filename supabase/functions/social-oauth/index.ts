import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface OAuthRequest {
  platform: string;
  clientId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Read JSON body
    const { platform, clientId } = await req.json() as OAuthRequest;
    
    console.log('[OAUTH] social-oauth called with:', { platform, clientId });

    // Validate required fields
    if (!platform || !clientId) {
      console.error('[OAUTH] Missing platform or clientId');
      return new Response(
        JSON.stringify({ error: 'Missing platform or clientId' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Read environment variables
    const META_APP_ID = Deno.env.get('META_APP_ID');
    const META_REDIRECT_URI = Deno.env.get('META_REDIRECT_URI');
    const GRAPH_API_VERSION = Deno.env.get('GRAPH_API_VERSION') || 'v21.0';

    if (!META_APP_ID) {
      console.error('[OAUTH] Missing META_APP_ID');
      return new Response(
        JSON.stringify({ error: 'Missing META_APP_ID environment variable' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    if (!META_REDIRECT_URI) {
      console.error('[OAUTH] Missing META_REDIRECT_URI');
      return new Response(
        JSON.stringify({ error: 'Missing META_REDIRECT_URI environment variable' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Build state payload
    const statePayload = { clientId, platform };
    const state = btoa(JSON.stringify(statePayload));
    console.log('[OAUTH] STATE:', state);

    // Build Facebook OAuth URL
    const scopes = [
      'instagram_basic',
      'instagram_business_basic',
      'instagram_business_content_publish',
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'business_management'
    ].join(',');

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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[OAUTH] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

interface OAuthRequest {
  action: string;
  platform: string;
  clientId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('[OAUTH] authHeader:', authHeader);
    
    if (!authHeader) {
      console.error('[OAUTH] No Authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Extract JWT token
    const token = authHeader.replace('Bearer ', '');
    console.log('[OAUTH] token extracted:', token ? 'present' : 'missing');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Verify user is authenticated by extracting JWT from Authorization header
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    console.log('[OAUTH] authUser:', user ? { id: user.id, email: user.email } : null);
    console.log('[OAUTH] userError:', userError);
    
    if (userError || !user) {
      console.error('[OAUTH] User authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { action, platform, clientId } = await req.json() as OAuthRequest;
    console.log(`[OAUTH] User ${user.id} initiating ${platform} connection for client ${clientId}`);

    // Verify user has access to this client
    const { data: client, error: clientError } = await supabaseClient
      .from('clients')
      .select('id, agency_id')
      .eq('id', clientId)
      .single();

    console.log('[OAUTH] client:', client);
    console.log('[OAUTH] clientError:', clientError);

    if (!client || clientError) {
      console.error('[OAUTH] Client not found');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Verify user is agency member
    const { data: membership, error: membershipError } = await supabaseClient
      .from('agency_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('agency_id', client.agency_id)
      .single();

    console.log('[OAUTH] membership:', membership);
    console.log('[OAUTH] membershipError:', membershipError);

    if (!membership || membershipError) {
      console.error('[OAUTH] Not authorized for this client');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Validate environment variables
    const META_APP_ID = Deno.env.get('META_APP_ID');
    const META_REDIRECT_URI = Deno.env.get('META_REDIRECT_URI');
    const GRAPH_API_VERSION = Deno.env.get('GRAPH_API_VERSION') || 'v21.0';

    if (!META_APP_ID) {
      console.error('[OAUTH] Missing META_APP_ID');
      throw new Error('Missing META_APP_ID');
    }
    if (!META_REDIRECT_URI) {
      console.error('[OAUTH] Missing META_REDIRECT_URI');
      throw new Error('Missing META_REDIRECT_URI');
    }

    console.log('[OAUTH] META_APP_ID:', META_APP_ID);
    console.log('[OAUTH] META_REDIRECT_URI:', META_REDIRECT_URI);
    console.log('[OAUTH] GRAPH_API_VERSION:', GRAPH_API_VERSION);

    // Generate OAuth URL
    const url = await generateOAuthUrl(platform, clientId, user.id, META_APP_ID, META_REDIRECT_URI, GRAPH_API_VERSION);

    if (!url) {
      console.error(`[OAUTH] Platform ${platform} not supported or misconfigured`);
      return new Response(
        JSON.stringify({ error: `Platform ${platform} not supported or misconfigured` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('[OAUTH] Generated URL:', url);

    return new Response(
      JSON.stringify({ url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[OAUTH] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});

async function generateOAuthUrl(
  platform: string,
  clientId: string,
  userId: string,
  metaAppId: string,
  metaRedirectUri: string,
  graphApiVersion: string
): Promise<string | null> {
  // Encode state as base64 with platform, clientId, userId
  const state = btoa(JSON.stringify({ platform, clientId, userId }));
  console.log('[OAUTH] STATE:', state);

  switch (platform.toLowerCase()) {
    case 'instagram':
    case 'facebook':
      // Facebook Business Login OAuth URL with Instagram permissions
      const scopes = [
        'instagram_basic',
        'instagram_content_publish',
        'pages_show_list',
        'pages_read_engagement',
        'business_management'
      ].join(',');

      const url = `https://www.facebook.com/${graphApiVersion}/dialog/oauth?client_id=${metaAppId}&redirect_uri=${encodeURIComponent(metaRedirectUri)}&scope=${scopes}&response_type=code&state=${state}`;
      console.log('[OAUTH] Built OAuth URL:', url);
      return url;

    case 'tiktok':
    case 'youtube':
    case 'linkedin':
      // These platforms are marked as "Coming Soon" in MVP
      console.log(`[OAUTH] Platform ${platform} not yet implemented`);
      return null;

    default:
      console.error(`[OAUTH] Unsupported platform: ${platform}`);
      return null;
  }
}

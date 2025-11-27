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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { action, platform, clientId } = await req.json() as OAuthRequest;

    console.log(`[OAUTH] User ${user.id} initiating ${platform} connection for client ${clientId}`);

    // Verify user has access to this client
    const { data: client } = await supabaseClient
      .from('clients')
      .select('id, agency_id')
      .eq('id', clientId)
      .single();

    if (!client) {
      throw new Error('Client not found');
    }

    // Verify user is agency member
    const { data: membership } = await supabaseClient
      .from('agency_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('agency_id', client.agency_id)
      .single();

    if (!membership) {
      throw new Error('Not authorized for this client');
    }

    // Generate OAuth URL
    const url = await generateOAuthUrl(platform, clientId, user.id);

    if (!url) {
      throw new Error(`Platform ${platform} not supported or misconfigured`);
    }

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
  userId: string
): Promise<string | null> {
  const META_APP_ID = Deno.env.get('META_APP_ID');
  const META_REDIRECT_URI = Deno.env.get('META_REDIRECT_URI');
  const GRAPH_API_VERSION = Deno.env.get('GRAPH_API_VERSION') || 'v21.0';

  // Encode state as base64 with platform, clientId, userId
  const state = btoa(JSON.stringify({ platform, clientId, userId }));

  switch (platform.toLowerCase()) {
    case 'instagram':
    case 'facebook':
      if (!META_APP_ID || !META_REDIRECT_URI) {
        console.error('[OAUTH] Meta credentials not configured');
        return null;
      }

      // Facebook Business Login OAuth URL with Instagram permissions
      const scopes = [
        'instagram_basic',
        'instagram_content_publish',
        'pages_show_list',
        'pages_read_engagement',
        'business_management'
      ].join(',');

      return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}&scope=${scopes}&response_type=code&state=${state}`;

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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OAuthRequest {
  action: 'connect' | 'reconnect';
  platform: string;
  clientId: string;
  connectionId?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Verify user authentication
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { action, platform, clientId, connectionId }: OAuthRequest = await req.json();

    console.log(`OAuth ${action} request for platform: ${platform}, client: ${clientId}`);

    // Verify user has access to this client
    const { data: clientData, error: clientError } = await supabaseClient
      .from('clients')
      .select('id, agency_id')
      .eq('id', clientId)
      .single();

    if (clientError || !clientData) {
      throw new Error('Client not found or access denied');
    }

    // Verify user is part of the agency
    const { data: memberData, error: memberError } = await supabaseClient
      .from('agency_members')
      .select('id')
      .eq('agency_id', clientData.agency_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (memberError || !memberData) {
      // Check if user is the agency owner
      const { data: agencyData, error: agencyError } = await supabaseClient
        .from('agencies')
        .select('id')
        .eq('id', clientData.agency_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (agencyError || !agencyData) {
        throw new Error('Access denied: Not a member of this agency');
      }
    }

    // Generate OAuth URL based on platform
    // NOTE: This is a placeholder implementation
    // Real implementation requires OAuth app credentials for each platform
    const authUrl = await generateOAuthUrl(platform, clientId, user.id);

    if (!authUrl) {
      throw new Error(`OAuth not configured for ${platform}. Please configure OAuth credentials in your environment variables.`);
    }

    return new Response(
      JSON.stringify({ authUrl }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('OAuth error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

async function generateOAuthUrl(
  platform: string, 
  clientId: string, 
  userId: string
): Promise<string | null> {
  // This is a placeholder implementation
  // Real OAuth URLs require app credentials configured in environment variables
  
  const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/social-oauth-callback`;
  const state = btoa(JSON.stringify({ platform, clientId, userId }));

  switch (platform) {
    case 'instagram':
      // Instagram Basic Display API or Instagram Graph API
      const instagramClientId = Deno.env.get('INSTAGRAM_CLIENT_ID');
      if (!instagramClientId) return null;
      
      return `https://api.instagram.com/oauth/authorize?client_id=${instagramClientId}&redirect_uri=${redirectUri}&scope=user_profile,user_media&response_type=code&state=${state}`;

    case 'facebook':
      const facebookAppId = Deno.env.get('FACEBOOK_APP_ID');
      if (!facebookAppId) return null;
      
      return `https://www.facebook.com/v18.0/dialog/oauth?client_id=${facebookAppId}&redirect_uri=${redirectUri}&scope=pages_show_list,pages_read_engagement,pages_manage_posts&response_type=code&state=${state}`;

    case 'tiktok':
      const tiktokClientKey = Deno.env.get('TIKTOK_CLIENT_KEY');
      if (!tiktokClientKey) return null;
      
      return `https://www.tiktok.com/auth/authorize?client_key=${tiktokClientKey}&redirect_uri=${redirectUri}&scope=user.info.basic,video.list&response_type=code&state=${state}`;

    case 'youtube':
      const youtubeClientId = Deno.env.get('YOUTUBE_CLIENT_ID');
      if (!youtubeClientId) return null;
      
      return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${youtubeClientId}&redirect_uri=${redirectUri}&scope=https://www.googleapis.com/auth/youtube.readonly&response_type=code&state=${state}&access_type=offline`;

    case 'linkedin':
      const linkedinClientId = Deno.env.get('LINKEDIN_CLIENT_ID');
      if (!linkedinClientId) return null;
      
      return `https://www.linkedin.com/oauth/v2/authorization?client_id=${linkedinClientId}&redirect_uri=${redirectUri}&scope=r_liteprofile%20r_emailaddress%20w_member_social&response_type=code&state=${state}`;

    default:
      return null;
  }
}

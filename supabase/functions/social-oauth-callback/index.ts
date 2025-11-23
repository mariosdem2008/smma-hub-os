import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return new Response(
        `<html><body><h1>Authorization Failed</h1><p>${error}</p><script>setTimeout(() => window.close(), 3000)</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (!code || !state) {
      throw new Error('Missing authorization code or state');
    }

    // Decode state to get platform, clientId, and userId
    const { platform, clientId, userId } = JSON.parse(atob(state));

    console.log(`OAuth callback for platform: ${platform}, client: ${clientId}`);

    // Exchange authorization code for access token
    const tokenData = await exchangeCodeForToken(platform, code);

    if (!tokenData) {
      throw new Error(`Failed to exchange code for ${platform} token`);
    }

    // Create Supabase client with service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch account information from the platform
    const accountInfo = await fetchAccountInfo(platform, tokenData.access_token);

    // Store or update the connection in the database
    const { error: upsertError } = await supabaseAdmin
      .from('social_connections')
      .upsert({
        client_id: clientId,
        platform: platform,
        account_name: accountInfo?.name || null,
        account_handle: accountInfo?.handle || null,
        account_id: accountInfo?.id || null,
        status: 'connected',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_expires_at: tokenData.expires_at || null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'client_id,platform',
      });

    if (upsertError) {
      console.error('Database error:', upsertError);
      throw new Error('Failed to save connection');
    }

    console.log(`Successfully connected ${platform} for client ${clientId}`);

    // Redirect back to the app with success message
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const redirectUrl = `${supabaseUrl.replace('/supabase', '')}/clients/${clientId}?tab=social&connected=${platform}`;
    
    return new Response(
      `<html><body><h1>Success!</h1><p>Your ${platform} account has been connected.</p><script>window.location.href = '${redirectUrl}';</script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );

  } catch (error) {
    console.error('Callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      `<html><body><h1>Connection Failed</h1><p>${errorMessage}</p><script>setTimeout(() => window.close(), 5000)</script></body></html>`,
      { headers: { 'Content-Type': 'text/html' }, status: 400 }
    );
  }
});

async function exchangeCodeForToken(platform: string, code: string): Promise<any> {
  const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/social-oauth-callback`;

  try {
    switch (platform) {
      case 'instagram': {
        const clientId = Deno.env.get('INSTAGRAM_CLIENT_ID');
        const clientSecret = Deno.env.get('INSTAGRAM_CLIENT_SECRET');
        
        const response = await fetch('https://api.instagram.com/oauth/access_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId!,
            client_secret: clientSecret!,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
            code: code,
          }),
        });

        return await response.json();
      }

      case 'facebook': {
        const appId = Deno.env.get('FACEBOOK_APP_ID');
        const appSecret = Deno.env.get('FACEBOOK_APP_SECRET');
        
        const response = await fetch(
          `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${redirectUri}&code=${code}`
        );

        return await response.json();
      }

      case 'tiktok': {
        const clientKey = Deno.env.get('TIKTOK_CLIENT_KEY');
        const clientSecret = Deno.env.get('TIKTOK_CLIENT_SECRET');
        
        const response = await fetch('https://open-api.tiktok.com/oauth/access_token/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_key: clientKey!,
            client_secret: clientSecret!,
            code: code,
            grant_type: 'authorization_code',
          }),
        });

        return await response.json();
      }

      case 'youtube': {
        const clientId = Deno.env.get('YOUTUBE_CLIENT_ID');
        const clientSecret = Deno.env.get('YOUTUBE_CLIENT_SECRET');
        
        const response = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId!,
            client_secret: clientSecret!,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
          }),
        });

        return await response.json();
      }

      case 'linkedin': {
        const clientId = Deno.env.get('LINKEDIN_CLIENT_ID');
        const clientSecret = Deno.env.get('LINKEDIN_CLIENT_SECRET');
        
        const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId!,
            client_secret: clientSecret!,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
          }),
        });

        return await response.json();
      }

      default:
        return null;
    }
  } catch (error) {
    console.error(`Token exchange error for ${platform}:`, error);
    return null;
  }
}

async function fetchAccountInfo(platform: string, accessToken: string): Promise<any> {
  try {
    switch (platform) {
      case 'instagram': {
        const response = await fetch(
          `https://graph.instagram.com/me?fields=id,username,account_type&access_token=${accessToken}`
        );
        const data = await response.json();
        return {
          id: data.id,
          handle: data.username,
          name: data.username,
        };
      }

      case 'facebook': {
        const response = await fetch(
          `https://graph.facebook.com/me?fields=id,name&access_token=${accessToken}`
        );
        const data = await response.json();
        return {
          id: data.id,
          name: data.name,
          handle: data.name,
        };
      }

      case 'tiktok': {
        const response = await fetch('https://open-api.tiktok.com/user/info/', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        const data = await response.json();
        return {
          id: data.data?.user?.open_id,
          handle: data.data?.user?.display_name,
          name: data.data?.user?.display_name,
        };
      }

      case 'youtube': {
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        const data = await response.json();
        const channel = data.items?.[0];
        return {
          id: channel?.id,
          name: channel?.snippet?.title,
          handle: channel?.snippet?.customUrl || channel?.snippet?.title,
        };
      }

      case 'linkedin': {
        const response = await fetch('https://api.linkedin.com/v2/me', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        const data = await response.json();
        return {
          id: data.id,
          name: `${data.localizedFirstName} ${data.localizedLastName}`,
          handle: data.vanityName || `${data.localizedFirstName}${data.localizedLastName}`,
        };
      }

      default:
        return null;
    }
  } catch (error) {
    console.error(`Account info fetch error for ${platform}:`, error);
    return null;
  }
}

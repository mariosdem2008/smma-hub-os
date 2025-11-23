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
  // STUB: Simulating successful token exchange
  // In production, this would make real API calls to each platform
  console.log(`[STUB] Simulating token exchange for ${platform} with code: ${code}`);
  
  return {
    access_token: `fake_access_token_${platform}_${Date.now()}`,
    refresh_token: `fake_refresh_token_${platform}_${Date.now()}`,
    expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days from now
  };
}

async function fetchAccountInfo(platform: string, accessToken: string): Promise<any> {
  // STUB: Simulating account info fetch
  // In production, this would make real API calls to each platform
  console.log(`[STUB] Simulating account info fetch for ${platform}`);
  
  return {
    id: `fake_account_id_${platform}_${Math.random().toString(36).substring(7)}`,
    handle: `@${platform}_user_${Math.random().toString(36).substring(7)}`,
    name: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Test Account`,
  };
}

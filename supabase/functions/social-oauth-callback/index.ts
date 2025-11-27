import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    console.log('[OAUTH-CALLBACK] code:', code ? 'present' : 'missing');
    console.log('[OAUTH-CALLBACK] state:', state);
    console.log('[OAUTH-CALLBACK] error:', error);

    // Handle OAuth errors
    if (error) {
      console.error('[OAUTH-CALLBACK] OAuth error:', error);
      return new Response(
        `<html><body><script>alert('OAuth error: ${error}'); window.close();</script></body></html>`,
        { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
      );
    }

    if (!code || !state) {
      console.error('[OAUTH-CALLBACK] Missing code or state');
      return new Response(
        '<html><body><script>alert("Missing authorization code or state"); window.close();</script></body></html>',
        { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
      );
    }

    // Decode state
    const decodedState = JSON.parse(atob(state));
    const { platform, clientId, userId } = decodedState;
    console.log('[OAUTH-CALLBACK] STATE:', decodedState);

    // Validate environment variables
    const META_APP_ID = Deno.env.get('META_APP_ID');
    const META_APP_SECRET = Deno.env.get('META_APP_SECRET');
    const META_REDIRECT_URI = Deno.env.get('META_REDIRECT_URI');
    const GRAPH_API_VERSION = Deno.env.get('GRAPH_API_VERSION') || 'v21.0';
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!META_APP_ID) throw new Error('Missing META_APP_ID');
    if (!META_APP_SECRET) throw new Error('Missing META_APP_SECRET');
    if (!META_REDIRECT_URI) throw new Error('Missing META_REDIRECT_URI');
    if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL');
    if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

    console.log('[OAUTH-CALLBACK] Environment variables validated');

    // Create admin client with service role
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Exchange code for tokens
    const tokens = await exchangeCodeForToken(code, META_APP_ID, META_APP_SECRET, META_REDIRECT_URI, GRAPH_API_VERSION);
    console.log('[OAUTH-CALLBACK] TOKEN EXCHANGE RESPONSE:', tokens ? 'success' : 'failed');

    if (!tokens) {
      throw new Error('Failed to exchange code for token');
    }

    // Fetch account info
    const accountInfo = await fetchAccountInfo(tokens.access_token, GRAPH_API_VERSION);
    console.log('[OAUTH-CALLBACK] IG ACCOUNT:', accountInfo);

    if (!accountInfo) {
      throw new Error('Failed to fetch account information');
    }

    // Upsert connection to database using admin client
    const { data: upsertResult, error: upsertError } = await admin
      .from('social_connections')
      .upsert({
        client_id: clientId,
        platform: platform.toLowerCase(),
        account_name: accountInfo.name,
        account_handle: accountInfo.handle,
        account_id: accountInfo.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        status: 'connected',
        token_expires_at: tokens.expires_at,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'client_id,platform'
      })
      .select();

    console.log('[OAUTH-CALLBACK] UPSERT RESULT:', upsertResult);
    console.log('[OAUTH-CALLBACK] UPSERT ERROR:', upsertError);

    if (upsertError) {
      throw new Error(`Database upsert failed: ${upsertError.message}`);
    }

    console.log('[OAUTH-CALLBACK] Connection saved successfully');

    // Return HTML that closes the popup
    return new Response(
      `<html>
        <body>
          <script>
            console.log('OAuth callback successful');
            window.close();
          </script>
          <p>Connection successful! This window will close automatically.</p>
        </body>
      </html>`,
      { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
    );

  } catch (error) {
    console.error('[OAUTH-CALLBACK] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      `<html><body><script>alert('Error: ${errorMessage}'); window.close();</script></body></html>`,
      { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
    );
  }
});

async function exchangeCodeForToken(
  code: string,
  appId: string,
  appSecret: string,
  redirectUri: string,
  graphApiVersion: string
): Promise<{ access_token: string; refresh_token?: string; expires_at: string } | null> {
  try {
    console.log('[TOKEN-EXCHANGE] Starting token exchange');
    
    // Exchange code for short-lived token
    const tokenUrl = `https://graph.facebook.com/${graphApiVersion}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`;
    
    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();
    
    console.log('[TOKEN-EXCHANGE] TOKEN EXCHANGE RESPONSE:', tokenData);

    if (!tokenData.access_token) {
      console.error('[TOKEN-EXCHANGE] No access token in response');
      return null;
    }

    // Exchange short-lived for long-lived token
    const longLivedUrl = `https://graph.facebook.com/${graphApiVersion}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`;
    
    const longLivedResponse = await fetch(longLivedUrl);
    const longLivedData = await longLivedResponse.json();
    
    console.log('[TOKEN-EXCHANGE] Long-lived token response:', longLivedData);

    if (!longLivedData.access_token) {
      console.error('[TOKEN-EXCHANGE] No long-lived access token in response');
      return null;
    }

    // Calculate expiration (60 days for long-lived tokens)
    const expiresIn = longLivedData.expires_in || 5184000; // 60 days default
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    return {
      access_token: longLivedData.access_token,
      expires_at: expiresAt
    };
  } catch (error) {
    console.error('[TOKEN-EXCHANGE] Error:', error);
    return null;
  }
}

async function fetchAccountInfo(
  accessToken: string,
  graphApiVersion: string
): Promise<{ id: string; name: string; handle: string; page_access_token?: string } | null> {
  try {
    console.log('[FETCH-ACCOUNT] Fetching Facebook pages');
    
    // Fetch Facebook pages
    const pagesUrl = `https://graph.facebook.com/${graphApiVersion}/me/accounts?access_token=${accessToken}`;
    const pagesResponse = await fetch(pagesUrl);
    const pagesData = await pagesResponse.json();
    
    console.log('[FETCH-ACCOUNT] PAGES RESPONSE:', pagesData);

    if (!pagesData.data || pagesData.data.length === 0) {
      console.error('[FETCH-ACCOUNT] No pages found');
      return null;
    }

    // Find page with Instagram Business Account
    for (const page of pagesData.data) {
      console.log('[FETCH-ACCOUNT] Checking page:', page.name);
      
      const igAccountUrl = `https://graph.facebook.com/${graphApiVersion}/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`;
      const igAccountResponse = await fetch(igAccountUrl);
      const igAccountData = await igAccountResponse.json();
      
      console.log('[FETCH-ACCOUNT] IG account check for page:', igAccountData);

      if (igAccountData.instagram_business_account) {
        const igId = igAccountData.instagram_business_account.id;
        
        // Fetch Instagram Business Account details
        const igDetailsUrl = `https://graph.facebook.com/${graphApiVersion}/${igId}?fields=name,username&access_token=${page.access_token}`;
        const igDetailsResponse = await fetch(igDetailsUrl);
        const igDetails = await igDetailsResponse.json();
        
        console.log('[FETCH-ACCOUNT] IG ACCOUNT:', igDetails);

        return {
          id: igId,
          name: igDetails.name || page.name,
          handle: igDetails.username || '',
          page_access_token: page.access_token
        };
      }
    }

    // If no Instagram account found, use first Facebook page
    console.log('[FETCH-ACCOUNT] No Instagram account found, using first Facebook page');
    const firstPage = pagesData.data[0];
    return {
      id: firstPage.id,
      name: firstPage.name,
      handle: '',
      page_access_token: firstPage.access_token
    };

  } catch (error) {
    console.error('[FETCH-ACCOUNT] Error:', error);
    return null;
  }
}

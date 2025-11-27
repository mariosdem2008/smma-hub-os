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

    if (error) {
      console.error('[OAUTH-CALLBACK] OAuth error:', error);
      return new Response(
        `<html><body><h1>Authorization Failed</h1><p>${error}</p><script>setTimeout(() => window.close(), 3000)</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (!code || !state) {
      throw new Error('Missing authorization code or state');
    }

    // Decode state
    const { platform, clientId, userId } = JSON.parse(atob(state));
    console.log(`[OAUTH-CALLBACK] Processing ${platform} callback for client ${clientId}`);

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Exchange code for access token
    const tokenData = await exchangeCodeForToken(platform, code);

    if (!tokenData) {
      throw new Error(`Failed to exchange code for ${platform} token`);
    }

    // Fetch account information
    const accountInfo = await fetchAccountInfo(platform, tokenData.access_token);

    if (!accountInfo) {
      throw new Error(`Failed to fetch ${platform} account info`);
    }

    console.log(`[OAUTH-CALLBACK] Connected account:`, {
      platform,
      accountName: accountInfo.name,
      accountId: accountInfo.id
    });

    // Store connection in database
    const { error: upsertError } = await supabaseAdmin
      .from('social_connections')
      .upsert({
        client_id: clientId,
        platform: platform.toLowerCase(),
        account_name: accountInfo.name,
        account_handle: accountInfo.handle,
        account_id: accountInfo.id,
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
      console.error('[OAUTH-CALLBACK] Database error:', upsertError);
      throw new Error('Failed to save connection');
    }

    console.log(`[OAUTH-CALLBACK] Successfully saved ${platform} connection for client ${clientId}`);

    // Redirect back to app
    const appUrl = Deno.env.get('SUPABASE_URL')?.replace('/supabase', '') || '';
    const redirectUrl = `${appUrl}/clients/${clientId}?tab=social&connected=${platform}`;
    
    return new Response(
      `<html><body><h1>Success!</h1><p>Your ${platform} account has been connected.</p><script>window.location.href = '${redirectUrl}';</script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );

  } catch (error) {
    console.error('[OAUTH-CALLBACK] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      `<html><body><h1>Connection Failed</h1><p>${errorMessage}</p><script>setTimeout(() => window.close(), 5000)</script></body></html>`,
      { headers: { 'Content-Type': 'text/html' }, status: 400 }
    );
  }
});

async function exchangeCodeForToken(platform: string, code: string): Promise<any> {
  const META_APP_ID = Deno.env.get('META_APP_ID');
  const META_APP_SECRET = Deno.env.get('META_APP_SECRET');
  const META_REDIRECT_URI = Deno.env.get('META_REDIRECT_URI');
  const GRAPH_API_VERSION = Deno.env.get('GRAPH_API_VERSION') || 'v21.0';

  if (platform === 'instagram' || platform === 'facebook') {
    console.log('[OAUTH-CALLBACK] Exchanging code for Meta access token');

    const tokenUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(META_REDIRECT_URI!)}&client_secret=${META_APP_SECRET}&code=${code}`;

    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('[OAUTH-CALLBACK] Token exchange error:', tokenData.error);
      throw new Error(tokenData.error.message);
    }

    console.log('[OAUTH-CALLBACK] Successfully obtained access token');

    // Exchange short-lived token for long-lived token
    const longLivedUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${tokenData.access_token}`;

    const longLivedResponse = await fetch(longLivedUrl);
    const longLivedData = await longLivedResponse.json();

    if (longLivedData.error) {
      console.error('[OAUTH-CALLBACK] Long-lived token error:', longLivedData.error);
      // Continue with short-lived token if long-lived fails
      return {
        access_token: tokenData.access_token,
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour
      };
    }

    console.log('[OAUTH-CALLBACK] Obtained long-lived access token');

    return {
      access_token: longLivedData.access_token,
      expires_at: new Date(Date.now() + longLivedData.expires_in * 1000).toISOString(),
    };
  }

  return null;
}

async function fetchAccountInfo(platform: string, accessToken: string): Promise<any> {
  const GRAPH_API_VERSION = Deno.env.get('GRAPH_API_VERSION') || 'v21.0';

  if (platform === 'instagram' || platform === 'facebook') {
    console.log('[OAUTH-CALLBACK] Fetching Facebook pages');

    // Get user's Facebook pages
    const pagesUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/me/accounts?access_token=${accessToken}`;
    const pagesResponse = await fetch(pagesUrl);
    const pagesData = await pagesResponse.json();

    if (pagesData.error) {
      console.error('[OAUTH-CALLBACK] Pages fetch error:', pagesData.error);
      throw new Error(pagesData.error.message);
    }

    if (!pagesData.data || pagesData.data.length === 0) {
      throw new Error('No Facebook pages found. Please create a Facebook page and connect it to an Instagram Business account.');
    }

    console.log(`[OAUTH-CALLBACK] Found ${pagesData.data.length} Facebook pages`);

    // Find page with Instagram Business account
    for (const page of pagesData.data) {
      const pageInfoUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${page.id}?fields=instagram_business_account,name&access_token=${page.access_token}`;
      const pageInfoResponse = await fetch(pageInfoUrl);
      const pageInfo = await pageInfoResponse.json();

      if (pageInfo.instagram_business_account) {
        console.log('[OAUTH-CALLBACK] Found Instagram Business account:', pageInfo.instagram_business_account.id);

        // Get Instagram account details
        const igUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pageInfo.instagram_business_account.id}?fields=username,name&access_token=${page.access_token}`;
        const igResponse = await fetch(igUrl);
        const igData = await igResponse.json();

        return {
          id: pageInfo.instagram_business_account.id,
          name: igData.name || pageInfo.name,
          handle: igData.username ? `@${igData.username}` : null,
          page_access_token: page.access_token, // Store page token for posting
        };
      }
    }

    // If no Instagram account found, use first Facebook page
    const firstPage = pagesData.data[0];
    console.log('[OAUTH-CALLBACK] No Instagram Business account found, using Facebook page');

    return {
      id: firstPage.id,
      name: firstPage.name,
      handle: null,
      page_access_token: firstPage.access_token,
    };
  }

  return null;
}

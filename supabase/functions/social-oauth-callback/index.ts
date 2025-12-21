import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

serve(async (req: Request) => {
  const headers = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    console.log('[OAUTH-CALLBACK] code:', code ? 'present' : 'missing');
    console.log('[OAUTH-CALLBACK] state:', state);
    console.log('[OAUTH-CALLBACK] error:', error);

    if (error) {
      console.error('[OAUTH-CALLBACK] OAuth error:', error);
      return new Response(
        `<html><body><script>alert('OAuth error: ${error}'); window.close();</script></body></html>`,
        { headers: { ...headers, 'Content-Type': 'text/html' } }
      );
    }

    if (!code || !state) {
      console.error('[OAUTH-CALLBACK] Missing code or state');
      return new Response(
        '<html><body><script>alert("Missing authorization code or state"); window.close();</script></body></html>',
        { headers: { ...headers, 'Content-Type': 'text/html' } }
      );
    }

    const decodedState = JSON.parse(atob(state));
    const { platform, clientId, userId, source = 'agency' } = decodedState;
    console.log('[OAUTH-CALLBACK] STATE:', decodedState);

    const META_APP_ID = Deno.env.get('META_APP_ID');
    const META_APP_SECRET = Deno.env.get('META_APP_SECRET');
    const META_REDIRECT_URI = Deno.env.get('META_REDIRECT_URI') || `${SUPABASE_URL}/functions/v1/social-oauth-callback`;
    const GRAPH_API_VERSION = Deno.env.get('GRAPH_API_VERSION') || 'v21.0';

    if (!META_APP_ID) throw new Error('Missing META_APP_ID');
    if (!META_APP_SECRET) throw new Error('Missing META_APP_SECRET');
    if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL');
    if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

    console.log('[OAUTH-CALLBACK] Environment variables validated');

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const tokens = await exchangeCodeForToken(code, META_APP_ID, META_APP_SECRET, META_REDIRECT_URI, GRAPH_API_VERSION);
    console.log('[OAUTH-CALLBACK] TOKEN EXCHANGE RESPONSE:', tokens ? 'success' : 'failed');

    if (!tokens) {
      throw new Error('Failed to exchange code for token');
    }

    const accountInfo = await fetchAccountInfo(tokens.access_token, GRAPH_API_VERSION);
    console.log('[OAUTH-CALLBACK] ACCOUNT INFO:', accountInfo);

    if (!accountInfo || !accountInfo.facebook) {
      throw new Error('Failed to fetch account information');
    }

    const connectionsToSave = [];

    const fbConnection = {
      client_id: clientId,
      platform: 'facebook',
      account_name: accountInfo.facebook.name,
      account_handle: accountInfo.facebook.name,
      account_id: accountInfo.facebook.id,
      access_token: accountInfo.facebook.access_token,
      refresh_token: tokens.refresh_token || null,
      status: 'connected',
      token_expires_at: tokens.expires_at,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    connectionsToSave.push(fbConnection);
    console.log('[OAUTH-CALLBACK] FB CONNECTION TO SAVE:', fbConnection);

    if (accountInfo.instagram) {
      const igConnection = {
        client_id: clientId,
        platform: 'instagram',
        account_name: accountInfo.instagram.name,
        account_handle: accountInfo.instagram.handle,
        account_id: accountInfo.instagram.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        status: 'connected',
        token_expires_at: tokens.expires_at,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      connectionsToSave.push(igConnection);
      console.log('[OAUTH-CALLBACK] IG CONNECTION TO SAVE:', igConnection);
    } else {
      console.log('[OAUTH-CALLBACK] No Instagram Business Account found, skipping IG connection');
    }

    for (const connection of connectionsToSave) {
      const { data: upsertResult, error: upsertError } = await admin
        .from('social_connections')
        .upsert(connection, { onConflict: 'client_id,platform' })
        .select();

      console.log(`[OAUTH-CALLBACK] UPSERT ${connection.platform.toUpperCase()} RESULT:`, upsertResult);
      console.log(`[OAUTH-CALLBACK] UPSERT ${connection.platform.toUpperCase()} ERROR:`, upsertError);

      if (upsertError) {
        throw new Error(`Database upsert failed for ${connection.platform}: ${upsertError.message}`);
      }
    }

    console.log('[OAUTH-CALLBACK] All connections saved successfully');

    if (source === 'client') {
      return new Response(
        `<html>
          <body style="font-family: system-ui; padding: 40px; text-align: center; background: #f9fafb;">
            <div style="max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <div style="width: 60px; height: 60px; background: #10b981; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <svg width="30" height="30" fill="white" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              </div>
              <h1 style="color: #111827; margin: 0 0 8px;">Connection Successful!</h1>
              <p style="color: #6b7280; margin: 0 0 24px;">Your social media account has been connected successfully.</p>
              <button onclick="window.close()" style="background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
                Close Window
              </button>
            </div>
          </body>
        </html>`,
        { headers: { ...headers, 'Content-Type': 'text/html' } }
      );
    } else {
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
        { headers: { ...headers, 'Content-Type': 'text/html' } }
      );
    }

  } catch (error) {
    console.error('[OAUTH-CALLBACK] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      `<html><body><script>alert('Error: ${errorMessage}'); window.close();</script></body></html>`,
      { headers: { ...corsHeaders(req), 'Content-Type': 'text/html' } }
    );
  }
});

async function exchangeCodeForToken(
  code: string,
  appId: string,
  appSecret: string,
  redirectUri: string,
  graphApiVersion: string
): Promise<{ access_token: string; refresh_token?: string; expires_at: string; granted_scopes?: string[] } | null> {
  try {
    console.log('[TOKEN-EXCHANGE] Starting token exchange');
    
    const tokenUrl = `https://graph.facebook.com/${graphApiVersion}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`;
    
    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();
    
    console.log('[TOKEN-EXCHANGE] TOKEN EXCHANGE RESPONSE:', tokenData);

    if (!tokenData.access_token) {
      console.error('[TOKEN-EXCHANGE] No access token in response');
      return null;
    }

    const longLivedUrl = `https://graph.facebook.com/${graphApiVersion}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`;
    
    const longLivedResponse = await fetch(longLivedUrl);
    const longLivedData = await longLivedResponse.json();
    
    console.log('[TOKEN-EXCHANGE] Long-lived token response:', longLivedData);

    if (!longLivedData.access_token) {
      console.error('[TOKEN-EXCHANGE] No long-lived access token in response');
      return null;
    }

    try {
      const permissionsUrl = `https://graph.facebook.com/${graphApiVersion}/me/permissions?access_token=${longLivedData.access_token}`;
      const permissionsResponse = await fetch(permissionsUrl);
      const permissionsData = await permissionsResponse.json();
      
      const grantedScopes = (permissionsData.data || [])
        .filter((p: any) => p.status === 'granted')
        .map((p: any) => p.permission);
      
      const declinedScopes = (permissionsData.data || [])
        .filter((p: any) => p.status === 'declined')
        .map((p: any) => p.permission);
      
      console.log('[TOKEN-EXCHANGE] ✓ GRANTED SCOPES:', grantedScopes.join(', '));
      if (declinedScopes.length > 0) {
        console.log('[TOKEN-EXCHANGE] ⚠️ DECLINED/MISSING SCOPES:', declinedScopes.join(', '));
      }
      
      const criticalScopes = ['instagram_manage_insights', 'read_insights', 'ads_read'];
      const missingCritical = criticalScopes.filter(s => !grantedScopes.includes(s));
      if (missingCritical.length > 0) {
        console.log('[TOKEN-EXCHANGE] ⚠️ MISSING CRITICAL SCOPES for analytics/ads:', missingCritical.join(', '));
      }
    } catch (permError) {
      console.error('[TOKEN-EXCHANGE] Error fetching permissions (non-fatal):', permError);
    }

    const expiresIn = longLivedData.expires_in || 5184000;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    
    console.log('[TOKEN-EXCHANGE] Token expires at:', expiresAt);

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
): Promise<{
  facebook: { id: string; name: string; access_token: string } | null;
  instagram: { id: string; name: string; handle: string } | null;
} | null> {
  try {
    console.log('[FETCH-ACCOUNT] Fetching Facebook pages');
    
    const pagesUrl = `https://graph.facebook.com/${graphApiVersion}/me/accounts?access_token=${accessToken}`;
    const pagesResponse = await fetch(pagesUrl);
    const pagesData = await pagesResponse.json();
    
    console.log('[FETCH-ACCOUNT] FULL PAGES RESPONSE:', JSON.stringify(pagesData, null, 2));
    console.log('[FETCH-ACCOUNT] Number of pages found:', pagesData.data?.length || 0);

    if (!pagesData.data || pagesData.data.length === 0) {
      console.error('[FETCH-ACCOUNT] No pages found - user may not have granted pages_show_list permission');
      throw new Error('No Facebook Pages found. Please ensure you have granted all required permissions.');
    }

    const firstPage = pagesData.data[0];
    console.log(`[FETCH-ACCOUNT] Using Facebook Page: "${firstPage.name}" (ID: ${firstPage.id})`);

    const facebookInfo = {
      id: firstPage.id,
      name: firstPage.name,
      access_token: firstPage.access_token
    };

    let instagramInfo: { id: string; name: string; handle: string } | null = null;

    for (const page of pagesData.data) {
      console.log(`[FETCH-ACCOUNT] Checking page "${page.name}" for Instagram connection`);
      
      const igAccountUrl = `https://graph.facebook.com/${graphApiVersion}/${page.id}?fields=connected_instagram_account&access_token=${page.access_token}`;
      const igAccountResponse = await fetch(igAccountUrl);
      const igAccountData = await igAccountResponse.json();
      
      const hasIgAccount = !!igAccountData.connected_instagram_account;
      console.log(`[FETCH-ACCOUNT] Page "${page.name}" has connected Instagram Account: ${hasIgAccount}`);
      
      if (hasIgAccount) {
        console.log(`[FETCH-ACCOUNT] Connected Instagram Account data:`, JSON.stringify(igAccountData, null, 2));
      }

      if (igAccountData.connected_instagram_account?.id) {
        const igBusinessId = igAccountData.connected_instagram_account.id;
        
        const igDetailsUrl = `https://graph.facebook.com/${graphApiVersion}/${igBusinessId}?fields=name,username&access_token=${page.access_token}`;
        const igDetailsResponse = await fetch(igDetailsUrl);
        const igDetails = await igDetailsResponse.json();
        
        console.log('[FETCH-ACCOUNT] ✓ Found Instagram Business Account!');
        console.log('[FETCH-ACCOUNT] - IG Business ID:', igBusinessId);
        console.log('[FETCH-ACCOUNT] - IG Name:', igDetails.name);
        console.log('[FETCH-ACCOUNT] - IG Username:', igDetails.username);

        instagramInfo = {
          id: igBusinessId,
          name: igDetails.name || page.name,
          handle: igDetails.username || ''
        };
        
        break;
      }
    }

    if (!instagramInfo) {
      console.log('[FETCH-ACCOUNT] ⚠️ No Instagram Business Account found on any Facebook Page');
      console.log('[FETCH-ACCOUNT] Facebook connection will be saved, but Instagram will be skipped');
    }

    return {
      facebook: facebookInfo,
      instagram: instagramInfo
    };

  } catch (error) {
    console.error('[FETCH-ACCOUNT] Error:', error);
    throw error;
  }
}

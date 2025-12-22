import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { verifyCronSecret } from "../_shared/cron.ts";

serve(async (req: Request) => {
const headers = corsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const cronAuth = verifyCronSecret(req, headers);
  if (cronAuth) return cronAuth;

  try {
    console.log('[TOKEN-REFRESH] Starting Meta token refresh process');

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const metaAppId = Deno.env.get('META_APP_ID');
    const metaAppSecret = Deno.env.get('META_APP_SECRET');

    if (!metaAppId || !metaAppSecret) {
      throw new Error('META_APP_ID or META_APP_SECRET not configured');
    }

    const fifteenDaysFromNow = new Date();
    fifteenDaysFromNow.setDate(fifteenDaysFromNow.getDate() + 15);

    const { data: connections, error: queryError } = await supabaseAdmin
      .from('social_connections')
      .select('*')
      .in('platform', ['instagram', 'facebook'])
      .eq('status', 'connected')
      .lt('token_expires_at', fifteenDaysFromNow.toISOString());

    if (queryError) {
      console.error('[TOKEN-REFRESH] Query error:', queryError);
      throw queryError;
    }

    if (!connections || connections.length === 0) {
      console.log('[TOKEN-REFRESH] No tokens need refreshing');
      return new Response(
        JSON.stringify({ message: 'No tokens need refreshing', refreshed: 0 }),
        { headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[TOKEN-REFRESH] Found ${connections.length} tokens to refresh`);

    const results = [];

    for (const connection of connections) {
      try {
        console.log(`[TOKEN-REFRESH] Refreshing token for ${connection.platform} - ${connection.account_name}`);

        const oldTokenPreview = connection.access_token?.substring(0, 10) || 'unknown';

        const tokenUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
        tokenUrl.searchParams.set('grant_type', 'fb_exchange_token');
        tokenUrl.searchParams.set('client_id', metaAppId);
        tokenUrl.searchParams.set('client_secret', metaAppSecret);
        tokenUrl.searchParams.set('fb_exchange_token', connection.access_token);

        const response = await fetch(tokenUrl.toString());
        const data = await response.json();

        if (!response.ok || data.error) {
          const errorCode = data.error?.code || data.error?.type || 'REFRESH_FAILED';
          console.error(`[TOKEN-REFRESH] Failed to refresh token for ${connection.id}:`, data);
          
          await supabaseAdmin
            .from('social_connections')
            .update({ status: 'error' })
            .eq('id', connection.id);
          
          await supabaseAdmin.from('token_refresh_logs').insert({
            social_connection_id: connection.id,
            old_token_preview: oldTokenPreview,
            new_token_preview: null,
            success: false,
            error_code: errorCode,
            response: data
          });

          results.push({
            connectionId: connection.id,
            platform: connection.platform,
            success: false,
            error: data.error?.message || 'Unknown error',
            errorCode
          });

          continue;
        }

        const newTokenPreview = data.access_token?.substring(0, 10) || 'unknown';

        const newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + 60);

        const { error: updateError } = await supabaseAdmin
          .from('social_connections')
          .update({
            access_token: data.access_token,
            token_expires_at: newExpiresAt.toISOString(),
            last_synced_at: new Date().toISOString(),
            status: 'connected',
            updated_at: new Date().toISOString()
          })
          .eq('id', connection.id);

        if (updateError) {
          console.error(`[TOKEN-REFRESH] Failed to update connection ${connection.id}:`, updateError);
          throw updateError;
        }

        await supabaseAdmin.from('token_refresh_logs').insert({
          social_connection_id: connection.id,
          old_token_preview: oldTokenPreview,
          new_token_preview: newTokenPreview,
          success: true,
          response: { expires_in: data.expires_in || 5184000 }
        });

        console.log(`[TOKEN-REFRESH] Successfully refreshed token for ${connection.id}`);

        results.push({
          connectionId: connection.id,
          platform: connection.platform,
          accountName: connection.account_name,
          success: true,
          expiresAt: newExpiresAt.toISOString()
        });

      } catch (error) {
        const errorCode = 'EXCEPTION_ERROR';
        console.error(`[TOKEN-REFRESH] Error refreshing token for ${connection.id}:`, error);
        
        await supabaseAdmin
          .from('social_connections')
          .update({ status: 'error' })
          .eq('id', connection.id);
        
        await supabaseAdmin.from('token_refresh_logs').insert({
          social_connection_id: connection.id,
          old_token_preview: connection.access_token?.substring(0, 10) || 'unknown',
          new_token_preview: null,
          success: false,
          error_code: errorCode,
          response: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
        
        results.push({
          connectionId: connection.id,
          platform: connection.platform,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorCode
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[TOKEN-REFRESH] Completed. ${successCount}/${results.length} tokens refreshed successfully`);

    return new Response(
      JSON.stringify({
        message: 'Token refresh completed',
        total: results.length,
        successful: successCount,
        failed: results.length - successCount,
        results
      }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[TOKEN-REFRESH] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

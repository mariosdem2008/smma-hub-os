import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[TOKEN-REFRESH] Starting Meta token refresh process');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const metaAppId = Deno.env.get('META_APP_ID');
    const metaAppSecret = Deno.env.get('META_APP_SECRET');

    if (!metaAppId || !metaAppSecret) {
      throw new Error('META_APP_ID or META_APP_SECRET not configured');
    }

    // Query tokens expiring in less than 15 days
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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[TOKEN-REFRESH] Found ${connections.length} tokens to refresh`);

    const results = [];

    for (const connection of connections) {
      try {
        console.log(`[TOKEN-REFRESH] Refreshing token for ${connection.platform} - ${connection.account_name}`);

        // Call Meta token exchange endpoint
        const tokenUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
        tokenUrl.searchParams.set('grant_type', 'fb_exchange_token');
        tokenUrl.searchParams.set('client_id', metaAppId);
        tokenUrl.searchParams.set('client_secret', metaAppSecret);
        tokenUrl.searchParams.set('fb_exchange_token', connection.access_token);

        const response = await fetch(tokenUrl.toString());
        const data = await response.json();

        if (!response.ok || data.error) {
          console.error(`[TOKEN-REFRESH] Failed to refresh token for ${connection.id}:`, data);
          
          // Log failure
          await supabaseAdmin.from('token_refresh_logs').insert({
            social_connection_id: connection.id,
            old_token_preview: connection.access_token?.substring(0, 10),
            new_token_preview: null,
            success: false,
            response: data
          });

          results.push({
            connectionId: connection.id,
            platform: connection.platform,
            success: false,
            error: data.error?.message || 'Unknown error'
          });

          continue;
        }

        // Calculate new expiration (60 days from now for long-lived tokens)
        const newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + 60);

        // Update connection with new token
        const { error: updateError } = await supabaseAdmin
          .from('social_connections')
          .update({
            access_token: data.access_token,
            token_expires_at: newExpiresAt.toISOString(),
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', connection.id);

        if (updateError) {
          console.error(`[TOKEN-REFRESH] Failed to update connection ${connection.id}:`, updateError);
          throw updateError;
        }

        // Log success
        await supabaseAdmin.from('token_refresh_logs').insert({
          social_connection_id: connection.id,
          old_token_preview: connection.access_token?.substring(0, 10),
          new_token_preview: data.access_token?.substring(0, 10),
          success: true,
          response: { expires_in: data.expires_in || 5184000 } // 60 days in seconds
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
        console.error(`[TOKEN-REFRESH] Error refreshing token for ${connection.id}:`, error);
        
        results.push({
          connectionId: connection.id,
          platform: connection.platform,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[TOKEN-REFRESH] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

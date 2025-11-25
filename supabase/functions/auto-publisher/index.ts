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
    console.log('[AUTO-PUBLISHER] Starting scheduled post check');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find all assets scheduled for now or earlier
    const { data: scheduledAssets, error: fetchError } = await supabaseAdmin
      .from('assets')
      .select(`
        *,
        clients!inner(id, agency_id, name)
      `)
      .eq('pipeline_stage', 'scheduled')
      .lte('scheduled_time', new Date().toISOString())
      .order('scheduled_time', { ascending: true });

    if (fetchError) {
      console.error('[AUTO-PUBLISHER] Error fetching scheduled assets:', fetchError);
      throw fetchError;
    }

    if (!scheduledAssets || scheduledAssets.length === 0) {
      console.log('[AUTO-PUBLISHER] No assets scheduled for posting');
      return new Response(
        JSON.stringify({ message: 'No assets to publish', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[AUTO-PUBLISHER] Found ${scheduledAssets.length} assets to publish`);

    const results = await Promise.allSettled(
      scheduledAssets.map(async (asset) => {
        console.log(`[AUTO-PUBLISHER] Processing asset ${asset.id} - ${asset.filename}`);

        try {
          // Get social connections for this client
          const { data: connections, error: connError } = await supabaseAdmin
            .from('social_connections')
            .select('*')
            .eq('client_id', asset.client_id)
            .eq('status', 'connected')
            .in('platform', asset.platforms || []);

          if (connError) {
            throw new Error(`Failed to fetch connections: ${connError.message}`);
          }

          if (!connections || connections.length === 0) {
            throw new Error(`No connected platforms found for asset platforms: ${asset.platforms?.join(', ')}`);
          }

          console.log(`[AUTO-PUBLISHER] Found ${connections.length} connected platforms`);

          const postResults = await Promise.allSettled(
            connections.map(async (connection) => {
              console.log(`[AUTO-PUBLISHER] Posting to ${connection.platform}`);
              
              // Get platform-specific caption
              const captions = asset.platform_captions as Record<string, string> || {};
              const caption = captions[connection.platform] || asset.final_caption || '';

              // Post to platform
              const postUrl = await postToSocialPlatform(
                connection.platform,
                connection.access_token,
                connection.account_id,
                {
                  caption,
                  mediaUrl: asset.file_url,
                  mediaType: asset.file_type,
                }
              );

              return {
                platform: connection.platform,
                postUrl,
                success: true,
              };
            })
          );

          // Check if all posts succeeded
          const allSucceeded = postResults.every(r => r.status === 'fulfilled');
          const successfulPosts = postResults
            .filter(r => r.status === 'fulfilled')
            .map(r => (r as PromiseFulfilledResult<any>).value);
          
          const failedPosts = postResults
            .filter(r => r.status === 'rejected')
            .map(r => (r as PromiseRejectedResult).reason);

          // Store first successful post URL
          const postUrl = successfulPosts.length > 0 ? successfulPosts[0].postUrl : null;

          // Update asset status
          const updateData = allSucceeded
            ? {
                pipeline_stage: 'published',
                post_url: postUrl,
                error_message: null,
                updated_at: new Date().toISOString(),
              }
            : {
                pipeline_stage: 'failed',
                error_message: failedPosts.map(e => e.message || e).join('; '),
                updated_at: new Date().toISOString(),
              };

          const { error: updateError } = await supabaseAdmin
            .from('assets')
            .update(updateData)
            .eq('id', asset.id);

          if (updateError) {
            console.error(`[AUTO-PUBLISHER] Failed to update asset ${asset.id}:`, updateError);
            throw updateError;
          }

          console.log(`[AUTO-PUBLISHER] Asset ${asset.id} updated to ${updateData.pipeline_stage}`);

          return {
            assetId: asset.id,
            filename: asset.filename,
            status: updateData.pipeline_stage,
            postUrl,
            successfulPlatforms: successfulPosts.map(p => p.platform),
            failedPlatforms: failedPosts.length > 0 ? failedPosts.map((_, i) => connections[i].platform) : [],
          };
        } catch (error) {
          console.error(`[AUTO-PUBLISHER] Error processing asset ${asset.id}:`, error);

          // Mark as failed
          await supabaseAdmin
            .from('assets')
            .update({
              pipeline_stage: 'failed',
              error_message: error instanceof Error ? error.message : 'Unknown error',
              updated_at: new Date().toISOString(),
            })
            .eq('id', asset.id);

          throw error;
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`[AUTO-PUBLISHER] Completed: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({
        message: 'Publishing completed',
        total: scheduledAssets.length,
        successful,
        failed,
        results: results.map(r => 
          r.status === 'fulfilled' ? r.value : { error: (r.reason as Error).message }
        ),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[AUTO-PUBLISHER] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Platform-specific posting functions
async function postToSocialPlatform(
  platform: string,
  accessToken: string,
  accountId: string | null,
  content: {
    caption: string;
    mediaUrl: string;
    mediaType: string;
  }
): Promise<string> {
  console.log(`[AUTO-PUBLISHER] Posting to ${platform}...`);

  switch (platform.toLowerCase()) {
    case 'instagram':
      return await postToInstagram(accessToken, accountId, content);
    case 'facebook':
      return await postToFacebook(accessToken, accountId, content);
    case 'linkedin':
      return await postToLinkedIn(accessToken, accountId, content);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

// STUB: Instagram posting (to be implemented with OAuth)
async function postToInstagram(
  accessToken: string,
  accountId: string | null,
  content: { caption: string; mediaUrl: string; mediaType: string }
): Promise<string> {
  console.log('[AUTO-PUBLISHER] [STUB] Instagram posting not yet implemented');
  
  // TODO: Implement Instagram Graph API posting
  // 1. Upload media container
  // 2. Publish media container
  // 3. Return post URL
  
  // For now, simulate success for testing
  const fakePostId = `fake_ig_post_${Date.now()}`;
  return `https://www.instagram.com/p/${fakePostId}/`;
}

// STUB: Facebook posting (to be implemented with OAuth)
async function postToFacebook(
  accessToken: string,
  accountId: string | null,
  content: { caption: string; mediaUrl: string; mediaType: string }
): Promise<string> {
  console.log('[AUTO-PUBLISHER] [STUB] Facebook posting not yet implemented');
  
  // TODO: Implement Facebook Graph API posting
  // 1. Upload media to page
  // 2. Create page post
  // 3. Return post URL
  
  // For now, simulate success for testing
  const fakePostId = `fake_fb_post_${Date.now()}`;
  return `https://www.facebook.com/${accountId}/posts/${fakePostId}`;
}

// STUB: LinkedIn posting (to be implemented with OAuth)
async function postToLinkedIn(
  accessToken: string,
  accountId: string | null,
  content: { caption: string; mediaUrl: string; mediaType: string }
): Promise<string> {
  console.log('[AUTO-PUBLISHER] [STUB] LinkedIn posting not yet implemented');
  
  // TODO: Implement LinkedIn API posting
  // 1. Upload media asset
  // 2. Create share post
  // 3. Return post URL
  
  // For now, simulate success for testing
  const fakePostId = `fake_li_post_${Date.now()}`;
  return `https://www.linkedin.com/feed/update/urn:li:share:${fakePostId}`;
}

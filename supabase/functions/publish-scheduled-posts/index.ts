import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { publishToInstagram, publishToFacebook } from "../_utils/instagram-publish.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

serve(async (req: Request) => {
const headers = corsHeaders(req);

if (req.method === "OPTIONS") {
  return new Response(null, { status: 204, headers });
}


  try {
    const startTime = Date.now();
    console.log('[AUTOPUBLISH] Starting scheduled posts check');

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Query scheduled posts ready to publish (with 1 minute buffer and retry limit)
    const now = new Date();
    const bufferTime = new Date(now.getTime() + 60000).toISOString();
    const { data: scheduledPosts, error: queryError } = await supabaseAdmin
      .from('scheduled_posts')
      .select(`
        id,
        project_id,
        agency_id,
        client_id,
        platform,
        social_connection_id,
        scheduled_for,
        caption,
        hashtags,
        status,
        retry_count
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', bufferTime)
      .lt('retry_count', 3)
      .order('scheduled_for', { ascending: true })
      .limit(50);

    if (queryError) {
      console.error('[AUTOPUBLISH] Query error:', queryError);
      throw queryError;
    }

    if (!scheduledPosts || scheduledPosts.length === 0) {
      console.log('[AUTOPUBLISH] No scheduled posts ready to publish');
      return new Response(
        JSON.stringify({ message: 'No posts to publish', processed: 0 }),
        { headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[AUTOPUBLISH] Found ${scheduledPosts.length} scheduled posts ready to publish`);

    const results = [];

    for (const scheduledPost of scheduledPosts) {
      try {
        const result = await publishScheduledPost(supabaseAdmin, scheduledPost);
        results.push(result);
      } catch (error) {
        console.error(`[AUTOPUBLISH] Error publishing scheduled post ${scheduledPost.id}:`, error);
        results.push({
          scheduledPostId: scheduledPost.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log('[AUTOPUBLISH] Completed. Results:', results);

    return new Response(
      JSON.stringify({
        message: 'Publishing completed',
        processed: results.length,
        results
      }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AUTOPUBLISH] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

async function publishScheduledPost(supabaseAdmin: any, scheduledPost: any) {
  const startTime = Date.now();
  console.log(`[AUTOPUBLISH] Publishing scheduled post ${scheduledPost.id} for platform ${scheduledPost.platform}`);

  await supabaseAdmin
    .from('scheduled_posts')
    .update({ status: 'publishing' })
    .eq('id', scheduledPost.id);

  try {
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id, title')
      .eq('id', scheduledPost.project_id)
      .single();

    if (projectError || !project) {
      throw new Error('Project not found');
    }

    const { data: finalAssets, error: assetsError } = await supabaseAdmin
      .from('project_assets')
      .select(`
        asset_id,
        assets:asset_id (
          id,
          file_url,
          file_type,
          thumbnail_url
        )
      `)
      .eq('project_id', scheduledPost.project_id)
      .eq('is_final_content', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (assetsError) {
      console.error('[AUTOPUBLISH] Error fetching final assets:', assetsError);
      throw new Error('Error fetching final asset');
    }

    if (!finalAssets || finalAssets.length === 0 || !finalAssets[0].assets) {
      const errorMessage = 'No final content asset found for project';
      console.error(`[AUTOPUBLISH] ${errorMessage}`);
      await handlePublishFailure(supabaseAdmin, scheduledPost, errorMessage, startTime, true);
      throw new Error(errorMessage);
    }

    const asset = finalAssets[0].assets;
    const mediaUrl = asset.file_url;
    const mediaType = asset.file_type?.startsWith('video') ? 'video' : 'image';

    const { data: connection, error: connectionError } = await supabaseAdmin
      .from('social_connections')
      .select('*')
      .eq('id', scheduledPost.social_connection_id)
      .single();

    if (connectionError || !connection) {
      throw new Error('Social connection not found');
    }

    if (connection.status !== 'connected') {
      throw new Error('Social connection is not active');
    }

    if (scheduledPost.platform === 'instagram' && !connection.account_id) {
      throw new Error('No Instagram Business Account connected');
    }

    const caption = scheduledPost.caption || project.title || '';
    const hashtags = scheduledPost.hashtags || '';
    const fullCaption = `${caption}\n\n${hashtags}`.trim();

    console.log(`[AUTOPUBLISH] Publishing to ${scheduledPost.platform}, media type: ${mediaType}`);

    let result;

    if (scheduledPost.platform === 'instagram') {
      result = await publishToInstagram(
        connection.account_id,
        connection.access_token,
        mediaUrl,
        mediaType,
        caption,
        hashtags
      );
    } else if (scheduledPost.platform === 'facebook') {
      result = await publishToFacebook(
        connection.account_id,
        connection.access_token,
        mediaUrl,
        mediaType,
        caption,
        hashtags
      );
    } else if (scheduledPost.platform === 'linkedin') {
      throw new Error('LinkedIn publishing not yet supported - coming soon');
    } else {
      throw new Error(`Platform ${scheduledPost.platform} not supported`);
    }

    const duration = Date.now() - startTime;

    if (result.success && result.mediaUrl) {
      await supabaseAdmin
        .from('scheduled_posts')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          platform_post_id: result.mediaId,
          platform_permalink: result.mediaUrl,
          error_message: null,
        })
        .eq('id', scheduledPost.id);

      await supabaseAdmin.from('post_logs').insert({
        scheduled_post_id: scheduledPost.id,
        project_id: scheduledPost.project_id,
        platform: scheduledPost.platform,
        success: true,
        duration_ms: duration,
        published_permalink: result.mediaUrl,
        request: { mediaUrl, mediaType, caption: fullCaption },
        response: { mediaId: result.mediaId, permalink: result.mediaUrl },
        attempt_number: (scheduledPost.retry_count || 0) + 1
      });

      await supabaseAdmin.from('activity_logs').insert({
        project_id: scheduledPost.project_id,
        action_type: 'auto_published_success',
        details: {
          platform: scheduledPost.platform,
          permalink: result.mediaUrl,
          media_id: result.mediaId,
          duration_ms: duration
        }
      });

      console.log(`[AUTOPUBLISH] Successfully published scheduled post ${scheduledPost.id}: ${result.mediaUrl}`);

      await updateProjectStatus(supabaseAdmin, scheduledPost.project_id);

      return {
        scheduledPostId: scheduledPost.id,
        success: true,
        permalink: result.mediaUrl,
      };
    } else {
      throw new Error(result.error || 'Unknown publishing error');
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await handlePublishFailure(supabaseAdmin, scheduledPost, errorMessage, duration, false);
    throw error;
  }
}

async function handlePublishFailure(
  supabaseAdmin: any, 
  scheduledPost: any, 
  errorMessage: string, 
  duration: number,
  isFatalError: boolean
) {
  const currentRetryCount = scheduledPost.retry_count || 0;
  const nextRetryCount = currentRetryCount + 1;
  
  console.error(`[AUTOPUBLISH] Error publishing scheduled post ${scheduledPost.id} (attempt ${nextRetryCount}/3):`, errorMessage);

  const shouldRetry = !isFatalError && nextRetryCount < 3;

  if (shouldRetry) {
    const retryTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    console.log(`[AUTOPUBLISH] Scheduling retry ${nextRetryCount + 1} for ${scheduledPost.id} at ${retryTime}`);
    
    await supabaseAdmin
      .from('scheduled_posts')
      .update({
        status: 'pending',
        retry_count: nextRetryCount,
        scheduled_for: retryTime,
        error_message: errorMessage,
      })
      .eq('id', scheduledPost.id);
  } else {
    console.error(`[AUTOPUBLISH] ${isFatalError ? 'Fatal error' : 'Max retries reached'} for ${scheduledPost.id}, marking as failed`);
    
    await supabaseAdmin
      .from('scheduled_posts')
      .update({
        status: 'failed',
        retry_count: nextRetryCount,
        error_message: errorMessage,
      })
      .eq('id', scheduledPost.id);

    await supabaseAdmin.from('activity_logs').insert({
      project_id: scheduledPost.project_id,
      action_type: 'auto_published_failed',
      details: {
        platform: scheduledPost.platform,
        error_message: errorMessage,
        attempts: nextRetryCount,
        is_fatal: isFatalError
      }
    });

    await updateProjectStatus(supabaseAdmin, scheduledPost.project_id);
  }

  await supabaseAdmin.from('post_logs').insert({
    scheduled_post_id: scheduledPost.id,
    project_id: scheduledPost.project_id,
    platform: scheduledPost.platform,
    success: false,
    duration_ms: duration,
    error_message: errorMessage,
    response: { error: errorMessage, willRetry: shouldRetry },
    attempt_number: nextRetryCount
  });
}

async function updateProjectStatus(supabaseAdmin: any, projectId: string) {
  const { data: allPosts, error } = await supabaseAdmin
    .from('scheduled_posts')
    .select('status')
    .eq('project_id', projectId);

  if (error || !allPosts || allPosts.length === 0) {
    return;
  }

  const hasPublished = allPosts.some((p: any) => p.status === 'published');
  const allCancelled = allPosts.every((p: any) => p.status === 'cancelled');
  const allCompleted = allPosts.every((p: any) => p.status === 'published' || p.status === 'failed' || p.status === 'cancelled');

  if (allCompleted) {
    if (hasPublished) {
      await supabaseAdmin
        .from('projects')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', projectId);
    } else if (allCancelled) {
      await supabaseAdmin
        .from('projects')
        .update({ status: 'approved', scheduled_for: null })
        .eq('id', projectId);
    } else {
      await supabaseAdmin
        .from('projects')
        .update({ status: 'failed', error_message: 'All scheduled posts failed' })
        .eq('id', projectId);
    }
  }
}

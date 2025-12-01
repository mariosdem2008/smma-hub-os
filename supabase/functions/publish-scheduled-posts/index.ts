import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { publishToInstagram, publishToFacebook } from "../_utils/instagram-publish.ts";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * AUTOPUBLISH ENGINE - publish-scheduled-posts
 * 
 * This function automatically publishes scheduled content to social media platforms.
 * 
 * REQUIRED CRON CONFIGURATION:
 * Run this function every 5 minutes via Supabase pg_cron.
 * Execute the following SQL in your Supabase SQL Editor:
 * 
 * SELECT cron.schedule(
 *   'publish-scheduled-posts-every-5-min',
 *   'CRON_EXPRESSION_EVERY_5_MINUTES',
 *   'SELECT net.http_post(...)'
 * );
 * 
 * Replace CRON_EXPRESSION with: asterisk-slash-5 space asterisk space asterisk space asterisk space asterisk
 * 
 * FEATURES:
 * - Publishes to Instagram, Facebook (LinkedIn coming soon)
 * - 3-attempt retry policy with 10-minute delays
 * - Comprehensive logging in post_logs table
 * - Project status management based on completion
 * - Uses service role key to bypass RLS
 * - 1-minute scheduling buffer to catch posts slightly in the past
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    console.log('[AUTOPUBLISH] Starting scheduled posts check');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Query scheduled posts ready to publish (with 1 minute buffer and retry limit)
    const now = new Date();
    const bufferTime = new Date(now.getTime() + 60000).toISOString(); // +1 minute buffer
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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AUTOPUBLISH] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

async function publishScheduledPost(supabaseAdmin: any, scheduledPost: any) {
  const startTime = Date.now();
  console.log(`[AUTOPUBLISH] Publishing scheduled post ${scheduledPost.id} for platform ${scheduledPost.platform}`);

  // Update status to publishing
  await supabaseAdmin
    .from('scheduled_posts')
    .update({ status: 'publishing' })
    .eq('id', scheduledPost.id);

  try {
    // Fetch project and final asset
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select(`
        id,
        title,
        final_asset_id,
        final_asset:assets!projects_final_asset_id_fkey (
          id,
          file_url,
          file_type,
          thumbnail_url
        )
      `)
      .eq('id', scheduledPost.project_id)
      .single();

    if (projectError || !project) {
      throw new Error('Project not found');
    }

    if (!project.final_asset_id || !project.final_asset) {
      throw new Error('No final asset found for project');
    }

    const asset = project.final_asset;
    const mediaUrl = asset.file_url;
    const mediaType = asset.file_type?.startsWith('video') ? 'video' : 'image';

    // Fetch social connection
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

    // Validate Instagram Business Account
    if (scheduledPost.platform === 'instagram' && !connection.account_id) {
      throw new Error('No Instagram Business Account connected');
    }

    // Prepare caption
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
      // Update scheduled post as published
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

      // Log success
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

      console.log(`[AUTOPUBLISH] Successfully published scheduled post ${scheduledPost.id}: ${result.mediaUrl}`);

      // Check if all scheduled posts for this project are complete
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
    const currentRetryCount = scheduledPost.retry_count || 0;
    const nextRetryCount = currentRetryCount + 1;
    
    console.error(`[AUTOPUBLISH] Error publishing scheduled post ${scheduledPost.id} (attempt ${nextRetryCount}/3):`, errorMessage);

    // Determine if we should retry
    const shouldRetry = nextRetryCount < 3;

    if (shouldRetry) {
      // Reschedule for retry in 10 minutes
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
      // Max retries reached - mark as failed
      console.error(`[AUTOPUBLISH] Max retries reached for ${scheduledPost.id}, marking as failed`);
      
      await supabaseAdmin
        .from('scheduled_posts')
        .update({
          status: 'failed',
          retry_count: nextRetryCount,
          error_message: errorMessage,
        })
        .eq('id', scheduledPost.id);

      // Check if all scheduled posts for this project are complete
      await updateProjectStatus(supabaseAdmin, scheduledPost.project_id);
    }

    // Log failure
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

    throw error;
  }
}

async function updateProjectStatus(supabaseAdmin: any, projectId: string) {
  // Fetch all scheduled posts for this project
  const { data: allPosts, error } = await supabaseAdmin
    .from('scheduled_posts')
    .select('status')
    .eq('project_id', projectId);

  if (error || !allPosts || allPosts.length === 0) {
    return;
  }

  const hasPublished = allPosts.some((p: any) => p.status === 'published');
  const hasPending = allPosts.some((p: any) => p.status === 'pending' || p.status === 'publishing');
  const allCancelled = allPosts.every((p: any) => p.status === 'cancelled');
  const allCompleted = allPosts.every((p: any) => p.status === 'published' || p.status === 'failed' || p.status === 'cancelled');

  if (allCompleted) {
    if (hasPublished) {
      // At least one published - mark project as published
      await supabaseAdmin
        .from('projects')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', projectId);
    } else if (allCancelled) {
      // All cancelled - revert to approved
      await supabaseAdmin
        .from('projects')
        .update({ status: 'approved', scheduled_for: null })
        .eq('id', projectId);
    } else {
      // All failed - mark as failed
      await supabaseAdmin
        .from('projects')
        .update({ status: 'failed', error_message: 'All scheduled posts failed' })
        .eq('id', projectId);
    }
  }
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { publishToInstagram, publishToFacebook } from "../_utils/instagram-publish.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[AUTOPUBLISH] Starting scheduled posts check');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Query projects ready to publish
    const now = new Date().toISOString();
    const { data: projects, error: queryError } = await supabaseAdmin
      .from('projects')
      .select(`
        id,
        client_id,
        title,
        platforms,
        platform_captions,
        hashtags,
        scheduled_time,
        final_asset_id,
        final_asset:assets (
          id,
          file_url,
          file_type,
          thumbnail_url
        )
      `)
      .eq('pipeline_stage', 'scheduled')
      .lte('scheduled_time', now)
      .order('scheduled_time', { ascending: true })
      .limit(10);

    if (queryError) {
      console.error('[AUTOPUBLISH] Query error:', queryError);
      throw queryError;
    }

    if (!projects || projects.length === 0) {
      console.log('[AUTOPUBLISH] No projects ready to publish');
      return new Response(
        JSON.stringify({ message: 'No projects to publish', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[AUTOPUBLISH] Found ${projects.length} projects ready to publish`);

    const results = [];

    for (const project of projects) {
      try {
        const result = await publishProject(supabaseAdmin, project);
        results.push(result);
      } catch (error) {
        console.error(`[AUTOPUBLISH] Error publishing project ${project.id}:`, error);
        results.push({
          projectId: project.id,
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

async function publishProject(supabaseAdmin: any, project: any) {
  console.log(`[AUTOPUBLISH] Publishing project ${project.id}: ${project.title} (attempt ${(project.retry_count || 0) + 1})`);

  // Null-safe check for final asset
  if (!project.final_asset_id || !project.final_asset) {
    const errorMsg = 'No final asset found for project';
    console.error(`[AUTOPUBLISH] ${errorMsg} - project ${project.id}`);
    
    // Mark as failed immediately - this is a configuration error
    await supabaseAdmin
      .from('projects')
      .update({
        error_message: errorMsg,
        pipeline_stage: 'failed',
        retry_count: 0,
      })
      .eq('id', project.id);
    
    throw new Error(errorMsg);
  }

  if (!project.platforms || project.platforms.length === 0) {
    throw new Error('No platforms specified for project');
  }

  // Filter to only supported platforms (Instagram, Facebook)
  const supportedPlatforms = project.platforms.filter(
    (p: string) => p === 'instagram' || p === 'facebook'
  );

  if (supportedPlatforms.length === 0) {
    console.log(`[AUTOPUBLISH] No supported platforms selected for project ${project.id}, marking as failed`);
    await supabaseAdmin
      .from('projects')
      .update({
        error_message: 'No supported platforms selected (only Instagram and Facebook are supported)',
        pipeline_stage: 'failed',
        retry_count: 0,
      })
      .eq('id', project.id);
    
    throw new Error('No supported platforms selected');
  }

  const asset = project.final_asset;
  const mediaUrl = asset.file_url;
  const mediaType = asset.file_type?.startsWith('video') ? 'video' : 'image';

  console.log(`[AUTOPUBLISH] Media type: ${mediaType}, URL: ${mediaUrl}`);
  console.log(`[AUTOPUBLISH] Supported platforms: ${supportedPlatforms.join(', ')}`);

  // Fetch social connections for client (only for supported platforms)
  const { data: connections, error: connectionsError } = await supabaseAdmin
    .from('social_connections')
    .select('*')
    .eq('client_id', project.client_id)
    .eq('status', 'connected')
    .in('platform', supportedPlatforms);

  if (connectionsError) {
    throw new Error(`Failed to fetch connections: ${connectionsError.message}`);
  }

  if (!connections || connections.length === 0) {
    throw new Error('No active social connections found for specified platforms');
  }

  console.log(`[AUTOPUBLISH] Found ${connections.length} active connections`);

  const publishResults: Record<string, any> = {};
  let hasSuccess = false;
  let hasFailure = false;

  // Publish to each platform
  for (const connection of connections) {
    const platform = connection.platform;
    console.log(`[AUTOPUBLISH] Publishing to ${platform}`);

    try {
      // Validate Instagram Business Account before publishing
      if (platform === 'instagram' && !connection.account_id) {
        console.error(`[AUTOPUBLISH] No Instagram Business Account for connection ${connection.id}`);
        
        // Log the skip
        await supabaseAdmin.from('post_logs').insert({
          project_id: project.id,
          platform: 'instagram',
          attempt_number: (project.retry_count || 0) + 1,
          success: false,
          error_message: 'No Instagram Business Account connected',
          response: { error: 'no_instagram_business_account' }
        });
        
        hasFailure = true;
        continue;
      }

      // Get platform-specific caption
      const captions = project.platform_captions || {};
      const caption = captions[platform] || project.title;

      let result;

      if (platform === 'instagram') {
        result = await publishToInstagram(
          connection.account_id,
          connection.access_token,
          mediaUrl,
          mediaType,
          caption,
          project.hashtags
        );
      } else if (platform === 'facebook') {
        result = await publishToFacebook(
          connection.account_id,
          connection.access_token,
          mediaUrl,
          mediaType,
          caption,
          project.hashtags
        );
      } else {
        console.log(`[AUTOPUBLISH] Platform ${platform} not yet implemented`);
        continue;
      }

      // Log the publish attempt
      await supabaseAdmin.from('post_logs').insert({
        project_id: project.id,
        platform: platform,
        attempt_number: (project.retry_count || 0) + 1,
        success: result.success,
        error_message: result.success ? null : result.error,
        response: result
      });

      if (result.success) {
        console.log(`[AUTOPUBLISH] Successfully published to ${platform}:`, result.mediaUrl);
        publishResults[platform] = result.mediaUrl;
        hasSuccess = true;
      } else {
        console.error(`[AUTOPUBLISH] Failed to publish to ${platform}:`, result.error);
        hasFailure = true;
      }

    } catch (error) {
      console.error(`[AUTOPUBLISH] Error publishing to ${platform}:`, error);
      
      // Log the error
      await supabaseAdmin.from('post_logs').insert({
        project_id: project.id,
        platform: platform,
        attempt_number: (project.retry_count || 0) + 1,
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        response: { error: String(error) }
      });
      
      hasFailure = true;
    }
  }

  // Collect error messages from failed platforms
  const errorMessages: string[] = [];
  for (const connection of connections) {
    const platform = connection.platform;
    if (!publishResults[platform]) {
      // This platform failed - fetch the error from post_logs
      const { data: logEntry } = await supabaseAdmin
        .from('post_logs')
        .select('error_message')
        .eq('project_id', project.id)
        .eq('platform', platform)
        .eq('attempt_number', (project.retry_count || 0) + 1)
        .single();
      
      if (logEntry?.error_message) {
        errorMessages.push(`${platform}: ${logEntry.error_message}`);
      }
    }
  }

  // Update project based on results
  const updateData: any = {};
  const currentRetryCount = project.retry_count || 0;

  if (hasSuccess && !hasFailure) {
    // All platforms succeeded
    updateData.pipeline_stage = 'published';
    updateData.published_urls = publishResults;
    updateData.error_message = null;
    updateData.retry_count = 0; // Reset retry count on success
    console.log(`[AUTOPUBLISH] Project ${project.id} fully published`);
  } else if (hasSuccess && hasFailure) {
    // Partial success
    updateData.pipeline_stage = 'published';
    updateData.published_urls = publishResults;
    updateData.error_message = `Partial success. Failed platforms: ${errorMessages.join('; ')}`;
    updateData.retry_count = 0; // Reset retry count on partial success
    console.log(`[AUTOPUBLISH] Project ${project.id} partially published`);
  } else {
    // All failed - implement retry logic
    const combinedErrors = errorMessages.join('; ') || 'Unknown error';
    if (currentRetryCount < 2) {
      // Retry: increment count and reschedule for 10 minutes later
      updateData.retry_count = currentRetryCount + 1;
      const retryTime = new Date();
      retryTime.setMinutes(retryTime.getMinutes() + 10);
      updateData.scheduled_time = retryTime.toISOString();
      updateData.error_message = `Retry ${currentRetryCount + 1}/3: ${combinedErrors}`;
      console.log(`[AUTOPUBLISH] Project ${project.id} scheduled for retry ${currentRetryCount + 1}/3 at ${retryTime.toISOString()}`);
    } else {
      // Max retries reached - mark as failed
      updateData.pipeline_stage = 'failed';
      updateData.retry_count = 3;
      updateData.error_message = `Failed after 3 attempts: ${combinedErrors}`;
      console.error(`[AUTOPUBLISH] Project ${project.id} failed after 3 retries: ${combinedErrors}`);
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from('projects')
    .update(updateData)
    .eq('id', project.id);

  if (updateError) {
    console.error(`[AUTOPUBLISH] Failed to update project ${project.id}:`, updateError);
  }

  return {
    projectId: project.id,
    success: hasSuccess,
    publishedUrls: publishResults,
    stage: updateData.pipeline_stage
  };
}

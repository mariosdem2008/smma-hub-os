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
        assets:final_asset_id (
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
  console.log(`[AUTOPUBLISH] Publishing project ${project.id}: ${project.title}`);

  if (!project.assets) {
    throw new Error('No final asset found for project');
  }

  if (!project.platforms || project.platforms.length === 0) {
    throw new Error('No platforms specified for project');
  }

  const asset = project.assets;
  const mediaUrl = asset.file_url;
  const mediaType = asset.file_type?.startsWith('video') ? 'video' : 'image';

  console.log(`[AUTOPUBLISH] Media type: ${mediaType}, URL: ${mediaUrl}`);

  // Fetch social connections for client
  const { data: connections, error: connectionsError } = await supabaseAdmin
    .from('social_connections')
    .select('*')
    .eq('client_id', project.client_id)
    .eq('status', 'connected')
    .in('platform', project.platforms);

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
      hasFailure = true;
    }
  }

  // Update project based on results
  const updateData: any = {};

  if (hasSuccess && !hasFailure) {
    // All platforms succeeded
    updateData.pipeline_stage = 'published';
    updateData.published_urls = publishResults;
    updateData.error_message = null;
    console.log(`[AUTOPUBLISH] Project ${project.id} fully published`);
  } else if (hasSuccess && hasFailure) {
    // Partial success
    updateData.pipeline_stage = 'published';
    updateData.published_urls = publishResults;
    updateData.error_message = 'Some platforms failed to publish';
    console.log(`[AUTOPUBLISH] Project ${project.id} partially published`);
  } else {
    // All failed
    updateData.pipeline_stage = 'failed';
    updateData.error_message = 'All platforms failed to publish';
    console.error(`[AUTOPUBLISH] Project ${project.id} failed to publish`);
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

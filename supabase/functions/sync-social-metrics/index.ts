import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// CRON SCHEDULE:
// This function should be scheduled to run every 6 hours via pg_cron
// 
// SQL to schedule:
// SELECT cron.schedule(
//   'sync-social-metrics',
//   '0 */6 * * *',
//   $$
//   SELECT net.http_post(
//     url:='https://PROJECT_REF.supabase.co/functions/v1/sync-social-metrics',
//     headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
//     body:='{}'::jsonb
//   ) as request_id;
//   $$
// );

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[METRICS-SYNC] Starting social metrics sync');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const graphApiVersion = Deno.env.get('GRAPH_API_VERSION') || 'v21.0';

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch all active social connections
    const { data: connections, error: connectionsError } = await supabase
      .from('social_connections')
      .select('*, clients!inner(id, agency_id)')
      .eq('status', 'connected')
      .not('access_token', 'is', null);

    if (connectionsError) {
      console.error('[METRICS-SYNC] Error fetching connections:', connectionsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch connections' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[METRICS-SYNC] Found ${connections?.length || 0} active connections`);

    let totalPostsSynced = 0;
    let totalProfilesSynced = 0;
    const errors: string[] = [];

    // Sync metrics for each connection
    for (const connection of connections || []) {
      const agencyId = connection.clients.agency_id;
      const clientId = connection.client_id;
      const platform = connection.platform;

      try {
        let syncedPostCount = 0;
        
        // Sync post metrics
        if (platform === 'instagram' || platform === 'facebook') {
          syncedPostCount = await syncPostMetrics(
            supabase,
            connection,
            agencyId,
            clientId,
            graphApiVersion
          );
          totalPostsSynced += syncedPostCount;
        }

        // Sync profile stats
        const profileSynced = await syncProfileStats(
          supabase,
          connection,
          agencyId,
          clientId,
          graphApiVersion
        );
        if (profileSynced) totalProfilesSynced++;

        // Log success
        await supabase.from('metrics_sync_logs').insert({
          agency_id: agencyId,
          client_id: clientId,
          platform,
          sync_type: 'full_sync',
          success: true,
          records_synced: syncedPostCount
        });

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[METRICS-SYNC] Error syncing ${platform} for client ${clientId}:`, errorMsg);
        errors.push(`${platform} (${clientId}): ${errorMsg}`);

        // Log failure
        await supabase.from('metrics_sync_logs').insert({
          agency_id: agencyId,
          client_id: clientId,
          platform,
          sync_type: 'full_sync',
          success: false,
          error_message: errorMsg,
          records_synced: 0
        });
      }
    }

    console.log(`[METRICS-SYNC] Sync complete: ${totalPostsSynced} posts, ${totalProfilesSynced} profiles`);

    return new Response(
      JSON.stringify({
        success: true,
        posts_synced: totalPostsSynced,
        profiles_synced: totalProfilesSynced,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[METRICS-SYNC] Fatal error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Sync post-level metrics for Instagram or Facebook
 */
async function syncPostMetrics(
  supabase: any,
  connection: any,
  agencyId: string,
  clientId: string,
  graphApiVersion: string
): Promise<number> {
  console.log(`[METRICS-SYNC] Syncing post metrics for ${connection.platform} - ${connection.account_id}`);

  // Fetch published posts for this connection
  const { data: scheduledPosts, error: postsError } = await supabase
    .from('scheduled_posts')
    .select('id, project_id, platform_post_id, platform, published_at')
    .eq('client_id', clientId)
    .eq('platform', connection.platform)
    .eq('status', 'published')
    .not('platform_post_id', 'is', null)
    .gte('published_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()); // Last 90 days

  if (postsError || !scheduledPosts || scheduledPosts.length === 0) {
    console.log(`[METRICS-SYNC] No published posts found for ${connection.platform}`);
    return 0;
  }

  console.log(`[METRICS-SYNC] Found ${scheduledPosts.length} published posts to sync`);

  let syncedCount = 0;

  for (const post of scheduledPosts) {
    try {
      const metrics = await fetchPostInsights(
        post.platform_post_id,
        connection.platform,
        connection.access_token,
        graphApiVersion
      );

      if (metrics) {
        // Upsert metrics
        const { error: upsertError } = await supabase
          .from('social_post_metrics')
          .upsert({
            agency_id: agencyId,
            client_id: clientId,
            project_id: post.project_id,
            scheduled_post_id: post.id,
            platform: connection.platform,
            platform_post_id: post.platform_post_id,
            date: new Date().toISOString().split('T')[0],
            ...metrics
          }, {
            onConflict: 'scheduled_post_id,platform_post_id,date'
          });

        if (upsertError) {
          console.error(`[METRICS-SYNC] Error upserting metrics for post ${post.platform_post_id}:`, upsertError);
        } else {
          syncedCount++;
        }
      }

      // Rate limiting: wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`[METRICS-SYNC] Error fetching metrics for post ${post.platform_post_id}:`, error);
    }
  }

  return syncedCount;
}

/**
 * Sync profile-level stats
 */
async function syncProfileStats(
  supabase: any,
  connection: any,
  agencyId: string,
  clientId: string,
  graphApiVersion: string
): Promise<boolean> {
  console.log(`[METRICS-SYNC] Syncing profile stats for ${connection.platform} - ${connection.account_id}`);

  try {
    const stats = await fetchProfileInsights(
      connection.account_id,
      connection.platform,
      connection.access_token,
      graphApiVersion
    );

    if (stats) {
      const { error: upsertError } = await supabase
        .from('social_profile_stats')
        .upsert({
          agency_id: agencyId,
          client_id: clientId,
          platform: connection.platform,
          profile_id: connection.account_id,
          date: new Date().toISOString().split('T')[0],
          ...stats
        }, {
          onConflict: 'client_id,platform,profile_id,date'
        });

      if (upsertError) {
        console.error(`[METRICS-SYNC] Error upserting profile stats:`, upsertError);
        return false;
      }

      return true;
    }

    return false;
  } catch (error) {
    console.error(`[METRICS-SYNC] Error fetching profile stats:`, error);
    return false;
  }
}

/**
 * Fetch insights for a single post from Instagram or Facebook
 */
async function fetchPostInsights(
  postId: string,
  platform: string,
  accessToken: string,
  graphApiVersion: string
): Promise<any> {
  const baseUrl = `https://graph.facebook.com/${graphApiVersion}`;

  try {
    if (platform === 'instagram') {
      // Instagram post insights
      const metricsUrl = `${baseUrl}/${postId}/insights?metric=impressions,reach,likes,comments,saves,shares&access_token=${accessToken}`;
      const response = await fetch(metricsUrl);

      if (!response.ok) {
        console.error(`[METRICS-SYNC] Instagram API error for post ${postId}:`, response.status);
        return null;
      }

      const data = await response.json();
      
      if (!data.data || data.data.length === 0) {
        return null;
      }

      // Parse metrics from response
      const metrics: any = {
        impressions: 0,
        reach: 0,
        likes: 0,
        comments: 0,
        saves: 0,
        shares: 0,
        clicks: 0
      };

      for (const metric of data.data) {
        const value = metric.values?.[0]?.value || 0;
        if (metric.name === 'impressions') metrics.impressions = value;
        if (metric.name === 'reach') metrics.reach = value;
        if (metric.name === 'likes') metrics.likes = value;
        if (metric.name === 'comments') metrics.comments = value;
        if (metric.name === 'saves') metrics.saves = value;
        if (metric.name === 'shares') metrics.shares = value;
      }

      return metrics;

    } else if (platform === 'facebook') {
      // Facebook post insights
      const metricsUrl = `${baseUrl}/${postId}/insights?metric=post_impressions,post_impressions_unique,post_engaged_users,post_clicks&access_token=${accessToken}`;
      const response = await fetch(metricsUrl);

      if (!response.ok) {
        console.error(`[METRICS-SYNC] Facebook API error for post ${postId}:`, response.status);
        return null;
      }

      const data = await response.json();

      if (!data.data || data.data.length === 0) {
        return null;
      }

      // Parse metrics
      const metrics: any = {
        impressions: 0,
        reach: 0,
        likes: 0,
        comments: 0,
        saves: 0,
        shares: 0,
        clicks: 0
      };

      for (const metric of data.data) {
        const value = metric.values?.[0]?.value || 0;
        if (metric.name === 'post_impressions') metrics.impressions = value;
        if (metric.name === 'post_impressions_unique') metrics.reach = value;
        if (metric.name === 'post_clicks') metrics.clicks = value;
      }

      // Fetch reactions/comments separately
      const reactionsUrl = `${baseUrl}/${postId}?fields=likes.summary(true),comments.summary(true),shares&access_token=${accessToken}`;
      const reactionsResponse = await fetch(reactionsUrl);
      
      if (reactionsResponse.ok) {
        const reactionsData = await reactionsResponse.json();
        metrics.likes = reactionsData.likes?.summary?.total_count || 0;
        metrics.comments = reactionsData.comments?.summary?.total_count || 0;
        metrics.shares = reactionsData.shares?.count || 0;
      }

      return metrics;
    }

    return null;
  } catch (error) {
    console.error(`[METRICS-SYNC] Error fetching post insights:`, error);
    return null;
  }
}

/**
 * Fetch profile-level insights
 */
async function fetchProfileInsights(
  accountId: string,
  platform: string,
  accessToken: string,
  graphApiVersion: string
): Promise<any> {
  const baseUrl = `https://graph.facebook.com/${graphApiVersion}`;

  try {
    if (platform === 'instagram') {
      // Instagram profile insights
      const metricsUrl = `${baseUrl}/${accountId}/insights?metric=impressions,reach,profile_views,follower_count&period=day&access_token=${accessToken}`;
      const response = await fetch(metricsUrl);

      if (!response.ok) {
        console.error(`[METRICS-SYNC] Instagram profile API error:`, response.status);
        return null;
      }

      const data = await response.json();

      if (!data.data || data.data.length === 0) {
        return null;
      }

      const stats: any = {
        followers: 0,
        impressions: 0,
        profile_visits: 0
      };

      for (const metric of data.data) {
        const value = metric.values?.[0]?.value || 0;
        if (metric.name === 'follower_count') stats.followers = value;
        if (metric.name === 'impressions') stats.impressions = value;
        if (metric.name === 'profile_views') stats.profile_visits = value;
      }

      return stats;

    } else if (platform === 'facebook') {
      // Facebook page insights
      const metricsUrl = `${baseUrl}/${accountId}/insights?metric=page_impressions,page_views_total&period=day&access_token=${accessToken}`;
      const response = await fetch(metricsUrl);

      if (!response.ok) {
        console.error(`[METRICS-SYNC] Facebook page API error:`, response.status);
        return null;
      }

      const data = await response.json();

      const stats: any = {
        followers: 0,
        impressions: 0,
        profile_visits: 0
      };

      for (const metric of data.data || []) {
        const value = metric.values?.[0]?.value || 0;
        if (metric.name === 'page_impressions') stats.impressions = value;
        if (metric.name === 'page_views_total') stats.profile_visits = value;
      }

      // Fetch follower count separately
      const pageUrl = `${baseUrl}/${accountId}?fields=followers_count&access_token=${accessToken}`;
      const pageResponse = await fetch(pageUrl);
      
      if (pageResponse.ok) {
        const pageData = await pageResponse.json();
        stats.followers = pageData.followers_count || 0;
      }

      return stats;
    }

    return null;
  } catch (error) {
    console.error(`[METRICS-SYNC] Error fetching profile insights:`, error);
    return null;
  }
}

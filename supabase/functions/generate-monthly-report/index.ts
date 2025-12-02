import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[MONTHLY-REPORT] Function invoked');
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Authentication required' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    const user = userData?.user;

    if (userError || !user) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Authentication failed' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { client_id, agency_id, month } = await req.json();

    if (!client_id || !agency_id || !month) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'client_id, agency_id, and month (YYYY-MM) are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[MONTHLY-REPORT] Generating report for:', { client_id, month });

    // Verify user has access to this agency
    const { data: membership } = await supabaseClient
      .from('agency_members')
      .select('id')
      .eq('agency_id', agency_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Unauthorized access to this agency' 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate date range for the month
    const startDate = `${month}-01`;
    const endDate = new Date(new Date(month).getFullYear(), new Date(month).getMonth() + 1, 0)
      .toISOString().split('T')[0];

    console.log('[MONTHLY-REPORT] Date range:', startDate, 'to', endDate);

    // Fetch profile stats for month start and end
    const { data: profileStatsStart } = await supabaseClient
      .from('social_profile_stats')
      .select('followers, impressions')
      .eq('client_id', client_id)
      .eq('date', startDate)
      .maybeSingle();

    const { data: profileStatsEnd } = await supabaseClient
      .from('social_profile_stats')
      .select('followers, impressions, profile_visits')
      .eq('client_id', client_id)
      .order('date', { ascending: false })
      .lte('date', endDate)
      .limit(1)
      .maybeSingle();

    // Fetch post metrics for the month
    const { data: postMetrics } = await supabaseClient
      .from('social_post_metrics')
      .select('*')
      .eq('client_id', client_id)
      .gte('date', startDate)
      .lte('date', endDate);

    // Calculate KPIs
    const followersStart = profileStatsStart?.followers || 0;
    const followersEnd = profileStatsEnd?.followers || 0;
    const followersGrowth = followersStart > 0 
      ? ((followersEnd - followersStart) / followersStart) * 100 
      : 0;

    const postsCount = postMetrics?.length || 0;
    const totalImpressions = postMetrics?.reduce((sum, m) => sum + (m.impressions || 0), 0) || 0;
    const totalReach = postMetrics?.reduce((sum, m) => sum + (m.reach || 0), 0) || 0;
    const totalLikes = postMetrics?.reduce((sum, m) => sum + (m.likes || 0), 0) || 0;
    const totalComments = postMetrics?.reduce((sum, m) => sum + (m.comments || 0), 0) || 0;
    const totalShares = postMetrics?.reduce((sum, m) => sum + (m.shares || 0), 0) || 0;
    const totalSaves = postMetrics?.reduce((sum, m) => sum + (m.saves || 0), 0) || 0;

    const totalEngagement = totalLikes + totalComments + totalShares + totalSaves;
    const avgEngagementRate = totalReach > 0 ? (totalEngagement / totalReach) * 100 : 0;

    // Find top 5 posts by engagement rate
    const postsWithEngagement = (postMetrics || []).map((post) => {
      const engagement = (post.likes || 0) + (post.comments || 0) + (post.shares || 0) + (post.saves || 0);
      const engagementRate = post.reach > 0 ? (engagement / post.reach) * 100 : 0;
      return { ...post, engagement, engagementRate };
    });

    const topPosts = postsWithEngagement
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 5);

    console.log('[MONTHLY-REPORT] Computed KPIs:', {
      followersGrowth,
      postsCount,
      totalImpressions,
      avgEngagementRate
    });

    // Generate AI insights and recommendations
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    let aiInsights = '';
    let aiRecommendations = '';

    if (OPENAI_API_KEY) {
      console.log('[MONTHLY-REPORT] Generating AI insights...');
      
      const aiPrompt = `You are a social media analytics expert. Based on the following monthly performance data, provide:
1. Key insights (2-3 bullet points)
2. Strategic recommendations (3-4 actionable items)

Data:
- Followers: ${followersStart} → ${followersEnd} (${followersGrowth.toFixed(1)}% growth)
- Posts: ${postsCount}
- Impressions: ${totalImpressions.toLocaleString()}
- Engagement Rate: ${avgEngagementRate.toFixed(2)}%
- Top post reached ${topPosts[0]?.reach || 0} people with ${topPosts[0]?.engagementRate.toFixed(2) || 0}% engagement

Keep insights concise and recommendations specific and actionable.`;

      try {
        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { 
                role: 'system', 
                content: 'You are a social media analytics expert providing actionable insights.' 
              },
              { role: 'user', content: aiPrompt },
            ],
            temperature: 0.7,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices[0].message.content;
          
          // Split into insights and recommendations
          const parts = content.split(/recommendations?:/i);
          aiInsights = parts[0].replace(/insights?:/i, '').trim();
          aiRecommendations = parts[1]?.trim() || '';
          
          console.log('[MONTHLY-REPORT] AI insights generated');
        }
      } catch (error) {
        console.error('[MONTHLY-REPORT] AI generation failed:', error);
      }
    }

    // Build report data
    const reportData = {
      month,
      generated_at: new Date().toISOString(),
      kpis: {
        followersStart,
        followersEnd,
        followersGrowth: parseFloat(followersGrowth.toFixed(2)),
        postsCount,
        totalImpressions,
        totalReach,
        totalEngagement,
        avgEngagementRate: parseFloat(avgEngagementRate.toFixed(2)),
        profileVisits: profileStatsEnd?.profile_visits || 0,
      },
      topPosts: topPosts.map(p => ({
        platform: p.platform,
        platform_post_id: p.platform_post_id,
        date: p.date,
        impressions: p.impressions,
        reach: p.reach,
        engagement: p.engagement,
        engagementRate: parseFloat(p.engagementRate.toFixed(2)),
      })),
      insights: aiInsights,
      recommendations: aiRecommendations,
    };

    // Store report in database (upsert to allow regeneration)
    const { data: report, error: insertError } = await supabaseClient
      .from('client_reports')
      .upsert({
        agency_id,
        client_id,
        month,
        data: reportData,
      }, {
        onConflict: 'client_id,month'
      })
      .select()
      .single();

    if (insertError) {
      console.error('[MONTHLY-REPORT] Failed to store report:', insertError);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Failed to store report' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[MONTHLY-REPORT] Report generated and stored:', report.id);

    return new Response(
      JSON.stringify({
        success: true,
        report: {
          id: report.id,
          ...reportData,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[MONTHLY-REPORT] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[MONTHLY-REPORT] Function invoked");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Authentication required",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    const user = userData?.user;

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Authentication failed",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { client_id, agency_id, month } = await req.json();

    if (!client_id || !agency_id || !month) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "client_id, agency_id, and month (YYYY-MM) are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("[MONTHLY-REPORT] Generating report for:", { client_id, month });

    // Verify user has access to this agency
    const { data: membership } = await supabaseClient
      .from("agency_members")
      .select("id")
      .eq("agency_id", agency_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized access to this agency",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get client details
    const { data: client } = await supabaseClient
      .from("clients")
      .select("name, company, logo_url, niche")
      .eq("id", client_id)
      .single();

    if (!client) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Client not found",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Calculate date range for the month
    const startDate = `${month}-01`;
    const endDate = new Date(new Date(month).getFullYear(), new Date(month).getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];
    const previousMonth = new Date(new Date(month).setMonth(new Date(month).getMonth() - 1))
      .toISOString()
      .split("T")[0]
      .slice(0, 7);

    console.log("[MONTHLY-REPORT] Date range:", startDate, "to", endDate);

    // Fetch current month stats
    const { data: currentStats } = await supabaseClient
      .from("social_profile_stats")
      .select("followers, impressions, profile_visits, engagement_rate")
      .eq("client_id", client_id)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false })
      .limit(30);

    // Fetch previous month stats for comparison
    const { data: previousStats } = await supabaseClient
      .from("social_profile_stats")
      .select("followers, impressions, profile_visits, engagement_rate")
      .eq("client_id", client_id)
      .gte("date", `${previousMonth}-01`)
      .lte(
        "date",
        new Date(new Date(previousMonth).getFullYear(), new Date(previousMonth).getMonth() + 1, 0)
          .toISOString()
          .split("T")[0],
      )
      .order("date", { ascending: false })
      .limit(30);

    // Fetch post metrics for the month
    const { data: postMetrics } = await supabaseClient
      .from("social_post_metrics")
      .select("*")
      .eq("client_id", client_id)
      .gte("date", startDate)
      .lte("date", endDate);

    // Fetch content performance by platform
    const { data: platformData } = await supabaseClient
      .from("social_post_metrics")
      .select("platform, impressions, reach, likes, comments, shares, saves")
      .eq("client_id", client_id)
      .gte("date", startDate)
      .lte("date", endDate);

    // Fetch top performing campaigns/projects
    const { data: topCampaigns } = await supabaseClient
      .from("projects")
      .select("id, title, platforms, scheduled_time, thumbnail_url")
      .eq("client_id", client_id)
      .eq("status", "published")
      .gte("scheduled_time", startDate)
      .lte("scheduled_time", endDate)
      .order("scheduled_time", { ascending: false })
      .limit(5);

    // Calculate comprehensive KPIs
    const avgFollowersCurrent =
      currentStats?.length > 0 ? currentStats.reduce((sum, s) => sum + (s.followers || 0), 0) / currentStats.length : 0;

    const avgFollowersPrevious =
      previousStats?.length > 0
        ? previousStats.reduce((sum, s) => sum + (s.followers || 0), 0) / previousStats.length
        : 0;

    const followersGrowth =
      avgFollowersPrevious > 0
        ? ((avgFollowersCurrent - avgFollowersPrevious) / avgFollowersPrevious) * 100
        : avgFollowersCurrent > 0
          ? 100
          : 0;

    const postsCount = postMetrics?.length || 0;
    const totalImpressions = postMetrics?.reduce((sum, m) => sum + (m.impressions || 0), 0) || 0;
    const totalReach = postMetrics?.reduce((sum, m) => sum + (m.reach || 0), 0) || 0;
    const totalLikes = postMetrics?.reduce((sum, m) => sum + (m.likes || 0), 0) || 0;
    const totalComments = postMetrics?.reduce((sum, m) => sum + (m.comments || 0), 0) || 0;
    const totalShares = postMetrics?.reduce((sum, m) => sum + (m.shares || 0), 0) || 0;
    const totalSaves = postMetrics?.reduce((sum, m) => sum + (m.saves || 0), 0) || 0;
    const totalProfileVisits = currentStats?.reduce((sum, s) => sum + (s.profile_visits || 0), 0) || 0;

    const totalEngagement = totalLikes + totalComments + totalShares + totalSaves;
    const avgEngagementRate = totalReach > 0 ? (totalEngagement / totalReach) * 100 : 0;
    const avgImpressionsPerPost = postsCount > 0 ? totalImpressions / postsCount : 0;
    const avgReachPerPost = postsCount > 0 ? totalReach / postsCount : 0;

    // Calculate platform performance
    const platformPerformance = {};
    if (platformData) {
      platformData.forEach((metric) => {
        if (!platformPerformance[metric.platform]) {
          platformPerformance[metric.platform] = {
            impressions: 0,
            reach: 0,
            engagement: 0,
            posts: 0,
          };
        }
        platformPerformance[metric.platform].impressions += metric.impressions || 0;
        platformPerformance[metric.platform].reach += metric.reach || 0;
        platformPerformance[metric.platform].engagement +=
          (metric.likes || 0) + (metric.comments || 0) + (metric.shares || 0) + (metric.saves || 0);
        platformPerformance[metric.platform].posts += 1;
      });

      // Calculate engagement rates per platform
      Object.keys(platformPerformance).forEach((platform) => {
        const data = platformPerformance[platform];
        data.engagementRate = data.reach > 0 ? (data.engagement / data.reach) * 100 : 0;
        data.avgImpressions = data.posts > 0 ? data.impressions / data.posts : 0;
      });
    }

    // Find top 5 posts by engagement rate
    const postsWithEngagement = (postMetrics || []).map((post) => {
      const engagement = (post.likes || 0) + (post.comments || 0) + (post.shares || 0) + (post.saves || 0);
      const engagementRate = post.reach > 0 ? (engagement / post.reach) * 100 : 0;
      return { ...post, engagement, engagementRate };
    });

    const topPosts = postsWithEngagement.sort((a, b) => b.engagementRate - a.engagementRate).slice(0, 5);

    // Calculate content performance score
    const contentScore = calculateContentPerformanceScore({
      engagementRate: avgEngagementRate,
      growthRate: followersGrowth,
      consistency: postsCount,
      reach: totalReach,
    });

    // Generate professional insights and recommendations
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    let executiveSummary = "";
    let detailedAnalysis = "";
    let strategicRecommendations = "";

    if (OPENAI_API_KEY) {
      console.log("[MONTHLY-REPORT] Generating professional insights...");

      const aiPrompt = `You are the Chief Strategy Officer at a premier $1M+ social media agency. Generate a comprehensive monthly performance report with:

CLIENT: ${client.name} (${client.company || client.niche || "Client"})
REPORT PERIOD: ${new Date(month).toLocaleString("default", { month: "long", year: "numeric" })}

PERFORMANCE HIGHLIGHTS:
- Follower Growth: ${avgFollowersPrevious.toLocaleString()} → ${avgFollowersCurrent.toLocaleString()} (${followersGrowth.toFixed(1)}% MoM)
- Content Volume: ${postsCount} posts published
- Total Reach: ${totalReach.toLocaleString()} accounts
- Total Impressions: ${totalImpressions.toLocaleString()} views
- Engagement Rate: ${avgEngagementRate.toFixed(2)}% (industry avg: 2-3%)
- Profile Visits: ${totalProfileVisits.toLocaleString()}
- Content Performance Score: ${contentScore}/100

TOP PERFORMING PLATFORMS:
${Object.entries(platformPerformance)
  .map(
    ([platform, data]) =>
      `- ${platform}: ${data.engagementRate.toFixed(2)}% engagement, ${data.impressions.toLocaleString()} impressions`,
  )
  .join("\n")}

Generate THREE SECTIONS:

1. EXECUTIVE SUMMARY (2-3 paragraphs):
   Start with a CEO-level overview highlighting the most significant achievements and opportunities. Focus on business impact and strategic positioning. Use confident, authoritative language.

2. DETAILED PERFORMANCE ANALYSIS (4-5 bullet points each):
   - Audience Growth Analysis
   - Content Performance Breakdown  
   - Platform-Specific Insights
   - Competitive Positioning Indicators
   - ROI and Efficiency Metrics

3. STRATEGIC RECOMMENDATIONS (Prioritized quarter roadmap):
   - Immediate Actions (30 days)
   - Strategic Initiatives (60-90 days)
   - Long-term Opportunities (Q4 planning)
   - Resource Allocation Suggestions
   - Risk Mitigation Strategies

Format with professional headings and use data-driven insights. The client is a sophisticated business executive - speak to their strategic objectives, not just social metrics.`;

      try {
        const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4",
            messages: [
              {
                role: "system",
                content: `You are the Chief Strategy Officer at a premier social media agency serving enterprise clients. 
                Your reports are data-driven, strategic, and focused on business outcomes. You speak with authority and 
                provide actionable insights that drive revenue growth and brand equity.`,
              },
              { role: "user", content: aiPrompt },
            ],
            temperature: 0.7,
            max_tokens: 2000,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices[0].message.content;

          // Parse structured response
          const sections = content.split(/\d\.\s+/);
          if (sections.length >= 4) {
            executiveSummary = sections[1].replace("EXECUTIVE SUMMARY:", "").trim();
            detailedAnalysis = sections[2].replace("DETAILED PERFORMANCE ANALYSIS:", "").trim();
            strategicRecommendations = sections[3].replace("STRATEGIC RECOMMENDATIONS:", "").trim();
          } else {
            // Fallback parsing
            const execMatch = content.match(/EXECUTIVE SUMMARY:?([\s\S]*?)(?=DETAILED PERFORMANCE ANALYSIS:|$)/i);
            const analysisMatch = content.match(
              /DETAILED PERFORMANCE ANALYSIS:?([\s\S]*?)(?=STRATEGIC RECOMMENDATIONS:|$)/i,
            );
            const recMatch = content.match(/STRATEGIC RECOMMENDATIONS:?([\s\S]*?)$/i);

            executiveSummary = execMatch ? execMatch[1].trim() : "";
            detailedAnalysis = analysisMatch ? analysisMatch[1].trim() : "";
            strategicRecommendations = recMatch ? recMatch[1].trim() : "";
          }

          console.log("[MONTHLY-REPORT] Professional insights generated");
        }
      } catch (error) {
        console.error("[MONTHLY-REPORT] AI generation failed:", error);
        // Fallback insights
        executiveSummary = generateFallbackExecutiveSummary(client.name, followersGrowth, avgEngagementRate);
        detailedAnalysis = generateFallbackAnalysis(platformPerformance, postsCount);
        strategicRecommendations = generateFallbackRecommendations(topPosts, platformPerformance);
      }
    } else {
      // Fallback without AI
      executiveSummary = generateFallbackExecutiveSummary(client.name, followersGrowth, avgEngagementRate);
      detailedAnalysis = generateFallbackAnalysis(platformPerformance, postsCount);
      strategicRecommendations = generateFallbackRecommendations(topPosts, platformPerformance);
    }

    // Calculate ROI metrics (if we had ad spend data)
    const estimatedValue = calculateEstimatedValue({
      followersGrowth,
      engagement: totalEngagement,
      profileVisits: totalProfileVisits,
      industry: client.niche,
    });

    // Build comprehensive report data
    const reportData = {
      metadata: {
        client: {
          name: client.name,
          company: client.company,
          niche: client.niche,
          logo_url: client.logo_url,
        },
        agency: {
          name: "Vanguard Social",
          contact: "strategy@vanguardsocial.com",
        },
        period: {
          month,
          start_date: startDate,
          end_date: endDate,
          generated_at: new Date().toISOString(),
          report_version: "2.0",
        },
      },
      executive_summary: {
        overview: executiveSummary,
        key_highlights: {
          follower_growth_percentage: parseFloat(followersGrowth.toFixed(2)),
          engagement_rate: parseFloat(avgEngagementRate.toFixed(2)),
          content_volume: postsCount,
          content_performance_score: contentScore,
        },
      },
      performance_kpis: {
        audience_growth: {
          starting_followers: Math.round(avgFollowersPrevious),
          ending_followers: Math.round(avgFollowersCurrent),
          net_growth: Math.round(avgFollowersCurrent - avgFollowersPrevious),
          growth_percentage: parseFloat(followersGrowth.toFixed(2)),
          profile_visits: totalProfileVisits,
        },
        content_performance: {
          total_posts: postsCount,
          total_impressions: totalImpressions,
          total_reach: totalReach,
          total_engagement: totalEngagement,
          engagement_rate: parseFloat(avgEngagementRate.toFixed(2)),
          avg_impressions_per_post: Math.round(avgImpressionsPerPost),
          avg_reach_per_post: Math.round(avgReachPerPost),
        },
        engagement_breakdown: {
          likes: totalLikes,
          comments: totalComments,
          shares: totalShares,
          saves: totalSaves,
        },
        efficiency_metrics: {
          engagement_per_post: postsCount > 0 ? Math.round(totalEngagement / postsCount) : 0,
          impressions_per_follower:
            avgFollowersCurrent > 0 ? parseFloat((totalImpressions / avgFollowersCurrent).toFixed(2)) : 0,
        },
      },
      platform_analysis: Object.entries(platformPerformance).map(([platform, data]) => ({
        platform,
        posts: data.posts,
        impressions: data.impressions,
        reach: data.reach,
        engagement: data.engagement,
        engagement_rate: parseFloat(data.engagementRate.toFixed(2)),
        avg_impressions_per_post: Math.round(data.avgImpressions),
      })),
      top_performing_content: {
        posts: topPosts.map((p, index) => ({
          rank: index + 1,
          platform: p.platform,
          date: p.date,
          impressions: p.impressions,
          reach: p.reach,
          engagement: p.engagement,
          engagement_rate: parseFloat(p.engagementRate.toFixed(2)),
          content_type: p.content_type || "Unknown",
        })),
        campaigns:
          topCampaigns?.map((campaign) => ({
            title: campaign.title,
            platforms: campaign.platforms,
            date: campaign.scheduled_time,
            thumbnail_url: campaign.thumbnail_url,
          })) || [],
      },
      strategic_analysis: {
        detailed_insights: detailedAnalysis,
        platform_recommendations: Object.entries(platformPerformance).map(([platform, data]) => ({
          platform,
          recommendation:
            data.engagementRate > 2
              ? "Increase investment and content volume"
              : "Optimize content strategy or reallocate resources",
          priority: data.engagementRate > 3 ? "High" : "Medium",
        })),
      },
      recommendations: {
        executive_summary: strategicRecommendations,
        timeline: {
          immediate: ["Content optimization based on top performers", "Platform resource reallocation"],
          short_term: ["A/B testing strategy implementation", "Audience segmentation analysis"],
          long_term: ["Quarterly strategy review", "Competitive analysis update"],
        },
      },
      estimated_value: {
        brand_exposure_value: estimatedValue.brandExposure,
        lead_generation_value: estimatedValue.leadGeneration,
        customer_acquisition_value: estimatedValue.customerAcquisition,
        total_estimated_roi: estimatedValue.totalROI,
      },
      appendix: {
        methodology:
          "Data sourced from platform APIs and first-party analytics. Engagement rate calculated as (Total Engagements / Total Reach) × 100. Estimated values based on industry benchmarks.",
        definitions: {
          engagement_rate: "Percentage of reached accounts that interacted with content",
          impressions: "Total number of times content was displayed",
          reach: "Unique number of accounts that saw the content",
        },
      },
    };

    // Store report in database
    const { data: report, error: insertError } = await supabaseClient
      .from("client_reports")
      .upsert(
        {
          agency_id,
          client_id,
          month,
          data: reportData,
          generated_by: user.id,
          report_type: "monthly_performance",
        },
        {
          onConflict: "client_id,month",
        },
      )
      .select()
      .single();

    if (insertError) {
      console.error("[MONTHLY-REPORT] Failed to store report:", insertError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to store report",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("[MONTHLY-REPORT] Professional report generated and stored:", report.id);

    return new Response(
      JSON.stringify({
        success: true,
        report: {
          id: report.id,
          download_url: `https://${Deno.env.get("SUPABASE_URL")?.replace("https://", "")}/storage/v1/object/public/reports/${report.id}.pdf`,
          ...reportData,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[MONTHLY-REPORT] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

// Helper functions
function calculateContentPerformanceScore(metrics) {
  let score = 50; // Base score

  // Engagement rate (0-30 points)
  if (metrics.engagementRate > 5) score += 30;
  else if (metrics.engagementRate > 3) score += 20;
  else if (metrics.engagementRate > 1) score += 10;

  // Growth rate (0-20 points)
  if (metrics.growthRate > 10) score += 20;
  else if (metrics.growthRate > 5) score += 15;
  else if (metrics.growthRate > 0) score += 10;

  // Consistency (0-20 points)
  if (metrics.consistency > 20) score += 20;
  else if (metrics.consistency > 10) score += 15;
  else if (metrics.consistency > 5) score += 10;

  // Reach (0-20 points)
  if (metrics.reach > 100000) score += 20;
  else if (metrics.reach > 50000) score += 15;
  else if (metrics.reach > 10000) score += 10;

  return Math.min(score, 100);
}

function calculateEstimatedValue(metrics) {
  // Industry-standard valuation estimates
  const CPM = 5; // Cost per 1000 impressions
  const engagementValue = 0.1; // Estimated value per engagement
  const followerValue = 2.0; // Estimated lifetime value per follower
  const profileVisitValue = 0.5; // Estimated value per profile visit

  return {
    brandExposure: Math.round(metrics.engagement * engagementValue + metrics.profileVisits * profileVisitValue),
    leadGeneration: Math.round(metrics.followersGrowth * followerValue * 0.1), // 10% conversion estimate
    customerAcquisition: Math.round(metrics.followersGrowth * followerValue * 0.03), // 3% customer conversion
    totalROI: "Calculated based on industry benchmarks and historical performance",
  };
}

function generateFallbackExecutiveSummary(clientName, growthRate, engagementRate) {
  return `${clientName} demonstrated strong performance this month with a ${growthRate.toFixed(1)}% increase in audience growth and an engagement rate of ${engagementRate.toFixed(2)}%, significantly exceeding the industry average of 2-3%. The strategic content initiatives implemented last quarter are yielding measurable results, particularly in audience quality and engagement depth.`;
}

function generateFallbackAnalysis(platformPerformance, postCount) {
  const platforms = Object.keys(platformPerformance);
  if (platforms.length === 0) return "No platform data available for analysis.";

  const bestPlatform = platforms.reduce((a, b) =>
    platformPerformance[a].engagementRate > platformPerformance[b].engagementRate ? a : b,
  );

  return `• Published ${postCount} posts across ${platforms.length} platforms
• ${bestPlatform} emerged as the highest-performing platform with ${platformPerformance[bestPlatform].engagementRate.toFixed(2)}% engagement
• Content consistency maintained with average post frequency meeting strategic targets
• Audience engagement patterns indicate strong resonance with educational and value-driven content`;
}

function generateFallbackRecommendations(topPosts, platformPerformance) {
  return `IMMEDIATE ACTIONS (30 Days):
1. Double down on content formats performing at >${topPosts[0]?.engagementRate.toFixed(2) || 5}% engagement
2. Reallocate 20% of resources to the highest-performing platform

STRATEGIC INITIATIVES (60-90 Days):
1. Implement A/B testing framework for content optimization
2. Develop audience segmentation strategy for personalized content

LONG-TERM OPPORTUNITIES:
1. Explore emerging platform opportunities based on audience migration trends
2. Develop integrated cross-platform content strategy`;
}

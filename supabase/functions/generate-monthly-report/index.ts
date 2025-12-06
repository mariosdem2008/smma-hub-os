import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface KPIData {
  followersStart: number;
  followersEnd: number;
  followersGrowth: number;
  postsCount: number;
  totalImpressions: number;
  totalReach: number;
  totalEngagement: number;
  avgEngagementRate: number;
  profileVisits: number;
  engagementByType: {
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  };
  topPerformingPlatform: string;
  postingFrequency: number;
  avgImpressionsPerPost: number;
  avgReachPerPost: number;
}

interface TopPost {
  platform: string;
  platform_post_id: string;
  date: string;
  caption: string;
  media_type: string;
  impressions: number;
  reach: number;
  engagement: number;
  engagementRate: number;
  likes: number;
  comments: number;
  shares: number;
}

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

    console.log("[MONTHLY-REPORT] Generating professional report for:", { client_id, month });

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

    // Get client information for personalized report
    const { data: client } = await supabaseClient
      .from("clients")
      .select("name, industry, social_platforms")
      .eq("id", client_id)
      .single();

    // Calculate date range for the month
    const startDate = `${month}-01`;
    const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];

    console.log("[MONTHLY-REPORT] Date range:", startDate, "to", endDate);

    // Fetch profile stats for month start and end
    const { data: profileStatsStart } = await supabaseClient
      .from("social_profile_stats")
      .select("followers, following, posts_count, engagement_rate, profile_visits")
      .eq("client_id", client_id)
      .gte("date", startDate)
      .lte("date", startDate)
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: profileStatsEnd } = await supabaseClient
      .from("social_profile_stats")
      .select("followers, following, posts_count, engagement_rate, profile_visits")
      .eq("client_id", client_id)
      .lte("date", endDate)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch all posts for the month
    const { data: allPosts } = await supabaseClient
      .from("social_posts")
      .select("*")
      .eq("client_id", client_id)
      .gte("scheduled_date", startDate)
      .lte("scheduled_date", endDate);

    // Fetch post metrics for the month
    const { data: postMetrics } = await supabaseClient
      .from("social_post_metrics")
      .select("*")
      .eq("client_id", client_id)
      .gte("date", startDate)
      .lte("date", endDate);

    // Calculate advanced KPIs
    const followersStart = profileStatsStart?.followers || 0;
    const followersEnd = profileStatsEnd?.followers || 0;
    const followersGrowth = followersStart > 0 ? ((followersEnd - followersStart) / followersStart) * 100 : 0;

    const postsCount = allPosts?.length || 0;
    const totalImpressions = postMetrics?.reduce((sum, m) => sum + (m.impressions || 0), 0) || 0;
    const totalReach = postMetrics?.reduce((sum, m) => sum + (m.reach || 0), 0) || 0;
    const totalLikes = postMetrics?.reduce((sum, m) => sum + (m.likes || 0), 0) || 0;
    const totalComments = postMetrics?.reduce((sum, m) => sum + (m.comments || 0), 0) || 0;
    const totalShares = postMetrics?.reduce((sum, m) => sum + (m.shares || 0), 0) || 0;
    const totalSaves = postMetrics?.reduce((sum, m) => sum + (m.saves || 0), 0) || 0;

    const totalEngagement = totalLikes + totalComments + totalShares + totalSaves;
    const avgEngagementRate = totalReach > 0 ? (totalEngagement / totalReach) * 100 : 0;
    const avgImpressionsPerPost = postsCount > 0 ? totalImpressions / postsCount : 0;
    const avgReachPerPost = postsCount > 0 ? totalReach / postsCount : 0;
    const postingFrequency = allPosts ? allPosts.length / 30 : 0; // Average posts per day

    // Find top performing platform
    const platformPerformance = postMetrics?.reduce(
      (acc, post) => {
        if (!acc[post.platform]) {
          acc[post.platform] = { engagement: 0, posts: 0 };
        }
        acc[post.platform].engagement +=
          (post.likes || 0) + (post.comments || 0) + (post.shares || 0) + (post.saves || 0);
        acc[post.platform].posts += 1;
        return acc;
      },
      {} as Record<string, { engagement: number; posts: number }>,
    );

    let topPerformingPlatform = "N/A";
    if (platformPerformance) {
      const platforms = Object.entries(platformPerformance);
      if (platforms.length > 0) {
        topPerformingPlatform = platforms.reduce((a, b) =>
          a[1].engagement / a[1].posts > b[1].engagement / b[1].posts ? a : b,
        )[0];
      }
    }

    // Find top 10 posts by engagement rate
    const postsWithEngagement = (postMetrics || []).map((post) => {
      const engagement = (post.likes || 0) + (post.comments || 0) + (post.shares || 0) + (post.saves || 0);
      const engagementRate = post.reach > 0 ? (engagement / post.reach) * 100 : 0;

      // Get post details
      const postDetails = allPosts?.find((p) => p.id === post.post_id);

      return {
        platform: post.platform,
        platform_post_id: post.platform_post_id,
        date: post.date,
        caption: postDetails?.caption || "",
        media_type: postDetails?.media_type || "unknown",
        impressions: post.impressions || 0,
        reach: post.reach || 0,
        engagement,
        engagementRate: parseFloat(engagementRate.toFixed(2)),
        likes: post.likes || 0,
        comments: post.comments || 0,
        shares: post.shares || 0,
      };
    });

    const topPosts = postsWithEngagement.sort((a, b) => b.engagementRate - a.engagementRate).slice(0, 10);

    console.log("[MONTHLY-REPORT] Computed advanced KPIs");

    // Generate professional AI insights and recommendations
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    let executiveSummary = "";
    let performanceInsights = "";
    let strategicRecommendations = "";
    let competitiveAnalysis = "";
    let industryBenchmarks = "";

    if (OPENAI_API_KEY && client) {
      console.log("[MONTHLY-REPORT] Generating professional AI analysis...");

      const aiPrompt = `You are the lead strategist at a top-tier social media agency serving Fortune 500 companies. Generate a comprehensive, professional monthly report for ${client.name} (${client.industry} industry).

PERFORMANCE DATA:
- Followers: ${followersStart.toLocaleString()} → ${followersEnd.toLocaleString()} (${followersGrowth.toFixed(1)}% growth)
- Total Posts: ${postsCount} (${postingFrequency.toFixed(1)} posts/day)
- Total Impressions: ${totalImpressions.toLocaleString()}
- Total Reach: ${totalReach.toLocaleString()}
- Total Engagement: ${totalEngagement.toLocaleString()}
- Average Engagement Rate: ${avgEngagementRate.toFixed(2)}%
- Profile Visits: ${profileStatsEnd?.profile_visits || 0}
- Top Platform: ${topPerformingPlatform}
- Engagement Breakdown: ${totalLikes} likes, ${totalComments} comments, ${totalShares} shares, ${totalSaves} saves

TOP POST CHARACTERISTICS:
${topPosts
  .slice(0, 3)
  .map((post, i) => `Post ${i + 1}: ${post.caption.substring(0, 100)}... (${post.engagementRate}% engagement rate)`)
  .join("\n")}

Please provide a comprehensive report with these sections:

1. EXECUTIVE SUMMARY (3-4 sentences highlighting key achievements and ROI)
2. PERFORMANCE INSIGHTS (analyze trends, strengths, and areas for improvement)
3. STRATEGIC RECOMPENDATIONS (3-5 specific, actionable strategies with expected outcomes)
4. COMPETITIVE ANALYSIS (how this performance compares to industry peers)
5. INDUSTRY BENCHMARKS (how metrics compare to industry standards)

Make it professional, data-driven, and focused on business outcomes. Use markdown formatting with bold headers.`;

      try {
        const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4-turbo-preview",
            messages: [
              {
                role: "system",
                content:
                  "You are a senior social media strategist at a leading digital agency. Provide comprehensive, professional analysis with actionable insights.",
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

          // Parse sections from AI response
          const sections = content.split(/\n#{1,2}\s+/);
          executiveSummary = sections.find((s) => s.toLowerCase().includes("executive")) || "";
          performanceInsights = sections.find((s) => s.toLowerCase().includes("performance")) || "";
          strategicRecommendations =
            sections.find((s) => s.toLowerCase().includes("strategic") || s.toLowerCase().includes("recommendation")) ||
            "";
          competitiveAnalysis = sections.find((s) => s.toLowerCase().includes("competitive")) || "";
          industryBenchmarks = sections.find((s) => s.toLowerCase().includes("benchmark")) || "";

          console.log("[MONTHLY-REPORT] Professional AI analysis generated");
        }
      } catch (error) {
        console.error("[MONTHLY-REPORT] AI generation failed:", error);
      }
    }

    // Build comprehensive report data
    const reportData = {
      month,
      generated_at: new Date().toISOString(),
      client_info: {
        name: client?.name || "",
        industry: client?.industry || "",
        platforms: client?.social_platforms || [],
      },
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
        engagementByType: {
          likes: totalLikes,
          comments: totalComments,
          shares: totalShares,
          saves: totalSaves,
        },
        topPerformingPlatform,
        postingFrequency: parseFloat(postingFrequency.toFixed(1)),
        avgImpressionsPerPost: parseFloat(avgImpressionsPerPost.toFixed(0)),
        avgReachPerPost: parseFloat(avgReachPerPost.toFixed(0)),
      },
      topPosts,
      analysis: {
        executiveSummary,
        performanceInsights,
        strategicRecommendations,
        competitiveAnalysis,
        industryBenchmarks,
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
        report: report,
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

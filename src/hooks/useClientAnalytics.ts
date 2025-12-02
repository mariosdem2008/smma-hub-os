import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format } from "date-fns";

interface ClientAnalytics {
  totalImpressions: number;
  totalReach: number;
  totalEngagement: number;
  totalFollowers: number;
  avgEngagementRate: number;
  postsThisMonth: number;
  followerGrowth: number;
  impressionsGrowth: number;
}

export function useClientAnalytics(clientId: string) {
  return useQuery({
    queryKey: ["client-analytics", clientId],
    queryFn: async (): Promise<ClientAnalytics> => {
      const thirtyDaysAgo = subDays(new Date(), 30);
      const sixtyDaysAgo = subDays(new Date(), 60);

      // Fetch post metrics for last 30 days
      const { data: postMetrics, error: metricsError } = await supabase
        .from("social_post_metrics")
        .select("impressions, reach, likes, comments, shares, saves")
        .eq("client_id", clientId)
        .gte("date", format(thirtyDaysAgo, "yyyy-MM-dd"));

      if (metricsError) throw metricsError;

      // Fetch post metrics for previous 30 days (for growth comparison)
      const { data: previousMetrics } = await supabase
        .from("social_post_metrics")
        .select("impressions")
        .eq("client_id", clientId)
        .gte("date", format(sixtyDaysAgo, "yyyy-MM-dd"))
        .lt("date", format(thirtyDaysAgo, "yyyy-MM-dd"));

      // Fetch latest profile stats
      const { data: profileStats, error: statsError } = await supabase
        .from("social_profile_stats")
        .select("followers, impressions, date")
        .eq("client_id", clientId)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (statsError) throw statsError;

      // Fetch profile stats from 30 days ago for growth
      const { data: previousProfileStats } = await supabase
        .from("social_profile_stats")
        .select("followers")
        .eq("client_id", clientId)
        .eq("date", format(thirtyDaysAgo, "yyyy-MM-dd"))
        .maybeSingle();

      // Calculate totals
      const totalImpressions = postMetrics?.reduce((sum, m) => sum + (m.impressions || 0), 0) || 0;
      const totalReach = postMetrics?.reduce((sum, m) => sum + (m.reach || 0), 0) || 0;
      const totalLikes = postMetrics?.reduce((sum, m) => sum + (m.likes || 0), 0) || 0;
      const totalComments = postMetrics?.reduce((sum, m) => sum + (m.comments || 0), 0) || 0;
      const totalShares = postMetrics?.reduce((sum, m) => sum + (m.shares || 0), 0) || 0;
      const totalSaves = postMetrics?.reduce((sum, m) => sum + (m.saves || 0), 0) || 0;

      const totalEngagement = totalLikes + totalComments + totalShares + totalSaves;
      const avgEngagementRate = totalReach > 0 ? (totalEngagement / totalReach) * 100 : 0;

      // Growth calculations
      const previousImpressions = previousMetrics?.reduce((sum, m) => sum + (m.impressions || 0), 0) || 0;
      const impressionsGrowth =
        previousImpressions > 0 ? ((totalImpressions - previousImpressions) / previousImpressions) * 100 : 0;

      const currentFollowers = profileStats?.followers || 0;
      const previousFollowers = previousProfileStats?.followers || 0;
      const followerGrowth =
        previousFollowers > 0 ? ((currentFollowers - previousFollowers) / previousFollowers) * 100 : 0;

      return {
        totalImpressions,
        totalReach,
        totalEngagement,
        totalFollowers: currentFollowers,
        avgEngagementRate: parseFloat(avgEngagementRate.toFixed(2)),
        postsThisMonth: postMetrics?.length || 0,
        followerGrowth: parseFloat(followerGrowth.toFixed(2)),
        impressionsGrowth: parseFloat(impressionsGrowth.toFixed(2)),
      };
    },
    enabled: !!clientId,
  });
}

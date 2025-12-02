import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format } from "date-fns";

interface ClientMetricsSummary {
  totalImpressions: number;
  totalEngagement: number;
  avgEngagementRate: number;
  postsPublished: number;
}

export function useClientMetricsSummary(clientId: string) {
  return useQuery({
    queryKey: ["client-metrics-summary", clientId],
    queryFn: async (): Promise<ClientMetricsSummary> => {
      const thirtyDaysAgo = subDays(new Date(), 30);

      // Fetch post metrics for last 30 days
      const { data: metrics, error } = await supabase
        .from("social_post_metrics")
        .select("impressions, reach, likes, comments, shares, saves")
        .eq("client_id", clientId)
        .gte("date", format(thirtyDaysAgo, "yyyy-MM-dd"));

      if (error) {
        console.error("Error fetching client metrics:", error);
        return {
          totalImpressions: 0,
          totalEngagement: 0,
          avgEngagementRate: 0,
          postsPublished: 0,
        };
      }

      const totalImpressions = metrics?.reduce((sum, m) => sum + (m.impressions || 0), 0) || 0;
      const totalReach = metrics?.reduce((sum, m) => sum + (m.reach || 0), 0) || 0;
      const totalLikes = metrics?.reduce((sum, m) => sum + (m.likes || 0), 0) || 0;
      const totalComments = metrics?.reduce((sum, m) => sum + (m.comments || 0), 0) || 0;
      const totalShares = metrics?.reduce((sum, m) => sum + (m.shares || 0), 0) || 0;
      const totalSaves = metrics?.reduce((sum, m) => sum + (m.saves || 0), 0) || 0;

      const totalEngagement = totalLikes + totalComments + totalShares + totalSaves;
      const avgEngagementRate = totalReach > 0 ? (totalEngagement / totalReach) * 100 : 0;

      return {
        totalImpressions,
        totalEngagement,
        avgEngagementRate: parseFloat(avgEngagementRate.toFixed(2)),
        postsPublished: metrics?.length || 0,
      };
    },
    enabled: !!clientId,
  });
}

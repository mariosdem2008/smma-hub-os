import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClientReport {
  id: string;
  agency_id: string;
  client_id: string;
  month: string;
  data: {
    month: string;
    generated_at: string;
    client_info: {
      name: string;
      industry: string;
      platforms: string[];
    };
    kpis: {
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
    };
    topPosts: Array<{
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
    }>;
    analysis: {
      executiveSummary: string;
      performanceInsights: string;
      strategicRecommendations: string;
      competitiveAnalysis: string;
      industryBenchmarks: string;
    };
  };
  created_at: string;
  updated_at: string;
}

export function useClientReports(clientId: string) {
  return useQuery({
    queryKey: ["client-reports", clientId],
    queryFn: async (): Promise<ClientReport[]> => {
      const { data, error } = await supabase
        .from("client_reports")
        .select("*")
        .eq("client_id", clientId)
        .order("month", { ascending: false });

      if (error) throw error;

      // Type assertion for the data field
      return (data || []).map((report) => ({
        ...report,
        data: report.data as ClientReport["data"],
      })) as ClientReport[];
    },
    enabled: !!clientId,
  });
}

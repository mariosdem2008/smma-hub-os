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
    };
    topPosts: Array<{
      platform: string;
      platform_post_id: string;
      date: string;
      impressions: number;
      reach: number;
      engagement: number;
      engagementRate: number;
    }>;
    insights: string;
    recommendations: string;
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

      return (data || []) as ClientReport[];
    },
    enabled: !!clientId,
  });
}
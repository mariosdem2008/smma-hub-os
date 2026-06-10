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
    report_insight_json?: {
      headline: string;
      performance_summary: string;
      insights: Array<{ point: string; evidence: string }>;
      recommendations: Array<{ action: string; why: string; owner: "agency" | "client" }>;
      risks_or_blockers: string[];
    };
    grounding?: {
      kpi_evidence_phrases?: string[];
      strategy_sources?: string[];
      delivery_source?: string;
      delivery_state?: string;
      blocker_count?: number;
    };
    governance?: {
      score?: number;
      accepted?: boolean;
      blocked_by_governance?: boolean;
      initial_hard_violation_count?: number;
      initial_soft_issue_count?: number;
      grading_persist_error?: string | null;
    };
    ai?: {
      task_type?: string;
      insight_source?: string;
      insight_model?: string | null;
      local_model_configured?: boolean;
      fallback_reason?: string | null;
    };
  };
  created_at: string;
  updated_at: string;
}

export function useClientReports(clientId: string, enabled = true) {
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
    enabled: !!clientId && enabled,
  });
}

export function useClientReport(clientId: string | undefined, reportId: string | undefined) {
  return useQuery({
    queryKey: ["client-report", clientId ?? "", reportId ?? ""],
    queryFn: async (): Promise<ClientReport | null> => {
      if (!clientId || !reportId) return null;

      const { data, error } = await supabase
        .from("client_reports")
        .select("*")
        .eq("client_id", clientId)
        .eq("id", reportId)
        .maybeSingle();

      if (error) throw error;
      return data as ClientReport | null;
    },
    enabled: !!clientId && !!reportId,
  });
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AgencyPulseSignalType =
  | "blocker"
  | "flagged_content"
  | "strategy_missing"
  | "strategy_stale"
  | "approval_stalled"
  | "report_due";

export type AgencyPulseSeverity = "high" | "med" | "low";
export type AgencyPulseOwner = "agency" | "client" | "owner";
export type AgencyPulseAgent = "grading" | "blocker" | "strategy" | "reporting";

export interface AgencyPulseAttentionItem {
  client_id: string;
  client_name: string;
  signal_type: AgencyPulseSignalType;
  severity: AgencyPulseSeverity;
  title: string;
  detail: string;
  responsible_agent: AgencyPulseAgent;
  owner: AgencyPulseOwner;
  recommended_action: string;
  deep_link: string;
}

export interface AgencyPulseSummary {
  clients_total: number;
  on_track: number;
  at_risk: number;
  blocked: number;
}

export interface AgencyPulseResponse {
  summary: AgencyPulseSummary;
  attention: AgencyPulseAttentionItem[];
  counts_by_type: Record<AgencyPulseSignalType, number>;
  counts_by_owner: Record<AgencyPulseOwner, number>;
  generated_at: string;
  current_period: string;
  persisted: false;
  refresh: {
    attempted: number;
    refreshed: number;
    failed: number;
    stale_total: number;
    next_offset: number | null;
    errors: Array<{ client_id: string; error: string }>;
  };
  briefing: string | null;
  local_llm_used: boolean;
}

export const agencyPulseKeys = {
  all: ["agency-pulse"] as const,
  agency: (agencyId: string) => [...agencyPulseKeys.all, agencyId] as const,
};

export function useAgencyPulse(agencyId: string | undefined) {
  return useQuery({
    queryKey: agencyPulseKeys.agency(agencyId ?? ""),
    queryFn: async (): Promise<AgencyPulseResponse> => {
      if (!agencyId) throw new Error("agency_id is required");

      const { data, error } = await supabase.functions.invoke("ai-agency-pulse", {
        body: {
          agency_id: agencyId,
          refresh_blockers: true,
          blocker_stale_minutes: 360,
          refresh_limit: 25,
          run_briefing: false,
        },
      });

      if (error) throw error;
      if (!data || typeof data !== "object") throw new Error("Agency pulse returned an invalid response");
      if ("error" in data) throw new Error(String((data as { error?: unknown }).error ?? "Failed to load agency pulse"));
      return data as AgencyPulseResponse;
    },
    enabled: !!agencyId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DeliveryState = "on_track" | "at_risk" | "blocked";
export type BlockerSeverity = "high" | "med" | "low";
export type BlockerOwner = "agency" | "client" | "owner";

export interface ClientBlocker {
  code: string;
  severity: BlockerSeverity;
  title: string;
  detail: string;
  owner: BlockerOwner;
  recommended_next_action: string;
  deep_link: string;
  signal_source: string;
}

export interface ClientBlockerSnapshot {
  id: string;
  agency_id: string;
  client_id: string;
  delivery_state: DeliveryState;
  blockers: ClientBlocker[];
  counts: { high: number; med: number; blocked: number };
  scanned_at: string;
  created_at?: string;
  updated_at?: string;
}

export const clientBlockerKeys = {
  all: ["client-blockers"] as const,
  client: (clientId: string) => [...clientBlockerKeys.all, "client", clientId] as const,
  agency: (agencyId: string) => [...clientBlockerKeys.all, "agency", agencyId] as const,
};

function normalizeSnapshot(row: any): ClientBlockerSnapshot {
  return {
    id: row.id,
    agency_id: row.agency_id,
    client_id: row.client_id,
    delivery_state: row.delivery_state ?? "on_track",
    blockers: Array.isArray(row.blockers) ? row.blockers : [],
    counts: {
      high: Number(row.counts?.high ?? 0),
      med: Number(row.counts?.med ?? 0),
      blocked: Number(row.counts?.blocked ?? 0),
    },
    scanned_at: row.scanned_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function useClientBlockers(clientId: string | undefined) {
  return useQuery({
    queryKey: clientBlockerKeys.client(clientId ?? ""),
    queryFn: async () => {
      if (!clientId) return null;
      const db = supabase as any;
      const { data, error } = await db
        .from("client_blockers")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();

      if (error) throw error;
      return data ? normalizeSnapshot(data) : null;
    },
    enabled: !!clientId,
  });
}

export function useAgencyClientBlockers(agencyId: string | undefined) {
  return useQuery({
    queryKey: clientBlockerKeys.agency(agencyId ?? ""),
    queryFn: async () => {
      if (!agencyId) return [];
      const db = supabase as any;
      const { data, error } = await db
        .from("client_blockers")
        .select("*")
        .eq("agency_id", agencyId)
        .order("scanned_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      return (data ?? []).map(normalizeSnapshot) as ClientBlockerSnapshot[];
    },
    enabled: !!agencyId,
  });
}

export function useScanClientBlockers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      agencyId,
      clientId,
      runLlm = false,
    }: {
      agencyId: string;
      clientId: string;
      runLlm?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke("ai-blocker-scan", {
        body: {
          agency_id: agencyId,
          client_id: clientId,
          run_llm: runLlm,
        },
      });
      if (error) throw error;
      return data as { mode: "client"; snapshot: ClientBlockerSnapshot; local_llm_used: boolean };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: clientBlockerKeys.client(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: clientBlockerKeys.agency(variables.agencyId) });
    },
  });
}

export function useScanAgencyClientBlockers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      agencyId,
      limit = 25,
      offset = 0,
      runLlm = false,
    }: {
      agencyId: string;
      limit?: number;
      offset?: number;
      runLlm?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke("ai-blocker-scan", {
        body: {
          agency_id: agencyId,
          mode: "agency",
          limit,
          offset,
          run_llm: runLlm,
        },
      });
      if (error) throw error;
      return data as {
        mode: "agency";
        scanned: number;
        failed: number;
        snapshots: ClientBlockerSnapshot[];
        errors: Array<{ client_id: string; error: string }>;
        paging: { limit: number; offset: number; next_offset: number | null };
        local_llm_used: boolean;
      };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: clientBlockerKeys.agency(variables.agencyId) });
    },
  });
}

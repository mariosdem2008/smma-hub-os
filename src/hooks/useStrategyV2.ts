import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapDecisionToArtifactStatus, type StrategyArtifactDecision } from "@/lib/strategy/v2/approvals";
import { clientOperationsKeys } from "@/hooks/useClientOperations";

export interface StrategyV2BriefRecord {
  id: string;
  client_id: string;
  version: number;
  readiness_state: string;
  status: string;
  content_json: Record<string, unknown>;
  missing_items: string[];
  assumptions: string[];
  citations: Array<Record<string, unknown>>;
  confidence: number | null;
  created_at: string;
  updated_at: string;
}

export interface StrategyV2ArtifactRecord {
  id: string;
  client_id: string;
  artifact_type: string;
  version: number;
  status: string;
  approved_by_user_id?: string | null;
  approved_at?: string | null;
  content_json: Record<string, unknown>;
  markdown: string | null;
  assumptions: string[];
  open_questions: string[];
  confidence: number | null;
  created_at: string;
  updated_at: string;
}

export interface StrategyArtifactApprovalV2Record {
  id: string;
  artifact_id: string;
  client_id: string;
  approval_stage: string;
  decision: StrategyArtifactDecision;
  note: string | null;
  actor_user_id: string | null;
  created_at: string;
}

export function useLatestClientOperatingBriefV2(clientId: string | undefined) {
  return useQuery({
    queryKey: ["strategy-v2-brief", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      if (!clientId) return null;
      const db = supabase as any;
      const { data, error } = await db
        .from("client_operating_briefs_v2")
        .select("*")
        .eq("client_id", clientId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as StrategyV2BriefRecord | null;
    },
  });
}

export function useLatestStrategyArtifactsV2(clientId: string | undefined) {
  return useQuery({
    queryKey: ["strategy-v2-artifacts", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      if (!clientId) return [] as StrategyV2ArtifactRecord[];
      const db = supabase as any;
      const { data, error } = await db
        .from("strategy_artifacts_v2")
        .select("*")
        .eq("client_id", clientId)
        .in("artifact_type", [
          "strategy_readiness_audit",
          "strategy_diagnosis",
          "strategy_recommendation",
          "strategy_plan_v2",
          "creator_brief",
        ])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StrategyV2ArtifactRecord[];
    },
  });
}

export function useStrategyArtifactApprovalsV2(clientId: string | undefined) {
  return useQuery({
    queryKey: ["strategy-v2-approvals", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      if (!clientId) return [] as StrategyArtifactApprovalV2Record[];
      const db = supabase as any;
      const { data, error } = await db
        .from("strategy_artifact_approvals_v2")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StrategyArtifactApprovalV2Record[];
    },
  });
}

export function useReviewStrategyArtifactV2() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      artifactId,
      clientId,
      agencyId,
      approvalStage,
      decision,
      note,
    }: {
      artifactId: string;
      clientId: string;
      agencyId: string;
      approvalStage: string;
      decision: StrategyArtifactDecision;
      note?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;
      const nextStatus = mapDecisionToArtifactStatus(decision);
      const approvedAt = decision === "approved" ? new Date().toISOString() : null;

      const { error: artifactError } = await supabase
        .from("strategy_artifacts_v2")
        .update({
          status: nextStatus,
          approved_by_user_id: decision === "approved" ? userId : null,
          approved_at: approvedAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", artifactId);
      if (artifactError) throw artifactError;

      const { data, error } = await supabase
        .from("strategy_artifact_approvals_v2")
        .insert({
          artifact_id: artifactId,
          agency_id: agencyId,
          client_id: clientId,
          approval_stage: approvalStage,
          decision,
          note: note?.trim() ? note.trim() : null,
          actor_user_id: userId,
        })
        .select("*")
        .single();
      if (error) throw error;

      if (decision === "approved") {
        const db = supabase as any;
        const { data: artifactRow, error: artifactLookupError } = await db
          .from("strategy_artifacts_v2")
          .select("published_to_strategy_id")
          .eq("id", artifactId)
          .maybeSingle();
        if (artifactLookupError) throw artifactLookupError;

        if (artifactRow?.published_to_strategy_id) {
          const { error: materializeError } = await db.rpc("materialize_strategy_approved_work", {
            p_strategy_id: artifactRow.published_to_strategy_id,
            p_reason: "strategy_plan_approved",
          });
          if (materializeError) throw materializeError;
        }
      }

      return data as StrategyArtifactApprovalV2Record;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["strategy-v2-artifacts", variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ["strategy-v2-approvals", variables.clientId] });
      queryClient.invalidateQueries({ queryKey: clientOperationsKeys.executionTasks(variables.clientId) });
    },
  });
}

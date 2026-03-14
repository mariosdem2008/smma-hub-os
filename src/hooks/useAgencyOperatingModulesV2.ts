import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAgency } from "@/hooks/useAgency";
import { useAuth } from "@/lib/auth";
import type { AgencyOperatingModuleV2 } from "@/lib/strategy/v2/contracts";
import { buildDefaultAgencyOperatingModuleV2, type AgencyAiSetupCoreModuleKey } from "@/lib/agency-ai-setup-v2/modules";
import type { AgencyAiSetupMetaV2 } from "@/lib/agency-ai-setup-v2/readiness";
import { useToast } from "@/hooks/use-toast";
import { recomputeAgencyAiSetupReadinessV2 } from "@/hooks/useAgencyAiSetupV2";

export interface AgencyOperatingModuleV2Record {
  id: string;
  agency_id: string;
  module_key: string;
  version: number;
  status: "draft" | "review" | "approved" | "archived";
  source_document_id: string | null;
  content_json: AgencyOperatingModuleV2;
  derived_snapshot_json: Record<string, unknown>;
  confidence: number | null;
  evidence_sources: Array<Record<string, unknown>>;
  approved_by_user_id: string | null;
  approved_at: string | null;
  updated_at: string;
  created_at: string;
}

export interface AgencyOperatingModuleReviewRecord {
  id: string;
  agency_id: string;
  module_key: string;
  module_version: number;
  decision: "approved" | "changes_requested" | "rejected";
  note: string | null;
  actor_user_id: string | null;
  created_at: string;
}

export function useAgencyOperatingModulesV2() {
  const { agencyId } = useAgency();

  return useQuery({
    queryKey: ["agency-operating-modules-v2", agencyId],
    enabled: !!agencyId,
    queryFn: async () => {
      if (!agencyId) return [] as AgencyOperatingModuleV2Record[];
      const db = supabase as any;
      const { data, error } = await db
        .from("agency_operating_modules_v2")
        .select("*")
        .eq("agency_id", agencyId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AgencyOperatingModuleV2Record[];
    },
  });
}

export function useLatestAgencyOperatingModulesV2() {
  const query = useAgencyOperatingModulesV2();

  const latestByKey = new Map<string, AgencyOperatingModuleV2Record>();
  for (const record of query.data ?? []) {
    if (!latestByKey.has(record.module_key)) latestByKey.set(record.module_key, record);
  }

  return {
    ...query,
    latestByKey,
  };
}

export function useAgencyOperatingModuleReviewsV2() {
  const { agencyId } = useAgency();

  return useQuery({
    queryKey: ["agency-operating-module-reviews-v2", agencyId],
    enabled: !!agencyId,
    queryFn: async () => {
      if (!agencyId) return [] as AgencyOperatingModuleReviewRecord[];
      const db = supabase as any;
      const { data, error } = await db
        .from("agency_operating_module_reviews_v2")
        .select("*")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AgencyOperatingModuleReviewRecord[];
    },
  });
}

export function useSaveAgencyOperatingModuleV2() {
  const { agencyId } = useAgency();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      moduleKey,
      content,
      confidence,
      status,
    }: {
      moduleKey: AgencyAiSetupCoreModuleKey;
      content: AgencyOperatingModuleV2;
      confidence?: number;
      status?: "draft" | "review";
    }) => {
      if (!agencyId) throw new Error("No agency selected");
      const db = supabase as any;
      const { data: latest, error: latestError } = await db
        .from("agency_operating_modules_v2")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("module_key", moduleKey)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestError) throw latestError;

      if (latest && latest.status !== "approved") {
        const { data, error } = await db
          .from("agency_operating_modules_v2")
          .update({
            status: status ?? latest.status,
            content_json: content,
            derived_snapshot_json: {
              title: content.title,
              definition: content.definition,
              key_rules: content.rules.slice(0, 5),
            },
            confidence: confidence ?? content.confidence,
            evidence_sources: content.evidence_sources,
            last_reviewed_at: new Date().toISOString(),
          })
          .eq("id", latest.id)
          .select("*")
          .single();
        if (error) throw error;
        return data as AgencyOperatingModuleV2Record;
      }

      const nextVersion = Number(latest?.version ?? 0) + 1;
      const { data, error } = await db
        .from("agency_operating_modules_v2")
        .insert({
          agency_id: agencyId,
          module_key: moduleKey,
          version: nextVersion,
          status: status ?? "draft",
          content_json: content,
          derived_snapshot_json: {
            title: content.title,
            definition: content.definition,
            key_rules: content.rules.slice(0, 5),
          },
          confidence: confidence ?? content.confidence,
          evidence_sources: content.evidence_sources,
          created_by: user?.id ?? null,
          last_reviewed_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as AgencyOperatingModuleV2Record;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-operating-modules-v2", agencyId] });
      queryClient.invalidateQueries({ queryKey: ["agency-ai-setup-v2-overview", agencyId] });
      toast({ title: "Module saved", description: "The module draft has been saved." });
    },
  });
}

export function useReviewAgencyOperatingModuleV2() {
  const { agencyId } = useAgency();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      moduleRecord,
      decision,
      note,
    }: {
      moduleRecord: AgencyOperatingModuleV2Record;
      decision: "approved" | "changes_requested" | "rejected";
      note?: string;
    }) => {
      if (!agencyId) throw new Error("No agency selected");
      const db = supabase as any;
      const nextStatus = decision === "approved" ? "approved" : decision === "changes_requested" ? "review" : "archived";
      const { data, error } = await db
        .from("agency_operating_modules_v2")
        .update({
          status: nextStatus,
          approved_by_user_id: decision === "approved" ? user?.id ?? null : null,
          approved_at: decision === "approved" ? new Date().toISOString() : null,
          last_reviewed_at: new Date().toISOString(),
        })
        .eq("id", moduleRecord.id)
        .select("*")
        .single();
      if (error) throw error;

      await db.from("agency_operating_module_reviews_v2").insert({
        agency_id: agencyId,
        module_key: moduleRecord.module_key,
        module_version: moduleRecord.version,
        decision,
        note: note?.trim() ? note.trim() : null,
        actor_user_id: user?.id ?? null,
      });

      await recomputeAgencyAiSetupReadinessV2(agencyId);

      return data as AgencyOperatingModuleV2Record;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["agency-operating-modules-v2", agencyId] });
      queryClient.invalidateQueries({ queryKey: ["agency-operating-module-reviews-v2", agencyId] });
      queryClient.invalidateQueries({ queryKey: ["agency-ai-setup-v2-overview", agencyId] });
      toast({
        title: "Module review updated",
        description:
          variables.decision === "approved"
            ? "The module is now approved and will count toward readiness."
            : variables.decision === "changes_requested"
              ? "The module remains in review with requested changes."
              : "The module was archived after rejection.",
      });
    },
  });
}

export function useEnsureAgencyOperatingModuleDraftV2() {
  const saveModule = useSaveAgencyOperatingModuleV2();

  return useMutation({
    mutationFn: async ({
      moduleKey,
      foundations,
    }: {
      moduleKey: AgencyAiSetupCoreModuleKey;
      foundations?: AgencyAiSetupMetaV2["foundations"];
    }) => {
      const content = buildDefaultAgencyOperatingModuleV2(moduleKey, foundations);
      return saveModule.mutateAsync({ moduleKey, content, status: "draft" });
    },
  });
}

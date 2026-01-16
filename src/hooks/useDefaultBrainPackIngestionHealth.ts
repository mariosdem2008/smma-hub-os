import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BrainModule } from "@/lib/ai/brainModules";

const DEFAULT_MODULES: BrainModule[] = ["bootstrap", "rep_policy", "quality_bar"];

export type DefaultBrainPackIngestionHealth = {
  approvedModules: BrainModule[];
  missingModules: BrainModule[];
};

export function useDefaultBrainPackIngestionHealth(args: {
  agencyId?: string;
  approvedModules: BrainModule[];
}) {
  const agencyId = args.agencyId;
  const approvedModules = (args.approvedModules ?? []).filter((m) => DEFAULT_MODULES.includes(m));

  return useQuery({
    queryKey: ["default-brain-pack", "ingestion-health", agencyId, approvedModules.slice().sort().join(",")],
    enabled: Boolean(agencyId) && approvedModules.length > 0,
    queryFn: async (): Promise<DefaultBrainPackIngestionHealth> => {
      const { data, error } = await supabase
        .from("ai_documents")
        .select("metadata")
        .eq("agency_id", agencyId)
        .eq("doc_type", "brain_document")
        .in("metadata->>module", approvedModules);

      if (error) throw error;

      const ingestedModules = new Set<string>();
      for (const row of data ?? []) {
        const metadata = row?.metadata as Record<string, unknown> | null | undefined;
        const module = typeof metadata?.module === "string" ? metadata.module : null;
        if (module) ingestedModules.add(module);
      }

      const missingModules = approvedModules.filter((m) => !ingestedModules.has(m));
      return { approvedModules, missingModules };
    },
  });
}


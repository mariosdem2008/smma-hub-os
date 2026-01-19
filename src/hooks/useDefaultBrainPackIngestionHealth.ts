import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BrainModule } from "@/lib/ai/brainModules";

export type DefaultBrainPackIngestionHealth = {
  approvedModules: BrainModule[];
  missingModules: BrainModule[];
};

export function useDefaultBrainPackIngestionHealth(args: {
  agencyId?: string;
  approvedModules: BrainModule[];
}) {
  const agencyId = args.agencyId;
  const approvedModules = Array.from(new Set(args.approvedModules ?? []));

  return useQuery({
    queryKey: ["default-brain-pack", "ingestion-health", agencyId, approvedModules.slice().sort().join(",")],
    enabled: Boolean(agencyId) && approvedModules.length > 0,
    queryFn: async (): Promise<DefaultBrainPackIngestionHealth> => {
      const { data, error } = await supabase.functions.invoke("ai-default-brain-pack-ingestion-health", {
        body: {
          agency_id: agencyId,
          approved_modules: approvedModules,
        },
      });

      if (error) throw error;

      const missingModules = Array.isArray(data?.missingModules) ? (data.missingModules as BrainModule[]) : [];
      return { approvedModules, missingModules };
    },
  });
}


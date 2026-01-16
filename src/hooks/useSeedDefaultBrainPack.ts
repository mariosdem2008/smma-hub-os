import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SeedDefaultBrainPackResponse = {
  seeded: boolean;
  repaired: boolean;
  inserted_count: number;
  document_ids: string[];
  ingested_count: number;
  failed_ids: string[];
  errors?: Array<{ stage: string; document_id?: string; message: string }>;
};

export function useSeedDefaultBrainPack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agencyId, mode }: { agencyId?: string; mode?: "seed_or_repair" | "ingest_only" }) => {
      const { data, error } = await supabase.functions.invoke("ai-seed-default-brain-pack", {
        body: {
          ...(agencyId ? { agency_id: agencyId } : {}),
          ...(mode ? { mode } : {}),
        },
      });

      if (error) throw error;
      return data as SeedDefaultBrainPackResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brain-documents"] });
      queryClient.invalidateQueries({ queryKey: ["brain-documents", "count"] });
      queryClient.invalidateQueries({ queryKey: ["default-brain-pack", "ingestion-health"] });
    },
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SeedDefaultBrainPackResponse = {
  seeded: boolean;
  document_ids: string[];
  approved: boolean;
  ingested: boolean;
  errors?: Array<{ stage: string; document_id?: string; message: string }>;
};

export function useSeedDefaultBrainPack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agencyId }: { agencyId?: string }) => {
      const { data, error } = await supabase.functions.invoke("ai-seed-default-brain-pack", {
        body: agencyId ? { agency_id: agencyId } : {},
      });

      if (error) throw error;
      return data as SeedDefaultBrainPackResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brain-documents"] });
      queryClient.invalidateQueries({ queryKey: ["brain-documents", "count"] });
    },
  });
}


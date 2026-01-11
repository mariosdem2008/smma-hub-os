import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAgency } from "@/hooks/useAgency";

export function useBrainDocumentsTotalCount() {
  const { agencyId } = useAgency();

  return useQuery({
    queryKey: ["brain-documents", "count", agencyId],
    queryFn: async () => {
      if (!agencyId) return 0;

      const { count, error } = await supabase
        .from("brain_documents")
        .select("id", { count: "exact", head: true })
        .eq("agency_id", agencyId);

      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!agencyId,
  });
}


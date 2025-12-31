import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAgency } from "./useAgency";

export interface AgencyData {
  id: string;
  name: string;
  website: string | null;
  niche: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Hook to fetch agency data for Bootstrap Profile auto-fill
 * Returns the agency name, website, and niche from onboarding
 */
export function useAgencyData() {
  const { agencyId } = useAgency();

  const query = useQuery<AgencyData | null>({
    queryKey: ["agency-data", agencyId],
    queryFn: async () => {
      if (!agencyId) return null;

      const { data, error } = await supabase
        .from("agencies")
        .select("id, name, website, niche, user_id, created_at, updated_at")
        .eq("id", agencyId)
        .single();

      if (error) {
        console.error("Failed to fetch agency data:", error);
        return null;
      }

      return data as AgencyData;
    },
    enabled: !!agencyId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return {
    agency: query.data,
    isLoading: query.isLoading,
    error: query.error,
    // Pre-filled fields for Bootstrap Profile
    bootstrapDefaults: query.data
      ? {
          agency_name: query.data.name,
          website: query.data.website || "",
          niche: query.data.niche || "",
        }
      : null,
  };
}

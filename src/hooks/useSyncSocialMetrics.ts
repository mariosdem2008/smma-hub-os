import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SyncResult {
  success: boolean;
  posts_synced?: number;
  profiles_synced?: number;
  errors?: string[];
  error?: string;
}

export function useSyncSocialMetrics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<SyncResult> => {
      const { data, error } = await supabase.functions.invoke("sync-social-metrics", {
        body: {},
      });

      if (error) throw error;
      return data as SyncResult;
    },
    onSuccess: () => {
      // Invalidate all analytics-related queries
      queryClient.invalidateQueries({ queryKey: ["client-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["top-posts"] });
      queryClient.invalidateQueries({ queryKey: ["worst-posts"] });
      queryClient.invalidateQueries({ queryKey: ["profile-trends"] });
      queryClient.invalidateQueries({ queryKey: ["client-metrics-summary"] });
    },
  });
}

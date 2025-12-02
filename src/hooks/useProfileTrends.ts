import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format } from "date-fns";

interface DailyTrend {
  date: string;
  followers: number;
  impressions: number;
  profile_visits: number;
}

export function useProfileTrends(clientId: string, days: number = 30) {
  return useQuery({
    queryKey: ["profile-trends", clientId, days],
    queryFn: async (): Promise<DailyTrend[]> => {
      const startDate = subDays(new Date(), days);

      const { data, error } = await supabase
        .from("social_profile_stats")
        .select("date, followers, impressions, profile_visits")
        .eq("client_id", clientId)
        .gte("date", format(startDate, "yyyy-MM-dd"))
        .order("date", { ascending: true });

      if (error) throw error;

      // Aggregate by date (sum across all platforms)
      const aggregated = (data || []).reduce((acc, curr) => {
        const existing = acc.find((item) => item.date === curr.date);
        if (existing) {
          existing.followers += curr.followers || 0;
          existing.impressions += curr.impressions || 0;
          existing.profile_visits += curr.profile_visits || 0;
        } else {
          acc.push({
            date: curr.date,
            followers: curr.followers || 0,
            impressions: curr.impressions || 0,
            profile_visits: curr.profile_visits || 0,
          });
        }
        return acc;
      }, [] as DailyTrend[]);

      return aggregated;
    },
    enabled: !!clientId,
  });
}

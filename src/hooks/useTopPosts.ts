import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format } from "date-fns";

interface TopPost {
  id: string;
  project_id: string;
  platform: string;
  platform_post_id: string;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagement: number;
  engagementRate: number;
  project?: {
    title: string;
    thumbnail_url: string | null;
  };
}

export function useTopPosts(clientId: string, limit: number = 5) {
  return useQuery({
    queryKey: ["top-posts", clientId, limit],
    queryFn: async (): Promise<TopPost[]> => {
      const thirtyDaysAgo = subDays(new Date(), 30);

      // Fetch post metrics for last 30 days
      const { data: metrics, error } = await supabase
        .from("social_post_metrics")
        .select(
          `
          id,
          project_id,
          platform,
          platform_post_id,
          impressions,
          reach,
          likes,
          comments,
          shares,
          saves,
          projects (
            title,
            thumbnail_url
          )
        `
        )
        .eq("client_id", clientId)
        .gte("date", format(thirtyDaysAgo, "yyyy-MM-dd"))
        .order("date", { ascending: false });

      if (error) throw error;

      // Calculate engagement metrics for each post
      const postsWithEngagement = (metrics || []).map((post) => {
        const engagement = (post.likes || 0) + (post.comments || 0) + (post.shares || 0) + (post.saves || 0);
        const engagementRate = post.reach > 0 ? (engagement / post.reach) * 100 : 0;

        return {
          ...post,
          engagement,
          engagementRate: parseFloat(engagementRate.toFixed(2)),
          project: Array.isArray(post.projects) ? post.projects[0] : post.projects,
        };
      });

      // Sort by engagement rate and return top posts
      return postsWithEngagement.sort((a, b) => b.engagementRate - a.engagementRate).slice(0, limit);
    },
    enabled: !!clientId,
  });
}

export function useTopPostsWithGate(clientId: string, limit: number = 5, enabled: boolean = true) {
  return useQuery({
    queryKey: ["top-posts", clientId, limit],
    queryFn: async (): Promise<TopPost[]> => {
      const thirtyDaysAgo = subDays(new Date(), 30);

      const { data: metrics, error } = await supabase
        .from("social_post_metrics")
        .select(
          `
          id,
          project_id,
          platform,
          platform_post_id,
          impressions,
          reach,
          likes,
          comments,
          shares,
          saves,
          projects (
            title,
            thumbnail_url
          )
        `
        )
        .eq("client_id", clientId)
        .gte("date", format(thirtyDaysAgo, "yyyy-MM-dd"))
        .order("date", { ascending: false });

      if (error) throw error;

      const postsWithEngagement = (metrics || []).map((post) => {
        const engagement = (post.likes || 0) + (post.comments || 0) + (post.shares || 0) + (post.saves || 0);
        const engagementRate = post.reach > 0 ? (engagement / post.reach) * 100 : 0;

        return {
          ...post,
          engagement,
          engagementRate: parseFloat(engagementRate.toFixed(2)),
          project: Array.isArray(post.projects) ? post.projects[0] : post.projects,
        };
      });

      return postsWithEngagement.sort((a, b) => b.engagementRate - a.engagementRate).slice(0, limit);
    },
    enabled: !!clientId && enabled,
  });
}

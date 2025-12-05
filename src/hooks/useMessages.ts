import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClientAuth } from "@/lib/client-auth";
import { useMemo } from "react";

export const useMessages = (conversationId?: string) => {
  const { clientUser, isAuthenticated } = useClientAuth();

  const url = useMemo(() => {
    // Use Vite environment variable
    return import.meta.env.VITE_SUPABASE_URL;
  }, []);

  return useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      if (!conversationId) {
        return [];
      }

      // If this is a temporary ID from optimistic update, return empty array
      if (conversationId.startsWith("temp-") || conversationId.startsWith("optimistic-")) {
        console.log("Temporary conversation ID, returning empty messages");
        return [];
      }

      console.log(`Fetching messages for conversation: ${conversationId}`);

      // Check if client portal user
      const clientToken = typeof window !== "undefined" ? localStorage.getItem("client_auth_token") : null;

      if (clientUser && isAuthenticated && clientToken) {
        // For client portal users
        const response = await fetch(`${url}/functions/v1/list-messages?conversation_id=${conversationId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${clientToken}`,
          },
          credentials: "include",
        });

        if (!response.ok) {
          // Don't throw error for 404, just return empty array
          if (response.status === 404) {
            console.log("Conversation not found, returning empty messages");
            return [];
          }
          const errorText = await response.text();
          console.error("Failed to fetch messages:", errorText);
          throw new Error("Failed to fetch messages");
        }

        const data = await response.json();
        console.log(`Fetched ${data.messages?.length || 0} messages for client user`);
        return data.messages || [];
      } else {
        // For Supabase auth users
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          throw new Error("No active session");
        }

        const response = await fetch(`${url}/functions/v1/list-messages?conversation_id=${conversationId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          // Don't throw error for 404, just return empty array
          if (response.status === 404) {
            console.log("Conversation not found, returning empty messages");
            return [];
          }
          const errorText = await response.text();
          console.error("Failed to fetch messages:", errorText);
          throw new Error("Failed to fetch messages");
        }

        const data = await response.json();
        console.log(`Fetched ${data.messages?.length || 0} messages for agency user`);
        return data.messages || [];
      }
    },
    enabled: !!conversationId,
    retry: (failureCount, error: any) => {
      // Don't retry on 404 errors
      if (error?.message?.includes("404") || error?.message?.includes("Conversation not found")) {
        return false;
      }
      return failureCount < 3;
    },
    // Optimizations for Instagram-like performance:
    staleTime: 1000 * 30, // 30 seconds - messages can be stale briefly
    gcTime: 1000 * 60 * 5, // 5 minutes - keep in cache longer
    refetchOnWindowFocus: false, // Don't refetch when tab regains focus
    refetchOnMount: false, // Don't refetch when component mounts if data exists
    refetchOnReconnect: true, // Only refetch on reconnect
  });
};

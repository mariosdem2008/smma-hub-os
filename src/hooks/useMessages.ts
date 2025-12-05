import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClientAuth } from "@/lib/client-auth";

export const useMessages = (conversationId?: string) => {
  const { clientUser, isAuthenticated } = useClientAuth();

  return useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      if (!conversationId) {
        return [];
      }

      // If this is a temporary ID from optimistic update, return empty array
      if (conversationId.startsWith("temp-")) {
        console.log("Temporary conversation ID, returning empty messages");
        return [];
      }

      // Check if client portal user
      const clientToken = typeof window !== "undefined" ? localStorage.getItem("client_auth_token") : null;

      if (clientUser && isAuthenticated && clientToken) {
        // For client portal users
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/list-messages?conversation_id=${conversationId}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${clientToken}`,
            },
            credentials: "include",
          },
        );

        if (!response.ok) {
          // Don't throw error for 404, just return empty array
          if (response.status === 404) {
            console.log("Conversation not found, returning empty messages");
            return [];
          }
          throw new Error("Failed to fetch messages");
        }

        const data = await response.json();
        return data.messages || [];
      } else {
        // For Supabase auth users
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          throw new Error("No active session");
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/list-messages?conversation_id=${conversationId}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
          },
        );

        if (!response.ok) {
          // Don't throw error for 404, just return empty array
          if (response.status === 404) {
            console.log("Conversation not found, returning empty messages");
            return [];
          }
          throw new Error("Failed to fetch messages");
        }

        const data = await response.json();
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
  });
};

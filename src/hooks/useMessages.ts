import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClientAuth } from "@/lib/client-auth";
import { useMemo } from "react";

export const useMessages = (conversationId?: string) => {
  const { clientUser, isAuthenticated } = useClientAuth();

  const url = useMemo(() => {
    return import.meta.env.VITE_SUPABASE_URL;
  }, []);

  return useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      if (!conversationId) {
        return [];
      }

      if (conversationId.startsWith("temp-") || conversationId.startsWith("optimistic-")) {
        return [];
      }

      console.log(`Fetching messages for: ${conversationId}`);

      const clientToken = typeof window !== "undefined" ? localStorage.getItem("client_auth_token") : null;

      if (clientUser && isAuthenticated && clientToken) {
        // Client portal user
        const response = await fetch(`${url}/functions/v1/list-messages?conversation_id=${conversationId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${clientToken}`,
          },
          credentials: "include",
        });

        if (!response.ok) {
          if (response.status === 404) {
            return [];
          }
          const errorText = await response.text();
          console.error("Failed to fetch messages:", errorText);
          throw new Error("Failed to fetch messages");
        }

        const data = await response.json();
        const messages = data.messages || [];

        // Get sender info on client side if needed
        return await enhanceMessagesWithSenderInfo(messages);
      } else {
        // Supabase auth user
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
          if (response.status === 404) {
            return [];
          }
          const errorText = await response.text();
          console.error("Failed to fetch messages:", errorText);
          throw new Error("Failed to fetch messages");
        }

        const data = await response.json();
        const messages = data.messages || [];

        // Get sender info on client side
        return await enhanceMessagesWithSenderInfo(messages);
      }
    },
    enabled: !!conversationId,
    retry: 2,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
  });
};

// Helper function to get sender info on client side
async function enhanceMessagesWithSenderInfo(messages: any[]) {
  if (!messages.length) return messages;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return messages;

  // Collect all user IDs
  const agencyMemberIds = messages
    .filter((msg) => msg.sender_type === "agency_member" && msg.sender_agency_member_id)
    .map((msg) => msg.sender_agency_member_id);

  const clientUserIds = messages
    .filter((msg) => msg.sender_type === "client_user" && msg.sender_client_user_id)
    .map((msg) => msg.sender_client_user_id);

  // Fetch agency member profiles
  const agencyMembersMap = new Map();
  if (agencyMemberIds.length > 0) {
    const { data: agencyMembers } = await supabase
      .from("agency_members")
      .select("id, user_id")
      .in("id", agencyMemberIds);

    if (agencyMembers) {
      const userIds = agencyMembers.map((m) => m.user_id).filter(Boolean);
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, email, full_name").in("id", userIds);

        if (profiles) {
          const profileMap = new Map(profiles.map((p) => [p.id, p]));
          agencyMembers.forEach((member) => {
            const profile = profileMap.get(member.user_id);
            if (profile) {
              agencyMembersMap.set(member.id, {
                id: member.id,
                email: profile.email,
                full_name: profile.full_name,
                type: "agency_member",
              });
            }
          });
        }
      }
    }
  }

  // Enhance messages with sender info
  return messages.map((msg) => {
    let sender = null;

    if (msg.sender_type === "agency_member" && msg.sender_agency_member_id) {
      sender = agencyMembersMap.get(msg.sender_agency_member_id) || null;
    }

    return {
      ...msg,
      sender,
    };
  });
}

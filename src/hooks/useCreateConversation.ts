import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface CreateConversationPayload {
  type: "client_chat" | "direct" | "group";
  client_id?: string;
  title?: string;
  member_ids?: string[];
  client_user_ids?: string[];
}

export const useCreateConversation = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (payload: CreateConversationPayload) => {
      console.log("Creating conversation with payload:", payload);

      // Get session for agency members
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("No active session");
      }

      console.log("Calling create-conversation Edge Function...");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-conversation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log("Edge Function response status:", response.status);
      console.log("Edge Function response:", responseText);

      if (!response.ok) {
        let errorMessage = "Failed to create conversation";
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = responseText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      try {
        const data = JSON.parse(responseText);
        console.log("Parsed response data:", data);
        return data;
      } catch (e) {
        console.error("Failed to parse response:", e);
        throw new Error("Invalid response from server");
      }
    },
    onMutate: async (variables) => {
      console.log("Optimistic update for:", variables);

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["conversations"] });

      // Create a temporary conversation ID
      const tempId = `temp-${Date.now()}`;

      const optimisticConversation = {
        id: tempId,
        type: variables.type,
        title: variables.title || (variables.type === "client_chat" ? "Client Chat" : "New Chat"),
        client_id: variables.client_id,
        _optimistic: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        unread_count: 0,
        latest_message: null,
        client_info: variables.client_id ? { name: "Loading..." } : null,
      };

      console.log("Optimistic conversation:", optimisticConversation);

      // Optimistically add to conversation list
      queryClient.setQueryData(["conversations"], (old: any[] | undefined) => {
        const newList = [...(old || []), optimisticConversation];
        console.log("Updated conversations list:", newList.length);
        return newList;
      });

      return {
        previousConversations: queryClient.getQueryData(["conversations"]),
        tempId,
      };
    },
    onSuccess: (data, variables, context) => {
      console.log("Mutation successful:", data);

      if (data.message === "Existing conversation found") {
        toast.info("Conversation already exists");
      } else {
        toast.success(data.message || "Conversation created");
      }

      // Invalidate conversations query to get the real data
      queryClient.invalidateQueries({ queryKey: ["conversations"] });

      // Navigate to the real conversation if it exists
      if (data.conversation?.id) {
        console.log("Navigating to conversation:", data.conversation.id);
        setTimeout(() => {
          navigate("/messages", {
            state: { selectedConversationId: data.conversation.id },
          });
        }, 300); // Give time for the list to update
      }
    },
    onError: (error: Error, variables, context) => {
      console.error("Mutation error:", error.message);

      // Rollback on error
      if (context?.previousConversations) {
        queryClient.setQueryData(["conversations"], context.previousConversations);
      }

      toast.error("Failed to create conversation: " + error.message);
    },
    onSettled: () => {
      // Always refetch conversations after mutation
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
};

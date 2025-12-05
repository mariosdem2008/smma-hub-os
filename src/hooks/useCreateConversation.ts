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

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-conversation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log("Edge Function response:", response.status, responseText);

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
        return JSON.parse(responseText);
      } catch (e) {
        throw new Error("Invalid response from server");
      }
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["conversations"] });

      // Create a temporary conversation ID that won't be used for fetching messages
      const tempId = `optimistic-${Date.now()}`;

      const optimisticConversation = {
        id: tempId,
        type: variables.type,
        title: variables.title || (variables.type === "client_chat" ? "Client Chat" : "New Chat"),
        client_id: variables.client_id,
        _optimistic: true,
        _tempId: tempId, // Add this flag to identify it
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        unread_count: 0,
        latest_message: null,
      };

      console.log("Optimistic update with temp ID:", tempId);

      // Optimistically add to conversation list but don't select it
      queryClient.setQueryData(["conversations"], (old: any[] | undefined) => {
        return [...(old || []), optimisticConversation];
      });

      return { previousConversations: queryClient.getQueryData(["conversations"]) };
    },
    onSuccess: (data, variables, context) => {
      console.log("Mutation successful, data:", data);

      // Invalidate conversations query to get the real data
      queryClient.invalidateQueries({ queryKey: ["conversations"] });

      toast.success(data.message || "Conversation created");

      // Navigate to the real conversation
      if (data.conversation?.id) {
        console.log("Navigating to conversation:", data.conversation.id);
        // Small delay to ensure the conversation list is updated
        setTimeout(() => {
          navigate("/messages", { state: { selectedConversationId: data.conversation.id } });
        }, 100);
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
  });
};

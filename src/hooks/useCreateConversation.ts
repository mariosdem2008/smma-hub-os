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

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to create conversation");
      }

      return response.json();
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

      // Optimistically add to conversation list but don't select it
      queryClient.setQueryData(["conversations"], (old: any[] | undefined) => {
        return [...(old || []), optimisticConversation];
      });

      return { previousConversations: queryClient.getQueryData(["conversations"]) };
    },
    onSuccess: (data, variables, context) => {
      // Invalidate conversations query to get the real data
      queryClient.invalidateQueries({ queryKey: ["conversations"] });

      toast.success("Conversation created");

      // Navigate to the real conversation
      if (data.conversation?.id) {
        // Small delay to ensure the conversation list is updated
        setTimeout(() => {
          navigate("/messages", { state: { selectedConversationId: data.conversation.id } });
        }, 100);
      }
    },
    onError: (error: Error, variables, context) => {
      // Rollback on error
      if (context?.previousConversations) {
        queryClient.setQueryData(["conversations"], context.previousConversations);
      }
      toast.error("Failed to create conversation: " + error.message);
    },
  });
};

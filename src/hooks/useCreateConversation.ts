import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateConversationPayload {
  type: "client_chat" | "direct" | "group";
  client_id?: string;
  title?: string;
  member_ids?: string[];
  client_user_ids?: string[];
}

export const useCreateConversation = () => {
  const queryClient = useQueryClient();

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

      // Optimistically add to conversation list
      const previousConversations = queryClient.getQueryData(["conversations"]) || [];

      const optimisticConversation = {
        id: `temp-${Date.now()}`,
        type: variables.type,
        title: variables.title || (variables.type === "client_chat" ? "Client Chat" : "New Chat"),
        client_id: variables.client_id,
        _optimistic: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        unread_count: 0,
      };

      queryClient.setQueryData(["conversations"], (old: any[] | undefined) => {
        return [...(old || []), optimisticConversation];
      });

      return { previousConversations };
    },
    onSuccess: (data) => {
      // Force immediate refetch of conversations
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("Conversation created");

      // Return the created conversation for navigation
      return data.conversation;
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

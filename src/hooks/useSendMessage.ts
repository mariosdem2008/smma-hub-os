import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SendMessagePayload {
  conversation_id: string;
  sender_type: "agency_member" | "client_user";
  sender_id: string;
  text: string;
  attachment_url?: string;
  related_project_id?: string;
}

export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SendMessagePayload) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("No active session");
      }

      const url = import.meta.env.VITE_SUPABASE_URL;

      const response = await fetch(`${url}/functions/v1/send-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to send message");
      }

      return response.json();
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["messages", variables.conversation_id] });

      // Create optimistic message
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        body: variables.text,
        created_at: new Date().toISOString(),
        sender_type: variables.sender_type,
        sender_agency_member_id: variables.sender_type === "agency_member" ? variables.sender_id : null,
        sender_client_user_id: variables.sender_type === "client_user" ? variables.sender_id : null,
        conversation_id: variables.conversation_id,
        _optimistic: true,
        sender: null,
      };

      // Optimistically update messages
      queryClient.setQueryData(["messages", variables.conversation_id], (old: any[] = []) => {
        return [...old, optimisticMessage];
      });

      return { optimisticMessage };
    },
    onSuccess: (data, variables, context) => {
      // Replace optimistic message with real one
      queryClient.setQueryData(["messages", variables.conversation_id], (old: any[] = []) => {
        return old.map((msg) => (msg.id === context?.optimisticMessage.id ? data.message : msg));
      });

      // Invalidate conversations list to update latest message
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error, variables, context) => {
      // Remove optimistic message on error
      queryClient.setQueryData(["messages", variables.conversation_id], (old: any[] = []) => {
        return old.filter((msg) => msg.id !== context?.optimisticMessage.id);
      });

      toast.error("Failed to send message: " + error.message);
    },
  });
};

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SendMessagePayload {
  conversation_id: string;
  sender_type: 'agency_member' | 'client_user';
  text?: string;
  attachment_url?: string;
  related_project_id?: string;
}

export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SendMessagePayload) => {
      const { data, error } = await supabase.functions.invoke('send-message', {
        body: payload,
      });

      if (error) throw error;
      return data;
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['messages', variables.conversation_id] });

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData(['messages', variables.conversation_id]);

      // Optimistically add the new message
      queryClient.setQueryData(['messages', variables.conversation_id], (old: any[] | undefined) => {
        const optimisticMessage = {
          id: `temp-${Date.now()}`,
          body: variables.text,
          sender_type: variables.sender_type,
          created_at: new Date().toISOString(),
          attachment_url: variables.attachment_url,
          related_project_id: variables.related_project_id,
          // Mark as optimistic for UI differentiation if needed
          _optimistic: true,
        };
        return [...(old || []), optimisticMessage];
      });

      return { previousMessages };
    },
    onError: (error: Error, variables, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(['messages', variables.conversation_id], context.previousMessages);
      }
      toast.error('Failed to send message: ' + error.message);
    },
    onSettled: (_, __, variables) => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['messages', variables.conversation_id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
};
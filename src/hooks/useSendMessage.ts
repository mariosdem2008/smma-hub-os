import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SendMessagePayload {
  conversation_id: string;
  sender_type: 'agency_member' | 'client_user';
  sender_id?: string; // Include sender ID for optimistic updates
  text?: string;
  attachment_url?: string;
  related_project_id?: string;
}

export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SendMessagePayload) => {
      if (payload.sender_type === 'client_user') {
        // Client portal user: use direct fetch with HttpOnly cookies
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-message`,
          {
            method: 'POST',
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(payload),
          },
        );

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || 'Failed to send message');
        }

        return response.json();
      }

      // Agency members: use Supabase auth
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

      // Optimistically add the new message with proper styling hint
      queryClient.setQueryData(['messages', variables.conversation_id], (old: any[] | undefined) => {
        const optimisticMessage = {
          id: `temp-${Date.now()}`,
          body: variables.text,
          sender_type: variables.sender_type,
          // Include sender IDs for proper isOwnMessage detection
          sender_agency_member_id: variables.sender_type === 'agency_member' ? variables.sender_id : null,
          sender_client_user_id: variables.sender_type === 'client_user' ? variables.sender_id : null,
          created_at: new Date().toISOString(),
          attachment_url: variables.attachment_url,
          related_project_id: variables.related_project_id,
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

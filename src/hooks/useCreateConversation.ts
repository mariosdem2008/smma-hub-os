import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CreateConversationPayload {
  type: 'client_chat' | 'direct' | 'group';
  client_id?: string;
  title?: string;
  member_ids?: string[];
  client_user_ids?: string[];
}

export const useCreateConversation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateConversationPayload) => {
      const { data, error } = await supabase.functions.invoke('create-conversation', {
        body: payload,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Conversation created');
    },
    onError: (error: Error) => {
      toast.error('Failed to create conversation: ' + error.message);
    },
  });
};
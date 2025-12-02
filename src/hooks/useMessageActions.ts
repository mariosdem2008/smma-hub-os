import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useDeleteMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, conversationId }: { messageId: string; conversationId: string }) => {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;
      return { messageId, conversationId };
    },
    onMutate: async ({ messageId, conversationId }) => {
      await queryClient.cancelQueries({ queryKey: ['messages', conversationId] });
      
      const previousMessages = queryClient.getQueryData(['messages', conversationId]);
      
      // Optimistically remove the message
      queryClient.setQueryData(['messages', conversationId], (old: any[] | undefined) => {
        return old?.filter((msg) => msg.id !== messageId) || [];
      });

      return { previousMessages, conversationId };
    },
    onError: (error: Error, _, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(['messages', context.conversationId], context.previousMessages);
      }
      toast.error('Failed to delete message: ' + error.message);
    },
    onSuccess: () => {
      toast.success('Message deleted');
    },
    onSettled: (_, __, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    },
  });
};

export const useEditMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, conversationId, newText }: { messageId: string; conversationId: string; newText: string }) => {
      const { data, error } = await supabase
        .from('messages')
        .update({ body: newText })
        .eq('id', messageId)
        .select()
        .single();

      if (error) throw error;
      return { message: data, conversationId };
    },
    onMutate: async ({ messageId, conversationId, newText }) => {
      await queryClient.cancelQueries({ queryKey: ['messages', conversationId] });
      
      const previousMessages = queryClient.getQueryData(['messages', conversationId]);
      
      // Optimistically update the message
      queryClient.setQueryData(['messages', conversationId], (old: any[] | undefined) => {
        return old?.map((msg) => 
          msg.id === messageId ? { ...msg, body: newText } : msg
        ) || [];
      });

      return { previousMessages, conversationId };
    },
    onError: (error: Error, _, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(['messages', context.conversationId], context.previousMessages);
      }
      toast.error('Failed to edit message: ' + error.message);
    },
    onSuccess: () => {
      toast.success('Message updated');
    },
    onSettled: (_, __, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    },
  });
};

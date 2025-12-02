import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useMessages = (conversationId: string | undefined) => {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      
      const { data, error } = await supabase.functions.invoke(`list-messages?conversation_id=${conversationId}`, {
        method: 'GET',
      });
      
      if (error) throw error;
      return data.messages;
    },
    enabled: !!conversationId,
  });
};
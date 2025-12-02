import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useConversations = () => {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('list-conversations');
      
      if (error) throw error;
      return data.conversations;
    },
  });
};
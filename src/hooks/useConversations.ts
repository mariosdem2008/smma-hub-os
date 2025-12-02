import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useClientAuth } from '@/lib/client-auth';

export const useConversations = () => {
  const { clientUser } = useClientAuth();

  return useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      // Check if client portal user
      const clientToken = localStorage.getItem('client_auth_token');
      
      if (clientToken && clientUser) {
        // Use direct fetch with client portal token
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-conversations`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${clientToken}`,
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to fetch conversations');
        }

        const data = await response.json();
        return data.conversations;
      } else {
        // Use Supabase auth for agency members
        const { data, error } = await supabase.functions.invoke('list-conversations');
        
        if (error) throw error;
        return data.conversations;
      }
    },
  });
};

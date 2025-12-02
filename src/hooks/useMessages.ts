import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useClientAuth } from '@/lib/client-auth';

export const useMessages = (conversationId: string | undefined) => {
  const queryClient = useQueryClient();
  const { clientUser } = useClientAuth();

  // Subscribe to realtime updates for this conversation
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      
      // Check if client portal user
      const clientToken = localStorage.getItem('client_auth_token');
      
      if (clientToken && clientUser) {
        // Use direct fetch with client portal token
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-messages?conversation_id=${conversationId}`,
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
          throw new Error(error.error || 'Failed to fetch messages');
        }

        const data = await response.json();
        return data.messages;
      } else {
        // Use Supabase auth for agency members
        const { data, error } = await supabase.functions.invoke(`list-messages?conversation_id=${conversationId}`, {
          method: 'GET',
        });
        
        if (error) throw error;
        return data.messages;
      }
    },
    enabled: !!conversationId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};
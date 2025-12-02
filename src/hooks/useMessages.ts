import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useMessages = (conversationId: string | undefined) => {
  const queryClient = useQueryClient();

  // Subscribe to realtime updates for this conversation
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          // Invalidate to refetch when new message arrives
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
      
      const { data, error } = await supabase.functions.invoke(`list-messages?conversation_id=${conversationId}`, {
        method: 'GET',
      });
      
      if (error) throw error;
      return data.messages;
    },
    enabled: !!conversationId,
    staleTime: 30000, // 30 seconds - reduce refetches
    refetchOnWindowFocus: false,
  });
};
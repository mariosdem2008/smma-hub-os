import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useClientAuth } from '@/lib/client-auth';
import { supabase } from '@/integrations/supabase/client';

interface ParticipantInfo {
  type: 'agency_member' | 'client_user';
  id: string; // agency_member_id or client_user_id
  userId: string; // auth user id or client_users.id
}

export function useCurrentParticipant() {
  const { user } = useAuth();
  const { clientUser } = useClientAuth();
  const [participant, setParticipant] = useState<ParticipantInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchParticipantInfo() {
      // Client portal user
      if (clientUser) {
        setParticipant({
          type: 'client_user',
          id: clientUser.id,
          userId: clientUser.id,
        });
        setLoading(false);
        return;
      }

      // Agency user - need to get their agency_member_id
      if (user) {
        try {
          const { data: memberData } = await supabase
            .from('agency_members')
            .select('id')
            .eq('user_id', user.id)
            .single();

          if (memberData) {
            setParticipant({
              type: 'agency_member',
              id: memberData.id,
              userId: user.id,
            });
          } else {
            setParticipant(null);
          }
        } catch (error) {
          console.error('Error fetching participant info:', error);
          setParticipant(null);
        }
        setLoading(false);
        return;
      }

      setParticipant(null);
      setLoading(false);
    }

    fetchParticipantInfo();
  }, [user, clientUser]);

  return { participant, loading };
}

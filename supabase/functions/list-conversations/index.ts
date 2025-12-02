import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if agency member
    const { data: agencyMember } = await supabaseClient
      .from('agency_members')
      .select('id, agency_id')
      .eq('user_id', user.id)
      .single();

    let conversations: any[] = [];

    if (agencyMember) {
      // Agency user - get all conversations for their agency
      const { data, error } = await supabaseClient
        .from('conversations')
        .select(`
          *,
          conversation_participants(
            id,
            agency_member_id,
            client_user_id,
            role
          ),
          clients(id, name, logo_url)
        `)
        .eq('agency_id', agencyMember.agency_id)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching conversations:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      conversations = data || [];
    } else {
      // Client user - get only their client chat
      const { data: clientUser } = await supabaseClient
        .from('client_users')
        .select('client_id')
        .eq('id', user.id)
        .single();

      if (clientUser) {
        const { data, error } = await supabaseClient
          .from('conversations')
          .select(`
            *,
            conversation_participants(
              id,
              agency_member_id,
              client_user_id,
              role
            ),
            clients(id, name, logo_url)
          `)
          .eq('type', 'client_chat')
          .eq('client_id', clientUser.client_id)
          .order('updated_at', { ascending: false });

        if (error) {
          console.error('Error fetching conversations:', error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        conversations = data || [];
      }
    }

    // Get all agency member IDs from participants to fetch profiles
    const memberIds = new Set<string>();
    conversations.forEach((conv: any) => {
      conv.conversation_participants?.forEach((p: any) => {
        if (p.agency_member_id) memberIds.add(p.agency_member_id);
      });
    });

    // Fetch agency member user_ids
    let memberToUserMap = new Map<string, string>();
    let profileMap = new Map<string, any>();

    if (memberIds.size > 0) {
      const { data: agencyMembers } = await supabaseClient
        .from('agency_members')
        .select('id, user_id')
        .in('id', Array.from(memberIds));

      const memberUserIds = agencyMembers?.map(m => m.user_id) || [];
      memberToUserMap = new Map(agencyMembers?.map(m => [m.id, m.user_id]));
      
      if (memberUserIds.length > 0) {
        const { data: profiles } = await supabaseClient
          .from('profiles')
          .select('id, email, full_name')
          .in('id', memberUserIds);

        profileMap = new Map(profiles?.map(p => [p.id, p]));
      }
    }

    // Get latest message for each conversation and unread counts
    const conversationsWithMeta = await Promise.all(
      conversations.map(async (conv) => {
        // Get latest message
        const { data: latestMessage } = await supabaseClient
          .from('messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Get participant for current user
        const { data: participant } = await supabaseClient
          .from('conversation_participants')
          .select('id')
          .eq('conversation_id', conv.id)
          .eq('agency_member_id', agencyMember?.id || null)
          .maybeSingle();

        let unreadCount = 0;
        if (participant) {
          const { data: readReceipts } = await supabaseClient
            .from('message_read_receipts')
            .select('message_id')
            .eq('participant_id', participant.id);

          const readMessageIds = readReceipts?.map(r => r.message_id) || [];

          if (readMessageIds.length > 0) {
            const { count } = await supabaseClient
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', conv.id)
              .not('id', 'in', `(${readMessageIds.join(',')})`);
            unreadCount = count || 0;
          } else {
            const { count } = await supabaseClient
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', conv.id);
            unreadCount = count || 0;
          }
        }

        // Build other_participant info for direct chats
        let otherParticipant = null;
        if (conv.type === 'direct' && agencyMember) {
          const otherP = conv.conversation_participants?.find(
            (p: any) => p.agency_member_id && p.agency_member_id !== agencyMember.id
          );
          if (otherP?.agency_member_id) {
            const userId = memberToUserMap.get(otherP.agency_member_id);
            const profile = userId ? profileMap.get(userId) : null;
            otherParticipant = {
              name: profile?.full_name || profile?.email || 'Unknown',
              email: profile?.email,
            };
          }
        }

        // Get client info for client_chat
        let clientInfo = null;
        if (conv.type === 'client_chat' && conv.clients) {
          clientInfo = {
            name: conv.clients.name,
            logo_url: conv.clients.logo_url,
          };
        }

        return {
          id: conv.id,
          type: conv.type,
          title: conv.title,
          client_id: conv.client_id,
          latest_message: latestMessage ? { body: latestMessage.body, created_at: latestMessage.created_at } : null,
          unread_count: unreadCount,
          created_at: conv.created_at,
          updated_at: conv.updated_at,
          other_participant: otherParticipant,
          client_info: clientInfo,
        };
      })
    );

    return new Response(JSON.stringify({ conversations: conversationsWithMeta }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in list-conversations:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
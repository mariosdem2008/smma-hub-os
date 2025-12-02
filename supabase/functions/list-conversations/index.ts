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
      .select('agency_id')
      .eq('user_id', user.id)
      .single();

    let conversations = [];

    if (agencyMember) {
      // Agency user - get all conversations for their agency
      const { data, error } = await supabaseClient
        .from('conversations')
        .select(`
          *,
          messages!inner(
            id,
            body,
            created_at,
            sender_type
          ),
          conversation_participants(
            id,
            agency_member_id,
            client_user_id,
            role
          )
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
            messages!inner(
              id,
              body,
              created_at,
              sender_type
            ),
            conversation_participants(
              id,
              agency_member_id,
              client_user_id,
              role
            )
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
          .single();

        // Get unread count for current user
        const { data: participant } = await supabaseClient
          .from('conversation_participants')
          .select('id')
          .eq('conversation_id', conv.id)
          .or(
            agencyMember
              ? `agency_member_id.eq.${agencyMember.agency_id}`
              : `client_user_id.eq.${user.id}`
          )
          .single();

        let unreadCount = 0;
        if (participant) {
          const { data: readReceipts } = await supabaseClient
            .from('message_read_receipts')
            .select('message_id')
            .eq('participant_id', participant.id);

          const readMessageIds = readReceipts?.map(r => r.message_id) || [];

          const { count } = await supabaseClient
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .not('id', 'in', `(${readMessageIds.join(',') || 'null'})`);

          unreadCount = count || 0;
        }

        return {
          ...conv,
          latest_message: latestMessage,
          unread_count: unreadCount,
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
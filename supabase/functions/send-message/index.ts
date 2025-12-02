import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface SendMessagePayload {
  conversation_id: string;
  sender_type: 'agency_member' | 'client_user';
  text?: string;
  attachment_url?: string;
  related_project_id?: string;
}

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

    const payload: SendMessagePayload = await req.json();
    const { conversation_id, sender_type, text, attachment_url, related_project_id } = payload;

    // Get conversation details
    const { data: conversation } = await supabaseClient
      .from('conversations')
      .select('agency_id, client_id, type')
      .eq('id', conversation_id)
      .single();

    if (!conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let senderAgencyMemberId = null;
    let senderClientUserId = null;
    let participantId = null;
    let senderName = 'Someone';

    if (sender_type === 'agency_member') {
      const { data: agencyMember } = await supabaseClient
        .from('agency_members')
        .select('id, user_id')
        .eq('user_id', user.id)
        .eq('agency_id', conversation.agency_id)
        .single();

      if (!agencyMember) {
        return new Response(JSON.stringify({ error: 'Not authorized to send in this conversation' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      senderAgencyMemberId = agencyMember.id;

      // Get sender name
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single();
      
      senderName = profile?.full_name || profile?.email || 'Agency member';

      // Get participant record
      const { data: participant } = await supabaseClient
        .from('conversation_participants')
        .select('id')
        .eq('conversation_id', conversation_id)
        .eq('agency_member_id', agencyMember.id)
        .single();

      participantId = participant?.id;
    } else {
      const { data: clientUser } = await supabaseClient
        .from('client_users')
        .select('id, full_name, email')
        .eq('id', user.id)
        .single();

      if (!clientUser) {
        return new Response(JSON.stringify({ error: 'Not authorized to send in this conversation' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      senderClientUserId = clientUser.id;
      senderName = clientUser.full_name || clientUser.email || 'Client';

      // Get participant record
      const { data: participant } = await supabaseClient
        .from('conversation_participants')
        .select('id')
        .eq('conversation_id', conversation_id)
        .eq('client_user_id', clientUser.id)
        .single();

      participantId = participant?.id;
    }

    // Insert message
    const { data: message, error: messageError } = await supabaseClient
      .from('messages')
      .insert({
        conversation_id,
        agency_id: conversation.agency_id,
        client_id: conversation.client_id,
        sender_type,
        sender_agency_member_id: senderAgencyMemberId,
        sender_client_user_id: senderClientUserId,
        body: text || null,
        attachment_url: attachment_url || null,
        related_project_id: related_project_id || null,
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error sending message:', messageError);
      return new Response(JSON.stringify({ error: messageError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create read receipt for sender
    if (participantId) {
      await supabaseClient
        .from('message_read_receipts')
        .insert({
          message_id: message.id,
          participant_id: participantId,
        });
    }

    // Get all participants except sender to create notifications
    const { data: participants } = await supabaseClient
      .from('conversation_participants')
      .select('id, agency_member_id, client_user_id, role')
      .eq('conversation_id', conversation_id);

    if (participants) {
      const notifications = [];
      const snippet = text ? (text.length > 50 ? text.substring(0, 50) + '...' : text) : 'Sent an attachment';

      for (const participant of participants) {
        // Skip sender
        if (sender_type === 'agency_member' && participant.agency_member_id === senderAgencyMemberId) continue;
        if (sender_type === 'client_user' && participant.client_user_id === senderClientUserId) continue;

        if (participant.agency_member_id) {
          notifications.push({
            agency_id: conversation.agency_id,
            user_type: 'agency_member',
            user_id: participant.agency_member_id,
            type: 'new_message',
            conversation_id: conversation_id,
            payload: {
              sender_name: senderName,
              snippet,
              conversation_type: conversation.type,
            },
          });
        } else if (participant.client_user_id) {
          notifications.push({
            agency_id: conversation.agency_id,
            user_type: 'client_user',
            user_id: participant.client_user_id,
            type: 'new_message',
            conversation_id: conversation_id,
            payload: {
              sender_name: senderName,
              snippet,
              conversation_type: conversation.type,
            },
          });
        }
      }

      if (notifications.length > 0) {
        await supabaseClient.from('notifications').insert(notifications);
      }
    }

    // Update conversation updated_at
    await supabaseClient
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation_id);

    console.log(`Message sent: ${message.id} in conversation ${conversation_id}`);

    return new Response(JSON.stringify({ message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in send-message:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface CreateConversationPayload {
  type: 'client_chat' | 'direct' | 'group';
  client_id?: string;
  title?: string;
  member_ids?: string[];
  client_user_ids?: string[];
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

    const payload: CreateConversationPayload = await req.json();
    const { type, client_id, title, member_ids = [], client_user_ids = [] } = payload;

    // Get user's agency
    const { data: agencyMember } = await supabaseClient
      .from('agency_members')
      .select('agency_id')
      .eq('user_id', user.id)
      .single();

    if (!agencyMember) {
      return new Response(JSON.stringify({ error: 'User is not an agency member' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create conversation
    const { data: conversation, error: conversationError } = await supabaseClient
      .from('conversations')
      .insert({
        agency_id: agencyMember.agency_id,
        type,
        client_id: type === 'client_chat' ? client_id : null,
        title: title || null,
      })
      .select()
      .single();

    if (conversationError) {
      console.error('Error creating conversation:', conversationError);
      return new Response(JSON.stringify({ error: conversationError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Add agency member participants
    const agencyParticipants = member_ids.map(memberId => ({
      conversation_id: conversation.id,
      agency_id: agencyMember.agency_id,
      agency_member_id: memberId,
      role: 'agency_member',
    }));

    // Add client user participants
    const clientParticipants = client_user_ids.map(userId => ({
      conversation_id: conversation.id,
      agency_id: agencyMember.agency_id,
      client_user_id: userId,
      role: 'client_user',
    }));

    const allParticipants = [...agencyParticipants, ...clientParticipants];

    if (allParticipants.length > 0) {
      const { error: participantsError } = await supabaseClient
        .from('conversation_participants')
        .insert(allParticipants);

      if (participantsError) {
        console.error('Error adding participants:', participantsError);
        return new Response(JSON.stringify({ error: participantsError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log(`Conversation created: ${conversation.id} (type: ${type})`);

    return new Response(JSON.stringify({ conversation }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in create-conversation:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
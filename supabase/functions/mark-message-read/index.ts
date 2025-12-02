import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface MarkReadPayload {
  message_id: string;
  conversation_id: string;
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

    const payload: MarkReadPayload = await req.json();
    const { message_id, conversation_id } = payload;

    // Find participant record
    const { data: agencyMember } = await supabaseClient
      .from('agency_members')
      .select('id')
      .eq('user_id', user.id)
      .single();

    let participantId = null;

    if (agencyMember) {
      const { data: participant } = await supabaseClient
        .from('conversation_participants')
        .select('id')
        .eq('conversation_id', conversation_id)
        .eq('agency_member_id', agencyMember.id)
        .single();

      participantId = participant?.id;
    } else {
      const { data: participant } = await supabaseClient
        .from('conversation_participants')
        .select('id')
        .eq('conversation_id', conversation_id)
        .eq('client_user_id', user.id)
        .single();

      participantId = participant?.id;
    }

    if (!participantId) {
      return new Response(JSON.stringify({ error: 'Participant not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create or update read receipt
    const { error: receiptError } = await supabaseClient
      .from('message_read_receipts')
      .upsert({
        message_id,
        participant_id: participantId,
      }, {
        onConflict: 'message_id,participant_id',
      });

    if (receiptError) {
      console.error('Error marking message read:', receiptError);
      return new Response(JSON.stringify({ error: receiptError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in mark-message-read:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CLIENT_PORTAL_JWT_SECRET = Deno.env.get('CLIENT_PORTAL_JWT_SECRET');

interface SendMessagePayload {
  conversation_id: string;
  sender_type: 'agency_member' | 'client_user';
  text?: string;
  attachment_url?: string;
  related_project_id?: string;
}

interface ClientPortalJwtPayload {
  sub: string;
  email: string;
  client_id: string;
  agency_id: string;
  role: string;
  exp: number;
}

// Helper to verify client portal JWT
async function verifyClientPortalToken(token: string): Promise<ClientPortalJwtPayload | null> {
  if (!CLIENT_PORTAL_JWT_SECRET) {
    console.error('CLIENT_PORTAL_JWT_SECRET not configured');
    return null;
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    
    // Verify signature
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(CLIENT_PORTAL_JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Handle base64url encoding properly
    const base64 = encodedSignature.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    const signature = Uint8Array.from(atob(padded), c => c.charCodeAt(0));
    
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    );

    if (!isValid) return null;

    // Decode payload with base64url handling
    const payloadBase64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const payloadPadded = payloadBase64 + '='.repeat((4 - payloadBase64.length % 4) % 4);
    const payload: ClientPortalJwtPayload = JSON.parse(atob(payloadPadded));
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      console.log('Client portal token expired');
      return null;
    }

    return payload;
  } catch (error) {
    console.error('Error verifying client portal token:', error);
    return null;
  }
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
    
    let authUserId: string | null = null;
    let clientPortalUser: ClientPortalJwtPayload | null = null;

    // Try Supabase auth first (for agency members)
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (user && !userError) {
      authUserId = user.id;
    } else {
      // Try client portal JWT
      clientPortalUser = await verifyClientPortalToken(token);
      
      if (!clientPortalUser) {
        console.log('Auth failed: neither Supabase auth nor client portal token valid');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'Agency members must use Supabase auth' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: agencyMember } = await supabaseClient
        .from('agency_members')
        .select('id, user_id')
        .eq('user_id', authUserId)
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
        .eq('id', authUserId)
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
      // Client user - can use either auth method but must be from client portal
      if (clientPortalUser) {
        // Using client portal JWT
        const { data: clientUser } = await supabaseClient
          .from('client_users')
          .select('id, full_name, email, client_id')
          .eq('id', clientPortalUser.sub)
          .single();

        if (!clientUser) {
          return new Response(JSON.stringify({ error: 'Client user not found' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Verify client user belongs to this conversation's client
        if (clientUser.client_id !== conversation.client_id) {
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
      } else {
        return new Response(JSON.stringify({ error: 'Client users must use client portal authentication' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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

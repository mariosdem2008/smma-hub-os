import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from '../_shared/cors.ts';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

const CLIENT_PORTAL_JWT_SECRET = Deno.env.get('CLIENT_PORTAL_JWT_SECRET');

interface ClientPortalJwtPayload {
  sub: string; // client_user.id
  email: string;
  client_id: string;
  agency_id: string;
  role: string;
  exp: number;
}

async function verifyClientPortalToken(token: string): Promise<ClientPortalJwtPayload | null> {
  if (!CLIENT_PORTAL_JWT_SECRET) return null;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [header, payload, signature] = parts;
    
    // Decode payload
    const payloadBase64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const payloadPadded = payloadBase64 + '='.repeat((4 - (payloadBase64.length % 4)) % 4);
    const decodedPayload: ClientPortalJwtPayload = JSON.parse(atob(payloadPadded));
    
    // Verify expiration
    if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return decodedPayload;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(req)


  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), {
        status: 401,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const clientUser = await verifyClientPortalToken(token);
    
    if (!clientUser) {
      return new Response(JSON.stringify({ error: 'Invalid client portal token' }), {
        status: 401,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const { conversation_id } = await req.json();
    
    if (!conversation_id) {
      return new Response(JSON.stringify({ error: 'conversation_id is required' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if conversation exists and is a client_chat for this client
    const { data: conversation, error: convError } = await supabaseClient
      .from('conversations')
      .select('*')
      .eq('id', conversation_id)
      .eq('type', 'client_chat')
      .eq('client_id', clientUser.client_id)
      .single();

    if (convError || !conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found or access denied' }), {
        status: 404,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    // Check if client user is already a participant
    const { data: existingParticipant } = await supabaseClient
      .from('conversation_participants')
      .select('id')
      .eq('conversation_id', conversation_id)
      .eq('client_user_id', clientUser.sub)
      .maybeSingle();

    if (existingParticipant) {
      return new Response(JSON.stringify({ 
        message: 'Client user already added to conversation',
        participant_id: existingParticipant.id 
      }), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    // Add client user as participant
    const { data: participant, error: participantError } = await supabaseClient
      .from('conversation_participants')
      .insert({
        conversation_id: conversation_id,
        agency_id: conversation.agency_id,
        agency_member_id: null,
        client_user_id: clientUser.sub,
        role: 'client_user',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (participantError) {
      console.error('Error adding participant:', participantError);
      return new Response(JSON.stringify({ error: participantError.message }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Added client user ${clientUser.sub} to conversation ${conversation_id}`);

    return new Response(JSON.stringify({ 
      message: 'Client user added to conversation',
      participant_id: participant.id 
    }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in add-client-user-to-conversation:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
});

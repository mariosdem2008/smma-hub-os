import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const allowedOrigins = [
  "https://73a2983b-0136-47d2-9a1f-01fe580ac593.lovableproject.com",
  "https://smmahub.net",
];

function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin") ?? "";
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : "";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, apikey, Authorization, X-Requested-With",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CLIENT_PORTAL_JWT_SECRET = Deno.env.get('CLIENT_PORTAL_JWT_SECRET');

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

    // Handle base64url encoding
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

function getCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const cookies = header.split(';').map((c) => c.trim());
  for (const cookie of cookies) {
    const [cookieName, ...rest] = cookie.split('=');
    if (cookieName === name) {
      return rest.join('=');
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: {
        ...corsHeaders(req),
      },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const cookieHeader = req.headers.get('Cookie');

    let token: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '');
    } else {
      token = getCookie(cookieHeader, 'cp_access_token');
    }

    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const conversationId = url.searchParams.get('conversation_id');

    if (!conversationId) {
      return new Response(JSON.stringify({ error: 'Missing conversation_id' }), {
        status: 400,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    
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

    // Verify user has access to this conversation
    const { data: conversation } = await supabaseClient
      .from('conversations')
      .select('agency_id, client_id, type')
      .eq('id', conversationId)
      .single();

    if (!conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    // Verify authorization
    if (authUserId) {
      // Agency member - check if they belong to the agency
      const { data: agencyMember } = await supabaseClient
        .from('agency_members')
        .select('id')
        .eq('user_id', authUserId)
        .eq('agency_id', conversation.agency_id)
        .single();

      if (!agencyMember) {
        return new Response(JSON.stringify({ error: 'Not authorized to view this conversation' }), {
          status: 403,
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        });
      }
    } else if (clientPortalUser) {
      // Client user - check if conversation is for their client
      if (conversation.client_id !== clientPortalUser.client_id) {
        return new Response(JSON.stringify({ error: 'Not authorized to view this conversation' }), {
          status: 403,
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        });
      }
    }

    // Fetch messages
    const { data: messages, error: messagesError } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return new Response(JSON.stringify({ error: messagesError.message }), {
        status: 500,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    // Get read receipts for all messages
    const messagesWithReceipts = await Promise.all(
      messages.map(async (message) => {
        const { data: receipts } = await supabaseClient
          .from('message_read_receipts')
          .select('participant_id, read_at')
          .eq('message_id', message.id);

        return {
          ...message,
          read_receipts: receipts || [],
        };
      })
    );

    console.log(`Listed ${messages.length} messages for conversation ${conversationId}`);

    return new Response(JSON.stringify({ messages: messagesWithReceipts }), {
      status: 200,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in list-messages:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});

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
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        });
      }
    }

    let conversations: any[] = [];
    let agencyMember: { id: string; agency_id: string } | null = null;

    if (authUserId) {
      // Agency member flow
      const { data: member } = await supabaseClient
        .from('agency_members')
        .select('id, agency_id')
        .eq('user_id', authUserId)
        .single();

      agencyMember = member;

      if (agencyMember) {
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
            headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
          });
        }

        conversations = data || [];
      }
    } else if (clientPortalUser) {
      // Client portal user flow - only get their client_chat
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
        .eq('client_id', clientPortalUser.client_id)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching conversations for client:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        });
      }

      conversations = data || [];
      console.log(`Found ${conversations.length} conversations for client ${clientPortalUser.client_id}`);
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
        let participantQuery = supabaseClient
          .from('conversation_participants')
          .select('id')
          .eq('conversation_id', conv.id);
        
        if (agencyMember) {
          participantQuery = participantQuery.eq('agency_member_id', agencyMember.id);
        } else if (clientPortalUser) {
          participantQuery = participantQuery.eq('client_user_id', clientPortalUser.sub);
        }
        
        const { data: participant } = await participantQuery.maybeSingle();

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
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in list-conversations:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});

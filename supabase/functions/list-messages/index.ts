import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const allowedOrigins = [
  "http://localhost:8080",
  "https://smmahub.net",
  "https://73a2983b-0136-47d2-9a1f-01fe580ac593.lovableproject.com",
  "https://id-preview--73a2983b-0136-47d2-9a1f-01fe580ac593.lovable.app",
];

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const isAllowed = allowedOrigins.includes(origin);

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigins[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      request.headers.get("Access-Control-Request-Headers") || "Content-Type, Authorization, apikey, Apikey, APIKEY",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Cache for conversation validation (5 minute TTL)
const conversationCache = new Map<string, { id: string; timestamp: number }>();

// Define proper TypeScript interfaces
interface AgencyMember {
  id: string;
  user: Array<{
    id: string;
    email: string;
    full_name: string;
  }>;
}

interface ClientUser {
  id: string;
  email: string;
  full_name: string;
}

interface Message {
  id: string;
  body: string;
  created_at: string;
  sender_type: string;
  agency_member_id: string | null;
  client_user_id: string | null;
  conversation_id: string;
  agency_member: AgencyMember[] | null;
  client_user: ClientUser[] | null;
}

interface FormattedMessage {
  id: string;
  body: string;
  created_at: string;
  sender_type: string;
  sender_agency_member_id: string | null;
  sender_client_user_id: string | null;
  conversation_id: string;
  sender: {
    id: string;
    email: string;
    full_name: string;
    type: string;
  } | null;
}

Deno.serve(async (req) => {
  // Handle OPTIONS request first
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders(req),
        Vary: "Origin, Access-Control-Request-Headers",
      },
    });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const conversationId = url.searchParams.get("conversation_id");
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const before = url.searchParams.get("before");

    if (!conversationId) {
      return new Response(JSON.stringify({ error: "conversation_id is required" }), {
        status: 400,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Check if this is a temporary ID from optimistic update
    if (conversationId.startsWith("temp-") || conversationId.startsWith("optimistic-")) {
      console.log(`Temporary conversation ID detected: ${conversationId}`);
      return new Response(JSON.stringify({ messages: [] }), {
        status: 200,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check cache first for conversation validation
    const cachedConversation = conversationCache.get(conversationId);
    const now = Date.now();

    if (cachedConversation && now - cachedConversation.timestamp < 5 * 60 * 1000) {
      console.log(`Using cached conversation validation for: ${conversationId}`);
    } else {
      // Verify the conversation exists
      const { data: conversation, error: convError } = await supabaseClient
        .from("conversations")
        .select("id")
        .eq("id", conversationId)
        .single();

      if (convError || !conversation) {
        return new Response(JSON.stringify({ error: "Conversation not found" }), {
          status: 404,
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Cache the conversation validation
      conversationCache.set(conversationId, { id: conversation.id, timestamp: now });
    }

    // Build query for messages
    let query = supabaseClient
      .from("messages")
      .select(
        `
        id,
        body,
        created_at,
        sender_type,
        agency_member_id,
        client_user_id,
        conversation_id,
        agency_member:agency_member_id(
          id,
          user:user_id(
            id,
            email,
            full_name
          )
        ),
        client_user:client_user_id(
          id,
          email,
          full_name
        )
      `,
      )
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 200)); // Cap at 200 messages max

    // Add cursor-based pagination if before timestamp provided
    if (before) {
      query = query.lt("created_at", before);
    }

    const { data: messages, error: messagesError } = await query;

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
      return new Response(JSON.stringify({ error: messagesError.message }), {
        status: 500,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Sort by created_at ascending for display
    const sortedMessages = (messages || []).sort(
      (a: Message, b: Message) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    // Transform the response to a cleaner format
    const formattedMessages: FormattedMessage[] = sortedMessages.map((msg: Message) => {
      let sender = null;

      if (msg.sender_type === "agency_member") {
        // Handle array response from Supabase
        if (msg.agency_member && Array.isArray(msg.agency_member) && msg.agency_member.length > 0) {
          const agencyMember = msg.agency_member[0];
          if (agencyMember.user && Array.isArray(agencyMember.user) && agencyMember.user.length > 0) {
            const user = agencyMember.user[0];
            sender = {
              id: agencyMember.id,
              email: user.email,
              full_name: user.full_name,
              type: "agency_member",
            };
          }
        }
      } else if (msg.sender_type === "client_user") {
        // Handle array response from Supabase
        if (msg.client_user && Array.isArray(msg.client_user) && msg.client_user.length > 0) {
          const clientUser = msg.client_user[0];
          sender = {
            id: clientUser.id,
            email: clientUser.email,
            full_name: clientUser.full_name,
            type: "client_user",
          };
        }
      }

      return {
        id: msg.id,
        body: msg.body,
        created_at: msg.created_at,
        sender_type: msg.sender_type,
        sender_agency_member_id: msg.agency_member_id,
        sender_client_user_id: msg.client_user_id,
        conversation_id: msg.conversation_id,
        sender,
      };
    });

    // Get the timestamp of the oldest message for pagination
    const oldestMessageTime = sortedMessages.length > 0 ? sortedMessages[0].created_at : null;

    return new Response(
      JSON.stringify({
        messages: formattedMessages,
        has_more: messages?.length === limit,
        next_cursor: oldestMessageTime,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders(req),
          "Content-Type": "application/json",
          "Cache-Control": "private, max-age=10", // Cache for 10 seconds
        },
      },
    );
  } catch (error) {
    console.error("Error in list-messages:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

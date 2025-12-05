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

    if (!conversationId) {
      return new Response(JSON.stringify({ error: "conversation_id is required" }), {
        status: 400,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Check if this is a temporary ID from optimistic update
    if (conversationId.startsWith("temp-")) {
      console.log(`Temporary conversation ID detected: ${conversationId}`);
      return new Response(JSON.stringify({ messages: [] }), {
        status: 200,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // First, verify the conversation exists and user has access
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

    // Fetch messages for the conversation
    const { data: messages, error: messagesError } = await supabaseClient
      .from("messages")
      .select(
        `
        *,
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
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
      return new Response(JSON.stringify({ error: messagesError.message }), {
        status: 500,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Transform the response to a cleaner format
    const formattedMessages = (messages || []).map((msg) => ({
      id: msg.id,
      body: msg.body,
      created_at: msg.created_at,
      sender_type: msg.sender_type,
      sender_agency_member_id: msg.agency_member_id,
      sender_client_user_id: msg.client_user_id,
      conversation_id: msg.conversation_id,
      sender:
        msg.sender_type === "agency_member"
          ? msg.agency_member?.user
            ? {
                id: msg.agency_member.id,
                email: msg.agency_member.user.email,
                full_name: msg.agency_member.user.full_name,
                type: "agency_member",
              }
            : null
          : msg.client_user
            ? {
                id: msg.client_user.id,
                email: msg.client_user.email,
                full_name: msg.client_user.full_name,
                type: "client_user",
              }
            : null,
    }));

    return new Response(JSON.stringify({ messages: formattedMessages }), {
      status: 200,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in list-messages:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

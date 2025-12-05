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
    const limit = parseInt(url.searchParams.get("limit") || "100");

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

    // Fetch messages for the conversation (SIMPLIFIED - no joins)
    const { data: messages, error: messagesError } = await supabaseClient
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
        attachment_url,
        related_project_id
      `,
      )
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(Math.min(limit, 200));

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
      return new Response(JSON.stringify({ error: messagesError.message }), {
        status: 500,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Collect all agency_member_ids and client_user_ids to fetch profiles separately
    const agencyMemberIds: string[] = [];
    const clientUserIds: string[] = [];

    (messages || []).forEach((msg: any) => {
      if (msg.sender_type === "agency_member" && msg.agency_member_id) {
        agencyMemberIds.push(msg.agency_member_id);
      } else if (msg.sender_type === "client_user" && msg.client_user_id) {
        clientUserIds.push(msg.client_user_id);
      }
    });

    // Fetch agency member profiles
    let agencyMembersMap = new Map<string, any>();
    if (agencyMemberIds.length > 0) {
      const { data: agencyMembers } = await supabaseClient
        .from("agency_members")
        .select(
          `
          id,
          user:user_id (
            id,
            email,
            full_name
          )
        `,
        )
        .in("id", agencyMemberIds);

      if (agencyMembers) {
        agencyMembers.forEach((member: any) => {
          if (member.user && Array.isArray(member.user) && member.user.length > 0) {
            const user = member.user[0];
            agencyMembersMap.set(member.id, {
              id: member.id,
              email: user.email,
              full_name: user.full_name,
              type: "agency_member",
            });
          }
        });
      }
    }

    // Fetch client user profiles
    let clientUsersMap = new Map<string, any>();
    if (clientUserIds.length > 0) {
      const { data: clientUsers } = await supabaseClient
        .from("client_users")
        .select(
          `
          id,
          email,
          full_name
        `,
        )
        .in("id", clientUserIds);

      if (clientUsers) {
        clientUsers.forEach((user: any) => {
          clientUsersMap.set(user.id, {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            type: "client_user",
          });
        });
      }
    }

    // Transform the response
    const formattedMessages = (messages || []).map((msg: any) => {
      let sender = null;

      if (msg.sender_type === "agency_member" && msg.agency_member_id) {
        sender = agencyMembersMap.get(msg.agency_member_id) || null;
      } else if (msg.sender_type === "client_user" && msg.client_user_id) {
        sender = clientUsersMap.get(msg.client_user_id) || null;
      }

      return {
        id: msg.id,
        body: msg.body,
        created_at: msg.created_at,
        sender_type: msg.sender_type,
        sender_agency_member_id: msg.agency_member_id,
        sender_client_user_id: msg.client_user_id,
        conversation_id: msg.conversation_id,
        attachment_url: msg.attachment_url,
        related_project_id: msg.related_project_id,
        sender,
      };
    });

    return new Response(
      JSON.stringify({
        messages: formattedMessages,
        has_more: messages?.length === limit,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders(req),
          "Content-Type": "application/json",
          "Cache-Control": "private, max-age=10",
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

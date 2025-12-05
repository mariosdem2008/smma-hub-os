import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const allowedOrigins = [
  "http://localhost:8080",
  "https://smmahub.net",
  "https://73a2983b-0136-47d2-9a1f-01fe580ac593.lovableproject.com",
  "https://id-preview--73a2983b-0136-47d2-9a1f-01fe580ac593.lovable.app",
];

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": allowedOrigins[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, Apikey, APIKEY",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  // Handle OPTIONS request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const conversationId = url.searchParams.get("conversation_id");
    const limit = parseInt(url.searchParams.get("limit") || "100");

    if (!conversationId) {
      return new Response(JSON.stringify({ error: "conversation_id is required" }), {
        status: 400,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    // Check if this is a temporary ID
    if (conversationId.startsWith("temp-") || conversationId.startsWith("optimistic-")) {
      console.log(`Temporary conversation ID: ${conversationId}`);
      return new Response(JSON.stringify({ messages: [] }), {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Fetching messages for conversation: ${conversationId}`);

    // SIMPLE QUERY - NO JOINS, NO RELATIONSHIPS
    const { data: messages, error: messagesError } = await supabaseClient
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(Math.min(limit, 200));

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
      return new Response(JSON.stringify({ error: messagesError.message }), {
        status: 500,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${messages?.length || 0} messages`);

    // If no messages, return empty array
    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ messages: [] }), {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    // Collect user IDs to fetch profiles
    const agencyMemberIds: string[] = [];
    const clientUserIds: string[] = [];

    messages.forEach((msg: any) => {
      if (msg.sender_type === "agency_member" && msg.agency_member_id) {
        agencyMemberIds.push(msg.agency_member_id);
      }
      if (msg.sender_type === "client_user" && msg.client_user_id) {
        clientUserIds.push(msg.client_user_id);
      }
    });

    // Fetch agency member profiles
    const agencyMembersMap = new Map<string, any>();
    if (agencyMemberIds.length > 0) {
      console.log(`Fetching ${agencyMemberIds.length} agency members`);

      // First get agency members
      const { data: agencyMembers } = await supabaseClient
        .from("agency_members")
        .select("id, user_id")
        .in("id", agencyMemberIds);

      if (agencyMembers && agencyMembers.length > 0) {
        // Then get user profiles
        const userIds = agencyMembers.map((m: any) => m.user_id).filter(Boolean);
        if (userIds.length > 0) {
          const { data: profiles } = await supabaseClient
            .from("profiles")
            .select("id, email, full_name")
            .in("id", userIds);

          if (profiles) {
            // Create a map from user_id to profile
            const profileMap = new Map(profiles.map((p: any) => [p.id, p]));

            // Map agency_member_id to profile
            agencyMembers.forEach((member: any) => {
              const profile = profileMap.get(member.user_id);
              if (profile) {
                agencyMembersMap.set(member.id, {
                  id: member.id,
                  email: profile.email,
                  full_name: profile.full_name,
                  type: "agency_member",
                });
              }
            });
          }
        }
      }
    }

    // Fetch client user profiles
    const clientUsersMap = new Map<string, any>();
    if (clientUserIds.length > 0) {
      console.log(`Fetching ${clientUserIds.length} client users`);

      const { data: clientUsers } = await supabaseClient
        .from("client_users")
        .select("id, email, full_name")
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

    // Format messages
    const formattedMessages = messages.map((msg: any) => {
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
        has_more: messages.length === limit,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error in list-messages:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }
});

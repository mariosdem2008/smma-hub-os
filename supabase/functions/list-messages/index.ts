import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

// Simple CORS headers - no request parameter needed
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, Apikey, APIKEY",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  // Handle OPTIONS request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const conversationId = url.searchParams.get("conversation_id");
    const limit = parseInt(url.searchParams.get("limit") || "100");

    if (!conversationId) {
      return new Response(JSON.stringify({ error: "conversation_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if this is a temporary ID
    if (conversationId.startsWith("temp-") || conversationId.startsWith("optimistic-")) {
      return new Response(JSON.stringify({ messages: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[list-messages] Fetching for conversation: ${conversationId}`);

    // STEP 1: Get messages with SIMPLE query - NO JOINS
    const { data: messages, error: messagesError } = await supabaseClient
      .from("messages")
      .select("*") // SIMPLE - select all columns, no relationships
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(Math.min(limit, 200));

    if (messagesError) {
      console.error("[list-messages] Error fetching messages:", messagesError);
      return new Response(JSON.stringify({ error: messagesError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[list-messages] Found ${messages?.length || 0} messages`);

    // If no messages, return empty array
    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ messages: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // STEP 2: Collect all user IDs from messages
    const agencyMemberIds: string[] = [];
    const clientUserIds: string[] = [];

    messages.forEach((msg: any) => {
      // Check for ANY possible column names that might contain agency member IDs
      if (msg.sender_type === "agency_member") {
        // Try common column names
        if (msg.agency_member_id) agencyMemberIds.push(msg.agency_member_id);
        else if (msg.sender_agency_member_id) agencyMemberIds.push(msg.sender_agency_member_id);
        else if (msg.agency_member) agencyMemberIds.push(msg.agency_member);
      }

      // Check for ANY possible column names that might contain client user IDs
      if (msg.sender_type === "client_user") {
        // Try common column names
        if (msg.client_user_id) clientUserIds.push(msg.client_user_id);
        else if (msg.sender_client_user_id) clientUserIds.push(msg.sender_client_user_id);
        else if (msg.client_user) clientUserIds.push(msg.client_user);
      }
    });

    console.log(`[list-messages] Found ${agencyMemberIds.length} agency members, ${clientUserIds.length} client users`);

    // STEP 3: Fetch user profiles SEPARATELY (no joins)
    const userProfiles = new Map<string, any>();

    // Try to fetch agency member profiles if we have IDs
    if (agencyMemberIds.length > 0) {
      try {
        // First, try to get agency members with user_id
        const { data: agencyMembers, error: agencyError } = await supabaseClient
          .from("agency_members")
          .select("id, user_id")
          .in("id", agencyMemberIds);

        if (!agencyError && agencyMembers) {
          // Get unique user IDs
          const userIds = [...new Set(agencyMembers.map((m: any) => m.user_id).filter(Boolean))];

          if (userIds.length > 0) {
            // Get user profiles
            const { data: profiles, error: profilesError } = await supabaseClient
              .from("profiles")
              .select("id, email, full_name")
              .in("id", userIds);

            if (!profilesError && profiles) {
              // Create a map from user_id to profile
              const profileMap = new Map(profiles.map((p: any) => [p.id, p]));

              // Map agency_member_id to profile
              agencyMembers.forEach((member: any) => {
                const profile = profileMap.get(member.user_id);
                if (profile) {
                  userProfiles.set(member.id, {
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
      } catch (error) {
        console.warn("[list-messages] Could not fetch agency member profiles:", error);
      }
    }

    // Try to fetch client user profiles if we have IDs
    if (clientUserIds.length > 0) {
      try {
        const { data: clientUsers, error: clientError } = await supabaseClient
          .from("client_users")
          .select("id, email, full_name")
          .in("id", clientUserIds);

        if (!clientError && clientUsers) {
          clientUsers.forEach((user: any) => {
            userProfiles.set(user.id, {
              id: user.id,
              email: user.email,
              full_name: user.full_name,
              type: "client_user",
            });
          });
        }
      } catch (error) {
        console.warn("[list-messages] Could not fetch client user profiles:", error);
      }
    }

    // STEP 4: Format messages with sender info
    const formattedMessages = messages.map((msg: any) => {
      let sender = null;

      if (msg.sender_type === "agency_member") {
        // Try multiple possible column names
        const agencyMemberId = msg.agency_member_id || msg.sender_agency_member_id || msg.agency_member;
        if (agencyMemberId) {
          sender = userProfiles.get(agencyMemberId) || null;
        }
      } else if (msg.sender_type === "client_user") {
        // Try multiple possible column names
        const clientUserId = msg.client_user_id || msg.sender_client_user_id || msg.client_user;
        if (clientUserId) {
          sender = userProfiles.get(clientUserId) || null;
        }
      }

      return {
        id: msg.id,
        body: msg.body,
        created_at: msg.created_at,
        sender_type: msg.sender_type,
        // Include all possible ID fields for debugging
        agency_member_id: msg.agency_member_id,
        sender_agency_member_id: msg.sender_agency_member_id,
        client_user_id: msg.client_user_id,
        sender_client_user_id: msg.sender_client_user_id,
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
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("[list-messages] Unhandled error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

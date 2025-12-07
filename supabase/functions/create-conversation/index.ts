import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

interface CreateConversationPayload {
  type: "client_chat" | "direct" | "group";
  client_id?: string;
  title?: string;
  member_ids?: string[];
  client_user_ids?: string[];
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const payload: CreateConversationPayload = await req.json();
    const { type, client_id, title, member_ids = [], client_user_ids = [] } = payload;

    console.log(
      `Creating conversation: type=${type}, client_id=${client_id}, member_ids=${member_ids.length}, client_user_ids=${client_user_ids.length}`,
    );

    // Get user's agency membership
    const { data: agencyMember } = await supabaseClient
      .from("agency_members")
      .select("id, agency_id")
      .eq("user_id", user.id)
      .single();

    if (!agencyMember) {
      return new Response(JSON.stringify({ error: "User is not an agency member" }), {
        status: 403,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    console.log(`User agency member: ${agencyMember.id}, agency: ${agencyMember.agency_id}`);

    // For client_chat, check if conversation already exists
    if (type === "client_chat" && client_id) {
      const { data: existingConv } = await supabaseClient
        .from("conversations")
        .select("*")
        .eq("agency_id", agencyMember.agency_id)
        .eq("type", "client_chat")
        .eq("client_id", client_id)
        .maybeSingle();

      if (existingConv) {
        console.log(`Found existing conversation: ${existingConv.id}`);
        return new Response(
          JSON.stringify({
            conversation: existingConv,
            message: "Existing conversation found",
          }),
          {
            status: 200,
            headers: { ...headers, "Content-Type": "application/json" },
          },
        );
      }
    }

    // For direct chats, check if conversation already exists between these two members
    if (type === "direct" && member_ids.length === 1) {
      const otherMemberId = member_ids[0];

      // Find existing direct conversation between these two members
      const { data: existingConvs } = await supabaseClient
        .from("conversations")
        .select(
          `
          *,
          conversation_participants(agency_member_id)
        `,
        )
        .eq("agency_id", agencyMember.agency_id)
        .eq("type", "direct");

      if (existingConvs) {
        for (const conv of existingConvs) {
          const participantIds = conv.conversation_participants?.map((p: any) => p.agency_member_id) || [];
          if (participantIds.includes(agencyMember.id) && participantIds.includes(otherMemberId)) {
            console.log(`Found existing direct conversation: ${conv.id}`);
            return new Response(
              JSON.stringify({
                conversation: conv,
                message: "Existing conversation found",
              }),
              {
                status: 200,
                headers: { ...headers, "Content-Type": "application/json" },
              },
            );
          }
        }
      }
    }

    // Create conversation
    const { data: conversation, error: conversationError } = await supabaseClient
      .from("conversations")
      .insert({
        agency_id: agencyMember.agency_id,
        type,
        client_id: type === "client_chat" ? client_id : null,
        title: title || null,
      })
      .select()
      .single();

    if (conversationError) {
      console.error("Error creating conversation:", conversationError);
      return new Response(JSON.stringify({ error: `Failed to create conversation: ${conversationError.message}` }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    console.log(`Successfully created conversation: ${conversation.id}`);

    // Always add creator as participant
    const participants: any[] = [
      {
        conversation_id: conversation.id,
        agency_id: agencyMember.agency_id,
        agency_member_id: agencyMember.id,
        role: "agency_member",
        created_at: new Date().toISOString(),
      },
    ];

    // Add other agency member participants (excluding creator if already in list)
    for (const memberId of member_ids) {
      if (memberId !== agencyMember.id) {
        participants.push({
          conversation_id: conversation.id,
          agency_id: agencyMember.agency_id,
          agency_member_id: memberId,
          role: "agency_member",
          created_at: new Date().toISOString(),
        });
      }
    }

    // Add explicitly passed client user participants
    for (const userId of client_user_ids) {
      participants.push({
        conversation_id: conversation.id,
        agency_id: agencyMember.agency_id,
        agency_member_id: null,
        client_user_id: userId,
        role: "client_user",
        created_at: new Date().toISOString(),
      });
    }

    // Client users using JWT auth will be added when they first access the portal
    if (type === "client_chat" && client_id) {
      console.log(`Client chat created. Client users will be added when they first access the portal.`);

      const { data: client } = await supabaseClient.from("clients").select("name").eq("id", client_id).single();

      if (client) {
        console.log(`Client chat created for: ${client.name}`);
      }
    }

    console.log(`Adding ${participants.length} participants to conversation`);

    if (participants.length > 0) {
      const { error: participantsError } = await supabaseClient.from("conversation_participants").insert(participants);

      if (participantsError) {
        console.error("Error adding participants:", participantsError);

        await supabaseClient.from("conversations").delete().eq("id", conversation.id);

        return new Response(JSON.stringify({ error: `Failed to add participants: ${participantsError.message}` }), {
          status: 500,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
    }

    console.log(`Successfully created conversation ${conversation.id} with ${participants.length} participants`);

    const { data: fullConversation } = await supabaseClient
      .from("conversations")
      .select(
        `
        *,
        conversation_participants(
          id,
          agency_member_id,
          client_user_id,
          role
        ),
        clients(id, name, logo_url)
      `,
      )
      .eq("id", conversation.id)
      .single();

    return new Response(
      JSON.stringify({
        conversation: fullConversation || conversation,
        message: "Conversation created successfully",
      }),
      {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in create-conversation:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: `Server error: ${message}` }), {
      status: 500,
      headers: { ...corsHeaders(req.headers.get("Origin")), "Content-Type": "application/json" },
    });
  }
});

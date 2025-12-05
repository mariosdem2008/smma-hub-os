import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface CreateConversationPayload {
  type: "client_chat" | "direct" | "group";
  client_id?: string;
  title?: string;
  member_ids?: string[];
  client_user_ids?: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: CreateConversationPayload = await req.json();
    const { type, client_id, title, member_ids = [], client_user_ids = [] } = payload;

    // Get user's agency membership
    const { data: agencyMember } = await supabaseClient
      .from("agency_members")
      .select("id, agency_id")
      .eq("user_id", user.id)
      .single();

    if (!agencyMember) {
      return new Response(JSON.stringify({ error: "User is not an agency member" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Creating conversation: type=${type}, agency_id=${agencyMember.agency_id}`);

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
        return new Response(JSON.stringify({ conversation: existingConv }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
            return new Response(JSON.stringify({ conversation: conv }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
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
      return new Response(JSON.stringify({ error: conversationError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Created conversation: ${conversation.id}`);

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

    // For client_chat conversations, auto-add ALL client users for that client
    if (type === "client_chat" && client_id) {
      const { data: clientUsers } = await supabaseClient.from("client_users").select("id").eq("client_id", client_id);

      if (clientUsers && clientUsers.length > 0) {
        for (const clientUser of clientUsers) {
          // Avoid duplicates if already added via client_user_ids
          const alreadyAdded = participants.some((p) => p.client_user_id === clientUser.id);
          if (!alreadyAdded) {
            participants.push({
              conversation_id: conversation.id,
              agency_id: agencyMember.agency_id,
              agency_member_id: null,
              client_user_id: clientUser.id,
              role: "client_user",
              created_at: new Date().toISOString(),
            });
          }
        }
      }
      console.log(`Auto-added ${clientUsers?.length || 0} client users as participants`);
    }

    console.log(`Adding ${participants.length} participants to conversation`);

    if (participants.length > 0) {
      const { error: participantsError } = await supabaseClient.from("conversation_participants").insert(participants);

      if (participantsError) {
        console.error("Error adding participants:", participantsError);

        // Delete the conversation since participants failed
        await supabaseClient.from("conversations").delete().eq("id", conversation.id);

        return new Response(JSON.stringify({ error: `Failed to add participants: ${participantsError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log(
      `Successfully created conversation: ${conversation.id} (type: ${type}) with ${participants.length} participants`,
    );

    return new Response(
      JSON.stringify({
        conversation,
        message: "Conversation created successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in create-conversation:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

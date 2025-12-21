import { createClient } from "npm:@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

const allowedOrigins = [
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
  "https://smmahub.net",
  "https://73a2983b-0136-47d2-9a1f-01fe580ac593.lovableproject.com",
  "https://id-preview--73a2983b-0136-47d2-9a1f-01fe580ac593.lovable.app",
];

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const isAllowed = allowedOrigins.includes(origin);

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigins[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
    "Access-Control-Allow-Headers":
      request.headers.get("Access-Control-Request-Headers") || "Content-Type, Authorization, apikey, Apikey, APIKEY",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

Deno.serve(async (req) => {
  // Handle OPTIONS request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(req),
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    const { conversation_id, sender_type, text, attachment_url, related_project_id } = payload;

    console.log("Received message payload:", {
      conversation_id,
      sender_type,
      text_length: text?.length,
      attachment_url: !!attachment_url,
      related_project_id,
    });

    if (!conversation_id || !sender_type || !text) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: conversation_id, sender_type, and text are required" }),
        {
          status: 400,
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        },
      );
    }

    // Verify conversation exists and user has access
    const { data: conversation, error: convError } = await supabaseClient
      .from("conversations")
      .select("id, agency_id, type, client_id")
      .eq("id", conversation_id)
      .single();

    if (convError || !conversation) {
      console.error("Conversation not found:", convError);
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // For agency members, verify they belong to the conversation's agency
    if (sender_type === "agency_member") {
      const { data: agencyMember } = await supabaseClient
        .from("agency_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("agency_id", conversation.agency_id)
        .single();

      if (!agencyMember) {
        return new Response(JSON.stringify({ error: "User is not a member of this agency" }), {
          status: 403,
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Create message
      const { data: message, error: messageError } = await supabaseClient
        .from("messages")
        .insert({
          conversation_id,
          body: text,
          sender_type,
          sender_agency_member_id: agencyMember.id,
          sender_client_user_id: null,
          agency_id: conversation.agency_id,
          client_id: conversation.client_id,
          attachment_url: attachment_url || null,
          related_project_id: related_project_id || null,
        })
        .select()
        .single();

      if (messageError) {
        console.error("Error creating message:", messageError);
        return new Response(JSON.stringify({ error: `Failed to send message: ${messageError.message}` }), {
          status: 500,
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Update conversation's updated_at
      await supabaseClient
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversation_id);

      console.log("Message sent successfully:", message.id);

      return new Response(
        JSON.stringify({
          message: {
            id: message.id,
            body: message.body,
            created_at: message.created_at,
            sender_type: message.sender_type,
            sender_agency_member_id: message.sender_agency_member_id,
            sender_client_user_id: message.sender_client_user_id,
            conversation_id: message.conversation_id,
            attachment_url: message.attachment_url,
            related_project_id: message.related_project_id,
          },
          success: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        },
      );
    }
    // For client users, we need to handle JWT tokens separately
    else if (sender_type === "client_user") {
      // Note: Client users should use a different endpoint with JWT validation
      // This is simplified - you'll need to implement JWT verification for client portal
      return new Response(JSON.stringify({ error: "Client user messaging not implemented in this endpoint" }), {
        status: 501,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    } else {
      return new Response(JSON.stringify({ error: "Invalid sender_type" }), {
        status: 400,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Error in send-message:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: `Server error: ${message}` }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

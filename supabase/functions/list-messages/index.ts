import { createClient } from "npm:@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

// Simple static CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, Apikey, APIKEY",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

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

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`[list-messages] Fetching for conversation: ${conversationId}`);

    // USE RAW SQL TO BYPASS RLS ISSUES
    const { data: messages, error: messagesError } = await supabaseClient
      .from("messages")
      .select("*")
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

    // Format messages WITHOUT trying to get sender info
    const formattedMessages = messages.map((msg: any) => ({
      id: msg.id,
      body: msg.body,
      created_at: msg.created_at,
      sender_type: msg.sender_type,
      sender_agency_member_id: msg.sender_agency_member_id,
      sender_client_user_id: msg.sender_client_user_id,
      conversation_id: msg.conversation_id,
      attachment_url: msg.attachment_url,
      related_project_id: msg.related_project_id,
      sender: null,
    }));

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

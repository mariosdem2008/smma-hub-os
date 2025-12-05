import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const payload = await req.json();
    const { conversation_id, sender_type, text, attachment_url, related_project_id } = payload;

    if (!conversation_id || !sender_type || !text) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's agency membership
    const { data: agencyMember } = await supabaseClient
      .from("agency_members")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!agencyMember && sender_type === "agency_member") {
      return new Response(JSON.stringify({ error: "User is not an agency member" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create message
    const messageData: any = {
      conversation_id,
      body: text,
      sender_type,
      agency_member_id: sender_type === "agency_member" ? agencyMember?.id : null,
      client_user_id: null, // Will be set for client users via JWT
    };

    if (attachment_url) messageData.attachment_url = attachment_url;
    if (related_project_id) messageData.related_project_id = related_project_id;

    const { data: message, error: messageError } = await supabaseClient
      .from("messages")
      .insert(messageData)
      .select()
      .single();

    if (messageError) {
      console.error("Error creating message:", messageError);
      return new Response(JSON.stringify({ error: messageError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update conversation updated_at
    await supabaseClient
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversation_id);

    return new Response(
      JSON.stringify({
        message,
        success: true,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in send-message:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

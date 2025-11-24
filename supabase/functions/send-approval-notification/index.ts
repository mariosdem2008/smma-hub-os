import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  contentType: 'post' | 'idea';
  contentId: string;
  contentTitle: string;
  clientId: string;
  action: 'submitted' | 'approved' | 'rejected';
  comment?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { contentType, contentId, contentTitle, clientId, action, comment }: NotificationRequest = await req.json();

    console.log("Processing approval notification:", { contentType, contentId, action });

    // Get client details
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("name, email, agency_id")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      throw new Error("Client not found");
    }

    // Get agency owner details
    const { data: agency, error: agencyError } = await supabase
      .from("agencies")
      .select("name, user_id")
      .eq("id", client.agency_id)
      .single();

    if (agencyError || !agency) {
      throw new Error("Agency not found");
    }

    // Get agency owner email
    const { data: ownerProfile, error: ownerError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", agency.user_id)
      .single();

    if (ownerError || !ownerProfile) {
      throw new Error("Agency owner not found");
    }

    // Get client portal users for the client
    const { data: portalUsers } = await supabase
      .from("client_portal_users")
      .select("email, name")
      .eq("client_id", clientId);

    let recipientEmail: string;
    let recipientName: string;
    let subject: string;
    let htmlContent: string;

    if (action === 'submitted') {
      // Notify client that content is ready for review
      recipientEmail = client.email || (portalUsers && portalUsers[0]?.email) || ownerProfile.email;
      recipientName = client.name;
      subject = `New ${contentType} ready for your review`;
      htmlContent = `
        <h2>New Content Ready for Review</h2>
        <p>Hello,</p>
        <p>A new ${contentType} "<strong>${contentTitle}</strong>" has been submitted for your approval.</p>
        <p>Please review and approve or reject this content in your portal.</p>
        <p>Best regards,<br>${agency.name}</p>
      `;
    } else if (action === 'approved') {
      // Notify agency that client approved content
      recipientEmail = ownerProfile.email;
      recipientName = ownerProfile.full_name || agency.name;
      subject = `Client approved ${contentType}`;
      htmlContent = `
        <h2>Content Approved</h2>
        <p>Hello ${recipientName},</p>
        <p>Your client <strong>${client.name}</strong> has approved the ${contentType} "<strong>${contentTitle}</strong>".</p>
        ${comment ? `<p><strong>Comment:</strong> ${comment}</p>` : ''}
        <p>Best regards,<br>Your Content Management System</p>
      `;
    } else {
      // Notify agency that client rejected content
      recipientEmail = ownerProfile.email;
      recipientName = ownerProfile.full_name || agency.name;
      subject = `Client rejected ${contentType}`;
      htmlContent = `
        <h2>Content Rejected</h2>
        <p>Hello ${recipientName},</p>
        <p>Your client <strong>${client.name}</strong> has rejected the ${contentType} "<strong>${contentTitle}</strong>".</p>
        ${comment ? `<p><strong>Reason:</strong> ${comment}</p>` : ''}
        <p>Please review and make the necessary changes.</p>
        <p>Best regards,<br>Your Content Management System</p>
      `;
    }

    // Send email via Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Content Hub <onboarding@resend.dev>",
        to: [recipientEmail],
        subject: subject,
        html: htmlContent,
      }),
    });

    if (!emailResponse.ok) {
      throw new Error(`Failed to send email: ${await emailResponse.text()}`);
    }

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending approval notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

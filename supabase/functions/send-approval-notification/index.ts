import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AgencyBranding {
  email_sender_name: string | null;
  email_footer: string | null;
}

interface NotificationRequest {
  contentType?: 'post' | 'idea';
  contentId?: string;
  contentTitle?: string;
  clientId?: string;
  action: 'submitted' | 'approved' | 'rejected' | 'approval_requested' | 'changes_requested';
  comment?: string;
  // New pipeline-specific fields
  asset_id?: string;
  approver_id?: string;
}

function generateWhiteLabelEmail(
  branding: AgencyBranding | null,
  subject: string,
  heading: string,
  body: string,
  ctaText?: string,
  ctaUrl?: string
): string {
  const senderName = branding?.email_sender_name || 'SMMAHub';
  const footer = branding?.email_footer || '';
  const fontFamily = 'Arial, sans-serif';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body {
          font-family: ${fontFamily};
          margin: 0;
          padding: 0;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
        }
        .header {
          background-color: #6366f1;
          padding: 30px 20px;
          text-align: center;
        }
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 24px;
        }
        .content {
          padding: 40px 30px;
        }
        .heading {
          font-size: 24px;
          font-weight: bold;
          color: #333;
          margin-bottom: 20px;
        }
        .body-text {
          font-size: 16px;
          line-height: 1.6;
          color: #666;
          margin-bottom: 30px;
        }
        .cta-button {
          display: inline-block;
          padding: 14px 30px;
          background-color: #8b5cf6;
          color: #ffffff !important;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          margin: 20px 0;
        }
        .footer {
          background-color: #f9f9f9;
          padding: 30px;
          text-align: center;
          font-size: 14px;
          color: #999;
        }
        .footer-text {
          margin-bottom: 10px;
        }
        .divider {
          height: 1px;
          background-color: #e5e5e5;
          margin: 30px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${senderName}</h1>
        </div>
        
        <div class="content">
          <div class="heading">${heading}</div>
          <div class="body-text">${body}</div>
          
          ${ctaText && ctaUrl ? `
            <a href="${ctaUrl}" class="cta-button">${ctaText}</a>
          ` : ''}
        </div>
        
        <div class="footer">
          ${footer ? `
            <div class="footer-text">${footer}</div>
            <div class="divider"></div>
          ` : ''}
          <div class="footer-text">© ${new Date().getFullYear()} ${senderName}. All rights reserved.</div>
          <div class="footer-text" style="color: #ccc; font-size: 12px;">
            This email was sent from your content management system.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const request: NotificationRequest = await req.json();
    const { contentType, contentId, contentTitle, clientId, action, comment, asset_id, approver_id } = request;

    console.log("Processing approval notification:", { contentType, contentId, action, asset_id });

    // Handle new pipeline approval notifications
    if (asset_id) {
      // Get asset details
      const { data: asset, error: assetError } = await supabase
        .from('assets')
        .select('filename, client_id, uploaded_by, clients(name, agency_id)')
        .eq('id', asset_id)
        .single();

      if (assetError) throw assetError;

      const client = (asset.clients as any);
      const agencyId = client.agency_id;

      // Get agency branding
      const { data: branding } = await supabase
        .from('agency_branding')
        .select('email_sender_name, email_footer')
        .eq('agency_id', agencyId)
        .single();

      const senderName = branding?.email_sender_name || 'SMMAHUB';

      let recipientEmail: string;
      let subject: string;
      let heading: string;
      let bodyText: string;

      if (action === 'approval_requested' && approver_id) {
        // Notify approver
        const { data: approver } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', approver_id)
          .single();

        if (!approver?.email) throw new Error('Approver email not found');

        recipientEmail = approver.email;
        const approverName = approver.full_name || 'there';

        subject = `Approval Needed: ${asset.filename}`;
        heading = "Content Ready for Your Approval";
        bodyText = `
          <p>Hi ${approverName},</p>
          <p>New content is ready for your review and approval:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Asset:</strong> ${asset.filename}</p>
            <p style="margin: 5px 0;"><strong>Client:</strong> ${client.name}</p>
          </div>
          <p>Please review the content and provide your feedback.</p>
        `;

      } else if (action === 'changes_requested') {
        // Notify editor/uploader
        if (!asset.uploaded_by) throw new Error('Uploader not found');

        const { data: uploader } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', asset.uploaded_by)
          .single();

        if (!uploader?.email) throw new Error('Uploader email not found');

        recipientEmail = uploader.email;
        const uploaderName = uploader.full_name || 'there';

        subject = `Changes Requested: ${asset.filename}`;
        heading = "Changes Requested on Your Content";
        bodyText = `
          <p>Hi ${uploaderName},</p>
          <p>Feedback has been provided on your content:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Asset:</strong> ${asset.filename}</p>
            <p style="margin: 5px 0;"><strong>Client:</strong> ${client.name}</p>
            ${comment ? `<p style="margin: 5px 0;"><strong>Feedback:</strong> ${comment}</p>` : ''}
          </div>
          <p>The asset has been moved back to editing. Please review the feedback and make the requested changes.</p>
        `;

      } else if (action === 'approved') {
        // Notify uploader of approval
        if (!asset.uploaded_by) throw new Error('Uploader not found');

        const { data: uploader } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', asset.uploaded_by)
          .single();

        if (!uploader?.email) throw new Error('Uploader email not found');

        recipientEmail = uploader.email;
        const uploaderName = uploader.full_name || 'there';

        subject = `Approved: ${asset.filename}`;
        heading = "Content Approved! 🎉";
        bodyText = `
          <p>Hi ${uploaderName},</p>
          <p>Great news! Your content has been approved:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Asset:</strong> ${asset.filename}</p>
            <p style="margin: 5px 0;"><strong>Client:</strong> ${client.name}</p>
          </div>
          <p>The asset is now ready for scheduling and publishing.</p>
        `;

      } else {
        throw new Error('Invalid action type');
      }

      const htmlContent = generateWhiteLabelEmail(
        branding,
        subject,
        heading,
        bodyText
      );

      // Send email
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${senderName} <notifications@smmahub.net>`,
          to: [recipientEmail],
          subject: subject,
          html: htmlContent,
        }),
      });

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error('Failed to send email:', errorText);
        throw new Error('Failed to send email notification');
      }

      console.log('Pipeline approval email sent successfully');

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Original post/idea approval notification logic below
    if (!contentType || !contentId || !clientId) {
      throw new Error('Missing required fields for content notification');
    }

    // Get client details
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("name, email, agency_id")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      throw new Error("Client not found");
    }

    // Get agency details
    const { data: agency, error: agencyError } = await supabase
      .from("agencies")
      .select("name, user_id")
      .eq("id", client.agency_id)
      .single();

    if (agencyError || !agency) {
      throw new Error("Agency not found");
    }

    // Get agency branding
    const { data: branding } = await supabase
      .from("agency_branding")
      .select("email_sender_name, email_footer")
      .eq("agency_id", client.agency_id)
      .single();

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
    let subject: string;
    let heading: string;
    let bodyText: string;

    if (action === 'submitted') {
      // Notify client that content is ready for review
      recipientEmail = client.email || (portalUsers && portalUsers[0]?.email) || ownerProfile.email;
      subject = `New ${contentType} ready for your review`;
      heading = "New Content Ready for Review";
      bodyText = `
        <p>Hello,</p>
        <p>A new ${contentType} "<strong>${contentTitle}</strong>" has been submitted for your approval.</p>
        <p>Please review and approve or reject this content in your portal.</p>
        <p>Best regards,<br/>${agency.name}</p>
      `;
    } else if (action === 'approved') {
      // Notify agency that client approved content
      recipientEmail = ownerProfile.email;
      subject = `Client approved ${contentType}`;
      heading = "Content Approved";
      bodyText = `
        <p>Hello ${ownerProfile.full_name || agency.name},</p>
        <p>Your client <strong>${client.name}</strong> has approved the ${contentType} "<strong>${contentTitle}</strong>".</p>
        ${comment ? `<p><strong>Comment:</strong> ${comment}</p>` : ''}
        <p>Keep up the great work!</p>
      `;
    } else {
      // Notify agency that client rejected content
      recipientEmail = ownerProfile.email;
      subject = `Client requested changes to ${contentType}`;
      heading = "Content Needs Revision";
      bodyText = `
        <p>Hello ${ownerProfile.full_name || agency.name},</p>
        <p>Your client <strong>${client.name}</strong> has requested changes to the ${contentType} "<strong>${contentTitle}</strong>".</p>
        ${comment ? `<p><strong>Feedback:</strong> ${comment}</p>` : ''}
        <p>Please review their feedback and make the necessary adjustments.</p>
      `;
    }

    const htmlContent = generateWhiteLabelEmail(
      branding,
      subject,
      heading,
      bodyText
    );

    const senderName = branding?.email_sender_name || 'Content Hub';

    // Send email via Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${senderName} <onboarding@resend.dev>`,
        to: [recipientEmail],
        subject: subject,
        html: htmlContent,
      }),
    });

    if (!emailResponse.ok) {
      throw new Error(`Failed to send email: ${await emailResponse.text()}`);
    }

    console.log("Email sent successfully to:", recipientEmail);

    return new Response(
      JSON.stringify({ success: true }),
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

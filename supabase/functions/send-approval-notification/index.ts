import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PUBLIC_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { buildApprovalNotificationIdempotencyKey } from "../../../src/lib/approvalNotifications.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

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
  action: 'submitted' | 'approved' | 'rejected' | 'approval_requested' | 'changes_requested' | 'approval_reminder';
  comment?: string;
  // New pipeline-specific fields
  asset_id?: string;
  approver_id?: string;
  // Project approval fields
  project_id?: string;
  idempotency_key?: string;
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

function uniqueEmails(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim().toLowerCase())
        .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)),
    ),
  );
}

async function parseProviderResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { body: text.slice(0, 2000) };
  }
}

async function beginEmailDelivery(
  supabase: ReturnType<typeof createClient>,
  input: {
    agencyId: string;
    projectId?: string | null;
    action: string;
    idempotencyKey: string;
    requestPayload: Record<string, unknown>;
  },
) {
  const existing = await supabase
    .from("notification_deliveries")
    .select("id, status, sent_at, created_at, attempt_count")
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();

  if (existing.error) throw existing.error;

  if (existing.data?.status === "sent" && existing.data.sent_at) {
    return { id: existing.data.id as string, shouldSend: false, deduped: true };
  }

  if (existing.data?.status === "sending") {
    const createdAt = Date.parse(String(existing.data.created_at ?? ""));
    const stillInFlight = Number.isFinite(createdAt) && Date.now() - createdAt < 10 * 60 * 1000;
    if (stillInFlight) {
      return { id: existing.data.id as string, shouldSend: false, deduped: true };
    }
  }

  if (existing.data?.id) {
    const attemptCount = Number(existing.data.attempt_count ?? 0) + 1;
    const updated = await supabase
      .from("notification_deliveries")
      .update({
        status: "sending",
        attempt_count: attemptCount,
        request_payload: input.requestPayload,
        provider_response: {},
        error_message: null,
      })
      .eq("id", existing.data.id)
      .select("id")
      .single();
    if (updated.error) throw updated.error;
    return { id: updated.data.id as string, shouldSend: true, deduped: false };
  }

  const inserted = await supabase
    .from("notification_deliveries")
    .insert({
      agency_id: input.agencyId,
      project_id: input.projectId ?? null,
      action: input.action,
      idempotency_key: input.idempotencyKey,
      status: "sending",
      request_payload: input.requestPayload,
    })
    .select("id")
    .single();

  if (inserted.error) {
    if ((inserted.error as any).code === "23505") {
      return beginEmailDelivery(supabase, input);
    }
    throw inserted.error;
  }

  return { id: inserted.data.id as string, shouldSend: true, deduped: false };
}

async function markEmailDeliverySent(
  supabase: ReturnType<typeof createClient>,
  deliveryId: string,
  providerResponse: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("notification_deliveries")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_response: providerResponse,
      error_message: null,
    })
    .eq("id", deliveryId);
  if (error) throw error;
}

async function markEmailDeliveryFailed(
  supabase: ReturnType<typeof createClient>,
  deliveryId: string,
  errorMessage: string,
  providerResponse: Record<string, unknown> = {},
) {
  const { error } = await supabase
    .from("notification_deliveries")
    .update({
      status: "failed",
      error_message: errorMessage.slice(0, 1000),
      provider_response: providerResponse,
    })
    .eq("id", deliveryId);
  if (error) throw error;
}

async function markEmailDeliverySkipped(
  supabase: ReturnType<typeof createClient>,
  input: {
    agencyId: string;
    projectId?: string | null;
    action: string;
    idempotencyKey: string;
    requestPayload: Record<string, unknown>;
    reason: string;
  },
) {
  const delivery = await beginEmailDelivery(supabase, input);
  if (!delivery.shouldSend) return { deduped: true };
  const { error } = await supabase
    .from("notification_deliveries")
    .update({
      status: "skipped",
      provider_response: { reason: input.reason },
      error_message: null,
    })
    .eq("id", delivery.id);
  if (error) throw error;
  return { deduped: false };
}

async function sendEmailOnce(
  supabase: ReturnType<typeof createClient>,
  input: {
    agencyId: string;
    projectId?: string | null;
    action: string;
    idempotencyKey: string;
    requestPayload: Record<string, unknown>;
    from: string;
    to: string[];
    subject: string;
    html: string;
  },
) {
  const recipients = uniqueEmails(input.to);
  if (recipients.length === 0) {
    const skipped = await markEmailDeliverySkipped(supabase, {
      agencyId: input.agencyId,
      projectId: input.projectId,
      action: input.action,
      idempotencyKey: input.idempotencyKey,
      requestPayload: input.requestPayload,
      reason: "no_valid_recipient",
    });
    return { success: true, skipped: true, deduped: skipped.deduped };
  }

  const delivery = await beginEmailDelivery(supabase, input);
  if (!delivery.shouldSend) {
    return { success: true, skipped: false, deduped: true };
  }

  if (!RESEND_API_KEY) {
    await markEmailDeliveryFailed(supabase, delivery.id, "RESEND_API_KEY is not configured");
    throw new Error("RESEND_API_KEY is not configured");
  }

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: recipients,
      subject: input.subject,
      html: input.html,
    }),
  });

  const providerResponse = await parseProviderResponse(emailResponse);
  if (!emailResponse.ok) {
    const message = typeof providerResponse.body === "string"
      ? providerResponse.body
      : `Resend returned ${emailResponse.status}`;
    await markEmailDeliveryFailed(supabase, delivery.id, message, {
      status: emailResponse.status,
      ...providerResponse,
    });
    console.error("Failed to send email:", providerResponse);
    throw new Error("Failed to send email notification");
  }

  await markEmailDeliverySent(supabase, delivery.id, {
    status: emailResponse.status,
    ...providerResponse,
  });

  return { success: true, skipped: false, deduped: false };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const request: NotificationRequest = await req.json();
    const { contentType, contentId, contentTitle, clientId, action, comment, asset_id, approver_id, project_id } = request;

    console.log("Processing approval notification:", { contentType, contentId, action, asset_id, project_id });

    // Handle project approval notifications
    if (project_id) {
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('title, client_id, agency_id, clients(name, email, portal_slug)')
        .eq('id', project_id)
        .single();

      if (projectError) throw projectError;

      const client = (project.clients as any);
      const agencyId = project.agency_id;

      // Get agency branding
      const { data: branding } = await supabase
        .from('agency_branding')
        .select('email_sender_name, email_footer')
        .eq('agency_id', agencyId)
        .single();

      // Get agency owner/team for notification
      const { data: agency } = await supabase
        .from('agencies')
        .select('user_id')
        .eq('id', agencyId)
        .single();

      if (!agency) throw new Error('Agency not found');

      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', agency.user_id)
        .single();

      if (!ownerProfile?.email) throw new Error('Agency owner email not found');

      const senderName = branding?.email_sender_name || 'SMMAHUB';

      let subject: string;
      let heading: string;
      let bodyText: string;
      let ctaText: string | undefined;
      let ctaUrl: string | undefined;
      let recipients: string[] = [ownerProfile.email];

      if (action === 'approved') {
        subject = `Client approved: ${project.title}`;
        heading = "Content Approved by Client! 🎉";
        bodyText = `
          <p>Hi ${ownerProfile.full_name || 'there'},</p>
          <p>Great news! Your client <strong>${client.name}</strong> has approved the project:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Project:</strong> ${project.title}</p>
            <p style="margin: 5px 0;"><strong>Client:</strong> ${client.name}</p>
            ${comment ? `<p style="margin: 5px 0;"><strong>Comment:</strong> ${comment}</p>` : ''}
          </div>
          <p>The project is now ready for scheduling and publishing.</p>
        `;
      } else if (action === 'changes_requested') {
        subject = `Changes requested: ${project.title}`;
        heading = "Client Requested Changes";
        bodyText = `
          <p>Hi ${ownerProfile.full_name || 'there'},</p>
          <p>Your client <strong>${client.name}</strong> has requested changes to the project:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Project:</strong> ${project.title}</p>
            <p style="margin: 5px 0;"><strong>Client:</strong> ${client.name}</p>
            <p style="margin: 5px 0;"><strong>Feedback:</strong> ${comment || 'No specific feedback provided'}</p>
          </div>
          <p>The project has been moved back to production. Please review the feedback and make the necessary adjustments.</p>
        `;
      } else if (action === 'approval_reminder') {
        const { data: clientUsers } = await supabase
          .from('client_users')
          .select('email')
          .eq('client_id', project.client_id);

        recipients = uniqueEmails([
          client.email,
          ...((clientUsers ?? []) as Array<{ email?: string | null }>).map((user) => user.email),
        ]);

        const portalSlug = typeof client?.portal_slug === "string" && client.portal_slug.trim()
          ? `/${client.portal_slug.trim()}`
          : "";

        subject = `Reminder: ${project.title} is waiting for review`;
        heading = "Content Waiting for Review";
        bodyText = `
          <p>Hello,</p>
          <p>Your agency has a project ready for your review:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Project:</strong> ${project.title}</p>
            <p style="margin: 5px 0;"><strong>Client:</strong> ${client.name}</p>
          </div>
          <p>Please approve it or request changes so the campaign can keep moving.</p>
        `;
        ctaText = "Review content";
        ctaUrl = `${PUBLIC_URL}/client/portal${portalSlug}/approvals`;
      } else {
        throw new Error('Invalid action type for project approval');
      }

      const htmlContent = generateWhiteLabelEmail(
        branding,
        subject,
        heading,
        bodyText,
        ctaText,
        ctaUrl
      );

      const idempotencyKey = request.idempotency_key ?? buildApprovalNotificationIdempotencyKey({
        action,
        projectId: project_id,
      });

      const delivery = await sendEmailOnce(supabase, {
        agencyId,
        projectId: project_id,
        action,
        idempotencyKey,
        requestPayload: request as unknown as Record<string, unknown>,
        from: `${senderName} <notifications@smmahub.net>`,
        to: recipients,
        subject,
        html: htmlContent,
      });

      return new Response(
        JSON.stringify({ success: true, ...delivery, idempotency_key: idempotencyKey }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

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

      const idempotencyKey = request.idempotency_key ?? buildApprovalNotificationIdempotencyKey({
        action,
        assetId: asset_id,
      });

      const delivery = await sendEmailOnce(supabase, {
        agencyId,
        action,
        idempotencyKey,
        requestPayload: request as unknown as Record<string, unknown>,
        from: `${senderName} <notifications@smmahub.net>`,
        to: [recipientEmail],
        subject,
        html: htmlContent,
      });

      return new Response(
        JSON.stringify({ success: true, ...delivery, idempotency_key: idempotencyKey }),
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

    const idempotencyKey = request.idempotency_key ?? buildApprovalNotificationIdempotencyKey({
      action,
      contentType,
      contentId,
      clientId,
    });

    const delivery = await sendEmailOnce(supabase, {
      agencyId: client.agency_id,
      action,
      idempotencyKey,
      requestPayload: request as unknown as Record<string, unknown>,
      from: `${senderName} <onboarding@resend.dev>`,
      to: [recipientEmail],
      subject,
      html: htmlContent,
    });

    return new Response(
      JSON.stringify({ success: true, ...delivery, idempotency_key: idempotencyKey }),
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

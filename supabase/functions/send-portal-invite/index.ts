import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateWhiteLabelEmail(
  branding: any,
  heading: string,
  body: string,
  ctaText: string,
  ctaUrl: string
): string {
  const primaryColor = branding?.primary_color || '#4E5DFF';
  const logo = branding?.logo_url || '';
  const senderName = branding?.email_sender_name || 'SMMAHUB';
  const footer = branding?.email_footer || '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: ${primaryColor}; padding: 40px 20px; border-radius: 12px 12px 0 0; text-align: center;">
          ${logo ? `<img src="${logo}" alt="${senderName}" style="max-width: 150px; height: auto; margin-bottom: 20px;">` : ''}
          <h1 style="color: white; margin: 0; font-size: 28px;">${heading}</h1>
        </div>
        
        <div style="background: #ffffff; padding: 40px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="font-size: 16px; color: #333; line-height: 1.6; margin-bottom: 30px;">
            ${body}
          </div>
          
          <div style="text-align: center; margin: 40px 0;">
            <a href="${ctaUrl}" 
               style="background: ${primaryColor}; 
                      color: white; 
                      padding: 16px 40px; 
                      text-decoration: none; 
                      border-radius: 8px; 
                      font-weight: 600;
                      display: inline-block;
                      box-shadow: 0 4px 12px rgba(78, 93, 255, 0.3);">
              ${ctaText}
            </a>
          </div>
          
          <p style="font-size: 13px; color: #555; text-align: center; margin: 0 0 20px 0; word-break: break-all;">
            Or copy and paste this link into your browser:<br />
            <a href="${ctaUrl}" style="color: ${primaryColor}; text-decoration: underline;">${ctaUrl}</a>
          </p>
          
          ${footer ? `
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;" />
            <div style="font-size: 14px; color: #666; margin-bottom: 20px;">
              ${footer}
            </div>
          ` : ''}
          
          <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
            © ${new Date().getFullYear()} ${senderName}. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

interface PortalInviteRequest {
  email: string;
  clientName: string;
  portalUrl: string;
  agencyName: string;
  agencyId: string;
  inviterName: string;
  temporaryPassword?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      email, 
      clientName, 
      portalUrl, 
      agencyName,
      agencyId,
      inviterName,
      temporaryPassword 
    }: PortalInviteRequest = await req.json();

    // Fetch agency branding
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    const { data: branding } = await supabaseClient
      .from('agency_branding')
      .select('logo_url, email_sender_name, primary_color, email_footer')
      .eq('agency_id', agencyId)
      .maybeSingle();

    const senderName = branding?.email_sender_name || 'SMMAHUB';

    const passwordSection = temporaryPassword 
      ? `
        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #ffc107;">
          <p style="font-size: 14px; color: #856404; margin: 0 0 10px 0; font-weight: 600;">
            Your temporary login credentials:
          </p>
          <p style="font-size: 14px; color: #856404; margin: 0;">
            <strong>Email:</strong> ${email}<br>
            <strong>Password:</strong> <code style="background: #ffe69c; padding: 4px 8px; border-radius: 4px;">${temporaryPassword}</code>
          </p>
          <p style="font-size: 12px; color: #856404; margin: 10px 0 0 0;">
            Please change your password after your first login.
          </p>
        </div>
      `
      : '';

    const emailHtml = generateWhiteLabelEmail(
      branding,
      'Welcome to Your Client Portal',
      `
        <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hi there! 👋</p>
        <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
          <strong>${inviterName}</strong> from <strong>${agencyName}</strong> has granted you access to the <strong>${clientName}</strong> client portal.
        </p>
        <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
          Through your portal, you can:
        </p>
        <ul style="font-size: 15px; color: #555; line-height: 1.8; margin-bottom: 30px;">
          <li>View your brand assets and guidelines</li>
          <li>Upload new assets and files</li>
          <li>Track content ideas and campaigns</li>
          <li>Review your social media profiles</li>
          <li>Collaborate with your agency team</li>
        </ul>
        ${passwordSection}
      `,
      'Access Your Portal',
      portalUrl
    );

    const emailResponse = await resend.emails.send({
      from: `${senderName} <invites@smmahub.net>`,
      to: [email],
      subject: `Access Your Client Portal - ${clientName}`,
      html: emailHtml,
    });

    console.log("Client portal invitation email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending client portal invitation email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

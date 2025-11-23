import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PortalInviteRequest {
  email: string;
  clientName: string;
  portalUrl: string;
  agencyName: string;
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
      inviterName,
      temporaryPassword 
    }: PortalInviteRequest = await req.json();

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

    const emailResponse = await resend.emails.send({
      from: "SMMAHUB <onboarding@resend.dev>",
      to: [email],
      subject: `Access Your Client Portal - ${clientName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #4E5DFF 0%, #6A73FF 100%); padding: 40px 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Your Client Portal</h1>
          </div>
          
          <div style="background: #ffffff; padding: 40px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="font-size: 16px; color: #333; line-height: 1.6; margin-bottom: 20px;">
              Hi there! 👋
            </p>
            
            <p style="font-size: 16px; color: #333; line-height: 1.6; margin-bottom: 20px;">
              <strong>${inviterName}</strong> from <strong>${agencyName}</strong> has granted you access to the <strong>${clientName}</strong> client portal on SMMAHUB.
            </p>
            
            <p style="font-size: 16px; color: #333; line-height: 1.6; margin-bottom: 30px;">
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
            
            <div style="text-align: center; margin: 40px 0;">
              <a href="${portalUrl}" 
                 style="background: linear-gradient(135deg, #4E5DFF 0%, #6A73FF 100%); 
                        color: white; 
                        padding: 16px 40px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        font-weight: 600;
                        display: inline-block;
                        box-shadow: 0 4px 12px rgba(78, 93, 255, 0.3);">
                Access Your Portal
              </a>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 30px;">
              <p style="font-size: 14px; color: #666; margin: 0; line-height: 1.6;">
                <strong>Portal URL:</strong><br>
                <a href="${portalUrl}" style="color: #4E5DFF; text-decoration: none;">${portalUrl}</a>
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;" />
            
            <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
              © ${new Date().getFullYear()} SMMAHUB. All rights reserved.
            </p>
          </div>
        </div>
      `,
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

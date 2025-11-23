import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TeamInviteRequest {
  email: string;
  inviteToken: string;
  agencyName: string;
  role: string;
  inviterName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, inviteToken, agencyName, role, inviterName }: TeamInviteRequest = await req.json();

    const appUrl = Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".lovableproject.com") || "http://localhost:5173";
    const inviteUrl = `${appUrl}/invite/${inviteToken}`;

    const emailResponse = await resend.emails.send({
      from: "SMMAHUB <onboarding@resend.dev>",
      to: [email],
      subject: `You're invited to join ${agencyName} on SMMAHUB`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #4E5DFF 0%, #6A73FF 100%); padding: 40px 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">You're Invited!</h1>
          </div>
          
          <div style="background: #ffffff; padding: 40px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="font-size: 16px; color: #333; line-height: 1.6; margin-bottom: 20px;">
              Hi there! 👋
            </p>
            
            <p style="font-size: 16px; color: #333; line-height: 1.6; margin-bottom: 20px;">
              <strong>${inviterName}</strong> has invited you to join <strong>${agencyName}</strong> as a <strong>${role}</strong> on SMMAHUB.
            </p>
            
            <p style="font-size: 16px; color: #333; line-height: 1.6; margin-bottom: 30px;">
              SMMAHUB is a comprehensive platform for managing social media marketing agencies, clients, and content workflows.
            </p>
            
            <div style="text-align: center; margin: 40px 0;">
              <a href="${inviteUrl}" 
                 style="background: linear-gradient(135deg, #4E5DFF 0%, #6A73FF 100%); 
                        color: white; 
                        padding: 16px 40px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        font-weight: 600;
                        display: inline-block;
                        box-shadow: 0 4px 12px rgba(78, 93, 255, 0.3);">
                Accept Invitation
              </a>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 30px;">
              <p style="font-size: 14px; color: #666; margin: 0; line-height: 1.6;">
                <strong>Note:</strong> This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
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

    console.log("Team invitation email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending team invitation email:", error);
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

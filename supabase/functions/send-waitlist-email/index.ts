import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WaitlistEmailRequest {
  email: string;
  name: string;
  agencySize?: string;
  painPoint?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, agencySize, painPoint }: WaitlistEmailRequest = await req.json();

    console.log("Sending waitlist confirmation email to:", email);

    // Send email via Brevo API v3
    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY || "",
      },
      body: JSON.stringify({
        sender: {
          name: "SMMAHUB",
          email: "hello@smmahub.com",
        },
        to: [
          {
            email: email,
            name: name,
          },
        ],
        subject: "Welcome to SMMAHUB Waitlist! 🎉",
        htmlContent: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to SMMAHUB</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                    <!-- Header -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #4E5DFF 0%, #6A73FF 100%); padding: 40px 30px; text-align: center;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">
                          Welcome to SMMAHUB! 🎉
                        </h1>
                        <p style="margin: 12px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">
                          You're on the list for early access
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px 30px;">
                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                          Hi ${name},
                        </p>
                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                          Thanks for joining the SMMAHUB waitlist! We're excited to have you on board as we prepare to launch on <strong>December 23rd</strong>.
                        </p>
                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                          As a waitlist member, you'll get:
                        </p>
                        <ul style="margin: 0 0 20px 0; padding-left: 20px; font-size: 16px; line-height: 1.8; color: #333333;">
                          <li><strong>Early access</strong> to the platform before general availability</li>
                          <li><strong>20% lifetime discount</strong> on any paid plan</li>
                          <li>Priority onboarding support</li>
                          <li>First look at new features</li>
                        </ul>
                        ${agencySize ? `
                        <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #666666; padding: 16px; background-color: #f8f9fa; border-radius: 8px;">
                          <strong>Agency Size:</strong> ${agencySize}<br>
                          ${painPoint ? `<strong>Biggest Pain Point:</strong> ${painPoint}` : ''}
                        </p>
                        ` : ''}
                        <p style="margin: 30px 0 0 0; font-size: 16px; line-height: 1.6; color: #333333;">
                          We'll send you an email as soon as SMMAHUB launches. Get ready to transform your social media agency workflow!
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 30px; background-color: #f8f9fa; text-align: center; border-top: 1px solid #e0e0e0;">
                        <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
                          Stay connected with us
                        </p>
                        <p style="margin: 0; font-size: 12px; color: #999999;">
                          © ${new Date().getFullYear()} SMMAHUB. All rights reserved.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      }),
    });

    if (!brevoResponse.ok) {
      const errorData = await brevoResponse.text();
      console.error("Brevo API error:", errorData);
      throw new Error(`Brevo API error: ${brevoResponse.status} - ${errorData}`);
    }

    const result = await brevoResponse.json();
    console.log("Email sent successfully via Brevo:", result);

    return new Response(
      JSON.stringify({ success: true, messageId: result.messageId }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-waitlist-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

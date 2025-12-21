import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// These must be configured in the target backend environment.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const ALLOWED_ROLES = new Set(["owner", "admin", "manager"]);
const ALLOWED_ORIGINS = [
  "http://localhost:8080",
  "http://localhost:3000",
  "http://localhost:5173",
  "https://smmahub.net",
  "https://app.smmahub.net",
  "https://app.smmahub.com",
  "https://smmahub.com",
];

function buildCorsHeaders(req: Request): { allowed: boolean; headers: Record<string, string> } {
  const origin = req.headers.get("origin") ?? "";
  const requestedHeaders = req.headers.get("access-control-request-headers") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin);
  const allowOrigin = allowed ? origin : "";

  return {
    allowed,
    headers: {
      ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin } : {}),
      "Access-Control-Allow-Headers": requestedHeaders || "authorization, content-type, apikey, x-client-info",
      // Keep methods explicit
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin, Access-Control-Request-Headers",
    },
  };
}

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
  portalUrl?: string;
  agencyName: string;
  agencyId: string;
  inviterName: string;
  clientId?: string;
  fullName?: string;
  role?: "client" | "approver" | "viewer";
  inviteToken?: string;
  portalBaseUrl?: string;
  temporaryPassword?: string;
}

Deno.serve(async (req) => {
  const { allowed, headers: baseCors } = buildCorsHeaders(req);
  const headers = { ...baseCors, "Content-Type": "application/json" };

  if (!allowed) {
    return new Response(JSON.stringify({ success: false, error: "Origin not allowed" }), {
      status: 403,
      headers,
    });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers,
      });
    }

    const accessToken = authHeader.replace(/bearer\s+/i, "");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      console.error("Missing backend env vars", {
        hasUrl: Boolean(SUPABASE_URL),
        hasServiceRole: Boolean(SUPABASE_SERVICE_ROLE_KEY),
        hasAnon: Boolean(SUPABASE_ANON_KEY),
      });
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Server is missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY.",
        }),
        { status: 500, headers },
      );
    }

    // Auth client uses user's access token; admin client bypasses RLS for privileged reads/writes.
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers,
      });
    }

    const {
      email,
      clientName,
      portalUrl,
      agencyName,
      agencyId,
      inviterName,
      clientId,
      fullName,
      role = "client",
      inviteToken,
      portalBaseUrl,
      temporaryPassword,
    }: PortalInviteRequest = await req.json();

    if (!agencyId) {
      return new Response(JSON.stringify({ success: false, error: "agencyId is required" }), {
        status: 400,
        headers,
      });
    }

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("agency_members")
      .select("id, role, agency_id")
      .eq("agency_id", agencyId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      console.error("Error fetching membership:", membershipError);
      return new Response(JSON.stringify({ success: false, error: "Failed to verify membership" }), {
        status: 500,
        headers,
      });
    }

    if (!membership || !ALLOWED_ROLES.has(membership.role)) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403,
        headers,
      });
    }

    if (!clientId) {
      return new Response(JSON.stringify({ success: false, error: "clientId is required" }), {
        status: 400,
        headers,
      });
    }

    const allowedRoles = ["client", "approver", "viewer"];
    const inviteRole = allowedRoles.includes(role) ? role : "client";

    const token = inviteToken || crypto.randomUUID().replace(/-/g, "");
    const invitePortalUrl =
      portalBaseUrl
        ? `${portalBaseUrl}${portalBaseUrl.includes("?") ? "&" : "?"}token=${token}`
        : portalUrl || "";

    if (!invitePortalUrl) {
      return new Response(JSON.stringify({ success: false, error: "portalUrl is required" }), {
        status: 400,
        headers,
      });
    }

    const { error: inviteError } = await supabaseAdmin.from("client_invites").insert({
      agency_id: agencyId,
      client_id: clientId,
      email,
      full_name: fullName || null,
      role: inviteRole,
      invite_token: token,
    });

    if (inviteError) {
      console.error("Error creating client invite:", inviteError);
      return new Response(JSON.stringify({ success: false, error: "Failed to create invite" }), {
        status: 500,
        headers,
      });
    }

    const { data: branding } = await supabaseAdmin
      .from("agency_branding")
      .select("logo_url, email_sender_name, primary_color, email_footer")
      .eq("agency_id", agencyId)
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
      invitePortalUrl
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
      headers,
    });
  } catch (error: any) {
    console.error("Error sending client portal invitation email:", error);
    const message = error?.message ?? "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers,
    });
  }
});

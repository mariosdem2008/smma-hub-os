import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "npm:@supabase/supabase-js@2";

<<<<<<< HEAD
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// These must be configured in the target backend environment.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
=======
const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";
const SUPABASE_ANON_KEY = Deno.env.get("ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
const FN_VERSION = "send-portal-invite_2025-12-21_1";

const resend = new Resend(resendApiKey);
>>>>>>> 9fb552e (Client Portal fixes)

const ALLOWED_ROLES = new Set(["owner", "admin", "manager"]);
const ALLOWED_INVITE_ROLES = new Set(["client", "approver", "viewer"]);
const ALLOWED_ORIGINS = [
  "http://localhost:8080",
  "http://localhost:3000",
  "http://localhost:5173",
  "https://smmahub.net",
  "https://app.smmahub.net",
  "https://app.smmahub.com",
  "https://smmahub.com",
];

function decodeRoleFromJwt(jwt: string | null | undefined): string | null {
  if (!jwt) return null;
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0))));
    return payload?.role || null;
  } catch {
    return null;
  }
}

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
  ctaUrl: string,
): string {
  const primaryColor = branding?.primary_color || "#4E5DFF";
  const logo = branding?.logo_url || "";
  const senderName = branding?.email_sender_name || "SMMAHUB";
  const footer = branding?.email_footer || "";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: ${primaryColor}; padding: 40px 20px; border-radius: 12px 12px 0 0; text-align: center;">
          ${logo ? `<img src="${logo}" alt="${senderName}" style="max-width: 150px; height: auto; margin-bottom: 20px;">` : ""}
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
          ` : ""}
          
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

  // Env validation
  const missingEnv: string[] = [];
  if (!SUPABASE_URL) missingEnv.push("SUPABASE_URL");
  if (!SUPABASE_SERVICE_ROLE_KEY) missingEnv.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_ANON_KEY) missingEnv.push("SUPABASE_ANON_KEY");
  if (!resendApiKey) missingEnv.push("RESEND_API_KEY");

  if (missingEnv.length > 0) {
    console.error("E00_ENV missing env vars:", missingEnv);
    return new Response(
      JSON.stringify({ success: false, code: "E00_ENV", error: "Missing env vars", missingEnv, v: FN_VERSION }),
      { status: 500, headers },
    );
  }

  const anonRole = decodeRoleFromJwt(SUPABASE_ANON_KEY);
  const serviceRole = decodeRoleFromJwt(SUPABASE_SERVICE_ROLE_KEY);

  console.log("send-portal-invite env:", {
    hasSupabaseUrl: !!SUPABASE_URL,
    usingReservedServiceKey: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    usingCustomServiceKey: !!Deno.env.get("SERVICE_ROLE_KEY"),
    anonRole,
    serviceRole,
  });

  if (!allowed) {
    return new Response(JSON.stringify({ success: false, code: "E403_ORIGIN", error: "Origin not allowed", v: FN_VERSION }), {
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
      return new Response(JSON.stringify({ success: false, code: "E01_AUTH", error: "Unauthorized", v: FN_VERSION }), {
        status: 401,
        headers,
      });
    }

    const accessToken = authHeader.replace(/bearer\s+/i, "");
<<<<<<< HEAD

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
=======
    const supabaseAuthClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const supabaseServiceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
>>>>>>> 9fb552e (Client Portal fixes)
    });

    const {
      data: { user },
      error: userError,
<<<<<<< HEAD
    } = await supabaseAuth.auth.getUser();
=======
    } = await supabaseAuthClient.auth.getUser(accessToken);
>>>>>>> 9fb552e (Client Portal fixes)

    if (userError || !user) {
      console.error("E01_AUTH getUser error:", userError);
      return new Response(JSON.stringify({ success: false, code: "E01_AUTH", error: "Unauthorized", v: FN_VERSION }), {
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

    const normalizedEmail = String(email ?? "").toLowerCase().trim();
    if (!normalizedEmail) {
      return new Response(
        JSON.stringify({ success: false, code: "E400_EMAIL", error: "email is required", v: FN_VERSION }),
        { status: 400, headers },
      );
    }

    if (!agencyId) {
      return new Response(
        JSON.stringify({ success: false, code: "E400_AGENCY_ID", error: "agencyId is required", v: FN_VERSION }),
        { status: 400, headers },
      );
    }

<<<<<<< HEAD
    const { data: membership, error: membershipError } = await supabaseAdmin
=======
    const { data: membership, error: membershipError } = await supabaseServiceClient
>>>>>>> 9fb552e (Client Portal fixes)
      .from("agency_members")
      .select("id, role, agency_id")
      .eq("agency_id", agencyId)
      .eq("user_id", user.id)
<<<<<<< HEAD
      .maybeSingle();

    if (membershipError) {
      console.error("Error fetching membership:", membershipError);
      return new Response(JSON.stringify({ success: false, error: "Failed to verify membership" }), {
        status: 500,
        headers,
=======
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      console.error("E02_MEMBERSHIP supabase error:", {
        message: membershipError.message,
        code: (membershipError as any).code,
        details: (membershipError as any).details,
        hint: (membershipError as any).hint,
>>>>>>> 9fb552e (Client Portal fixes)
      });
      return new Response(
        JSON.stringify({
          success: false,
          code: "E02_MEMBERSHIP",
          error: "Failed to verify membership",
          debug: {
            message: (membershipError as any)?.message,
            code: (membershipError as any)?.code,
            details: (membershipError as any)?.details,
            hint: (membershipError as any)?.hint,
          },
          v: FN_VERSION,
        }),
        { status: 500, headers },
      );
    }

    if (!membership || !ALLOWED_ROLES.has(membership.role)) {
      return new Response(JSON.stringify({ success: false, code: "E403_ROLE", error: "Forbidden", v: FN_VERSION }), {
        status: 403,
        headers,
      });
    }

    if (!clientId) {
      return new Response(
        JSON.stringify({ success: false, code: "E400_CLIENT_ID", error: "clientId is required", v: FN_VERSION }),
        { status: 400, headers },
      );
    }

    const inviteRole = ALLOWED_INVITE_ROLES.has(role) ? role : "client";

    const token = inviteToken || crypto.randomUUID().replace(/-/g, "");
    const invitePortalUrl =
      portalBaseUrl && portalBaseUrl.length > 0
        ? `${portalBaseUrl}${portalBaseUrl.includes("?") ? "&" : "?"}token=${token}`
        : portalUrl || "";

    if (!invitePortalUrl) {
      return new Response(
        JSON.stringify({ success: false, code: "E400_PORTAL_URL", error: "portalUrl is required", v: FN_VERSION }),
        { status: 400, headers },
      );
    }

    // Duplicate check: pending, unexpired
    const { data: existingInvite, error: dupError } = await supabaseServiceClient
      .from("client_invites")
      .select("id, expires_at, accepted")
      .eq("client_id", clientId)
      .eq("email", normalizedEmail)
      .eq("accepted", false)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (dupError) {
      console.error("E03_DUP_CHECK error:", dupError);
      return new Response(JSON.stringify({ success: false, code: "E03_DUP_CHECK", error: "Failed duplicate check", v: FN_VERSION }), {
        status: 500,
        headers,
      });
    }

<<<<<<< HEAD
    const { error: inviteError } = await supabaseAdmin.from("client_invites").insert({
=======
    if (existingInvite) {
      return new Response(
        JSON.stringify({ success: false, code: "E05_DUPLICATE", error: "Pending invite already exists", v: FN_VERSION }),
        { status: 409, headers },
      );
    }

    const { error: inviteError } = await supabaseServiceClient.from("client_invites").insert({
>>>>>>> 9fb552e (Client Portal fixes)
      agency_id: agencyId,
      client_id: clientId,
      email: normalizedEmail,
      full_name: fullName || null,
      role: inviteRole,
      invite_token: token,
    });

    if (inviteError) {
      console.error("E03_INVITE_INSERT error:", inviteError);
      return new Response(
        JSON.stringify({ success: false, code: "E03_INVITE_INSERT", error: "Failed to create invite", v: FN_VERSION }),
        { status: 500, headers },
      );
    }

<<<<<<< HEAD
    const { data: branding } = await supabaseAdmin
=======
    const { data: branding, error: brandingError } = await supabaseServiceClient
>>>>>>> 9fb552e (Client Portal fixes)
      .from("agency_branding")
      .select("logo_url, email_sender_name, primary_color, email_footer")
      .eq("agency_id", agencyId)
      .maybeSingle();

    if (brandingError) {
      console.error("E06_BRANDING error:", brandingError);
    }

    const senderName = branding?.email_sender_name || "SMMAHUB";

    const passwordSection = temporaryPassword
      ? `
        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #ffc107;">
          <p style="font-size: 14px; color: #856404; margin: 0 0 10px 0; font-weight: 600;">
            Your temporary login credentials:
          </p>
          <p style="font-size: 14px; color: #856404; margin: 0;">
            <strong>Email:</strong> ${normalizedEmail}<br>
            <strong>Password:</strong> <code style="background: #ffe69c; padding: 4px 8px; border-radius: 4px;">${temporaryPassword}</code>
          </p>
          <p style="font-size: 12px; color: #856404; margin: 10px 0 0 0;">
            Please change your password after your first login.
          </p>
        </div>
      `
      : "";

    const emailHtml = generateWhiteLabelEmail(
      branding,
      "Welcome to Your Client Portal",
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
      "Access Your Portal",
      invitePortalUrl,
    );

    try {
      const emailResponse = await resend.emails.send({
        from: `${senderName} <invites@smmahub.net>`,
        to: [normalizedEmail],
        subject: `Access Your Client Portal - ${clientName}`,
        html: emailHtml,
      });

      console.log("Client portal invitation email sent successfully:", emailResponse);

      return new Response(JSON.stringify({ success: true, data: emailResponse, invite_token: token, v: FN_VERSION }), {
        status: 200,
        headers,
      });
    } catch (emailError: any) {
      console.error("E04_RESEND error:", emailError);
      return new Response(
        JSON.stringify({
          success: false,
          code: "E04_RESEND",
          error: emailError?.message ?? "Failed to send email",
          invite_token: token,
          v: FN_VERSION,
        }),
        { status: 502, headers },
      );
    }
  } catch (error: any) {
    console.error("E99_UNKNOWN error:", error);
    const message = error?.message ?? "Unknown error";
    return new Response(JSON.stringify({ success: false, code: "E99_UNKNOWN", error: message, v: FN_VERSION }), {
      status: 500,
      headers,
    });
  }
});

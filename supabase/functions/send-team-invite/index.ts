import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PUBLIC_URL } from "../_shared/env.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TeamInviteRequest {
  inviteToken?: string;
  invite_token?: string;
  resend?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: TeamInviteRequest = await req.json();
    const inviteToken = body.inviteToken ?? body.invite_token;
    const allowResend = body.resend ?? false;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          code: "E00_ENV",
          error: "Missing Supabase env vars",
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (!inviteToken || typeof inviteToken !== "string") {
      return new Response(
        JSON.stringify({ success: false, code: "E400_TOKEN", error: "inviteToken is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      return new Response(
        JSON.stringify({ success: false, code: "E401_AUTH", error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
    const accessToken = authHeader.replace(/bearer\s+/i, "");

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    });

    const { data: authUser, error: authError } = await anonClient.auth.getUser();
    if (authError || !authUser?.user) {
      return new Response(
        JSON.stringify({ success: false, code: "E401_AUTH", error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { data: invite, error: inviteError } = await serviceClient
      .from("agency_invites")
      .select("id, agency_id, email, role, expires_at, accepted")
      .eq("token", inviteToken)
      .maybeSingle();

    if (inviteError || !invite) {
      return new Response(
        JSON.stringify({ success: false, code: "E404_INVITE", error: "Invite not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { data: agency } = await serviceClient
      .from("agencies")
      .select("id, name, user_id")
      .eq("id", invite.agency_id)
      .single();

    if (!agency) {
      return new Response(
        JSON.stringify({ success: false, code: "E404_AGENCY", error: "Agency not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (invite.accepted) {
      return new Response(
        JSON.stringify({ success: false, code: "E409_ACCEPTED", error: "Invite already accepted" }),
        { status: 409, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (invite.expires_at && new Date(invite.expires_at) <= new Date()) {
      return new Response(
        JSON.stringify({ success: false, code: "E410_EXPIRED", error: "Invite expired" }),
        { status: 410, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { data: inviterMembership } = await serviceClient
      .from("agency_members")
      .select("role")
      .eq("agency_id", invite.agency_id)
      .eq("user_id", authUser.user.id)
      .maybeSingle();

    const allowedRoles = new Set(["owner", "admin", "manager"]);
    if (!inviterMembership || !allowedRoles.has(inviterMembership.role)) {
      return new Response(
        JSON.stringify({ success: false, code: "E403_ROLE", error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { data: sub } = await serviceClient
      .from("subscriptions")
      .select("plan_type")
      .eq("user_id", agency.user_id)
      .maybeSingle();
    const plan = sub?.plan_type || "free";
    if (plan === "free") {
      return new Response(
        JSON.stringify({ success: false, code: "PLAN_REQUIRED", error: "Upgrade required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

    const { count: agencyCount } = await serviceClient
      .from("agency_invite_email_logs")
      .select("*", { count: "exact", head: true })
      .eq("agency_id", invite.agency_id)
      .gt("sent_at", tenMinutesAgo);
    if ((agencyCount ?? 0) >= 10) {
      return new Response(
        JSON.stringify({ success: false, code: "E429_AGENCY", error: "Rate limit exceeded for agency" }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { count: inviterCount } = await serviceClient
      .from("agency_invite_email_logs")
      .select("*", { count: "exact", head: true })
      .eq("inviter_user_id", authUser.user.id)
      .gt("sent_at", tenMinutesAgo);
    if ((inviterCount ?? 0) >= 5) {
      return new Response(
        JSON.stringify({ success: false, code: "E429_INVITER", error: "Rate limit exceeded for inviter" }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (!allowResend) {
      const { data: existingLog } = await serviceClient
        .from("agency_invite_email_logs")
        .select("id")
        .eq("invite_id", invite.id)
        .maybeSingle();
      if (existingLog) {
        return new Response(
          JSON.stringify({ success: false, code: "E409_SENT", error: "Invite email already sent" }),
          { status: 409, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }
    }

    const { data: inviterProfile } = await serviceClient
      .from("profiles")
      .select("full_name, email")
      .eq("id", authUser.user.id)
      .maybeSingle();
    const inviterName = inviterProfile?.full_name || inviterProfile?.email || "A team member";

    // Canonical flow: user signs in, then reviews/accepts invites from /invitations.
    // Token links remain an optional shortcut route in the app, but we avoid them in email.
    const inviteUrl = `${PUBLIC_URL}/invitations`;
    const expiryText = invite.expires_at ? new Date(invite.expires_at).toLocaleString() : null;
    const emailResponse = await resend.emails.send({
      from: "SMMAHUB <invites@smmahub.net>",
      to: [invite.email],
      subject: `You're invited to join ${agency.name} on SMMAHUB`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #4E5DFF 0%, #6A73FF 100%); padding: 40px 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">You're Invited!</h1>
          </div>
          
          <div style="background: #ffffff; padding: 40px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="font-size: 16px; color: #333; line-height: 1.6; margin-bottom: 20px;">
              Hi there,
            </p>
            
            <p style="font-size: 16px; color: #333; line-height: 1.6; margin-bottom: 20px;">
              <strong>${inviterName}</strong> has invited you to join <strong>${agency.name}</strong> as a <strong>${invite.role}</strong> on SMMAHUB.
            </p>
            
             <p style="font-size: 16px; color: #333; line-height: 1.6; margin-bottom: 12px;">
               Click the button below to sign in and view your invitation.
             </p>
             ${
               expiryText
                 ? `<p style="font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 30px;">
                      Your invitation expires on ${expiryText}.
                    </p>`
                 : `<div style="height: 18px;"></div>`
             }
            
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
                 View Invitation
               </a>
             </div>
            
            <p style="font-size: 12px; color: #666; text-align: center; margin: 0;">
              If you didn't expect this invitation, you can ignore this email.
            </p>
          </div>
        </div>
      `,
    });

    await serviceClient.from("agency_invite_email_logs").upsert({
      agency_id: invite.agency_id,
      invite_id: invite.id,
      inviter_user_id: authUser.user.id,
      to_email: invite.email,
      ip: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return new Response(
      JSON.stringify({
        success: true,
        messageId: (emailResponse as any)?.id ?? null,
        to: invite.email,
        agency_id: invite.agency_id,
        invite_id: invite.id,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("Error sending team invitation email:", error);
    let code = "E99_UNKNOWN";
    let status = 500;
    return new Response(
      JSON.stringify({ success: false, code, error: error?.message || "Internal error" }),
      { status, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);

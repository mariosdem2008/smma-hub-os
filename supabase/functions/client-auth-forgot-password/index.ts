import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PUBLIC_URL } from "../_shared/env.ts";

Deno.serve(async (req) => {
const origin = req.headers.get("origin");
  const headers = corsHeaders(req)
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const { email, client_id } = await req.json();

    if (!email || !client_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find user
    const { data: user, error: userError } = await supabaseAdmin
      .from("client_users")
      .select("*, clients!inner(name, portal_slug)")
      .eq("email", email)
      .eq("client_id", client_id)
      .single();

    if (userError || !user) {
      // Don't reveal if user exists or not
      return new Response(
        JSON.stringify({ message: "If an account exists, you will receive a password reset email" }),
        { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Generate reset token
    const resetTokenArray = new Uint8Array(32);
    crypto.getRandomValues(resetTokenArray);
    const reset_token = Array.from(resetTokenArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const expires_at = new Date();
    expires_at.setHours(expires_at.getHours() + 24); // 24 hour expiry

    // Save reset token
    await supabaseAdmin
      .from("client_users")
      .update({
        password_reset_token: reset_token,
        password_reset_expires_at: expires_at.toISOString()
      })
      .eq("id", user.id);

    // Send reset email
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const resetUrl = `${PUBLIC_URL}/client/reset-password?token=${reset_token}`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "SMMAHUB <noreply@smmahub.net>",
        to: [email],
        subject: "Reset Your Client Portal Password",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Reset Your Password</h2>
            <p>Hi ${user.full_name || 'there'},</p>
            <p>You requested to reset your password for the ${user.clients?.name || 'client'} portal.</p>
            <p>Click the button below to reset your password:</p>
            <a href="${resetUrl}" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Reset Password</a>
            <p>Or copy this link: ${resetUrl}</p>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      }),
    });

    return new Response(
      JSON.stringify({ message: "If an account exists, you will receive a password reset email" }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Forgot password error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});

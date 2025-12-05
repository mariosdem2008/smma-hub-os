import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = [
  "http://localhost:8080",
  "https://smmahub.net",
  "https://73a2983b-0136-47d2-9a1f-01fe580ac593.lovableproject.com",
  "https://id-preview--73a2983b-0136-47d2-9a1f-01fe580ac593.lovable.app",
];

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  if (!allowedOrigins.includes(origin)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}


const JWT_SECRET = Deno.env.get("CLIENT_PORTAL_JWT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const ACCESS_TOKEN_TTL_SECONDS = 20 * 60; // 20 minutes
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

if (!JWT_SECRET) {
  console.error("CLIENT_PORTAL_JWT_SECRET is not configured");
  throw new Error("CLIENT_PORTAL_JWT_SECRET environment variable is required");
}

interface ClientUser {
  id: string;
  email: string;
  full_name: string | null;
  client_id: string;
  agency_id: string;
  role: string;
}

async function generateAccessToken(user: ClientUser): Promise<{ token: string; exp: number }> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ACCESS_TOKEN_TTL_SECONDS;
  const payload = {
    sub: user.id,
    email: user.email,
    client_id: user.client_id,
    agency_id: user.agency_id,
    role: user.role,
    exp,
  };

  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(JWT_SECRET!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  const token = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;

  return { token, exp };
}

async function generateRefreshToken(): Promise<{ token: string; hash: string; expiresAt: Date }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");

  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

  return { token, hash, expiresAt };
}

function createAuthCookies(accessToken: string, refreshToken: string): string[] {
  const accessCookie =
    `cp_access_token=${accessToken}; Max-Age=${ACCESS_TOKEN_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`;
  const refreshCookie =
    `cp_refresh_token=${refreshToken}; Max-Age=${REFRESH_TOKEN_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`;

  return [accessCookie, refreshCookie];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: {
        ...corsHeaders(req),
      },
    });
  }

  try {
    const { reset_token, new_password } = await req.json();

    if (!reset_token || !new_password) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        },
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find user with valid reset token
    const { data: user, error: userError } = await supabaseAdmin
      .from("client_users")
      .select("*")
      .eq("password_reset_token", reset_token)
      .gt("password_reset_expires_at", new Date().toISOString())
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired reset token" }),
        {
          status: 400,
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        },
      );
    }

    // Hash new password
    const encoder = new TextEncoder();
    const data = encoder.encode(new_password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const password_hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Update password and clear reset token
    await supabaseAdmin
      .from("client_users")
      .update({
        password_hash,
        password_reset_token: null,
        password_reset_expires_at: null,
      })
      .eq("id", user.id);

    const clientUser: ClientUser = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      client_id: user.client_id,
      agency_id: user.agency_id,
      role: user.role,
    };

    // Create refresh token entry
    const { token: refreshToken, hash: refreshHash, expiresAt } = await generateRefreshToken();

    await supabaseAdmin.from("client_refresh_tokens").insert({
      client_user_id: clientUser.id,
      token_hash: refreshHash,
      expires_at: expiresAt.toISOString(),
    });

    // Generate access token
    const { token: accessToken, exp } = await generateAccessToken(clientUser);

    const cookies = createAuthCookies(accessToken, refreshToken);
    const headers = new Headers({
      ...corsHeaders(req),
      "Content-Type": "application/json",
    });
    cookies.forEach((cookie) => headers.append("Set-Cookie", cookie));

    return new Response(
      JSON.stringify({
        user: clientUser,
        exp,
      }),
      { status: 200, headers },
    );
  } catch (error) {
    console.error("Reset password error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});

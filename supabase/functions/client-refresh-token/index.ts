import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = [
  "https://73a2983b-0136-47d2-9a1f-01fe580ac593.lovableproject.com",
  "https://smmahub.net",
];

function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin") ?? "";
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : "";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, apikey, Authorization, X-Requested-With",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function parseCookies(header: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  const parts = header.split(";");
  for (const part of parts) {
    const [name, ...rest] = part.trim().split("=");
    if (!name) continue;
    cookies[name] = rest.join("=");
  }
  return cookies;
}

function createAuthCookies(accessToken: string, refreshToken: string): string[] {
  const accessCookie =
    `cp_access_token=${accessToken}; Max-Age=${ACCESS_TOKEN_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`;
  const refreshCookie =
    `cp_refresh_token=${refreshToken}; Max-Age=${REFRESH_TOKEN_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`;

  return [accessCookie, refreshCookie];
}

function clearAuthCookiesHeaders(req: Request): Headers {
  const headers = new Headers({
    "Content-Type": "application/json",
    ...corsHeaders(req),
  });
  headers.append(
    "Set-Cookie",
    "cp_access_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax",
  );
  headers.append(
    "Set-Cookie",
    "cp_refresh_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax",
  );
  return headers;
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
    const cookieHeader = req.headers.get("Cookie");
    const cookies = parseCookies(cookieHeader);
    const refreshToken = cookies["cp_refresh_token"];

    if (!refreshToken) {
      const headers = clearAuthCookiesHeaders(req);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers,
      });
    }

    const refreshHash = await hashToken(refreshToken);
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find valid refresh token
    const { data: storedToken, error: tokenError } = await supabaseAdmin
      .from("client_refresh_tokens")
      .select("id, client_user_id, expires_at, revoked_at")
      .eq("token_hash", refreshHash)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (tokenError || !storedToken) {
      const headers = clearAuthCookiesHeaders(req);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers,
      });
    }

    // Load user
    const { data: user, error: userError } = await supabaseAdmin
      .from("client_users")
      .select("id, email, full_name, client_id, agency_id, role")
      .eq("id", storedToken.client_user_id)
      .single();

    if (userError || !user) {
      const headers = clearAuthCookiesHeaders(req);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers,
      });
    }

    const clientUser: ClientUser = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      client_id: user.client_id,
      agency_id: user.agency_id,
      role: user.role,
    };

    // Revoke old token
    await supabaseAdmin
      .from("client_refresh_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", storedToken.id);

    // Create new refresh token
    const newBytes = new Uint8Array(32);
    crypto.getRandomValues(newBytes);
    const newRefreshToken = Array.from(newBytes).map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const newRefreshHash = await hashToken(newRefreshToken);
    const newRefreshExpires = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

    await supabaseAdmin.from("client_refresh_tokens").insert({
      client_user_id: clientUser.id,
      token_hash: newRefreshHash,
      expires_at: newRefreshExpires.toISOString(),
    });

    // Generate new access token
    const { token: accessToken, exp } = await generateAccessToken(clientUser);

    const cookiesOut = createAuthCookies(accessToken, newRefreshToken);
    const headers = new Headers({
      "Content-Type": "application/json",
      ...corsHeaders(req),
    });
    cookiesOut.forEach((cookie) => headers.append("Set-Cookie", cookie));

    return new Response(JSON.stringify({ user: clientUser, exp }), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    const headers = clearAuthCookiesHeaders(req);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers,
    });
  }
});

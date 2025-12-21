import { createClient } from "npm:@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { portalCors } from "../_shared/cors_portal.ts";

const JWT_SECRET = Deno.env.get("CLIENT_PORTAL_JWT_SECRET");
const FN_VERSION = "client-auth-login_2025-12-21_3";

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
  const { allowed, headers: cors } = portalCors(req);
  const headers = { ...cors, "Content-Type": "application/json", "X-FN-VERSION": FN_VERSION };

  if (!allowed) {
    return new Response(JSON.stringify({ success: false, code: "E403_ORIGIN", error: "Origin not allowed", v: FN_VERSION }), {
      status: 403,
      headers,
    });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...cors, "X-FN-VERSION": FN_VERSION } });
  }

  try {
    const { email, password, client_id } = await req.json();

    if (!email || !password || !client_id) {
      return new Response(JSON.stringify({ success: false, code: "E400_FIELDS", error: "Missing required fields", v: FN_VERSION }), {
        status: 400,
        headers,
      });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          code: "E00_ENV",
          error: "Missing env vars",
          missingEnv: [
            ...(SUPABASE_URL ? [] : ["SUPABASE_URL"]),
            ...(SUPABASE_SERVICE_ROLE_KEY ? [] : ["SUPABASE_SERVICE_ROLE_KEY"]),
          ],
          v: FN_VERSION,
        }),
        { status: 500, headers },
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    });

    // Find user
    const { data: user, error: userError } = await supabaseAdmin
      .from("client_users")
      .select("id, email, full_name, client_id, agency_id, role, password_hash")
      .eq("email", email)
      .eq("client_id", client_id)
      .single();

    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, code: "E401_INVALID", error: "Invalid email or password", v: FN_VERSION }), {
        status: 401,
        headers,
      });
    }

    // Verify password
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const password_hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    if (password_hash !== user.password_hash) {
      return new Response(JSON.stringify({ success: false, code: "E401_INVALID", error: "Invalid email or password", v: FN_VERSION }), {
        status: 401,
        headers,
      });
    }

    // Update last login
    await supabaseAdmin
      .from("client_users")
      .update({ last_login_at: new Date().toISOString() })
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
    const { token: refreshToken, hash: refreshHash, expiresAt } =
      await generateRefreshToken();

    await supabaseAdmin.from("client_refresh_tokens").insert({
      client_user_id: clientUser.id,
      token_hash: refreshHash,
      expires_at: expiresAt.toISOString(),
    });

    // Generate access token
    const { token: accessToken, exp } = await generateAccessToken(clientUser);

    const cookies = createAuthCookies(accessToken, refreshToken);
    const respHeaders = new Headers(headers);
    cookies.forEach((cookie) => respHeaders.append("Set-Cookie", cookie));

    return new Response(
      JSON.stringify({
        success: true,
        user: clientUser,
        exp,
        v: FN_VERSION,
      }),
      { status: 200, headers: respHeaders },
    );
  } catch (error) {
    console.error("Login error:", error);
    return new Response(JSON.stringify({ success: false, code: "E99_UNKNOWN", error: "Internal server error", v: FN_VERSION }), {
      status: 500,
      headers,
    });
  }
});

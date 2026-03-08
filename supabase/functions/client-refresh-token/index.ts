import { createClient } from "npm:@supabase/supabase-js@2";
import { portalCors } from "../_shared/cors_portal.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

const FN_VERSION = "client-refresh-token_2026-03-07_4";
const CLIENT_PORTAL_JWT_SECRET = Deno.env.get("CLIENT_PORTAL_JWT_SECRET");

const ACCESS_TOKEN_TTL_SECONDS = 20 * 60; // 20 minutes
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

if (!CLIENT_PORTAL_JWT_SECRET) {
  console.warn("[client-refresh-token] Missing CLIENT_PORTAL_JWT_SECRET");
}

interface ClientPortalJwtPayload {
  sub: string;
  email: string;
  client_id: string;
  agency_id: string;
  role: string;
  exp: number;
}

function base64UrlEncode(input: Uint8Array): string {
  let str = "";
  for (const b of input) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncodeJson(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  return base64UrlEncode(bytes);
}

async function hmacSha256Sign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return base64UrlEncode(new Uint8Array(sig));
}

function getCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const cookies = header.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const idx = cookie.indexOf("=");
    if (idx === -1) continue;
    const cookieName = cookie.slice(0, idx);
    const cookieVal = cookie.slice(idx + 1);
    if (cookieName === name) return cookieVal;
  }
  return null;
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function generateAccessToken(payload: Omit<ClientPortalJwtPayload, "exp">): Promise<{ token: string; exp: number }> {
  if (!CLIENT_PORTAL_JWT_SECRET) {
    throw new Error("CLIENT_PORTAL_JWT_SECRET not configured");
  }

  const exp = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS;
  const header = { alg: "HS256", typ: "JWT" };
  const body: ClientPortalJwtPayload = { ...payload, exp };

  const headerB64 = base64UrlEncodeJson(header);
  const payloadB64 = base64UrlEncodeJson(body);
  const signingInput = `${headerB64}.${payloadB64}`;
  const sigB64 = await hmacSha256Sign(CLIENT_PORTAL_JWT_SECRET, signingInput);

  return { token: `${signingInput}.${sigB64}`, exp };
}

Deno.serve(async (req: Request) => {
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

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed", v: FN_VERSION }), {
      status: 405,
      headers,
    });
  }

  try {
    const cookieHeader = req.headers.get("Cookie");
    const refreshToken = getCookie(cookieHeader, "cp_refresh_token");

    if (!refreshToken) {
      return new Response(JSON.stringify({ success: false, error: "No refresh token", v: FN_VERSION }), {
        status: 401,
        headers,
      });
    }

    const refreshHash = await hashToken(refreshToken);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      global: {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    });

    const { data: refreshRow, error: refreshErr } = await supabaseAdmin
      .from("client_refresh_tokens")
      .select("id, client_user_id, expires_at, revoked_at")
      .eq("token_hash", refreshHash)
      .maybeSingle();

    const refreshExpired = refreshRow?.expires_at ? new Date(refreshRow.expires_at).getTime() <= Date.now() : true;
    if (refreshErr || !refreshRow || refreshRow.revoked_at || refreshExpired) {
      return new Response(JSON.stringify({ success: false, error: "Invalid refresh token", v: FN_VERSION }), {
        status: 401,
        headers,
      });
    }

    const { data: clientUser, error: userErr } = await supabaseAdmin
      .from("client_users")
      .select("id,email,full_name,client_id,agency_id,role")
      .eq("id", refreshRow.client_user_id)
      .single();

    if (userErr || !clientUser) {
      return new Response(JSON.stringify({ success: false, error: "User not found", v: FN_VERSION }), {
        status: 404,
        headers,
      });
    }

    const { token: accessToken, exp } = await generateAccessToken({
      sub: clientUser.id,
      email: clientUser.email,
      client_id: clientUser.client_id,
      agency_id: clientUser.agency_id,
      role: clientUser.role,
    });

    const resHeaders = new Headers(headers);
    resHeaders.append(
      "Set-Cookie",
      `cp_access_token=${accessToken}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${ACCESS_TOKEN_TTL_SECONDS}`,
    );
    resHeaders.append(
      "Set-Cookie",
      `cp_refresh_token=${refreshToken}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${REFRESH_TOKEN_TTL_SECONDS}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: clientUser.id,
          email: clientUser.email,
          full_name: clientUser.full_name,
          client_id: clientUser.client_id,
          agency_id: clientUser.agency_id,
          role: clientUser.role,
        },
        exp,
        v: FN_VERSION,
      }),
      { status: 200, headers: resHeaders },
    );
  } catch (error) {
    console.error("[client-refresh-token] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message, v: FN_VERSION }), {
      status: 500,
      headers,
    });
  }
});

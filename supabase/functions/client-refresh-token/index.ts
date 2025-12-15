// supabase/functions/client-refresh-token/index.ts
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

const CLIENT_PORTAL_JWT_SECRET = Deno.env.get("CLIENT_PORTAL_JWT_SECRET");
const CLIENT_PORTAL_JWT_REFRESH_SECRET = Deno.env.get("CLIENT_PORTAL_JWT_REFRESH_SECRET");

if (!CLIENT_PORTAL_JWT_SECRET) {
  console.warn("[client-refresh-token] Missing CLIENT_PORTAL_JWT_SECRET");
}
if (!CLIENT_PORTAL_JWT_REFRESH_SECRET) {
  console.warn("[client-refresh-token] Missing CLIENT_PORTAL_JWT_REFRESH_SECRET");
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

function base64UrlDecodeToBytes(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
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

async function hmacSha256Verify(secret: string, data: string, signatureB64Url: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const sigBytes = base64UrlDecodeToBytes(signatureB64Url);

  return await crypto.subtle.verify(
    "HMAC",
    key,
    new Uint8Array(sigBytes).buffer as ArrayBuffer,
    new TextEncoder().encode(data),
  );
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

// Verify refresh token (JWT HS256)
async function verifyRefreshToken(token: string): Promise<ClientPortalJwtPayload | null> {
  if (!CLIENT_PORTAL_JWT_REFRESH_SECRET) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, sigB64] = parts;

    const signingInput = `${headerB64}.${payloadB64}`;
    const ok = await hmacSha256Verify(CLIENT_PORTAL_JWT_REFRESH_SECRET, signingInput, sigB64);
    if (!ok) return null;

    const payloadJson = new TextDecoder().decode(base64UrlDecodeToBytes(payloadB64));
    const payload: ClientPortalJwtPayload = JSON.parse(payloadJson);

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch (err) {
    console.error("[client-refresh-token] verifyRefreshToken error:", err);
    return null;
  }
}

// Generate new access token (JWT HS256)
async function generateAccessToken(payload: ClientPortalJwtPayload): Promise<{ token: string; exp: number }> {
  if (!CLIENT_PORTAL_JWT_SECRET) {
    throw new Error("CLIENT_PORTAL_JWT_SECRET not configured");
  }

  const exp = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour
  const header = { alg: "HS256", typ: "JWT" };
  const body = { ...payload, exp };

  const headerB64 = base64UrlEncodeJson(header);
  const payloadB64 = base64UrlEncodeJson(body);
  const signingInput = `${headerB64}.${payloadB64}`;
  const sigB64 = await hmacSha256Sign(CLIENT_PORTAL_JWT_SECRET, signingInput);

  return { token: `${signingInput}.${sigB64}`, exp };
}

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req);

  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const cookieHeader = req.headers.get("Cookie");
    const refreshToken = getCookie(cookieHeader, "cp_refresh_token");

    if (!refreshToken) {
      return new Response(JSON.stringify({ error: "No refresh token" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const payload = await verifyRefreshToken(refreshToken);
    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid refresh token" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const { token: accessToken, exp } = await generateAccessToken(payload);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: clientUser, error: userErr } = await supabaseAdmin
      .from("client_users")
      .select("id,email,full_name,client_id,agency_id,role,clients(*)")
      .eq("id", payload.sub)
      .single();

    if (userErr || !clientUser) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const userData = {
      id: clientUser.id,
      email: clientUser.email,
      full_name: clientUser.full_name,
      client_id: clientUser.client_id,
      agency_id: clientUser.agency_id,
      role: clientUser.role,
    };

    const resHeaders = new Headers({
      ...headers,
      "Content-Type": "application/json",
    });

    // IMPORTANT:
    // - SameSite=None requires Secure (true) in browsers.
    // - On localhost over http, Secure cookies may be dropped by the browser.
    // If you’re testing on http://localhost, you may need to set Secure=false OR use https locally.
    const isLocalhost = (req.headers.get("origin") ?? "").includes("localhost");
    const secureAttr = isLocalhost ? "" : " Secure;";

    resHeaders.append(
      "Set-Cookie",
      `cp_access_token=${accessToken}; HttpOnly;${secureAttr} SameSite=None; Path=/; Max-Age=3600`,
    );

    return new Response(JSON.stringify({ user: userData, exp }), {
      status: 200,
      headers: resHeaders,
    });
  } catch (error) {
    console.error("[client-refresh-token] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});

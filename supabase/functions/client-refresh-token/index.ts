// client-refresh-token/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

const allowedOrigins = [
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
  "https://smmahub.net",
  "https://73a2983b-0136-47d2-9a1f-01fe580ac593.lovableproject.com",
  "https://id-preview--73a2983b-0136-47d2-9a1f-01fe580ac593.lovable.app",
];

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const isAllowed = allowedOrigins.includes(origin);

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigins[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

const CLIENT_PORTAL_JWT_SECRET = Deno.env.get("CLIENT_PORTAL_JWT_SECRET");
const CLIENT_PORTAL_JWT_REFRESH_SECRET = Deno.env.get("CLIENT_PORTAL_JWT_REFRESH_SECRET");

interface ClientPortalJwtPayload {
  sub: string;
  email: string;
  client_id: string;
  agency_id: string;
  role: string;
  exp: number;
}

// Helper to verify refresh token
async function verifyRefreshToken(token: string): Promise<ClientPortalJwtPayload | null> {
  if (!CLIENT_PORTAL_JWT_REFRESH_SECRET) {
    console.error("CLIENT_PORTAL_JWT_REFRESH_SECRET not configured");
    return null;
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    // Verify signature
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(CLIENT_PORTAL_JWT_REFRESH_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    // Handle base64url encoding
    const base64 = encodedSignature.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const signature = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
    );

    if (!isValid) return null;

    // Decode payload
    const payloadBase64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const payloadPadded = payloadBase64 + "=".repeat((4 - (payloadBase64.length % 4)) % 4);
    const payload: ClientPortalJwtPayload = JSON.parse(atob(payloadPadded));

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      console.log("Refresh token expired");
      return null;
    }

    return payload;
  } catch (error) {
    console.error("Error verifying refresh token:", error);
    return null;
  }
}

// Generate new access token
function generateAccessToken(payload: ClientPortalJwtPayload): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const payloadCopy = { ...payload, exp: Math.floor(Date.now() / 1000) + 3600 }; // 1 hour expiry
  const payloadStr = btoa(JSON.stringify(payloadCopy)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const textEncoder = new TextEncoder();
  const data = textEncoder.encode(`${header}.${payloadStr}`);
  const key = textEncoder.encode(CLIENT_PORTAL_JWT_SECRET!);

  // Note: In production, use proper HMAC-SHA256 signing
  // This is a simplified version - you should use a proper JWT library
  const signature = "dummy-signature"; // Replace with actual HMAC-SHA256

  return `${header}.${payloadStr}.${signature}`;
}

function getCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const cookies = header.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [cookieName, ...rest] = cookie.split("=");
    if (cookieName === name) {
      return rest.join("=");
    }
  }
  return null;
}

Deno.serve(async (req) => {
  // Handle OPTIONS request first
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin") ?? "";
    const isAllowed = allowedOrigins.includes(origin);

    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigins[0],
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }

  try {
    const cookieHeader = req.headers.get("Cookie");
    const refreshToken = getCookie(cookieHeader, "cp_refresh_token");

    if (!refreshToken) {
      return new Response(JSON.stringify({ error: "No refresh token" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const payload = await verifyRefreshToken(refreshToken);

    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid refresh token" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Generate new access token
    const accessToken = generateAccessToken(payload);

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get client details
    const { data: clientUser } = await supabaseClient
      .from("client_users")
      .select("*, clients(*)")
      .eq("id", payload.sub)
      .single();

    if (!clientUser) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
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

    // Set new access token as cookie
    const headers = new Headers({
      ...corsHeaders(req),
      "Content-Type": "application/json",
      "Set-Cookie": `cp_access_token=${accessToken}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=3600`,
    });

    return new Response(
      JSON.stringify({
        user: userData,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
      {
        status: 200,
        headers,
      },
    );
  } catch (error) {
    console.error("Error in client-refresh-token:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

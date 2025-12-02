import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

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
      headers: corsHeaders(req),
    });
  }

  try {
    console.log("Signup request received");
    const { invite_token, password, full_name } = await req.json();
    console.log("Request data:", {
      invite_token: invite_token?.substring(0, 10),
      has_password: !!password,
      full_name,
    });

    if (!invite_token || !password) {
      console.error("Missing required fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders(req),
          },
        },
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Validate invite token
    console.log("Validating invite token");
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("client_invites")
      .select("*")
      .eq("invite_token", invite_token)
      .eq("accepted", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (inviteError || !invite) {
      console.error("Invalid invite:", inviteError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired invitation" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders(req),
          },
        },
      );
    }
    console.log("Invite validated for email:", invite.email);

    // Check if user already exists
    console.log("Checking for existing user");
    const { data: existingUser } = await supabaseAdmin
      .from("client_users")
      .select("id")
      .eq("email", invite.email)
      .eq("client_id", invite.client_id)
      .single();

    if (existingUser) {
      console.error("User already exists");
      return new Response(
        JSON.stringify({ error: "User already exists" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders(req),
          },
        },
      );
    }
    console.log("No existing user found");

    // Hash password using Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const password_hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Create client user
    console.log("Creating client user");
    const { data: newUser, error: createError } = await supabaseAdmin
      .from("client_users")
      .insert({
        agency_id: invite.agency_id,
        client_id: invite.client_id,
        email: invite.email,
        full_name: full_name || invite.full_name || null,
        role: invite.role,
        password_hash,
        invitation_status: "accepted",
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating user:", createError);
      return new Response(
        JSON.stringify({ error: "Failed to create user", details: createError.message }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders(req),
          },
        },
      );
    }
    console.log("User created successfully:", newUser.id);

    // Mark invite as accepted
    await supabaseAdmin
      .from("client_invites")
      .update({ accepted: true })
      .eq("id", invite.id);

    const clientUser: ClientUser = {
      id: newUser.id,
      email: newUser.email,
      full_name: newUser.full_name,
      client_id: newUser.client_id,
      agency_id: newUser.agency_id,
      role: newUser.role,
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
    const headers = new Headers({
      "Content-Type": "application/json",
      ...corsHeaders(req),
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
    console.error("Signup error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders(req),
        },
      },
    );
  }
});

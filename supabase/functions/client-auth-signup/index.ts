import { createClient } from "npm:@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { portalCors } from "../_shared/cors_portal.ts";

const JWT_SECRET = Deno.env.get("CLIENT_PORTAL_JWT_SECRET");
const FN_VERSION = "client-auth-signup_2025-12-21_5";

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

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function createAuthCookies(accessToken: string, refreshToken: string): string[] {
  const accessCookie =
    `cp_access_token=${accessToken}; Max-Age=${ACCESS_TOKEN_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`;
  const refreshCookie =
    `cp_refresh_token=${refreshToken}; Max-Age=${REFRESH_TOKEN_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`;

  return [accessCookie, refreshCookie];
}

async function ensurePortalSlugAndLink(params: {
  supabaseAdmin: any; // loosen typing for Edge function supabase client
  clientId: string;
  authUserId: string;
  fallbackSlug: string;
}): Promise<string> {
  const { supabaseAdmin, clientId, authUserId, fallbackSlug } = params;

  let finalSlug = fallbackSlug;
  const { data: existingClient } = await supabaseAdmin
    .from("clients")
    .select("portal_slug")
    .eq("id", clientId)
    .single();

  if (!existingClient?.portal_slug) {
    const { data: generatedSlug, error: slugError } = await supabaseAdmin.rpc("generate_portal_slug");

    if (slugError) {
      console.error("E06_SLUG_RPC error:", slugError);
      throw new Error("E06_SLUG_RPC");
    }

    if (typeof generatedSlug === "string" && generatedSlug.length > 0) {
      finalSlug = generatedSlug;
    }
  } else {
    finalSlug = existingClient.portal_slug;
  }

  const { data: clientRow, error: clientUpdateError } = await supabaseAdmin
    .from("clients")
    .update({
      portal_enabled: true,
      portal_slug: finalSlug,
      portal_user_id: authUserId,
    })
    .eq("id", clientId)
    .select("id, portal_slug, portal_user_id")
    .single();

  if (clientUpdateError || !clientRow || clientRow.portal_user_id !== authUserId) {
    console.error("E07_CLIENT_UPDATE error:", clientUpdateError);
    throw new Error("E07_CLIENT_UPDATE");
  }

  return clientRow.portal_slug;
}

async function getOrCreateAuthUserId(params: {
  supabaseAdmin: any;
  email: string;
  password: string;
  clientId: string;
  agencyId: string;
  role: string;
}): Promise<string> {
  const { supabaseAdmin, email, password, clientId, agencyId, role } = params;

  // Try to create first
  const { data: createdAuth, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { client_id: clientId, agency_id: agencyId, role },
  });

  if (createdAuth?.user?.id) {
    return createdAuth.user.id;
  }

  // If already exists, fetch by email
  const status = (authCreateError as any)?.status;
  const message = (authCreateError as any)?.message || authCreateError?.message;
  if (status === 409 || message?.toLowerCase().includes("already")) {
    const { data: existingAuth, error: authLookupError } = await supabaseAdmin.auth.admin.getUserByEmail(email);

    if (authLookupError) {
      console.error("E04_AUTH_LOOKUP auth user lookup failed:", authLookupError);
      throw new Error(
        JSON.stringify({
          code: "E04_AUTH_LOOKUP",
          error: "Failed to lookup auth user",
          detail: { status: (authLookupError as any)?.status, message: (authLookupError as any)?.message || authLookupError?.message },
        }),
      );
    }

    if (existingAuth?.user?.id) {
      return existingAuth.user.id;
    }
  }

  console.error("E04_AUTH_CREATE auth user creation failed:", authCreateError);
  throw new Error(
    JSON.stringify({
      code: "E04_AUTH_CREATE",
      error: "Failed to create auth user",
      detail: { status, message },
    }),
  );
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
    console.log("Signup request received");
    const { invite_token, password, full_name } = await req.json();
    console.log("Request data:", {
      invite_token: invite_token?.substring(0, 10),
      has_password: !!password,
      full_name,
    });

    if (!invite_token || !password) {
      return new Response(JSON.stringify({ success: false, code: "E400_FIELDS", error: "Missing required fields", v: FN_VERSION }), {
        status: 400,
        headers,
      });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("E00_ENV", { hasUrl: !!SUPABASE_URL, hasServiceRole: !!SUPABASE_SERVICE_ROLE_KEY });
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

    if (!SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY.length < 20) {
      console.error("E00_SERVICE_ROLE_MISSING", { hasServiceRole: !!SUPABASE_SERVICE_ROLE_KEY, length: SUPABASE_SERVICE_ROLE_KEY?.length });
      return new Response(
        JSON.stringify({
          success: false,
          code: "E00_SERVICE_ROLE_MISSING",
          error: "Service role key missing or invalid length",
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
      console.error("E400_INVITE invalid invite:", inviteError);
      return new Response(JSON.stringify({ success: false, code: "E400_INVITE", error: "Invalid or expired invitation", v: FN_VERSION }), {
        status: 400,
        headers,
      });
    }
    console.log("Invite validated for email:", invite.email);

    // Check if client portal user already exists (idempotent accept)
    console.log("Checking for existing user");
    const { data: existingClientUser } = await supabaseAdmin
      .from("client_users")
      .select("id, email, password_hash, full_name, client_id, agency_id, role")
      .eq("email", invite.email)
      .eq("client_id", invite.client_id)
      .maybeSingle();

    // Resolve auth user id if present
    let authUserId: string | null = null;
    // Resolve or create auth user id
    try {
      authUserId = await getOrCreateAuthUserId({
        supabaseAdmin,
        email: invite.email,
        password,
        clientId: invite.client_id,
        agencyId: invite.agency_id,
        role: invite.role,
      });
    } catch (authErr: any) {
      const parsed = (() => {
        try {
          return authErr?.message ? JSON.parse(authErr.message) : {};
        } catch {
          return {};
        }
      })();

      if (parsed.code === "E04_AUTH_LOOKUP") {
        return new Response(
          JSON.stringify({
            success: false,
            code: parsed.code,
            error: parsed.error,
            detail: parsed.detail,
            v: FN_VERSION,
          }),
          { status: 500, headers },
        );
      }

      if (parsed.code === "E04_AUTH_CREATE") {
        return new Response(
          JSON.stringify({
            success: false,
            code: parsed.code,
            error: parsed.error,
            detail: parsed.detail,
            v: FN_VERSION,
          }),
          { status: 500, headers },
        );
      }

      console.error("E04_AUTH_CREATE unknown auth error:", authErr);
      return new Response(
        JSON.stringify({
          success: false,
          code: "E04_AUTH_CREATE",
          error: "Failed to create auth user",
          detail: authErr?.message,
          v: FN_VERSION,
        }),
        { status: 500, headers },
      );
    }

    if (existingClientUser) {
      console.log("Existing client user found, performing idempotent accept");

      const incomingHash = await hashPassword(password);
      if (incomingHash !== existingClientUser.password_hash) {
        return new Response(
          JSON.stringify({
            success: false,
            code: "E409_EXISTS",
            error: "User already exists. Use login (password mismatch).",
            client_id: invite.client_id,
            portal_slug: null,
            v: FN_VERSION,
          }),
          { status: 409, headers },
        );
      }

      // authUserId already ensured by getOrCreateAuthUserId above

      if (!authUserId) {
        console.error("E04_AUTH_CREATE auth user id missing after creation");
        return new Response(
          JSON.stringify({ success: false, code: "E04_AUTH_ID_MISSING", error: "Failed to resolve auth user id", v: FN_VERSION }),
          { status: 500, headers },
        );
      }

      const finalSlug = await ensurePortalSlugAndLink({
        supabaseAdmin,
        clientId: invite.client_id,
        authUserId,
        fallbackSlug: (invite.invite_token || invite.client_id || "").replace(/-/g, "").slice(0, 8),
      });

      await supabaseAdmin
        .from("client_invites")
        .update({ accepted: true })
        .eq("invite_token", invite.invite_token);

      const clientUser: ClientUser = {
        id: existingClientUser.id,
        email: existingClientUser.email,
        full_name: existingClientUser.full_name,
        client_id: existingClientUser.client_id,
        agency_id: existingClientUser.agency_id,
        role: existingClientUser.role,
      };

      const { token: refreshToken, hash: refreshHash, expiresAt } = await generateRefreshToken();

      await supabaseAdmin.from("client_refresh_tokens").insert({
        client_user_id: clientUser.id,
        token_hash: refreshHash,
        expires_at: expiresAt.toISOString(),
      });

      const { token: accessToken, exp } = await generateAccessToken(clientUser);

      const cookies = createAuthCookies(accessToken, refreshToken);
      const respHeaders = new Headers(headers);
      cookies.forEach((cookie) => respHeaders.append("Set-Cookie", cookie));

      return new Response(
        JSON.stringify({
          success: true,
          user: clientUser,
          client_id: invite.client_id,
          portal_slug: finalSlug,
          portal_user_id: authUserId,
          exp,
          v: FN_VERSION,
        }),
        { status: 200, headers: respHeaders },
      );
    }
    console.log("No existing user found");

    // Hash password using Web Crypto API
    const password_hash = await hashPassword(password);

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
      console.error("E03_CREATE_USER Error creating user:", createError);
      return new Response(
        JSON.stringify({ success: false, code: "E03_CREATE_USER", error: "Failed to create user", details: createError.message, v: FN_VERSION }),
        {
          status: 500,
          headers,
        },
      );
    }
    console.log("User created successfully:", newUser.id);

    // authUserId already ensured by getOrCreateAuthUserId above; sanity check
    if (!authUserId) {
      console.error("E04_AUTH_ID_MISSING auth user id missing after creation");
      return new Response(
        JSON.stringify({ success: false, code: "E04_AUTH_ID_MISSING", error: "Failed to resolve auth user id", v: FN_VERSION }),
        { status: 500, headers },
      );
    }

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

    const finalSlug = await ensurePortalSlugAndLink({
      supabaseAdmin,
      clientId: invite.client_id,
      authUserId,
      fallbackSlug: (invite.invite_token || invite.client_id || "").replace(/-/g, "").slice(0, 8),
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
        client_id: invite.client_id,
        portal_slug: finalSlug,
        portal_user_id: authUserId,
        exp,
        v: FN_VERSION,
      }),
      { status: 200, headers: respHeaders },
    );
  } catch (error) {
    console.error("E99_UNKNOWN Signup error:", error);
    return new Response(JSON.stringify({ success: false, code: "E99_UNKNOWN", error: "Internal server error", v: FN_VERSION }), {
      status: 500,
      headers,
    });
  }
});

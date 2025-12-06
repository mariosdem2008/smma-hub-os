import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

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
    "Access-Control-Allow-Methods": "POST, PUT, GET, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      request.headers.get("Access-Control-Request-Headers") || "Content-Type, Authorization, apikey, x-client-info, *",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_PORTAL_JWT_SECRET = Deno.env.get("CLIENT_PORTAL_JWT_SECRET");

interface ClientPortalJwtPayload {
  sub: string; // client_user.id
  email: string;
  client_id: string;
  agency_id: string;
  role: string;
  exp: number;
}

async function verifyClientPortalToken(token: string): Promise<ClientPortalJwtPayload | null> {
  if (!CLIENT_PORTAL_JWT_SECRET) {
    console.error("CLIENT_PORTAL_JWT_SECRET not configured");
    return null;
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      console.log("Invalid JWT format");
      return null;
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    // Verify signature
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(CLIENT_PORTAL_JWT_SECRET),
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

    if (!isValid) {
      console.log("Invalid JWT signature");
      return null;
    }

    // Decode payload
    const payloadBase64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const payloadPadded = payloadBase64 + "=".repeat((4 - (payloadBase64.length % 4)) % 4);
    const payload: ClientPortalJwtPayload = JSON.parse(atob(payloadPadded));

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      console.log("Client portal token expired");
      return null;
    }

    console.log(`JWT verified for client_user.id: ${payload.sub}, client_id: ${payload.client_id}`);
    return payload;
  } catch (error) {
    console.error("Error verifying client portal token:", error);
    return null;
  }
}

Deno.serve(async (req) => {
  // Handle OPTIONS request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders(req),
        Vary: "Origin, Access-Control-Request-Headers",
      },
    });
  }

  console.log(`[${new Date().toISOString()}] File upload request from: ${req.headers.get("origin")}`);

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }

  try {
    // Get Supabase auth token from Authorization header
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      console.log("No Authorization header found");
      return new Response(
        JSON.stringify({
          error: "No authorization token provided",
          hint: "Please make sure you're logged in and the token is included in the Authorization header",
        }),
        {
          status: 401,
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("Token received (first 50 chars):", token.substring(0, 50) + "...");

    // Try client portal JWT verification first
    console.log("Attempting client portal token verification...");
    let clientPortalUser = await verifyClientPortalToken(token);

    if (!clientPortalUser) {
      console.log("Client portal token verification failed, trying Supabase auth...");

      // Try Supabase auth
      const supabaseClientWithAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
        auth: {
          persistSession: false,
        },
      });

      const {
        data: { user },
        error: authError,
      } = await supabaseClientWithAuth.auth.getUser(token);

      if (user && !authError) {
        console.log("Supabase auth successful for user:", user.email);

        // For Supabase auth users (agency members), we need to get client info differently
        // For now, reject since this is client portal uploads only
        return new Response(
          JSON.stringify({
            error: "This endpoint is for client portal users only",
            hint: "Agency members should use a different upload method",
          }),
          {
            status: 403,
            headers: { ...corsHeaders(req), "Content-Type": "application/json" },
          },
        );
      } else {
        console.log("Supabase auth also failed");
        return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
          status: 401,
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        });
      }
    }

    console.log(`Authenticated as client_user.id: ${clientPortalUser.sub}, client_id: ${clientPortalUser.client_id}`);

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      console.log("No file in form data");
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    console.log(`File received: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);

    // Validate file size (max 50MB)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      console.log(`File too large: ${file.size} bytes`);
      return new Response(JSON.stringify({ error: "File size exceeds 50MB limit" }), {
        status: 400,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Create unique filename
    const fileExt = file.name.split(".").pop();
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 10);
    const fileName = `${clientPortalUser.client_id}/${clientPortalUser.sub}/${timestamp}_${randomId}.${fileExt}`;

    console.log(`Uploading file to: ${fileName}`);

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from("client-uploads")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(JSON.stringify({ error: `Storage error: ${uploadError.message}` }), {
        status: 500,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    console.log(`File uploaded to storage: ${uploadData.path}`);

    // Get public URL
    const {
      data: { publicUrl },
    } = supabaseClient.storage.from("client-uploads").getPublicUrl(uploadData.path);

    // Insert into client_uploads table
    const { data: dbData, error: dbError } = await supabaseClient
      .from("client_uploads")
      .insert({
        client_id: clientPortalUser.client_id,
        agency_id: clientPortalUser.agency_id,
        uploaded_by: clientPortalUser.sub,
        file_name: file.name,
        file_url: publicUrl,
        file_type: file.type,
        file_size: file.size,
        file_path: uploadData.path,
        status: "pending",
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database insert error:", dbError);
      // Clean up storage if DB insert fails
      await supabaseClient.storage.from("client-uploads").remove([uploadData.path]);

      return new Response(JSON.stringify({ error: `Database error: ${dbError.message}` }), {
        status: 500,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    console.log(`File record created: ${dbData.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        upload: dbData,
        url: publicUrl,
        message: "File uploaded successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Unexpected error in upload-file:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: `Server error: ${message}` }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

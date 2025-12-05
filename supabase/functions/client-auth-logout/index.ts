const allowedOrigins = [
  "http://localhost:8080",
  "https://smmahub.net",
  "https://73a2983b-0136-47d2-9a1f-01fe580ac593.lovableproject.com",
  "https://id-preview--73a2983b-0136-47d2-9a1f-01fe580ac593.lovable.app",
];

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const isAllowed = allowedOrigins.includes(origin);
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
    "Access-Control-Allow-Credentials": "true",
  };
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

  // Simply clear cookies; refresh tokens are revoked by client-refresh-token when used
  const headers = clearAuthCookiesHeaders(req);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers,
  });
});

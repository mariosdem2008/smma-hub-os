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

function clearAuthCookiesHeaders(): Headers {
  const headers = new Headers({ "Content-Type": "application/json", ...corsHeaders(new Request("")) });
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

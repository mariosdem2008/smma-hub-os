import { corsHeaders } from "../_shared/cors.ts";

function clearAuthCookiesHeaders(): Headers {
  const headers = new Headers({ ...corsHeaders, "Content-Type": "application/json" });
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
    return new Response(null, { headers: corsHeaders });
  }

  // Simply clear cookies; refresh tokens are revoked by client-refresh-token when used
  const headers = clearAuthCookiesHeaders();

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers,
  });
});

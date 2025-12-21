import { portalCors } from "../_shared/cors_portal.ts";

const FN_VERSION = "client-auth-logout_2025-12-21_3";

function clearAuthCookiesHeaders(base: Record<string, string>): Headers {
  const headers = new Headers({
    "Content-Type": "application/json",
    ...base,
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
  const { allowed, headers: cors } = portalCors(req);
  if (!allowed) {
    return new Response(JSON.stringify({ success: false, code: "E403_ORIGIN", error: "Origin not allowed", v: FN_VERSION }), {
      status: 403,
      headers: { ...cors, "X-FN-VERSION": FN_VERSION },
    });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...cors, "X-FN-VERSION": FN_VERSION } });
  }

  // Simply clear cookies; refresh tokens are revoked by client-refresh-token when used
  const headers = clearAuthCookiesHeaders({ ...cors, "X-FN-VERSION": FN_VERSION });

  return new Response(JSON.stringify({ success: true, v: FN_VERSION }), {
    status: 200,
    headers,
  });
});

const ALLOWED_ORIGINS = [
  "http://localhost:8080",
  "http://localhost:3000",
  "http://localhost:5173",
  // add your production domains here:
  "https://smmahub.net",
  "https://app.smmahub.net",
  "https://app.smmahub.com",
  "https://smmahub.com",
];

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const requestedHeaders = req.headers.get("access-control-request-headers") ?? "";

  const allowOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0]; // safe fallback for dev

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Credentials": "true",

    // IMPORTANT: echo request headers so `apikey` is always included when needed
    "Access-Control-Allow-Headers": requestedHeaders || "apikey, authorization, content-type, x-client-info",

    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",

    // Prevent caches mixing origins/headers
    "Vary": "Origin, Access-Control-Request-Headers",
  };
}

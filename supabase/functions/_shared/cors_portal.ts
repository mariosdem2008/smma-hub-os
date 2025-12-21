const ALLOWED_ORIGINS = [
  "http://localhost:8080",
  "http://localhost:3000",
  "http://localhost:5173",
  "https://smmahub.net",
  "https://smmahub.com",
  "https://app.smmahub.net",
  "https://app.smmahub.com",
];

export function portalCors(req: Request): { allowed: boolean; headers: Record<string, string> } {
  const origin = req.headers.get("origin") ?? "";
  const requestedHeaders = req.headers.get("access-control-request-headers") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin);

  return {
    allowed,
    headers: allowed
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Headers": requestedHeaders || "authorization, content-type, apikey, x-client-info",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Max-Age": "86400",
          Vary: "Origin, Access-Control-Request-Headers",
        }
      : {},
  };
}

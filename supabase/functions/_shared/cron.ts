export function verifyCronSecret(
  req: Request,
  headers: Record<string, string> = {},
): Response | null {
  const expected = Deno.env.get("CRON_SECRET") || "";
  const provided = req.headers.get("x-cron-secret") || "";

  if (!expected || provided !== expected) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }

  return null;
}

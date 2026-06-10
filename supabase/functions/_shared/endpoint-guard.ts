const UI_ENDPOINT_ALLOWLIST = new Set([
  "ai-agency-admin-chat",
  "ai-default-brain-pack-ingestion-health",
  "ai-brain-analyze",
  "ai-brain-document-approve",
  "ai-brain-ingest",
  "ai-seed-default-brain-pack",
  "ai-seed-default-brain-pack-admin",
  "ai-brains-agency",
  "ai-brains-client",
  "ai-job-worker",
  "ai-ingestion-source-register",
  "ai-memory-approve",
  "ai-documents-ingest",
  "ai-onboarding",
  "ai-onboarding-scan",
  "ai-onboarding-suggest",
  "ai-onboarding-client-chat",
  "ai-rep-chat",
  "ai-retrieve-context",
  "ai-ask",
  "ai-strategy-generate",
  "ai-assistant",
  "generate-ai-content",
]);

function getEnvFlag(name: string) {
  if (typeof Deno !== "undefined" && Deno.env?.get) {
    return Deno.env.get(name);
  }
  if (typeof process !== "undefined") {
    return process.env?.[name];
  }
  return undefined;
}

export function getEndpointGuardResponse(endpoint: string, headers: Record<string, string> = {}) {
  const allowUnused = getEnvFlag("ENABLE_UNUSED_AI_ENDPOINTS") === "true";
  if (allowUnused) return null;
  if (UI_ENDPOINT_ALLOWLIST.has(endpoint)) return null;

  return new Response(
    JSON.stringify({ error: "Endpoint disabled by default", code: "ENDPOINT_DISABLED" }),
    { status: 403, headers: { ...headers, "Content-Type": "application/json" } },
  );
}

export function isEndpointAllowlisted(endpoint: string) {
  return UI_ENDPOINT_ALLOWLIST.has(endpoint);
}

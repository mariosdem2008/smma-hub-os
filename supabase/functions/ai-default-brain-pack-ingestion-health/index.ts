import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";
import { generateSpanId, generateTraceId, logOtelSpan } from "../../../src/ai/otel.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

type Body = { agency_id?: string; approved_modules?: string[] };

serve(async (req: Request) => {
  const traceId = generateTraceId();
  const spanId = generateSpanId();
  const spanStart = Date.now();
  let response: Response | undefined;
  let supabase: ReturnType<typeof createClient> | null = null;
  let agencyId: string | undefined;
  let userId: string | undefined;

  response = await (async () => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(req) });
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders(req));
    }

    const guardResponse = getEndpointGuardResponse("ai-default-brain-pack-ingestion-health", corsHeaders(req));
    if (guardResponse) return guardResponse;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401, corsHeaders(req));
    }

    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders(req));
    }

    userId = user.id;
    const body = (await req.json().catch(() => ({}))) as Body;
    agencyId = body.agency_id;
    if (!agencyId) {
      return jsonResponse({ error: "agency_id required" }, 400, corsHeaders(req));
    }

  const requested = Array.isArray(body.approved_modules) ? body.approved_modules : [];
  const approvedModules = Array.from(
    new Set(requested.filter((module): module is string => typeof module === "string" && module.length > 0)),
  );
  if (approvedModules.length === 0) {
    return jsonResponse({ approvedModules: [], missingModules: [] }, 200, corsHeaders(req));
  }

  const { data: membership, error: membershipError } = await supabase
    .from("agency_members")
    .select("agency_id")
    .eq("agency_id", agencyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    console.error("default_brain_pack_ingestion_health_membership_query_failed", {
      agency_id: agencyId,
      user_id: user.id,
      error: membershipError.message,
    });
    return jsonResponse({ error: "Failed to resolve agency membership" }, 500, corsHeaders(req));
  }

  if (!membership) {
    return jsonResponse({ error: "Forbidden", code: "FORBIDDEN_MEMBERSHIP" }, 403, corsHeaders(req));
  }

  const { data, error } = await supabase
    .from("ai_documents")
    .select("metadata")
    .eq("agency_id", agencyId)
    .eq("doc_type", "brain_document")
    .in("metadata->>module", approvedModules);

  if (error) {
    console.error("default_brain_pack_ingestion_health_query_failed", {
      agency_id: agencyId,
      user_id: user.id,
      error: error.message,
    });
    return jsonResponse({ error: "Failed to check ingestion health" }, 500, corsHeaders(req));
  }

  const ingestedModules = new Set<string>();
  for (const row of data ?? []) {
    const metadata = row?.metadata as Record<string, unknown> | null | undefined;
    const module = typeof metadata?.module === "string" ? metadata.module : null;
    if (module) ingestedModules.add(module);
  }

  const missingModules = approvedModules.filter((m) => !ingestedModules.has(m));
    return jsonResponse({ approvedModules, missingModules }, 200, corsHeaders(req));
  })();

  await logOtelSpan(supabase, {
    traceId,
    spanId,
    stage: "edge.ai-default-brain-pack-ingestion-health",
    taskType: TaskType.TOOL_EXECUTION,
    agencyId,
    userId,
    latencyMs: Date.now() - spanStart,
    attributes: { http_status: response?.status ?? 0 },
  });

  return response!;
});

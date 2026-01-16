import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";
import { approveBrainDocument, ingestBrainDocumentForRag } from "../_shared/brain-documents.ts";
import { inferAgencyIdFromMemberships, seedApproveAndIngestDefaultBrainPackV1 } from "../_shared/seed-default-brain-pack.ts";
import { renderDefaultBrainPackV1 } from "../_shared/defaultBrainPackV1.ts";
import { buildDefaultBrainPackUsageLog, type DefaultBrainPackUsageStage } from "../_shared/default-brain-pack-usage-log.ts";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

type Body = { agency_id?: string; mode?: "seed_or_repair" | "ingest_only" };

serve(async (req: Request) => {
  const startedAt = Date.now();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders(req));
  }

  const guardResponse = getEndpointGuardResponse("ai-seed-default-brain-pack", corsHeaders(req));
  if (guardResponse) return guardResponse;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401, corsHeaders(req));
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders(req));
  }

  const body = (await req.json().catch(() => ({}))) as Body;

  const { data: memberships, error: membershipError } = await supabase
    .from("agency_members")
    .select("agency_id, role")
    .eq("user_id", user.id);

  if (membershipError) {
    console.error("seed_default_brain_pack_v1_membership_query_failed", {
      user_id: user.id,
      error: membershipError.message,
    });
    return jsonResponse({ error: "Failed to resolve agency membership" }, 500, corsHeaders(req));
  }

  const inferred = inferAgencyIdFromMemberships(body.agency_id, (memberships ?? []) as Array<{ agency_id: string }>);
  if (!inferred.agencyId) {
    return jsonResponse({ error: inferred.error ?? "agency_id required" }, 400, corsHeaders(req));
  }

  const agencyId = inferred.agencyId;
  const membershipRow = (memberships ?? []).find((m: any) => m.agency_id === agencyId) as { agency_id: string; role?: string } | undefined;
  if (!membershipRow) {
    return jsonResponse({ error: "Forbidden", code: "FORBIDDEN_MEMBERSHIP" }, 403, corsHeaders(req));
  }

  const role = membershipRow.role ?? "";
  if (!["owner", "admin"].includes(role)) {
    return jsonResponse({ error: "Forbidden", code: "FORBIDDEN_ROLE" }, 403, corsHeaders(req));
  }

  const startedAtForLogs = Date.now();
  const logStage = async (stage: DefaultBrainPackUsageStage, meta: { insertedCount?: number; documentIds?: string[]; ingestedCount?: number; failedIds?: string[]; errorCode?: string; statusCode?: number } = {}) => {
    try {
      await supabase.from("ai_usage_logs").insert(
        buildDefaultBrainPackUsageLog({
          agencyId,
          userId: user.id,
          stage,
          insertedCount: meta.insertedCount,
          documentIds: meta.documentIds,
          ingestedCount: meta.ingestedCount,
          failedIds: meta.failedIds,
          errorCode: meta.errorCode,
          statusCode: meta.statusCode,
          latencyMs: Date.now() - startedAtForLogs,
        }),
      );
    } catch {
      // never block response on observability
    }
  };

  let rpcMode: "seed" | "repair" | "ingest_only" = "seed";
  if (body.mode === "ingest_only") {
    rpcMode = "ingest_only";
  } else {
    const { data: anyDocs } = await supabase
      .from("brain_documents")
      .select("id")
      .eq("agency_id", agencyId)
      .limit(1);
    const hasAnyBrainDocs = Array.isArray(anyDocs) ? anyDocs.length > 0 : Boolean(anyDocs);
    rpcMode = hasAnyBrainDocs ? "repair" : "seed";
  }

  const result = await seedApproveAndIngestDefaultBrainPackV1({
    supabase: supabase as any,
    userId: user.id,
    agencyId,
    mode: rpcMode,
    renderPack: (fields) => renderDefaultBrainPackV1({
      agency_name: fields.agency_name,
      agency_website: fields.agency_website,
      agency_niche: fields.agency_niche,
    }),
    approveBrainDocument,
    ingestBrainDocumentForRag,
    log: (level, event, payload) => {
      const logger = level === "error" ? console.error : console.log;
      logger(event, payload);
    },
  });

  if (rpcMode === "seed") {
    await logStage("seed_rpc_called", { insertedCount: result.inserted_count, documentIds: result.document_ids });
  } else if (rpcMode === "repair") {
    await logStage("repair_rpc_called", { insertedCount: result.inserted_count, documentIds: result.document_ids });
  }

  if (result.document_ids.length > 0) {
    await logStage("approved", { insertedCount: result.inserted_count, documentIds: result.document_ids, failedIds: result.failed_ids });
  }

  await logStage("ingested", { insertedCount: result.inserted_count, documentIds: result.document_ids, ingestedCount: result.ingested_count, failedIds: result.failed_ids });

  if (result.failed_ids.length > 0) {
    await logStage("failed", { insertedCount: result.inserted_count, documentIds: result.document_ids, ingestedCount: result.ingested_count, failedIds: result.failed_ids, errorCode: "PARTIAL_FAILURE" });
  }

  await logStage("completed", { insertedCount: result.inserted_count, documentIds: result.document_ids, ingestedCount: result.ingested_count, failedIds: result.failed_ids });

  return jsonResponse(result, 200, corsHeaders(req));
});

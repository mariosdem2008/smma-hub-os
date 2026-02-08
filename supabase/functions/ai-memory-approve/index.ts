import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";
import { ingestMemoryItemAsDocument } from "../_shared/memory-ingest.ts";
import { isLongTermMemoryEnabled, isPhase2EnabledForAgency } from "../../../src/ai/flags.ts";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders(req));
  }

  const guardResponse = getEndpointGuardResponse("ai-memory-approve", corsHeaders(req));
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

  const body = await req.json().catch(() => ({}));
  const agencyId = body.agency_id as string | undefined;
  const memoryItemId = body.memory_item_id as string | undefined;
  const decision = (body.decision as string | undefined)?.trim() ?? "";

  if (!agencyId || !memoryItemId || !decision) {
    return jsonResponse({ error: "agency_id, memory_item_id, decision are required" }, 400, corsHeaders(req));
  }

  const { data: membership } = await supabase
    .from("agency_members")
    .select("agency_id, role")
    .eq("user_id", user.id)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (!membership) {
    return jsonResponse({ error: "Forbidden" }, 403, corsHeaders(req));
  }
  if (membership.role !== "admin") {
    return jsonResponse({ error: "Forbidden (admin required)" }, 403, corsHeaders(req));
  }

  const { data: memoryRow, error: memoryError } = await supabase
    .from("ai_memory_items")
    .select("id, agency_id, client_id, scope, status, content")
    .eq("id", memoryItemId)
    .maybeSingle();

  if (memoryError || !memoryRow) {
    return jsonResponse({ error: "Memory item not found" }, 404, corsHeaders(req));
  }
  if ((memoryRow as any).agency_id !== agencyId) {
    return jsonResponse({ error: "tenant_scope_violation" }, 403, corsHeaders(req));
  }

  const normalizedDecision = decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "";
  if (!normalizedDecision) {
    return jsonResponse({ error: "decision must be approved|rejected" }, 400, corsHeaders(req));
  }

  const nextStatus = normalizedDecision === "approved" ? "active" : "rejected";
  const updatePayload: Record<string, unknown> = {
    status: nextStatus,
    approved_by: normalizedDecision === "approved" ? user.id : null,
    approved_at: normalizedDecision === "approved" ? new Date().toISOString() : null,
    rejected_by: normalizedDecision === "rejected" ? user.id : null,
    rejected_at: normalizedDecision === "rejected" ? new Date().toISOString() : null,
  };

  const { error: updateError } = await supabase
    .from("ai_memory_items")
    .update(updatePayload)
    .eq("id", memoryItemId)
    .eq("agency_id", agencyId);

  if (updateError) {
    return jsonResponse({ error: updateError.message ?? "Failed to update memory item" }, 500, corsHeaders(req));
  }

  // Phase 2: make approved long-term memory retrievable.
  // We ingest synchronously so staging smoke can validate end-to-end without relying on cron.
  let ingestedDocumentId: string | null = null;
  if (nextStatus === "active" && isLongTermMemoryEnabled() && isPhase2EnabledForAgency(agencyId)) {
    const clientId = (memoryRow as any).client_id ?? null;
    const scope = String((memoryRow as any).scope ?? "long_term");
    const isEpisodic = scope === "episodic";
    const docType = clientId
      ? (isEpisodic ? "client_episodic" : "client_memory")
      : (isEpisodic ? "agency_episodic" : "agency_memory");

    // Idempotency: remove prior ingests for this memory item and tenant scope.
    await supabase
      .from("ai_documents")
      .delete()
      .eq("agency_id", agencyId)
      .eq("client_id", clientId)
      .eq("doc_type", docType)
      .eq("source->>source_type", "ai_memory_item")
      .eq("source->>source_ref", memoryItemId);

    const ingest = await ingestMemoryItemAsDocument({
      supabase,
      agencyId,
      clientId,
      memoryItemId,
      docType,
      title: `Memory (${String((memoryRow as any).scope ?? "long_term")})`,
      content: String((memoryRow as any).content ?? ""),
      metadata: { scope: String((memoryRow as any).scope ?? "long_term"), approved: true },
    });
    ingestedDocumentId = ingest.documentId;
  }

  return jsonResponse(
    {
      ok: true,
      memory_item_id: memoryItemId,
      status: nextStatus,
      scope: (memoryRow as any).scope ?? null,
      ingested_document_id: ingestedDocumentId,
    },
    200,
    corsHeaders(req),
  );
});

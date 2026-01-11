import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";
import { verifyCronSecret } from "../_shared/cron.ts";
import { approveBrainDocument, ingestBrainDocumentForRag } from "../_shared/brain-documents.ts";
import { seedApproveAndIngestDefaultBrainPackV1 } from "../_shared/seed-default-brain-pack.ts";
import { resolveAgencyAdminUserId } from "../_shared/agency-members.ts";
import { renderDefaultBrainPackV1 } from "../../../src/brain/defaultPackV1.ts";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

type Body = {
  agency_id?: string;
  dry_run?: boolean;
};

serve(async (req: Request) => {
  const startedAt = Date.now();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders(req));
  }

  const guardResponse = getEndpointGuardResponse("ai-seed-default-brain-pack-admin", corsHeaders(req));
  if (guardResponse) return guardResponse;

  const cronAuth = verifyCronSecret(req, corsHeaders(req));
  if (cronAuth) return cronAuth;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const body = (await req.json().catch(() => ({}))) as Body;
  const agencyId = body.agency_id;
  const dryRun = Boolean(body.dry_run);

  if (!agencyId) {
    return jsonResponse({ error: "agency_id is required" }, 400, corsHeaders(req));
  }

  const actingUserId = await resolveAgencyAdminUserId(supabase as any, agencyId);
  if (!actingUserId) {
    return jsonResponse({ error: "No agency member found for agency" }, 400, corsHeaders(req));
  }

  if (dryRun) {
    const { count, error } = await supabase
      .from("brain_documents")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agencyId);

    if (error) {
      return jsonResponse({ error: "Failed to check brain_documents" }, 500, corsHeaders(req));
    }

    return jsonResponse(
      {
        dry_run: true,
        eligible: (count ?? 0) === 0,
        brain_documents_count: count ?? 0,
        agency_id: agencyId,
        acting_user_id: actingUserId,
      },
      200,
      corsHeaders(req),
    );
  }

  const result = await seedApproveAndIngestDefaultBrainPackV1({
    supabase: supabase as any,
    userId: actingUserId,
    agencyId,
    renderPack: (fields) =>
      renderDefaultBrainPackV1({
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

  try {
    const modelParts = [
      result.seeded ? "seeded" : "skipped",
      result.approved ? "approved" : "not_approved",
      result.ingested ? "ingested" : "not_ingested",
    ];
    await supabase.from("ai_usage_logs").insert({
      agency_id: agencyId,
      client_id: null,
      endpoint: "ai-seed-default-brain-pack-admin",
      model: `default_brain_pack_v1:${modelParts.join(":")}`,
      tokens_estimate: 0,
      tokens_in: 0,
      tokens_out: 0,
      latency_ms: Date.now() - startedAt,
      unknown: false,
    });
  } catch (error) {
    console.error("seed_default_brain_pack_v1_admin_usage_log_failed", {
      agency_id: agencyId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return jsonResponse({ ...result, agency_id: agencyId, acting_user_id: actingUserId }, 200, corsHeaders(req));
});


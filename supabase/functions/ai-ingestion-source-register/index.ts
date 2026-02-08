import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";

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

  const guardResponse = getEndpointGuardResponse("ai-ingestion-source-register", corsHeaders(req));
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
  const sourceType = (body.source_type as string | undefined)?.trim() ?? "";
  const sourceRef = (body.source_ref as string | undefined)?.trim() ?? "";
  const sourceUrl = (body.source_url as string | undefined)?.trim() ?? "";
  const allowed = typeof body.allowed === "boolean" ? body.allowed : true;
  const manifestSha256 = (body.manifest_sha256 as string | undefined)?.trim() ?? "";
  const manifestJson = (body.manifest_json as Record<string, unknown> | undefined) ?? undefined;

  if (!agencyId || !sourceType || !sourceRef) {
    return jsonResponse({ error: "agency_id, source_type, source_ref are required" }, 400, corsHeaders(req));
  }

  const { data: membership } = await supabase
    .from("agency_members")
    .select("agency_id, role")
    .eq("user_id", user.id)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (!membership || membership.role !== "admin") {
    return jsonResponse({ error: "Forbidden (admin required)" }, 403, corsHeaders(req));
  }

  const { data, error } = await supabase
    .from("ai_ingestion_sources")
    .upsert(
      {
        agency_id: agencyId,
        source_type: sourceType,
        source_ref: sourceRef,
        source_url: sourceUrl || null,
        allowed,
        manifest_sha256: manifestSha256 || null,
        manifest_json: manifestJson ?? null,
        created_by: user.id,
      },
      { onConflict: "agency_id,source_type,source_ref" },
    )
    .select("id")
    .single();

  if (error) {
    return jsonResponse({ error: error.message ?? "Failed to register ingestion source" }, 500, corsHeaders(req));
  }

  return jsonResponse(
    { ok: true, id: data?.id ?? null, agency_id: agencyId, source_type: sourceType, source_ref: sourceRef, allowed },
    200,
    corsHeaders(req),
  );
});

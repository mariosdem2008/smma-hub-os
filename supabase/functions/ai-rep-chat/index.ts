import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { embedText } from "../_shared/embeddings.ts";
import { decideAiRepResponse } from "../_shared/ai-rep-chat.ts";
import { capMatchesByTokenBudget, clampMatchCount } from "../_shared/retrieval.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

async function safeRetrieveContext(opts: {
  supabase: any;
  agencyId: string;
  clientId: string;
  query: string;
}) {
  try {
    const embeddingModel = Deno.env.get("EMBEDDING_MODEL_ID") ?? "text-embedding-3-small";
    const queryEmbedding = await embedText(opts.query, "", embeddingModel);
    const { data: matches, error } = await opts.supabase.rpc("match_ai_embeddings", {
      p_agency_id: opts.agencyId,
      p_client_id: opts.clientId,
      p_query_embedding: queryEmbedding,
      p_match_count: clampMatchCount(6),
      p_doc_types: null,
      p_modules: null,
      p_min_similarity: 0.2,
    });
    if (error || !Array.isArray(matches)) return [];
    const capped = capMatchesByTokenBudget(matches, 600);
    return capped.matches
      .map((row: any) => (row?.chunk_text as string) ?? "")
      .filter(Boolean);
  } catch {
    return [];
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders(req));
  }

  const guardResponse = getEndpointGuardResponse("ai-rep-chat", corsHeaders(req));
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
  const clientId = body.client_id as string | undefined;
  const message = (body.message as string | undefined)?.trim();

  if (!clientId || !message) {
    return jsonResponse({ error: "client_id and message are required" }, 400, corsHeaders(req));
  }

  const { data: clientRow } = await supabase
    .from("clients")
    .select("id, agency_id, portal_user_id")
    .eq("id", clientId)
    .maybeSingle();

  if (!clientRow?.agency_id) {
    return jsonResponse({ error: "Client not found" }, 404, corsHeaders(req));
  }

  const isPortalUserForClient = clientRow.portal_user_id && clientRow.portal_user_id === user.id;

  if (!isPortalUserForClient) {
    const { data: membership } = await supabase
      .from("agency_members")
      .select("agency_id")
      .eq("user_id", user.id)
      .eq("agency_id", clientRow.agency_id)
      .maybeSingle();

    if (!membership) {
      return jsonResponse({ error: "Forbidden" }, 403, corsHeaders(req));
    }
  }

  const { data: brainRow } = await supabase
    .from("client_brains")
    .select("brain_json, updated_at, version")
    .eq("client_id", clientId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const brainJson = (brainRow?.brain_json as any) ?? {};
  const brief = (brainJson?.client_brief_v1 as any) ?? null;

  const retrievedSnippets = await safeRetrieveContext({
    supabase,
    agencyId: clientRow.agency_id,
    clientId,
    query: message,
  });

  const decision = decideAiRepResponse({ brief, message, retrievedSnippets });

  await supabase.from("ai_usage_logs").insert({
    agency_id: clientRow.agency_id,
    client_id: clientId,
    endpoint: "ai-rep-chat",
    model: Deno.env.get("CHAT_MODEL_ID") ?? "mapping-only",
    tokens_estimate: Math.ceil(message.length / 4),
    tokens_in: Math.ceil(message.length / 4),
    tokens_out: Math.ceil(decision.assistant_message.length / 4),
    latency_ms: 0,
    unknown: decision.unknown,
  });

  return jsonResponse(
    {
      assistant_message: decision.assistant_message,
      suggestions: decision.suggestions,
      used_sections: decision.used_sections,
      unknown: decision.unknown,
    },
    200,
    corsHeaders(req),
  );
});

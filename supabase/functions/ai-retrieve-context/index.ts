import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { getLockdownFailure, logLockdownAttempt } from "../_shared/lockdown.ts";
import { capMatchesByTokenBudget, clampMatchCount, getInitialMatchCount, applyScoreRerank } from "../_shared/retrieval.ts";
import { embedQueryForRag, getMatchRpcName } from "../_shared/rag-index.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";
import { generateSpanId, generateTraceId, logOtelSpan } from "../../../src/ai/otel.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

serve(async (req: Request) => {
  const traceId = generateTraceId();
  const spanId = generateSpanId();
  const spanStart = Date.now();
  let response: Response | undefined;
  let supabase: ReturnType<typeof createClient> | null = null;
  let agencyId: string | undefined;
  let clientId: string | undefined;
  let userId: string | undefined;

  try {
    response = await (async () => {
      if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders(req) });
      }

      if (req.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders(req));
      }

      const guardResponse = getEndpointGuardResponse("ai-retrieve-context", corsHeaders(req));
      if (guardResponse) return guardResponse;

      const lockdownEnabled = Deno.env.get("AI_LOCKDOWN_UNUSED_ENDPOINTS") === "true";
      const body = await req.json().catch(() => ({}));
      agencyId = body.agency_id as string | undefined;
      clientId = body.client_id as string | undefined;
      const query = (body.query as string | undefined)?.trim();
      const topK = Number(body.top_k ?? 8);
      const docTypes = Array.isArray(body.doc_types) ? body.doc_types : null;
      const modules = Array.isArray(body.modules) ? body.modules : null;
      const minSimilarity = Number(body.min_similarity ?? 0.2);
      const tokenBudget = Number(body.token_budget ?? 800);
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        const lockdown = getLockdownFailure({
          lockdownEnabled,
          hasAuthHeader: false,
          isUserValid: false,
          hasMembership: false,
        });
        if (lockdown) {
          const lockdownSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false },
          });
          await logLockdownAttempt({
            supabase: lockdownSupabase,
            endpoint: "ai-retrieve-context",
            agencyId,
            clientId,
          });
          return jsonResponse(lockdown.body, lockdown.status, corsHeaders(req));
        }
        return jsonResponse({ error: "Missing Authorization header" }, 401, corsHeaders(req));
      }

      supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });

      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      const user = userData?.user;
      const isUserValid = !userError && !!user;
      if (!isUserValid) {
        const lockdown = getLockdownFailure({
          lockdownEnabled,
          hasAuthHeader: true,
          isUserValid: false,
          hasMembership: false,
        });
        if (lockdown) {
          await logLockdownAttempt({
            supabase,
            endpoint: "ai-retrieve-context",
            agencyId,
            clientId,
          });
          return jsonResponse(lockdown.body, lockdown.status, corsHeaders(req));
        }
        return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders(req));
      }

      userId = user.id;
      const startTime = Date.now();

      if (!agencyId || !query) {
        return jsonResponse({ error: "agency_id and query are required" }, 400, corsHeaders(req));
      }

      const { data: membership } = await supabase
        .from("agency_members")
        .select("agency_id")
        .eq("user_id", user.id)
        .eq("agency_id", agencyId)
        .maybeSingle();

      if (!membership) {
        const lockdown = getLockdownFailure({
          lockdownEnabled,
          hasAuthHeader: true,
          isUserValid: true,
          hasMembership: false,
        });
        if (lockdown) {
          await logLockdownAttempt({
            supabase,
            endpoint: "ai-retrieve-context",
            agencyId,
            clientId,
          });
          return jsonResponse(lockdown.body, lockdown.status, corsHeaders(req));
        }
        return jsonResponse({ error: "Forbidden" }, 403, corsHeaders(req));
      }

      let queryEmbedding: number[];
      try {
        const embedded = await embedQueryForRag({ query });
        queryEmbedding = embedded.embedding as any;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("API_KEY is not configured")) {
          return jsonResponse(
            {
              error: "AI embeddings are not configured",
              message: "Configure GEMINI_API_KEY (or OPENAI_API_KEY if using OpenAI embeddings) and retry.",
              code: "MISSING_API_KEY",
            },
            500,
            corsHeaders(req),
          );
        }
        throw error;
      }

      const rpcName = getMatchRpcName({ scoped: true });
      const { data: matches, error: matchError } = await supabase.rpc(rpcName, {
        p_agency_id: agencyId,
        p_client_id: clientId ?? null,
        p_query_embedding: queryEmbedding,
        p_match_count: clampMatchCount(getInitialMatchCount(topK, 50)),
        p_doc_types: docTypes,
        p_modules: modules,
        p_min_similarity: Number.isFinite(minSimilarity) ? minSimilarity : 0.2,
      });

      if (matchError) {
        return jsonResponse({ error: matchError.message }, 400, corsHeaders(req));
      }

      await supabase.from("ai_usage_logs").insert({
        agency_id: agencyId,
        client_id: clientId ?? null,
        endpoint: "ai-retrieve-context",
        model: "rag-query-embedding",
        tokens_estimate: Math.ceil(query.length / 4),
        tokens_in: Math.ceil(query.length / 4),
        tokens_out: 0,
        latency_ms: Date.now() - startTime,
        unknown: false,
      });

      const reranked = applyScoreRerank(matches || [], 12);
      const capped = capMatchesByTokenBudget(reranked, tokenBudget);
      const responseBody = capped.matches.map((row: any) => ({
        source: row.doc_type,
        source_id: row.chunk_id,
        snippet: row.chunk_text,
        score: row.score,
      }));

      return jsonResponse(responseBody, 200, corsHeaders(req));
    })();
  } finally {
    await logOtelSpan(supabase, {
      traceId,
      spanId,
      stage: "edge.ai-retrieve-context",
      taskType: TaskType.EMBED_TEXT,
      agencyId,
      clientId,
      userId,
      latencyMs: Date.now() - spanStart,
      attributes: { http_status: response?.status ?? 0 },
    });
  }

  return response!;
});

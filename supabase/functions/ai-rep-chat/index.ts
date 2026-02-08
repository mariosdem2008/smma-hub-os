import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { decideAiRepResponse } from "../_shared/ai-rep-chat.ts";
import { capMatchesByTokenBudget, clampMatchCount, getInitialMatchCount, applyScoreRerank } from "../_shared/retrieval.ts";
import { embedQueryForRag, getMatchRpcName } from "../_shared/rag-index.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";
import { generateSpanId, generateTraceId, logOtelSpan } from "../../../src/ai/otel.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";
import { isEpisodicMemoryEnabled, isPhase2EnabledForAgency } from "../../../src/ai/flags.ts";
import { ai } from "../../../src/ai/router.ts";

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
    const { embedding: queryEmbedding } = await embedQueryForRag({ query: opts.query });
    // Phase 2: retrieval is still tenant-scoped, but can include agency-scoped docs (client_id is null)
    // without leaking other clients (0 cross-tenant leaks).
    const rpcName = getMatchRpcName({ scoped: true });
    const { data: matches, error } = await opts.supabase.rpc(rpcName, {
      p_agency_id: opts.agencyId,
      p_client_id: opts.clientId,
      p_query_embedding: queryEmbedding,
      p_match_count: clampMatchCount(getInitialMatchCount(6, 50)),
      p_doc_types: null,
      p_modules: null,
      p_min_similarity: 0.2,
    });
    if (error || !Array.isArray(matches)) return [];
    const reranked = applyScoreRerank(matches, 12);
    const capped = capMatchesByTokenBudget(reranked, 600);
    return capped.matches
      .map((row: any) => (row?.chunk_text as string) ?? "")
      .filter(Boolean);
  } catch {
    return [];
  }
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

  response = await (async () => {
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
    const body = await req.json().catch(() => ({}));
    clientId = body.client_id as string | undefined;
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
    agencyId = clientRow.agency_id;

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

  // Phase 2: episodic memory capture (0 cross-tenant leaks; tenant scoped by agency_id + client_id).
  // Disabled by default behind ENABLE_EPISODIC_MEMORY.
  if (isEpisodicMemoryEnabled() && isPhase2EnabledForAgency(clientRow.agency_id)) {
    const threadId = (typeof body.thread_id === "string" && body.thread_id.trim())
      ? String(body.thread_id).trim().slice(0, 160)
      : `rep-chat:${clientId}`;

    const turnUser = String(message).slice(0, 600);
    const turnAssistant = String(decision.assistant_message ?? "").slice(0, 600);
    const turnText = `User: ${turnUser}\nAssistant: ${turnAssistant}`;

    // Minimal PII scan to avoid persisting obvious secrets; treat anything suspicious as "do not store".
    const hasPii = /\b\d{3}-\d{2}-\d{4}\b/.test(turnText) // US SSN
      || /\b(?:\d[ -]*?){13,16}\b/.test(turnText) // CC-like
      || /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(turnText); // email

    if (!hasPii && turnText.trim().length > 0) {
      // Buffer up turns and write a single episodic summary every 5 messages (per P2-MEM-01).
      const { data: bufferRow } = await supabase
        .from("ai_episodic_buffers")
        .select("id, turns_json, turn_count")
        .eq("agency_id", clientRow.agency_id)
        .eq("client_id", clientId)
        .eq("thread_id", threadId)
        .maybeSingle();

      const existingTurns = Array.isArray((bufferRow as any)?.turns_json) ? (bufferRow as any).turns_json : [];
      const nextTurns = [...existingTurns, { u: turnUser, a: turnAssistant, at: new Date().toISOString() }].slice(-5);
      const nextCount = Number((bufferRow as any)?.turn_count ?? existingTurns.length) + 1;

      if (bufferRow?.id) {
        await supabase
          .from("ai_episodic_buffers")
          .update({
            turns_json: nextTurns,
            turn_count: nextCount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", bufferRow.id)
          .eq("agency_id", clientRow.agency_id);
      } else {
        await supabase
          .from("ai_episodic_buffers")
          .insert({
            agency_id: clientRow.agency_id,
            client_id: clientId,
            thread_id: threadId,
            turns_json: nextTurns,
            turn_count: nextCount,
          });
      }

      // Only write memory every 5 turns.
      if (nextCount % 5 === 0) {
        const convo = nextTurns.map((t: any) => `User: ${String(t?.u ?? "")}\nAssistant: ${String(t?.a ?? "")}`).join("\n\n");
        let summary = convo.slice(0, 1500);
        try {
          const s = await ai.run({
            taskType: TaskType.SUMMARIZE,
            input: convo,
            context: { environment: "prod", supabase, skipUsageLog: true },
            metadata: {
              systemPrompt:
                "Summarize the last 5 chat turns into 50-100 tokens. Keep only stable preferences/facts. Avoid PII. Output plain text only.",
            },
          });
          if (typeof s.text === "string" && s.text.trim().length > 0) {
            summary = s.text.trim();
          }
        } catch {
          // fall back to deterministic truncation
        }

        const { data: memoryRow } = await supabase
          .from("ai_memory_items")
          .insert({
            agency_id: clientRow.agency_id,
            client_id: clientId,
            type: "episodic_summary",
            content: summary,
            summary,
            thread_id: threadId,
            checkpoint_id: null,
            scope: "episodic",
            status: "active",
            created_by: user.id,
            metadata: { source: "ai-rep-chat", turns: 5, max_chars: 1500 },
          })
          .select("id")
          .single();

        if (memoryRow?.id) {
          const dedupeKey = `memory_ingest:${memoryRow.id}`;
          await supabase.from("ai_jobs").upsert(
            {
              agency_id: clientRow.agency_id,
              client_id: clientId,
              job_type: "ingest_memory_item",
              payload_json: { memory_item_id: memoryRow.id },
              dedupe_key: dedupeKey,
              status: "pending",
              run_after: new Date().toISOString(),
              last_error: null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "job_type,client_id,dedupe_key" },
          );
        }

        // Reset buffer after flush.
        await supabase
          .from("ai_episodic_buffers")
          .update({ turns_json: [], turn_count: 0, updated_at: new Date().toISOString() })
          .eq("agency_id", clientRow.agency_id)
          .eq("client_id", clientId)
          .eq("thread_id", threadId);
      }
    }
  }

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
  })();

  await logOtelSpan(supabase, {
    traceId,
    spanId,
    stage: "edge.ai-rep-chat",
    taskType: TaskType.CHAT_GENERAL,
    agencyId,
    clientId,
    userId,
    latencyMs: Date.now() - spanStart,
    attributes: { http_status: response?.status ?? 0 },
  });

  return response!;
});

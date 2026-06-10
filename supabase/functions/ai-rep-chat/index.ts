import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { buildAiRepChatMessages, decideAiRepResponse, parseAiRepLlmReply, type AiRepChatTurn } from "../_shared/ai-rep-chat.ts";
import { capMatchesByTokenBudget, clampMatchCount, getInitialMatchCount, applyScoreRerank } from "../_shared/retrieval.ts";
import { embedQueryForRag, getMatchRpcName } from "../_shared/rag-index.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";
import { generateSpanId, generateTraceId, logOtelSpan } from "../../../src/ai/otel.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";
import { isEpisodicMemoryEnabled, isPhase2EnabledForAgency } from "../../../src/ai/flags.ts";
import { ai } from "../../../src/ai/router.ts";
import { enforceAgencyAgentActivation } from "../_shared/agency-ai-setup.ts";

const CLIENT_PORTAL_JWT_SECRET = Deno.env.get("CLIENT_PORTAL_JWT_SECRET");

interface ClientPortalJwtPayload {
  sub: string;
  email: string;
  client_id: string;
  agency_id: string;
  role: string;
  exp: number;
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

async function enforceClientFacingCertification(args: {
  supabase: ReturnType<typeof createClient>;
  agencyId: string;
  cors: Record<string, string>;
}) {
  const { data, error } = await args.supabase
    .from("agency_ai_certifications_v2")
    .select("scenario_key, certified_at")
    .eq("agency_id", args.agencyId)
    .eq("agent_class", "client_facing")
    .eq("certification_state", "certified");

  if (error) throw error;

  const certifiedRows = (data ?? []) as Array<{ scenario_key: string; certified_at: string | null }>;
  const certifiedScenarioKeys = new Set(certifiedRows.map((row) => row.scenario_key));
  const { data: setupStatus, error: setupStatusError } = await args.supabase
    .from("agency_ai_setup_status_v2")
    .select("meta_json")
    .eq("agency_id", args.agencyId)
    .maybeSingle();

  if (setupStatusError) throw setupStatusError;

  const evidenceTimestamps = [
    setupStatus?.meta_json?.foundations?.updated_at,
    setupStatus?.meta_json?.guardrails?.updated_at,
    setupStatus?.meta_json?.workflow?.updated_at,
  ]
    .filter((item): item is string => typeof item === "string" && item.length > 0)
    .map((item) => Date.parse(item))
    .filter((item) => Number.isFinite(item));

  const staleScenarioKeys = certifiedRows
    .filter((row) => {
      const certifiedAt = Date.parse(row.certified_at ?? "");
      if (!Number.isFinite(certifiedAt)) return false;
      return evidenceTimestamps.some((timestamp) => timestamp > certifiedAt);
    })
    .map((row) => row.scenario_key)
    .filter((item) => item === "client_response_certification");

  if (certifiedScenarioKeys.has("client_response_certification") && staleScenarioKeys.length === 0) {
    return null;
  }

  return jsonResponse(
    {
      success: false,
      code: "AGENT_ACTIVATION_REQUIRED",
      error:
        staleScenarioKeys.length > 0
          ? "client facing agent needs certification revalidation before operational usage."
          : "client facing agent requires certification before operational usage.",
      deep_link: "/agency/ai-setup/readiness/preview/client_facing",
      agent_class: "client_facing",
      required_mode: "operational",
      missing_certification_scenarios: staleScenarioKeys.length > 0 ? [] : ["client_response_certification"],
      stale_certification_scenarios: staleScenarioKeys,
    },
    412,
    args.cors,
  );
}

function getCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const cookies = header.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const idx = cookie.indexOf("=");
    if (idx === -1) continue;
    const cookieName = cookie.slice(0, idx);
    const cookieVal = cookie.slice(idx + 1);
    if (cookieName === name) return cookieVal;
  }
  return null;
}

async function verifyClientPortalToken(token: string): Promise<ClientPortalJwtPayload | null> {
  if (!CLIENT_PORTAL_JWT_SECRET) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(CLIENT_PORTAL_JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const base64 = encodedSignature.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const signature = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
    );
    if (!isValid) return null;

    const payloadBase64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const payloadPadded = payloadBase64 + "=".repeat((4 - (payloadBase64.length % 4)) % 4);
    const payload: ClientPortalJwtPayload = JSON.parse(atob(payloadPadded));

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
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

async function safeLoadRecentTurns(opts: {
  supabase: any;
  agencyId: string;
  clientId: string;
  threadId: string;
}): Promise<AiRepChatTurn[]> {
  try {
    const { data } = await opts.supabase
      .from("ai_episodic_buffers")
      .select("turns_json")
      .eq("agency_id", opts.agencyId)
      .eq("client_id", opts.clientId)
      .eq("thread_id", opts.threadId)
      .maybeSingle();

    const turns = Array.isArray((data as any)?.turns_json) ? (data as any).turns_json : [];
    return turns.flatMap((turn: any) => {
      const out: AiRepChatTurn[] = [];
      if (typeof turn?.u === "string" && turn.u.trim()) out.push({ role: "user", content: turn.u });
      if (typeof turn?.a === "string" && turn.a.trim()) out.push({ role: "assistant", content: turn.a });
      return out;
    });
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
    const cookieHeader = req.headers.get("Cookie");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
    const cookieToken = getCookie(cookieHeader, "cp_access_token");
    const token = bearerToken ?? cookieToken;
    if (!token) return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders(req));

    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user = userData?.user;
    const clientPortalUser = user ? null : await verifyClientPortalToken(token);
    if ((userError || !user) && !clientPortalUser) {
      return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders(req));
    }

    userId = user?.id ?? clientPortalUser?.sub;
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

  if (clientPortalUser) {
    const { data: cpUser } = await supabase
      .from("client_users")
      .select("id, client_id, agency_id")
      .eq("id", clientPortalUser.sub)
      .maybeSingle();
    const ownsClient =
      cpUser?.client_id === clientId &&
      cpUser?.agency_id === clientRow.agency_id &&
      clientPortalUser.client_id === clientId &&
      clientPortalUser.agency_id === clientRow.agency_id;
    if (!ownsClient) return jsonResponse({ error: "Forbidden" }, 403, corsHeaders(req));
  } else if (user) {
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
  }

  const activationResponse = await enforceAgencyAgentActivation({
    supabaseClient: supabase,
    agencyId: clientRow.agency_id,
    agentClass: "client_facing",
    requiredMode: "operational",
    corsHeaders: corsHeaders(req),
  });
  if (activationResponse) {
    return activationResponse;
  }

  // Keep the operational-only client-facing surface explicitly certification-gated
  // even if a stale shared helper is ever deployed on this function revision.
  const certificationResponse = await enforceClientFacingCertification({
    supabase,
    agencyId: clientRow.agency_id,
    cors: corsHeaders(req),
  });
  if (certificationResponse) {
    return certificationResponse;
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
  const threadId = (typeof body.thread_id === "string" && body.thread_id.trim())
    ? String(body.thread_id).trim().slice(0, 160)
    : `rep-chat:${clientId}`;

  // Governed generation: only call the LLM when the brief passed the deterministic gate.
  // On any LLM failure we fall back to the deterministic mapping and record why.
  let assistantMessage = decision.assistant_message;
  let suggestions = decision.suggestions;
  let llmModel: string | null = null;
  let llmUsage: { inputTokens?: number; outputTokens?: number } | undefined;
  let llmLatencyMs = 0;
  let fallbackReason: string | null = null;

  if (!decision.unknown && brief) {
    const llmStart = Date.now();
    try {
      const history = await safeLoadRecentTurns({
        supabase,
        agencyId: clientRow.agency_id,
        clientId,
        threadId,
      });
      const llm = await ai.run({
        taskType: TaskType.CHAT_GENERAL,
        messages: buildAiRepChatMessages({ brief, message, retrievedSnippets, history }),
        context: {
          agencyId: clientRow.agency_id,
          clientId,
          userId,
          environment: "prod",
          supabase,
          skipUsageLog: true,
        },
      });
      llmLatencyMs = Date.now() - llmStart;
      if (!llm.unknown && !llm.error && typeof llm.text === "string" && llm.text.trim().length > 0) {
        const parsed = parseAiRepLlmReply(llm.text);
        assistantMessage = parsed.assistant_message;
        suggestions = parsed.suggestions.length >= 2 ? parsed.suggestions : decision.suggestions;
        llmModel = llm.meta?.model ?? null;
        llmUsage = llm.usage;
      } else {
        fallbackReason = llm.error ?? (llm.unknown ? "llm_returned_unknown" : "llm_empty_response");
      }
    } catch (err) {
      llmLatencyMs = Date.now() - llmStart;
      fallbackReason = err instanceof Error ? `llm_error: ${err.message}`.slice(0, 200) : "llm_error";
    }
  }

  // Phase 2: episodic memory capture (0 cross-tenant leaks; tenant scoped by agency_id + client_id).
  // Disabled by default behind ENABLE_EPISODIC_MEMORY.
  if (isEpisodicMemoryEnabled() && isPhase2EnabledForAgency(clientRow.agency_id)) {
    const turnUser = String(message).slice(0, 600);
    const turnAssistant = String(assistantMessage ?? "").slice(0, 600);
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
            created_by: user?.id ?? null,
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
    model: llmModel ?? Deno.env.get("CHAT_MODEL_ID") ?? "mapping-only",
    tokens_estimate: llmUsage?.inputTokens ?? Math.ceil(message.length / 4),
    tokens_in: llmUsage?.inputTokens ?? Math.ceil(message.length / 4),
    tokens_out: llmUsage?.outputTokens ?? Math.ceil(assistantMessage.length / 4),
    latency_ms: llmLatencyMs,
    unknown: decision.unknown,
    metadata: {
      generation: llmModel ? "llm" : "deterministic",
      fallback_reason: fallbackReason,
    },
  });

    return jsonResponse(
      {
        assistant_message: assistantMessage,
        suggestions,
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

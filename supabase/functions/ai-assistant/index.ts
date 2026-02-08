import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";
import { runAiTask } from "../_shared/ai-router.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";
import { fetchBrainDocument } from "../_shared/brain-documents.ts";
import { embedQueryForRag, getMatchRpcName } from "../_shared/rag-index.ts";
import { generateSpanId, generateTraceId, logOtelSpan } from "../../../src/ai/otel.ts";
import { resolvePersonaPromptContext, type PersonaPromptContext } from "../_shared/persona-prompt-context.ts";

type MinimalSupabase = ReturnType<typeof createClient>;

type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type Thread = {
  id: string;
  agency_id: string;
  client_id: string;
  user_id: string;
  kind: "assistant";
  title: string | null;
  summary: string | null;
};

type AiAssistantResponseJson = {
  assistant_message: string;
  proposals: Array<{
    id: string;
    module: string;
    title: string;
    summary: string;
    proposed_content_json: Record<string, unknown>;
    risks?: string[];
  }>;
  unknown: boolean;
  confidence: number;
  context_request?: {
    requests: Array<Record<string, unknown>>;
  };
};

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function normalizeText(value: unknown, maxLen = 8000): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}…` : trimmed;
}

function normalizeChatHistory(value: unknown, maxMessages = 20): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  const messages: ChatMessage[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const role = record.role;
    const content = normalizeText(record.content);
    if ((role !== "user" && role !== "assistant") || !content) continue;
    messages.push({ role, content });
  }
  return messages.slice(-maxMessages);
}

async function requireMembership(supabase: MinimalSupabase, userId: string, agencyId: string) {
  const { data } = await supabase
    .from("agency_members")
    .select("agency_id, role")
    .eq("user_id", userId)
    .eq("agency_id", agencyId)
    .maybeSingle();
  return data as { agency_id: string; role: string } | null;
}

async function loadProfile(supabase: MinimalSupabase, userId: string) {
  const { data } = await supabase.from("profiles").select("full_name, email").eq("id", userId).maybeSingle();
  return data as { full_name: string | null; email: string } | null;
}

async function getClientAndAgency(supabase: MinimalSupabase, clientId: string) {
  const { data } = await supabase
    .from("clients")
    .select("id, agency_id, name, niche, website, status")
    .eq("id", clientId)
    .maybeSingle();
  return data as
    | { id: string; agency_id: string; name: string; niche: string | null; website: string | null; status: string | null }
    | null;
}

async function getOrCreateThread(supabase: MinimalSupabase, agencyId: string, clientId: string, userId: string) {
  const existing = await supabase
    .from("client_ai_chat_threads")
    .select("id, agency_id, client_id, user_id, kind, title, summary")
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .eq("kind", "assistant")
    .maybeSingle();
  if (existing.data) return existing.data as Thread;

  const created = await supabase
    .from("client_ai_chat_threads")
    .insert({
      agency_id: agencyId,
      client_id: clientId,
      user_id: userId,
      kind: "assistant",
      title: null,
      summary: null,
    })
    .select("id, agency_id, client_id, user_id, kind, title, summary")
    .single();
  if (created.error || !created.data) throw new Error("Failed to create chat thread");
  return created.data as Thread;
}

async function insertMessage(
  supabase: MinimalSupabase,
  threadId: string,
  role: ChatRole,
  content: string,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await supabase.from("client_ai_chat_messages").insert({
    thread_id: threadId,
    role,
    content,
    metadata,
  });
  if (error) throw new Error("Failed to persist chat message");
}

async function loadRecentMessages(supabase: MinimalSupabase, threadId: string, limit = 24): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("client_ai_chat_messages")
    .select("role, content")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error("Failed to load chat messages");
  return (data ?? []).map((m: any) => ({ role: m.role as ChatRole, content: String(m.content ?? "") }));
}

async function loadActiveStrategyId(supabase: MinimalSupabase, clientId: string): Promise<string | null> {
  const { data } = await supabase
    .from("strategies")
    .select("id")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function loadStrategyModules(
  supabase: MinimalSupabase,
  clientId: string,
  strategyId: string,
  modules: string[] | null,
  includeLocked: boolean,
) {
  let query = supabase
    .from("strategy_modules")
    .select("id, module, content_json, locked, status")
    .eq("client_id", clientId)
    .eq("strategy_id", strategyId);
  if (Array.isArray(modules) && modules.length > 0) {
    query = query.in("module", modules);
  }
  if (!includeLocked) {
    query = query.eq("locked", false);
  }
  const { data, error } = await query.order("module");
  if (error) throw new Error("Failed to load strategy modules");
  return (data ?? []).map((m: any) => ({
    id: m.id,
    module: m.module,
    locked: !!m.locked,
    status: m.status,
    content_json: m.content_json ?? {},
  }));
}

async function loadStrategyDocument(supabase: MinimalSupabase, clientId: string) {
  const { data } = await supabase
    .from("strategy_documents")
    .select("id, content_markdown, updated_at")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    content_markdown: (data.content_markdown as string | null) ?? "",
    updated_at: data.updated_at,
  };
}

async function runEmbeddingsSearch(supabase: MinimalSupabase, args: {
  agencyId: string;
  clientId?: string | null;
  query: string;
  docTypes?: string[] | null;
  modules?: string[] | null;
  matchCount?: number | null;
  minSimilarity?: number | null;
}) {
  const embedded = await embedQueryForRag({ query: args.query });
  const rpcName = getMatchRpcName({ scoped: true });
  const { data, error } = await supabase.rpc(rpcName, {
    p_agency_id: args.agencyId,
    p_query_embedding: embedded.embedding as any,
    p_client_id: args.clientId ?? null,
    p_match_count: Math.min(Math.max(Number(args.matchCount ?? 8), 1), 12),
    p_doc_types: args.docTypes ?? null,
    p_modules: args.modules ?? null,
    p_min_similarity: typeof args.minSimilarity === "number" ? args.minSimilarity : 0.2,
  });
  if (error) return { status: "error", results: [] as any[] };
  return { status: "ok", results: data ?? [] };
}

function buildSystemPrompt(args: {
  userName: string;
  userRole: string;
  clientName: string;
  persona: PersonaPromptContext;
  startup: {
    rep_policy: Record<string, unknown>;
    quality_bar: Record<string, unknown>;
  };
  summary?: string | null;
  allowStrategyProposals: boolean;
}) {
  return [
    `You are ${args.persona.assistant_name}, the AI Assistant inside SMMAHUB.`,
    "",
    "You are chatting with an agency team member about a specific client.",
    `User: ${args.userName} (${args.userRole})`,
    `Client: ${args.clientName}`,
    `Persona source: ${args.persona.source} (cache version: ${args.persona.cache_version})`,
    args.persona.tone_traits.length > 0
      ? `Tone traits: ${args.persona.tone_traits.join(", ")}.`
      : "Tone traits: clear, practical, professional.",
    args.persona.expertise_traits.length > 0
      ? `Expertise traits: ${args.persona.expertise_traits.join(", ")}.`
      : "Expertise traits: agency operations, strategy, and execution.",
    "",
    "FOLLOW THESE RULES:",
    "- Be conversational and helpful (like a normal chat assistant).",
    "- Follow the agency's Communication Style and Quality Standards provided below.",
    "- Do not assume missing facts. If you need more info, request it using context_request (schema).",
    "- Default to advice/brainstorming; do NOT auto-propose module edits unless the user explicitly asks to change/update a module.",
    "",
    "CAPABILITIES:",
    `- Strategy module proposals: ${args.allowStrategyProposals ? "enabled" : "disabled"}.`,
    "- You never apply changes yourself. The user must approve applies and can undo via history.",
    "",
    "CONTEXT REQUEST MECHANISM (use when needed):",
    "- Add context_request.requests with one or more of:",
    '  - { "type":"brain_module", "module":"sop_strategy" | "tone_voice" | "bootstrap" | ... }',
    '  - { "type":"strategy_modules", "modules":[...], "include_locked":false }',
    '  - { "type":"strategy_document" }',
    '  - { "type":"client_basics" }',
    '  - { "type":"embeddings_search", "query":"...", "doc_types":[...], "modules":[...], "match_count":8, "min_similarity":0.2 }',
    "",
    args.summary ? `Conversation summary so far:\n${args.summary}` : "",
    "",
    "Agency Communication Style (rep_policy JSON):",
    JSON.stringify(args.startup.rep_policy ?? {}, null, 2),
    "",
    "Agency Quality Standards (quality_bar JSON):",
    JSON.stringify(args.startup.quality_bar ?? {}, null, 2),
  ]
    .filter(Boolean)
    .join("\n");
}

function safeJsonStringify(value: unknown, maxChars = 50_000) {
  const text = JSON.stringify(value, null, 2);
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n…(truncated)`;
}

function pickAllowStrategyProposals(activeTab: unknown) {
  // Strategy proposals are safe across ClientDetail pages (user approval + undo),
  // but we keep a toggle so we can disable outside Strategy if desired later.
  if (typeof activeTab !== "string") return true;
  return true;
}

async function summarizeThreadIfNeeded(supabase: MinimalSupabase, thread: Thread, messages: ChatMessage[]) {
  // Cheap summarization to keep context small as chats grow.
  // Only runs when we have enough content; keeps cost low by using the router's summarizer.
  const MIN_MESSAGES = 18;
  if (messages.length < MIN_MESSAGES) return;

  const text = messages
    .slice(-24)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  const result = await runAiTask({
    task_type: TaskType.SUMMARIZE,
    tenant: { agency_id: thread.agency_id, client_id: thread.client_id, user_id: thread.user_id },
    input: { message: `Summarize this conversation for future context:\n\n${text}` },
    metadata: {},
    supabase,
  });

  const summary = normalizeText(result.assistant_message, 4000);
  if (!summary) return;
  await supabase.from("client_ai_chat_threads").update({ summary }).eq("id", thread.id);
}

function extractContextRequests(json: AiAssistantResponseJson): Array<Record<string, unknown>> {
  if (!json || typeof json !== "object") return [];
  const cr = (json as any).context_request;
  if (!cr || typeof cr !== "object" || Array.isArray(cr)) return [];
  const requests = (cr as any).requests;
  if (!Array.isArray(requests)) return [];
  return requests.filter((r) => r && typeof r === "object" && !Array.isArray(r));
}

serve(async (req: Request) => {
  const traceId = generateTraceId();
  const spanId = generateSpanId();
  const spanStart = Date.now();
  let response: Response | undefined;
  let supabase: MinimalSupabase | null = null;
  let agencyId: string | undefined;
  let clientId: string | undefined;
  let userId: string | undefined;
  let observedPersonaReloaded = false;
  let observedPersonaSource = "default";
  let observedPersonaCacheVersion: string | null = null;
  let observedContextRequests = 0;

  response = await (async () => {
    try {
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders(req) });
      }

      if (req.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders(req));
      }

      const guardResponse = getEndpointGuardResponse("ai-assistant", corsHeaders(req));
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
      const action = (body.action as string | undefined) ?? "send";
      clientId = (body.client_id as string | undefined) ?? "";
      const strategyIdInput = (body.strategy_id as string | undefined) ?? null;
      const activeTab = body.active_tab;
      const message = normalizeText(body.message, 4000);
      const clientChatHistory = normalizeChatHistory(body.chat_history);

      if (!clientId) {
        return jsonResponse({ error: "client_id is required" }, 400, corsHeaders(req));
      }

      const client = await getClientAndAgency(supabase, clientId);
      if (!client) {
        return jsonResponse({ error: "Client not found" }, 404, corsHeaders(req));
      }

      agencyId = client.agency_id;
      const membership = await requireMembership(supabase, user.id, client.agency_id);
      if (!membership) {
        return jsonResponse({ error: "Forbidden" }, 403, corsHeaders(req));
      }

    const profile = await loadProfile(supabase, user.id);
    const userName = profile?.full_name?.trim() || profile?.email || "Team member";
    const userRole = membership.role || "member";

    // Ensure AI Setup is complete for the agency (rep_policy + quality_bar approved).
    const repPolicy = await fetchBrainDocument(supabase as any, client.agency_id, "rep_policy");
    const qualityBar = await fetchBrainDocument(supabase as any, client.agency_id, "quality_bar");
    const missingSetup: string[] = [];
    if (!repPolicy || repPolicy.status !== "approved") missingSetup.push("Communication Style");
    if (!qualityBar || qualityBar.status !== "approved") missingSetup.push("Quality Standards");
    if (missingSetup.length > 0) {
      return jsonResponse(
        {
          error: "AI Assistant is not configured yet. Complete AI Setup to continue.",
          code: "AI_SETUP_REQUIRED",
          missing: missingSetup,
        },
        400,
        corsHeaders(req),
      );
    }

    const persona = await resolvePersonaPromptContext({
      supabase,
      agencyId: client.agency_id,
      clientId,
      scope: "client",
      fallbackToAgencyScope: true,
    });
    observedPersonaReloaded = persona.reloaded;
    observedPersonaSource = persona.source;
    observedPersonaCacheVersion = persona.cache_version;

    await logOtelSpan(supabase, {
      traceId,
      spanId: generateSpanId(),
      parentSpanId: spanId,
      stage: "edge.ai-assistant.persona_context",
      taskType: TaskType.AI_ASSISTANT,
      agencyId: client.agency_id,
      clientId,
      userId,
      latencyMs: 0,
      attributes: {
        persona_reloaded: persona.reloaded,
        persona_source: persona.source,
        persona_cache_version: persona.cache_version,
      },
    });

    const thread = await getOrCreateThread(supabase, client.agency_id, clientId, user.id);

    if (action === "load") {
      const msgs = await loadRecentMessages(supabase, thread.id, 60);
      return jsonResponse(
        {
          thread_id: thread.id,
          summary: thread.summary,
          messages: msgs,
        },
        200,
        corsHeaders(req),
      );
    }

    if (!message) {
      return jsonResponse({ error: "message is required" }, 400, corsHeaders(req));
    }

    await insertMessage(supabase, thread.id, "user", message);

    const allowStrategyProposals = pickAllowStrategyProposals(activeTab);
    const strategyId = strategyIdInput ?? (await loadActiveStrategyId(supabase, clientId));

    const recentMessages = await loadRecentMessages(supabase, thread.id, 24);
    const systemPrompt = buildSystemPrompt({
      userName,
      userRole,
      clientName: client.name,
      persona,
      startup: { rep_policy: repPolicy.content_json ?? {}, quality_bar: qualityBar.content_json ?? {} },
      summary: thread.summary,
      allowStrategyProposals,
    });

    // Startup client basics as a lightweight system message (not the full strategy).
    const clientBasics = {
      id: client.id,
      name: client.name,
      niche: client.niche,
      website: client.website,
      status: client.status,
      strategy_id: strategyId,
    };

    const baseMessages = [
      { role: "system", content: systemPrompt },
      { role: "system", content: `Client basics (JSON):\n${safeJsonStringify(clientBasics, 4000)}` },
      // Also include any immediate UI-provided messages (e.g. unsaved in-session state) as optional hints.
      ...clientChatHistory.map((m) => ({ role: m.role, content: m.content })),
      ...recentMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const runOnce = async (messagesForAi: Array<{ role: string; content: string }>) => {
      const result = await runAiTask({
        task_type: TaskType.AI_ASSISTANT,
        tenant: {
          agency_id: client.agency_id,
          user_id: user.id,
          client_id: clientId,
        },
        input: { message: "" },
        context: { messages: messagesForAi },
        metadata: {
          strategy_id: strategyId,
          active_tab: typeof activeTab === "string" ? activeTab : null,
          allow_strategy_proposals: allowStrategyProposals,
          persona_cache_version: persona.cache_version,
          persona_reloaded: persona.reloaded,
        },
        supabase,
      });
      return result;
    };

    // On-demand context loop (max 2 hops).
    let messagesForAi = [...baseMessages, { role: "user", content: message }];
    let final = await runOnce(messagesForAi);
    let json = (final.json ?? null) as AiAssistantResponseJson | null;

    for (let hop = 0; hop < 2; hop++) {
      if (!json || typeof json !== "object") break;
      const requests = extractContextRequests(json);
      observedContextRequests += requests.length;
      if (requests.length === 0) break;

      const contextPayload: Record<string, unknown> = { fetched: [] as any[] };
      for (const req of requests.slice(0, 6)) {
        const type = String((req as any).type ?? "");
        if (type === "brain_module") {
          const module = String((req as any).module ?? "");
          const doc = module ? await fetchBrainDocument(supabase as any, client.agency_id, module as any) : null;
          (contextPayload.fetched as any[]).push({
            type,
            module,
            found: !!doc,
            status: doc?.status ?? null,
            content_json: doc?.content_json ?? null,
          });
        } else if (type === "client_basics") {
          (contextPayload.fetched as any[]).push({ type, client: clientBasics });
        } else if (type === "strategy_document") {
          const doc = await loadStrategyDocument(supabase, clientId);
          (contextPayload.fetched as any[]).push({
            type,
            found: !!doc,
            strategy_document: doc,
          });
        } else if (type === "strategy_modules") {
          if (!strategyId) {
            (contextPayload.fetched as any[]).push({ type, error: "No active strategy found" });
            continue;
          }
          const modules = Array.isArray((req as any).modules) ? ((req as any).modules as any[]).map(String) : null;
          const includeLocked = Boolean((req as any).include_locked ?? false);
          const mods = await loadStrategyModules(supabase, clientId, strategyId, modules, includeLocked);
          (contextPayload.fetched as any[]).push({ type, strategy_id: strategyId, modules: mods });
        } else if (type === "embeddings_search") {
          const query = normalizeText((req as any).query, 400);
          if (!query) continue;
          const docTypes = Array.isArray((req as any).doc_types) ? ((req as any).doc_types as any[]).map(String) : null;
          const modules = Array.isArray((req as any).modules) ? ((req as any).modules as any[]).map(String) : null;
          const matchCount = typeof (req as any).match_count === "number" ? (req as any).match_count : 8;
          const minSimilarity = typeof (req as any).min_similarity === "number" ? (req as any).min_similarity : 0.2;
          const search = await runEmbeddingsSearch(supabase, {
            agencyId: client.agency_id,
            clientId,
            query,
            docTypes,
            modules,
            matchCount,
            minSimilarity,
          });
          (contextPayload.fetched as any[]).push({ type, status: search.status, results: search.results });
        }
      }

      messagesForAi = [
        ...baseMessages,
        { role: "system", content: `Additional context (JSON):\n${safeJsonStringify(contextPayload, 80_000)}` },
        { role: "user", content: message },
      ];

      final = await runOnce(messagesForAi);
      json = (final.json ?? null) as AiAssistantResponseJson | null;
    }

    const assistantText = normalizeText(final.assistant_message, 12_000) || "Done.";
    await insertMessage(
      supabase,
      thread.id,
      "assistant",
      assistantText,
      json && typeof json === "object" ? { json } : {},
    );

    // Best-effort summarization (keeps future turns fast + cheap).
    try {
      const msgsForSummary = await loadRecentMessages(supabase, thread.id, 60);
      await summarizeThreadIfNeeded(supabase, thread, msgsForSummary);
    } catch {
      // ignore
    }

      return jsonResponse(
      {
        thread_id: thread.id,
        assistant_message: assistantText,
        json: final.json,
        meta: final.meta,
        usage: final.usage,
        schemaOk: final.schemaOk,
        error: final.error ?? null,
      },
      200,
      corsHeaders(req),
    );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unhandled error";
      return jsonResponse({ error: message }, 500, corsHeaders(req));
    }
  })();

  await logOtelSpan(supabase, {
    traceId,
    spanId,
    stage: "edge.ai-assistant",
    taskType: TaskType.AI_ASSISTANT,
    agencyId,
    clientId,
    userId,
    latencyMs: Date.now() - spanStart,
    attributes: {
      http_status: response?.status ?? 0,
      persona_reloaded: observedPersonaReloaded,
      persona_source: observedPersonaSource,
      persona_cache_version: observedPersonaCacheVersion,
      context_request_count: observedContextRequests,
    },
  });

  return response!;
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { calculateCost, checkBudget, incrementBudget } from "../_shared/budgets.ts";
import { ai } from "../../../src/ai/router.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";
import { applyRagPolicy, getRagConfig, shouldUseRagPolicy } from "../../../src/ai/ragPolicy.ts";
import { validateCitations } from "../../../src/ai/citations.ts";
import { capMatchesByTokenBudget, clampMatchCount, getInitialMatchCount, applyScoreRerank } from "../_shared/retrieval.ts";
import { embedQueryForRag, getMatchRpcName } from "../_shared/rag-index.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";
import { generateSpanId, generateTraceId, logOtelSpan } from "../../../src/ai/otel.ts";

const TOKEN_CAP = 6000;
const DAILY_LIMIT = 20;
const MONTHLY_BUDGET = 50;
const CLIENT_MEMORY_TOP_K = 6;
const AGENCY_MEMORY_TOP_K = 4;
const EXEMPLAR_TOP_K = 2;
const MAX_CONTEXT_CHARS = 6000;
const MAX_CONTEXT_TOKENS = 900;
const DEFAULT_COST_ESTIMATION_METHOD = "estimate_chars_div3";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function estimateTokensForCost(text: string) {
  return Math.ceil(text.length / 3);
}

function extractUsageFromRaw(raw: unknown) {
  const usage = (raw as any)?.usage;
  const inputTokens = usage?.prompt_tokens ?? usage?.input_tokens;
  const outputTokens = usage?.completion_tokens ?? usage?.output_tokens;
  if (typeof inputTokens !== "number" && typeof outputTokens !== "number") return undefined;
  return { inputTokens, outputTokens };
}

function utcDayString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function utcMonthString(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function emptySources() {
  return {
    agency_brain_fields: [],
    client_brain_fields: [],
    memory_citations: [],
  };
}

function buildUnknown(questions: string[]) {
  return {
    answer: "UNKNOWN",
    unknown: true,
    questions,
    confidence: 0,
    sources: emptySources(),
    escalate_to_human: false,
    escalation_reason: null,
  };
}

function truncateContext(text: string, limit: number) {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...`;
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

      const guardResponse = getEndpointGuardResponse("ai-ask", corsHeaders(req));
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
      const startTime = Date.now();
      const strictSchema = Deno.env.get("AI_SCHEMA_STRICT") === "true";
      const body = await req.json().catch(() => ({}));
      agencyId = body.agency_id as string | undefined;
      clientId = body.client_id as string | undefined;
      const question = (body.question as string | undefined)?.trim() ?? "";

      if (!agencyId || !question) {
        return jsonResponse({ error: "agency_id and question are required" }, 400, corsHeaders(req));
      }

  const { data: membership } = await supabase
    .from("agency_members")
    .select("agency_id")
    .eq("user_id", user.id)
    .eq("agency_id", agencyId)
    .maybeSingle();

      if (!membership) {
        return jsonResponse({ error: "Forbidden" }, 403, corsHeaders(req));
      }

  const { data: promptRow, error: promptError } = await supabase
    .from("ai_prompt_registry")
    .select("id, version, model, max_tokens")
    .eq("task_type", "rag_ask")
    .eq("status", "active")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

      if (promptError || !promptRow) {
        return jsonResponse({ error: "Prompt registry not configured" }, 500, corsHeaders(req));
      }

  const ragModelId = Deno.env.get("RAG_MODEL_ID") ?? "gpt-5-mini";
  const dayKey = utcDayString();
  const monthKey = utcMonthString();
  const useRagPolicy = shouldUseRagPolicy({ agencyId, clientId });
  const ragConfig = getRagConfig(TaskType.CLIENT_PORTAL_QA);

  const { data: rateRow } = await supabase
    .from("ai_rate_limits")
    .select("id, used_count, limit_per_day")
    .eq("agency_id", agencyId)
    .eq("user_id", user.id)
    .eq("day_yyyy_mm_dd", dayKey)
    .maybeSingle();

      if (!rateRow) {
        await supabase.from("ai_rate_limits").insert({
      agency_id: agencyId,
      user_id: user.id,
      day_yyyy_mm_dd: dayKey,
      limit_per_day: DAILY_LIMIT,
      used_count: 0,
      reset_time_utc: "00:00",
      reset_timezone: "UTC",
    });
      } else if (rateRow.used_count >= rateRow.limit_per_day) {
        const latency = Date.now() - startTime;
        const responsePayload = {
      answer: "UNKNOWN",
      unknown: true,
      questions: ["Daily rate limit reached. Please try again after 00:00 UTC."],
      confidence: 0,
      sources: emptySources(),
      escalate_to_human: false,
      escalation_reason: null,
    };

        await supabase.from("ai_runs").insert({
      agency_id: agencyId,
      client_id: clientId ?? null,
      user_id: user.id,
      prompt_id: promptRow.id,
      prompt_version: promptRow.version,
      model: promptRow.model,
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      latency_ms: latency,
      success: true,
      citations: responsePayload.sources,
      unknown: true,
      escalate_to_human: false,
      escalation_reason: null,
      metadata: { cost_estimation_method: DEFAULT_COST_ESTIMATION_METHOD },
    });

        return jsonResponse(responsePayload, 200, corsHeaders(req));
      }

  let budgetSnapshot = await checkBudget(supabase, agencyId, monthKey);
  if (!budgetSnapshot.budgetId) {
    await supabase.from("ai_budgets").insert({
      agency_id: agencyId,
      month_yyyy_mm: monthKey,
      budget_usd: MONTHLY_BUDGET,
      spent_usd: 0,
      hard_stop: true,
      reset_day: 1,
      reset_time_utc: "00:00",
      reset_timezone: "UTC",
    });
    budgetSnapshot = await checkBudget(supabase, agencyId, monthKey);
  }

      if (!budgetSnapshot.allowed && budgetSnapshot.hardStop) {
        const latency = Date.now() - startTime;
        const responsePayload = {
      answer: "UNKNOWN",
      unknown: true,
      questions: null,
      confidence: 0,
      sources: emptySources(),
      escalate_to_human: true,
      escalation_reason: "Monthly AI budget exceeded",
    };

        await supabase.from("ai_escalations").insert({
      agency_id: agencyId,
      client_id: clientId ?? null,
      user_id: user.id,
      question,
      reason: "Monthly AI budget exceeded",
      status: "open",
      assignee_role: "agency_admin",
    });

        await supabase.from("ai_runs").insert({
      agency_id: agencyId,
      client_id: clientId ?? null,
      user_id: user.id,
      prompt_id: promptRow.id,
      prompt_version: promptRow.version,
      model: ragModelId,
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      latency_ms: latency,
      success: true,
      citations: responsePayload.sources,
      unknown: true,
      escalate_to_human: true,
      escalation_reason: responsePayload.escalation_reason,
      metadata: { cost_estimation_method: DEFAULT_COST_ESTIMATION_METHOD },
    });

        return jsonResponse(responsePayload, 200, corsHeaders(req));
      }

  const tokenEstimate = estimateTokens(question);
      if (tokenEstimate > TOKEN_CAP) {
        const latency = Date.now() - startTime;
        const responsePayload = {
      answer: "UNKNOWN",
      unknown: true,
      questions: ["Your request is too long. Please shorten it."],
      confidence: 0,
      sources: emptySources(),
      escalate_to_human: false,
      escalation_reason: null,
    };

        await supabase.from("ai_runs").insert({
      agency_id: agencyId,
      client_id: clientId ?? null,
      user_id: user.id,
      prompt_id: promptRow.id,
      prompt_version: promptRow.version,
      model: promptRow.model,
      tokens_in: tokenEstimate,
      tokens_out: 0,
      cost_usd: 0,
      latency_ms: latency,
      success: true,
      citations: responsePayload.sources,
      unknown: true,
      escalate_to_human: false,
      escalation_reason: null,
      metadata: {
        cost_estimation_method: DEFAULT_COST_ESTIMATION_METHOD,
        retrieval_count: 0,
        context_truncated: false,
        doc_types_used: [],
        rag_policy_version: useRagPolicy ? "v1" : "legacy",
      },
    });

        return jsonResponse(responsePayload, 200, corsHeaders(req));
      }

  await supabase
    .from("ai_rate_limits")
    .update({ used_count: (rateRow?.used_count ?? 0) + 1 })
    .eq("agency_id", agencyId)
    .eq("user_id", user.id)
    .eq("day_yyyy_mm_dd", dayKey);

  let queryEmbedding: number[];
      try {
        const embedded = await embedQueryForRag({ query: question });
        queryEmbedding = embedded.embedding as any;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("API_KEY is not configured")) {
          const responsePayload = buildUnknown([
            "AI embeddings are not configured. Please contact support.",
          ]);
          const latency = Date.now() - startTime;
          await supabase.from("ai_runs").insert({
        agency_id: agencyId,
        client_id: clientId ?? null,
        user_id: user.id,
        prompt_id: promptRow.id,
        prompt_version: promptRow.version,
        model: promptRow.model,
        tokens_in: tokenEstimate,
        tokens_out: 0,
        cost_usd: 0,
        latency_ms: latency,
        success: true,
        citations: responsePayload.sources,
        unknown: true,
        escalate_to_human: false,
        escalation_reason: null,
        metadata: { cost_estimation_method: DEFAULT_COST_ESTIMATION_METHOD },
      });
          await supabase.from("ai_usage_logs").insert({
        agency_id: agencyId,
        client_id: clientId ?? null,
        endpoint: "ai-ask",
        model: "embeddings-not-configured",
        tokens_estimate: tokenEstimate,
        tokens_in: tokenEstimate,
        tokens_out: 0,
        latency_ms: Date.now() - startTime,
        unknown: true,
      });
          return jsonResponse(responsePayload, 200, corsHeaders(req));
        }
        throw error;
      }

  const legacyClientDocTypes = ["client_guidelines", "client_notes", "approved_posts", "ai_artifact", "strategy_draft"];
  const legacyAgencyDocTypes = ["agency_sop"];
  const legacyExemplarDocTypes = ["agency_exemplar_strategy"];

  const rpcName = getMatchRpcName({ scoped: false });
  const { data: clientMatches } = await supabase.rpc(rpcName, {
    p_agency_id: agencyId,
    p_client_id: clientId ?? null,
    p_query_embedding: queryEmbedding,
    p_match_count: clampMatchCount(
      getInitialMatchCount(useRagPolicy ? ragConfig.client_memory_top_k : CLIENT_MEMORY_TOP_K, 50),
    ),
    p_doc_types: useRagPolicy ? ragConfig.client_doc_types : legacyClientDocTypes,
    p_modules: null,
    p_min_similarity: useRagPolicy ? ragConfig.min_similarity : 0.2,
  });

  const { data: agencyMatches } = await supabase.rpc(rpcName, {
    p_agency_id: agencyId,
    p_client_id: null,
    p_query_embedding: queryEmbedding,
    p_match_count: clampMatchCount(
      getInitialMatchCount(useRagPolicy ? ragConfig.agency_memory_top_k : AGENCY_MEMORY_TOP_K, 50),
    ),
    p_doc_types: useRagPolicy ? ragConfig.agency_doc_types : legacyAgencyDocTypes,
    p_modules: null,
    p_min_similarity: useRagPolicy ? ragConfig.min_similarity : 0.2,
  });

  const { data: exemplarMatches } = await supabase.rpc(rpcName, {
    p_agency_id: agencyId,
    p_client_id: null,
    p_query_embedding: queryEmbedding,
    p_match_count: clampMatchCount(
      getInitialMatchCount(useRagPolicy ? ragConfig.exemplar_top_k : EXEMPLAR_TOP_K, 50),
    ),
    p_doc_types: useRagPolicy ? ragConfig.exemplar_doc_types : legacyExemplarDocTypes,
    p_modules: null,
    p_min_similarity: useRagPolicy ? ragConfig.min_similarity : 0.2,
  });

  const matches = applyScoreRerank([
    ...(clientMatches || []),
    ...(agencyMatches || []),
    ...(exemplarMatches || []),
  ], 12);

      if (matches.length === 0) {
        const responsePayload = buildUnknown([
          "What platform is this for?",
          "What is the primary goal of this request?",
        ]);
        const latency = Date.now() - startTime;
        await supabase.from("ai_runs").insert({
      agency_id: agencyId,
      client_id: clientId ?? null,
      user_id: user.id,
      prompt_id: promptRow.id,
      prompt_version: promptRow.version,
      model: promptRow.model,
      tokens_in: tokenEstimate,
      tokens_out: 0,
      cost_usd: 0,
      latency_ms: latency,
      success: true,
      citations: responsePayload.sources,
      unknown: true,
      escalate_to_human: false,
      escalation_reason: null,
      metadata: { cost_estimation_method: DEFAULT_COST_ESTIMATION_METHOD },
    });
        await supabase.from("ai_usage_logs").insert({
      agency_id: agencyId,
      client_id: clientId ?? null,
      endpoint: "ai-ask",
      model: "retrieval-only",
      tokens_estimate: tokenEstimate,
      tokens_in: tokenEstimate,
      tokens_out: 0,
      latency_ms: Date.now() - startTime,
      unknown: true,
    });
        return jsonResponse(responsePayload, 200, corsHeaders(req));
      }

  const legacyMatches = useRagPolicy ? matches : capMatchesByTokenBudget(matches, MAX_CONTEXT_TOKENS).matches;
  const fullContext = legacyMatches.map((row: any) => `(${row.doc_type}) ${row.chunk_text}`).join("\n\n");
  const legacyContext = truncateContext(fullContext, MAX_CONTEXT_CHARS);
  const legacyContextTruncated = fullContext.length > MAX_CONTEXT_CHARS || legacyMatches.length < matches.length;
  const ragResult = useRagPolicy ? applyRagPolicy(matches, ragConfig) : null;
  const context = ragResult?.context ?? legacyContext;
  const selectedMatches = ragResult?.selectedMatches ?? legacyMatches;
  const contextTruncated = ragResult?.contextTruncated ?? legacyContextTruncated;
  const retrievalCount = ragResult?.retrievalCount ?? legacyMatches.length;
  const docTypesUsed = ragResult?.docTypesUsed ?? Array.from(new Set(legacyMatches.map((row: any) => row.doc_type)));
  const ragPolicyVersion = useRagPolicy ? "v1" : "legacy";

  const estimatedInputTokens = estimateTokensForCost(`${question}\n\n${context}`);
  const estimatedOutputTokens = Math.max(0, Number(promptRow.max_tokens ?? 0));
  const estimatedCostUsd = calculateCost("openai", ragModelId, estimatedInputTokens, estimatedOutputTokens);
  const reservation = await incrementBudget(
    supabase,
    agencyId,
    monthKey,
    estimatedCostUsd,
    true,
  );

      if (!reservation.allowed && reservation.hardStop) {
        const latency = Date.now() - startTime;
        const responsePayload = {
      answer: "UNKNOWN",
      unknown: true,
      questions: null,
      confidence: 0,
      sources: emptySources(),
      escalate_to_human: true,
      escalation_reason: "Monthly AI budget exceeded",
    };

        await supabase.from("ai_escalations").insert({
      agency_id: agencyId,
      client_id: clientId ?? null,
      user_id: user.id,
      question,
      reason: "Monthly AI budget exceeded",
      status: "open",
      assignee_role: "agency_admin",
    });

        await supabase.from("ai_runs").insert({
      agency_id: agencyId,
      client_id: clientId ?? null,
      user_id: user.id,
      prompt_id: promptRow.id,
      prompt_version: promptRow.version,
      model: ragModelId,
      tokens_in: estimatedInputTokens,
      tokens_out: 0,
      cost_usd: 0,
      latency_ms: latency,
      success: true,
      citations: responsePayload.sources,
      unknown: true,
      escalate_to_human: true,
      escalation_reason: responsePayload.escalation_reason,
      metadata: { cost_estimation_method: DEFAULT_COST_ESTIMATION_METHOD },
    });

        return jsonResponse(responsePayload, 200, corsHeaders(req));
      }

  let responsePayload = buildUnknown([
    "What additional details should the agency provide to answer this accurately?",
  ]);

  let aiResult: any = null;
      try {
        aiResult = await ai.run({
      taskType: TaskType.CLIENT_PORTAL_QA,
      input: question,
      context: {
        agencyId,
        clientId,
        userId: user.id,
        environment: "prod",
        supabase,
      },
      metadata: { context },
    });

    const parsed = (aiResult.output ?? {}) as {
      answer?: string;
      unknown?: boolean;
      questions?: string[];
      confidence?: number;
    };

    responsePayload = {
      answer: parsed.answer || "UNKNOWN",
      unknown: Boolean(parsed.unknown),
      questions: parsed.questions || [],
      confidence: parsed.confidence ?? 0,
      sources: {
        agency_brain_fields: [],
        client_brain_fields: [],
        memory_citations: selectedMatches.map((row: any) => ({
          doc_type: row.doc_type,
          document_id: row.document_id,
          chunk_id: row.chunk_id,
          score: row.score ?? row.similarity ?? 0,
        })),
      },
      escalate_to_human: false,
      escalation_reason: null,
    };
      } catch {
        responsePayload = buildUnknown([
          "Unable to generate a grounded answer. Please add more context.",
        ]);
      }

  const latency = Date.now() - startTime;
  const usage = extractUsageFromRaw(aiResult?.raw);
  const runtimeModel = aiResult?.meta?.model ?? ragModelId;
  const tokensIn = usage?.inputTokens ?? estimateTokensForCost(`${question}\n\n${context}`);
  const tokensOut = usage?.outputTokens ?? estimateTokensForCost(responsePayload.answer ?? "");
  const costUsd = calculateCost("openai", runtimeModel, tokensIn, tokensOut);
  const costEstimationMethod = usage ? "token_based" : DEFAULT_COST_ESTIMATION_METHOD;
  const deltaAdjustment = costUsd - estimatedCostUsd;
  if (deltaAdjustment !== 0) {
    await incrementBudget(supabase, agencyId, monthKey, deltaAdjustment, false);
  }

  const citations = {
    memory_citations: selectedMatches
      .map((row: any) => ({
        doc_id: row.document_id ?? row.doc_id,
        chunk_id: row.chunk_id,
        doc_type: row.doc_type,
        similarity: row.score ?? row.similarity ?? 0,
      }))
      .filter((row: any) => typeof row.doc_id === "string"),
    client_brain_fields: responsePayload.sources?.client_brain_fields ?? [],
    agency_brain_fields: responsePayload.sources?.agency_brain_fields ?? [],
  };

  const citationValidation = validateCitations(
    { sources: citations, unknown: responsePayload.unknown, escalate_to_human: responsePayload.escalate_to_human ?? false },
    selectedMatches,
  );

      if (!citationValidation.valid && strictSchema) {
        await supabase.from("ai_runs").insert({
      agency_id: agencyId,
      client_id: clientId ?? null,
      user_id: user.id,
      prompt_id: promptRow.id,
      prompt_version: promptRow.version,
      model: runtimeModel,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: costUsd,
      latency_ms: latency,
      success: false,
      citations,
      unknown: responsePayload.unknown,
      escalate_to_human: responsePayload.escalate_to_human ?? false,
      escalation_reason: responsePayload.escalation_reason ?? null,
      metadata: {
        cost_estimation_method: costEstimationMethod,
        retrieval_count: retrievalCount,
        context_truncated: contextTruncated,
        doc_types_used: docTypesUsed,
        rag_policy_version: ragPolicyVersion,
        citation_errors: citationValidation.errors,
      },
    });

        return jsonResponse({ error: "Citation validation failed", code: "CITATION_VALIDATION_FAILED" }, 500, corsHeaders(req));
      }

      await supabase.from("ai_runs").insert({
    agency_id: agencyId,
    client_id: clientId ?? null,
    user_id: user.id,
    prompt_id: promptRow.id,
    prompt_version: promptRow.version,
    model: runtimeModel,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_usd: costUsd,
    latency_ms: latency,
    success: true,
    citations,
    unknown: responsePayload.unknown,
    escalate_to_human: responsePayload.escalate_to_human ?? false,
    escalation_reason: responsePayload.escalation_reason ?? null,
    metadata: {
      cost_estimation_method: costEstimationMethod,
      retrieval_count: retrievalCount,
      context_truncated: contextTruncated,
      doc_types_used: docTypesUsed,
      rag_policy_version: ragPolicyVersion,
      ...(citationValidation.valid ? {} : { citation_errors: citationValidation.errors }),
    },
  });

      return jsonResponse(responsePayload, 200, corsHeaders(req));
    })();
  } finally {
    await logOtelSpan(supabase, {
      traceId,
      spanId,
      stage: "edge.ai-ask",
      taskType: TaskType.CLIENT_PORTAL_QA,
      agencyId,
      clientId,
      userId,
      latencyMs: Date.now() - spanStart,
      attributes: { http_status: response?.status ?? 0 },
    });
  }

  return response!;
});

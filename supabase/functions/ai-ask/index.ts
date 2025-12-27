import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { embedText } from "../_shared/embeddings.ts";
import { calculateCost, checkBudget, incrementBudget } from "../_shared/budgets.ts";
import { ai } from "../../../src/ai/router.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";

const TOKEN_CAP = 6000;
const DAILY_LIMIT = 20;
const MONTHLY_BUDGET = 50;
const CLIENT_MEMORY_TOP_K = 6;
const AGENCY_MEMORY_TOP_K = 4;
const EXEMPLAR_TOP_K = 2;
const MAX_CONTEXT_CHARS = 6000;
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders(req));
  }

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

  const startTime = Date.now();
  const body = await req.json().catch(() => ({}));
  const agencyId = body.agency_id as string | undefined;
  const clientId = body.client_id as string | undefined;
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
      metadata: { cost_estimation_method: DEFAULT_COST_ESTIMATION_METHOD },
    });

    return jsonResponse(responsePayload, 200, corsHeaders(req));
  }

  await supabase
    .from("ai_rate_limits")
    .update({ used_count: (rateRow?.used_count ?? 0) + 1 })
    .eq("agency_id", agencyId)
    .eq("user_id", user.id)
    .eq("day_yyyy_mm_dd", dayKey);

  const embeddingApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!embeddingApiKey) {
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

  const embeddingModel = Deno.env.get("EMBEDDING_MODEL_ID") ?? "text-embedding-3-small";
  const queryEmbedding = await embedText(question, embeddingApiKey, embeddingModel);

  const { data: clientMatches } = await supabase.rpc("match_ai_embeddings", {
    p_agency_id: agencyId,
    p_client_id: clientId ?? null,
    p_query_embedding: queryEmbedding,
    p_match_count: CLIENT_MEMORY_TOP_K,
    p_doc_types: ["client_guidelines", "client_notes", "approved_posts", "ai_artifact", "strategy_draft"],
  });

  const { data: agencyMatches } = await supabase.rpc("match_ai_embeddings", {
    p_agency_id: agencyId,
    p_client_id: null,
    p_query_embedding: queryEmbedding,
    p_match_count: AGENCY_MEMORY_TOP_K,
    p_doc_types: ["agency_sop"],
  });

  const { data: exemplarMatches } = await supabase.rpc("match_ai_embeddings", {
    p_agency_id: agencyId,
    p_client_id: null,
    p_query_embedding: queryEmbedding,
    p_match_count: EXEMPLAR_TOP_K,
    p_doc_types: ["agency_exemplar_strategy"],
  });

  const matches = [
    ...(clientMatches || []),
    ...(agencyMatches || []),
    ...(exemplarMatches || []),
  ];

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

  const context = truncateContext(
    matches.map((row: any) => `(${row.doc_type}) ${row.chunk_text}`).join("\n\n"),
    MAX_CONTEXT_CHARS,
  );

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
        memory_citations: matches.map((row: any) => ({
          doc_type: row.doc_type,
          document_id: row.document_id,
          chunk_id: row.chunk_id,
          score: row.score,
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
    citations: responsePayload.sources,
    unknown: responsePayload.unknown,
    escalate_to_human: responsePayload.escalate_to_human ?? false,
    escalation_reason: responsePayload.escalation_reason ?? null,
    metadata: { cost_estimation_method: costEstimationMethod },
  });

  return jsonResponse(responsePayload, 200, corsHeaders(req));
});

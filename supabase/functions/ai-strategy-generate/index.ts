import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { evaluateClientBrainForStrategy } from "../_shared/brain-quality.ts";
import { embedText } from "../_shared/embeddings.ts";
import { ai } from "../../../src/ai/router.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";
import { applyRagPolicy, getRagConfig, shouldUseRagPolicy } from "../../../src/ai/ragPolicy.ts";
import { validateCitations } from "../../../src/ai/citations.ts";
import { calculateCost } from "../_shared/budgets.ts";
import { capMatchesByTokenBudget, clampMatchCount } from "../_shared/retrieval.ts";
import { buildStrategyOutputSchema, type StrategyOutput } from "../_shared/strategy-output.ts";
import { marked } from "npm:marked@9.1.6";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function emptySources() {
  return {
    agency_brain_fields: [],
    client_brain_fields: [],
    memory_citations: [],
  };
}

function buildUnknownResponse(gate: { missing_fields: string[]; questions: string[] }) {
  return {
    unknown: true,
    missing_fields: gate.missing_fields,
    questions: gate.questions,
    escalation: false,
  };
}

function truncate(text: string, limit: number) {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...`;
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

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    const serialized = entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(",");
    return `{${serialized}}`;
  }
  return JSON.stringify(value);
}

async function sha256Hex(input: string) {
  const buffer = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const MODULE_LABELS: Record<string, string> = {
  positioning: "Positioning",
  pillars: "Pillars",
  campaign_plan: "Campaign plan",
  weekly_plan: "Weekly plan",
  channel_adaptations: "Channel adaptations",
  rules_constraints: "Rules + constraints",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders(req));
  }

  const guardResponse = getEndpointGuardResponse("ai-strategy-generate", corsHeaders(req));
  if (guardResponse) return guardResponse;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const startTime = Date.now();
  const strictSchema = Deno.env.get("AI_SCHEMA_STRICT") === "true";
  const failHard = Deno.env.get("AI_EMBEDDING_FAIL_HARD") === "true";
  const body = await req.json().catch(() => ({}));
  const clientId = body.client_id as string | undefined;
  const instruction = body.instruction as string | undefined;
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const cronHeader = req.headers.get("x-cron-secret") ?? "";
  const isCron = cronSecret.length > 0 && cronHeader === cronSecret;

  if (!clientId) {
    return jsonResponse({ error: "client_id is required" }, 400, corsHeaders(req));
  }

  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("agency_id")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError || !clientRow?.agency_id) {
    return jsonResponse({ error: "Client not found" }, 404, corsHeaders(req));
  }

  const agencyId = clientRow.agency_id as string;

  let actingUserId: string | null = null;
  if (isCron) {
    const { data: adminUser } = await supabase
      .from("agency_members")
      .select("user_id")
      .eq("agency_id", agencyId)
      .in("role", ["owner", "admin"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    actingUserId = adminUser?.user_id ?? null;
    if (!actingUserId) {
      return jsonResponse({ error: "No admin user available for job execution" }, 403, corsHeaders(req));
    }
  } else {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401, corsHeaders(req));
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders(req));
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
    actingUserId = user.id;
  }

  const { data: brainRow, error: brainError } = await supabase
    .from("client_brains")
    .select("id, brain_json, usable, status, updated_at")
    .eq("agency_id", agencyId)
    .eq("client_id", clientId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (brainError || !brainRow) {
    return jsonResponse({ error: "Client brain not found" }, 404, corsHeaders(req));
  }

  const gate = evaluateClientBrainForStrategy((brainRow.brain_json as any) ?? {});

  if (!gate.usable || !brainRow.usable) {
    await supabase.from("ai_usage_logs").insert({
      agency_id: agencyId,
      client_id: clientId,
      endpoint: "ai-strategy-generate",
      model: "gate-only",
      tokens_estimate: 0,
      tokens_in: 0,
      tokens_out: 0,
      latency_ms: Date.now() - startTime,
      unknown: true,
    });
    return jsonResponse(buildUnknownResponse(gate), 200, corsHeaders(req));
  }

  const { data: agencyBrainRow } = await supabase
    .from("agency_brains")
    .select("brain_json")
    .eq("agency_id", agencyId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: onboardingProfile } = await supabase
    .from("client_onboarding_profiles")
    .select("*")
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: latestStrategy } = await supabase
    .from("strategies")
    .select("id, updated_at")
    .eq("client_id", clientId)
    .order("version_int", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: moduleRows } = latestStrategy?.id
    ? await supabase
        .from("strategy_modules")
        .select("module, content_json, updated_at")
        .eq("strategy_id", latestStrategy.id)
    : { data: [] };

  const embeddingApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!embeddingApiKey) {
    if (failHard) {
      return jsonResponse({ error: "OPENAI_API_KEY is not configured", code: "MISSING_API_KEY" }, 500, corsHeaders(req));
    }
    await supabase.from("ai_usage_logs").insert({
      agency_id: agencyId,
      client_id: clientId,
      endpoint: "ai-strategy-generate",
      model: "embeddings-not-configured",
      tokens_estimate: 0,
      tokens_in: 0,
      tokens_out: 0,
      latency_ms: Date.now() - startTime,
      unknown: true,
    });
    return jsonResponse(
      buildUnknownResponse({
        missing_fields: ["embedding_api_key"],
        questions: ["AI generation is not configured. Please contact support."],
      }),
      200,
      corsHeaders(req),
    );
  }

  const embeddingModel = Deno.env.get("EMBEDDING_MODEL_ID") ?? "text-embedding-3-small";
  const useRagPolicy = shouldUseRagPolicy({ agencyId, clientId });
  const ragConfig = getRagConfig(TaskType.STRATEGY_PLAN);
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedText("strategy_draft", embeddingApiKey, embeddingModel);
  } catch (error: any) {
    if (failHard) {
      return jsonResponse({ error: "Embedding failed", code: "EMBEDDING_FAILED" }, 500, corsHeaders(req));
    }
    throw error;
  }

  const legacyClientDocTypes = ["client_guidelines", "client_notes", "approved_posts", "ai_artifact", "strategy_draft"];
  const legacyAgencyDocTypes = ["agency_sop", "brain_document"];
  const legacyExemplarDocTypes = ["agency_exemplar_strategy"];

  const { data: clientMatches } = await supabase.rpc("match_ai_embeddings", {
    p_agency_id: agencyId,
    p_client_id: clientId,
    p_query_embedding: queryEmbedding,
    p_match_count: clampMatchCount(useRagPolicy ? ragConfig.client_memory_top_k : 6),
    p_doc_types: useRagPolicy ? ragConfig.client_doc_types : legacyClientDocTypes,
    p_modules: null,
    p_min_similarity: useRagPolicy ? ragConfig.min_similarity : 0.2,
  });

  const { data: agencyMatches } = await supabase.rpc("match_ai_embeddings", {
    p_agency_id: agencyId,
    p_client_id: null,
    p_query_embedding: queryEmbedding,
    p_match_count: clampMatchCount(useRagPolicy ? ragConfig.agency_memory_top_k : 4),
    p_doc_types: useRagPolicy ? ragConfig.agency_doc_types : legacyAgencyDocTypes,
    p_modules: null,
    p_min_similarity: useRagPolicy ? ragConfig.min_similarity : 0.2,
  });

  const { data: exemplarMatches } = await supabase.rpc("match_ai_embeddings", {
    p_agency_id: agencyId,
    p_client_id: null,
    p_query_embedding: queryEmbedding,
    p_match_count: clampMatchCount(useRagPolicy ? ragConfig.exemplar_top_k : 2),
    p_doc_types: useRagPolicy ? ragConfig.exemplar_doc_types : legacyExemplarDocTypes,
    p_modules: null,
    p_min_similarity: useRagPolicy ? ragConfig.min_similarity : 0.2,
  });

  const matches = [
    ...(clientMatches || []),
    ...(agencyMatches || []),
    ...(exemplarMatches || []),
  ];

  if (matches.length === 0) {
    await supabase.from("ai_usage_logs").insert({
      agency_id: agencyId,
      client_id: clientId,
      endpoint: "ai-strategy-generate",
      model: "retrieval-only",
      tokens_estimate: 0,
      tokens_in: 0,
      tokens_out: 0,
      latency_ms: Date.now() - startTime,
      unknown: true,
    });
    return jsonResponse(
      buildUnknownResponse({
        missing_fields: ["memory_context"],
        questions: ["Upload client guidelines or approvals to ground strategy."],
      }),
      200,
      corsHeaders(req),
    );
  }

  const legacyMatches = useRagPolicy ? matches : capMatchesByTokenBudget(matches, 1200).matches;
  const fullContext = legacyMatches.map((row: any) => `(${row.doc_type}) ${row.chunk_text}`).join("\n\n");
  const legacyContext = truncate(fullContext, 6000);
  const legacyContextTruncated = fullContext.length > 6000 || legacyMatches.length < matches.length;
  const ragResult = useRagPolicy ? applyRagPolicy(matches, ragConfig) : null;
  const context = ragResult?.context ?? legacyContext;
  const selectedMatches = ragResult?.selectedMatches ?? legacyMatches;
  const contextTruncated = ragResult?.contextTruncated ?? legacyContextTruncated;
  const retrievalCount = ragResult?.retrievalCount ?? legacyMatches.length;
  const docTypesUsed = ragResult?.docTypesUsed ?? Array.from(new Set(legacyMatches.map((row: any) => row.doc_type)));
  const ragPolicyVersion = useRagPolicy ? "v1" : "legacy";

  const promptContext = [
    `Onboarding Profile:\n${JSON.stringify(onboardingProfile ?? {})}`,
    `Structured Strategy:\n${JSON.stringify(moduleRows ?? [])}`,
    `RAG Context:\n${context}`,
  ].join("\n\n");

  const outputSchema = buildStrategyOutputSchema();
  let aiResult: any = null;
  let output: StrategyOutput | null = null;
  try {
    aiResult = await ai.run({
      taskType: TaskType.STRATEGY_PLAN,
      input: "",
      context: { agencyId, clientId, userId: actingUserId, environment: "prod", supabase },
      metadata: { context: promptContext, instruction },
      outputSchema,
    });
    output = (aiResult.output ?? null) as StrategyOutput | null;
  } catch {
    return jsonResponse(
      buildUnknownResponse({
        missing_fields: ["strategy_generation"],
        questions: ["Strategy generation failed. Please retry."],
      }),
      200,
      corsHeaders(req),
    );
  }

  if (!aiResult?.schemaOk || !output) {
    const runtimeModel = aiResult?.meta?.model ?? (Deno.env.get("STRATEGY_MODEL_ID") ?? "gpt-4o-mini");
    const tokensIn = estimateTokensForCost(context);
    const tokensOut = 0;
    const costUsd = calculateCost("openai", runtimeModel, tokensIn, tokensOut);

    await supabase.from("ai_runs").insert({
      agency_id: agencyId,
      client_id: clientId,
      user_id: actingUserId,
      prompt_id: null,
      prompt_version: null,
      model: runtimeModel,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: costUsd,
      latency_ms: Date.now() - startTime,
      success: false,
      citations: {},
      unknown: true,
      escalate_to_human: false,
      escalation_reason: null,
      metadata: {
        error: "strategy_schema_invalid",
      },
    });

    return jsonResponse({ error: "Strategy JSON invalid", code: "STRATEGY_SCHEMA_INVALID" }, 500, corsHeaders(req));
  }

  const markdown = output.document.markdown;
  const html = marked.parse(markdown);

  const citations = selectedMatches.map((row: any) => ({
    doc_type: row.doc_type,
    document_id: row.document_id,
    chunk_id: row.chunk_id,
    score: row.score,
  }));

  const brainDocIds = Array.from(
    new Set(
      selectedMatches
        .filter((row: any) => row.doc_type === "brain_document" && row.document_id)
        .map((row: any) => row.document_id)
    )
  );

  const { data: brainDocRows } = brainDocIds.length
    ? await supabase
        .from("ai_documents")
        .select("id, metadata")
        .in("id", brainDocIds)
    : { data: [] };

  const brainDocVersions = (brainDocRows ?? [])
    .map((row: any) => ({
      id: row.id,
      module: row.metadata?.module ?? null,
      version: row.metadata?.version ?? null,
      status: row.metadata?.status ?? null,
      approved_at: row.metadata?.approved_at ?? null,
    }))
    .sort((a: any, b: any) => String(a.module ?? "").localeCompare(String(b.module ?? "")));

  const derivedFromHash = await sha256Hex(
    stableStringify({
      onboardingProfile,
      scan: {
        ai_scan_result: onboardingProfile?.ai_scan_result ?? null,
        ai_scan_at: onboardingProfile?.ai_scan_at ?? null,
        ai_scan_accepted: onboardingProfile?.ai_scan_accepted ?? null,
      },
      brain_documents: brainDocVersions,
    }),
  );

  const modulePayload = Object.entries(output.modules).map(([module, content]) => ({
    module,
    content_json: content,
    ai_confidence: (content as any).confidence_0_100 ?? null,
  }));

  const autoValidationTasks = Object.entries(output.modules)
    .filter(([, content]) => (content as any).confidence_0_100 < 70)
    .map(([module, content]) => {
      const questions = (content as any).open_questions ?? [];
      const description = questions.length
        ? `Open questions: ${questions.slice(0, 5).join("; ")}`
        : "Review module for accuracy and completeness.";
      return {
        module,
        title: `Validate ${MODULE_LABELS[module] ?? module} module`,
        description,
        priority: "high",
        dedupe_key: `validation:${module}`,
      };
    });

  const taskRows = [...(output.tasks ?? []), ...autoValidationTasks];
  const tasksPayload = Array.from(
    taskRows.reduce((map, task) => {
      const key = task.dedupe_key ?? `${task.module ?? "general"}:${task.title}`;
      if (!map.has(key)) {
        map.set(key, task);
      }
      return map;
    }, new Map<string, any>())
  ).map(([, task]) => task);

  const rpcResult = await supabase.rpc("create_strategy_snapshot", {
    p_client_id: clientId,
    p_agency_id: agencyId,
    p_strategy_id: latestStrategy?.id ?? null,
    p_user_id: actingUserId,
    p_modules: modulePayload,
    p_document_markdown: markdown,
    p_document_html: html,
    p_model: aiResult?.meta?.model ?? (Deno.env.get("STRATEGY_MODEL_ID") ?? "gpt-4o-mini"),
    p_instruction: instruction ?? null,
    p_derived_hash: derivedFromHash,
    p_decisions: output.decisions ?? null,
    p_tasks: tasksPayload.length ? tasksPayload : null,
  });

  if (rpcResult?.error) {
    return jsonResponse({ error: "Failed to save strategy snapshot" }, 500, corsHeaders(req));
  }

  const usage = extractUsageFromRaw(aiResult?.raw);
  const runtimeModel = aiResult?.meta?.model ?? (Deno.env.get("STRATEGY_MODEL_ID") ?? "gpt-4o-mini");
  const tokensIn = usage?.inputTokens ?? estimateTokensForCost(context);
  const tokensOut = usage?.outputTokens ?? estimateTokensForCost(markdown);
  const costUsd = calculateCost("openai", runtimeModel, tokensIn, tokensOut);
  const costEstimationMethod = usage ? "token_based" : "estimate_chars_div3";

  const citationsForRun = {
    memory_citations: selectedMatches
      .map((row: any) => ({
        doc_id: row.document_id ?? row.doc_id,
        chunk_id: row.chunk_id,
        doc_type: row.doc_type,
        similarity: row.score ?? row.similarity ?? 0,
      }))
      .filter((row: any) => typeof row.doc_id === "string"),
    client_brain_fields: [],
    agency_brain_fields: [],
  };

  const citationValidation = validateCitations(
    { sources: citationsForRun, unknown: false, escalate_to_human: false },
    selectedMatches,
  );

  if (!citationValidation.valid && strictSchema) {
    await supabase.from("ai_runs").insert({
      agency_id: agencyId,
      client_id: clientId,
      user_id: actingUserId,
      prompt_id: null,
      prompt_version: null,
      model: runtimeModel,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: costUsd,
      latency_ms: Date.now() - startTime,
      success: false,
      citations: citationsForRun,
      unknown: false,
      escalate_to_human: false,
      escalation_reason: null,
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
    client_id: clientId,
    user_id: actingUserId,
    prompt_id: null,
    prompt_version: null,
    model: runtimeModel,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_usd: costUsd,
    latency_ms: Date.now() - startTime,
    success: true,
    citations: citationsForRun,
    unknown: false,
    escalate_to_human: false,
    escalation_reason: null,
    metadata: {
      cost_estimation_method: costEstimationMethod,
      retrieval_count: retrievalCount,
      context_truncated: contextTruncated,
      doc_types_used: docTypesUsed,
      rag_policy_version: ragPolicyVersion,
      ...(citationValidation.valid ? {} : { citation_errors: citationValidation.errors }),
    },
  });

  await supabase.from("ai_usage_logs").insert({
    agency_id: agencyId,
    client_id: clientId,
    endpoint: "ai-strategy-generate",
    model: runtimeModel,
    tokens_estimate: Math.ceil(markdown.length / 4),
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    latency_ms: Date.now() - startTime,
    unknown: false,
  });

  return jsonResponse(
    {
      unknown: false,
      modules: output.modules,
      tasks_created: tasksPayload.length,
      citations,
      confidence: Math.round(
        Object.values(output.modules)
          .map((mod: any) => Number(mod.confidence_0_100 ?? 0))
          .reduce((acc, val) => acc + val, 0) / Object.keys(output.modules).length,
      ),
      document: rpcResult?.data ?? null,
    },
    200,
    corsHeaders(req),
  );
});

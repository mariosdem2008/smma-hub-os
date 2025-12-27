import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { evaluateClientBrainForStrategy } from "../_shared/brain-quality.ts";
import { buildChunks, DEFAULT_EMBEDDING_DIM, embedText, tokenize } from "../_shared/embeddings.ts";
import { embedWithPolicy } from "../_shared/embedding-policy.ts";
import { ai } from "../../../src/ai/router.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";
import { applyRagPolicy, getRagConfig, shouldUseRagPolicy } from "../../../src/ai/ragPolicy.ts";
import { validateCitations } from "../../../src/ai/citations.ts";
import { calculateCost } from "../_shared/budgets.ts";

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
  const strictSchema = Deno.env.get("AI_SCHEMA_STRICT") === "true";
  const failHard = Deno.env.get("AI_EMBEDDING_FAIL_HARD") === "true";
  const body = await req.json().catch(() => ({}));
  const agencyId = body.agency_id as string | undefined;
  const clientId = body.client_id as string | undefined;

  if (!agencyId || !clientId) {
    return jsonResponse({ error: "agency_id and client_id are required" }, 400, corsHeaders(req));
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
  const legacyAgencyDocTypes = ["agency_sop"];
  const legacyExemplarDocTypes = ["agency_exemplar_strategy"];

  const { data: clientMatches } = await supabase.rpc("match_ai_embeddings", {
    p_agency_id: agencyId,
    p_client_id: clientId,
    p_query_embedding: queryEmbedding,
    p_match_count: useRagPolicy ? ragConfig.client_memory_top_k : 6,
    p_doc_types: useRagPolicy ? ragConfig.client_doc_types : legacyClientDocTypes,
  });

  const { data: agencyMatches } = await supabase.rpc("match_ai_embeddings", {
    p_agency_id: agencyId,
    p_client_id: null,
    p_query_embedding: queryEmbedding,
    p_match_count: useRagPolicy ? ragConfig.agency_memory_top_k : 4,
    p_doc_types: useRagPolicy ? ragConfig.agency_doc_types : legacyAgencyDocTypes,
  });

  const { data: exemplarMatches } = await supabase.rpc("match_ai_embeddings", {
    p_agency_id: agencyId,
    p_client_id: null,
    p_query_embedding: queryEmbedding,
    p_match_count: useRagPolicy ? ragConfig.exemplar_top_k : 2,
    p_doc_types: useRagPolicy ? ragConfig.exemplar_doc_types : legacyExemplarDocTypes,
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

  const fullContext = matches.map((row: any) => `(${row.doc_type}) ${row.chunk_text}`).join("\n\n");
  const legacyContext = truncate(fullContext, 6000);
  const legacyContextTruncated = fullContext.length > 6000;
  const ragResult = useRagPolicy ? applyRagPolicy(matches, ragConfig) : null;
  const context = ragResult?.context ?? legacyContext;
  const selectedMatches = ragResult?.selectedMatches ?? matches;
  const contextTruncated = ragResult?.contextTruncated ?? legacyContextTruncated;
  const retrievalCount = ragResult?.retrievalCount ?? matches.length;
  const docTypesUsed = ragResult?.docTypesUsed ?? Array.from(new Set(matches.map((row: any) => row.doc_type)));
  const ragPolicyVersion = useRagPolicy ? "v1" : "legacy";

  let parsed: { summary?: string; sections?: any[] } = {};
  try {
    const aiResult = await ai.run({
      taskType: TaskType.STRATEGY_PLAN,
      input: "",
      context: { agencyId, clientId, userId: user.id, environment: "prod", supabase },
      metadata: { context },
    });
    parsed = (aiResult.output ?? {}) as { summary?: string; sections?: any[] };
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

  const strategy = {
    summary: parsed.summary || "",
    sections: Array.isArray(parsed.sections) ? parsed.sections : [],
  };

  const citations = selectedMatches.map((row: any) => ({
    doc_type: row.doc_type,
    document_id: row.document_id,
    chunk_id: row.chunk_id,
    score: row.score,
  }));

  const strategyPayload = JSON.stringify(strategy);

  const { data: docRow } = await supabase
    .from("ai_documents")
    .insert({
      agency_id: agencyId,
      client_id: clientId,
      doc_type: "strategy_draft",
      title: "Strategy draft v1",
      content: strategyPayload,
      extracted_text: strategy.summary || "Strategy draft",
      source: { source_type: "ai_strategy", source_ref: brainRow.id },
      metadata: {
        confidence: parsed.confidence ?? 70,
        brain_version: brainRow.updated_at,
      },
    })
    .select("id")
    .single();

  if (docRow?.id) {
    const tokens = tokenize(strategyPayload);
    const chunks = buildChunks(tokens, 900, 140, 12);
    const zeroVector = Array(DEFAULT_EMBEDDING_DIM).fill(0);
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const { data: chunkRow } = await supabase
        .from("ai_document_chunks")
        .insert({
          document_id: docRow.id,
          chunk_index: index,
          chunk_text: chunk.text,
          token_count: chunk.tokenCount,
          chunk_meta: { start_token: chunk.start, end_token: chunk.end },
        })
        .select("id")
        .single();

      if (!chunkRow?.id) continue;

      let embeddingResult;
      try {
        embeddingResult = await embedWithPolicy({
          text: chunk.text,
          apiKey: embeddingApiKey ?? undefined,
          failHard,
          embed: (text) => embedText(text, embeddingApiKey ?? "", embeddingModel),
          zeroVector,
        });
      } catch (error: any) {
        if (error?.code === "MISSING_API_KEY") {
          return jsonResponse({ error: "OPENAI_API_KEY is not configured", code: "MISSING_API_KEY" }, 500, corsHeaders(req));
        }
        if (error?.code === "EMBEDDING_FAILED") {
          return jsonResponse({ error: "Embedding failed", code: "EMBEDDING_FAILED" }, 500, corsHeaders(req));
        }
        throw error;
      }

      await supabase.from("ai_embeddings").insert({
        agency_id: agencyId,
        client_id: clientId,
        doc_type: "strategy_draft",
        document_id: docRow.id,
        chunk_id: chunkRow.id,
        embedding: embeddingResult.vector,
        model: embeddingModel,
        metadata: {
          similarity: "cosine",
          embedding_dim: DEFAULT_EMBEDDING_DIM,
          embedding_fallback: embeddingResult.legacyZeroVector,
          legacy_zero_vector: embeddingResult.legacyZeroVector,
        },
      });
    }
  }

  const usage = extractUsageFromRaw(aiResult?.raw);
  const runtimeModel = aiResult?.meta?.model ?? (Deno.env.get("STRATEGY_MODEL_ID") ?? "gpt-4o-mini");
  const tokensIn = usage?.inputTokens ?? estimateTokensForCost(context);
  const tokensOut = usage?.outputTokens ?? estimateTokensForCost(JSON.stringify(strategy));
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
      user_id: user.id,
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
    user_id: user.id,
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
    tokens_estimate: Math.ceil(JSON.stringify(strategy).length / 4),
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    latency_ms: Date.now() - startTime,
    unknown: false,
  });

  return jsonResponse(
    {
      unknown: false,
      strategy,
      citations,
      confidence: parsed.confidence ?? 70,
    },
    200,
    corsHeaders(req),
  );
});

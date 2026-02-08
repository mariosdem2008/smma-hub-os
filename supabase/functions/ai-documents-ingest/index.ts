import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { buildChunks, embedText, embedTextShadowGemini, getExpectedEmbeddingDim, getShadowEmbeddingDim, getShadowGeminiModelId, isShadowGeminiEnabled, tokenize } from "../_shared/embeddings.ts";
import { embedWithPolicy } from "../_shared/embedding-policy.ts";
import { persistEmbeddingResult, persistShadowEmbeddingResult } from "../_shared/embedding-store.ts";
import { getLockdownFailure, logLockdownAttempt } from "../_shared/lockdown.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";
import { generateSpanId, generateTraceId, logOtelSpan } from "../../../src/ai/otel.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";
import { isContextualIngestionEnabled, isPhase2EnabledForAgency } from "../../../src/ai/flags.ts";
import { ai } from "../../../src/ai/router.ts";

const ALLOWED_DOC_TYPES = [
  "agency_exemplar_strategy",
  "agency_sop",
  "client_guidelines",
  "client_notes",
  "approved_posts",
  "ai_artifact",
  "strategy_draft",
];

const ALLOWED_FILE_EXTENSIONS = ["pdf", "docx", "txt", "md"];
const CHUNK_SIZE_TOKENS = 900;
const OVERLAP_TOKENS = 140;
const MAX_CHUNKS = 120;
const MAX_EXTRACTED_CHARS = 150000;
const MAX_FILE_SIZE_MB = 20;
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

  response = await (async () => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(req) });
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders(req));
    }

    const guardResponse = getEndpointGuardResponse("ai-documents-ingest", corsHeaders(req));
    if (guardResponse) return guardResponse;

    const lockdownEnabled = Deno.env.get("AI_LOCKDOWN_UNUSED_ENDPOINTS") === "true";
    const body = await req.json().catch(() => ({}));
    agencyId = body.agency_id as string | undefined;
    clientId = body.client_id as string | undefined;
    const docType = body.doc_type as string | undefined;
    const title = body.title as string | undefined;
    const content = body.content as string | undefined;
    const sourceType = body.source_type as string | undefined;
    const sourceRef = body.source_ref as string | undefined;
    const fileName = body.file_name as string | undefined;
    const fileSizeMb = body.file_size_mb as number | undefined;
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
          endpoint: "ai-documents-ingest",
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
          endpoint: "ai-documents-ingest",
          agencyId,
          clientId,
        });
        return jsonResponse(lockdown.body, lockdown.status, corsHeaders(req));
      }
      return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders(req));
    }

    userId = user.id;
    const startTime = Date.now();
    const failHard = Deno.env.get("AI_EMBEDDING_FAIL_HARD") === "true";

  if (!agencyId || !docType || !title || !content || !sourceType || !sourceRef) {
    return jsonResponse({ error: "Missing required fields" }, 400, corsHeaders(req));
  }

  if (!ALLOWED_DOC_TYPES.includes(docType)) {
    return jsonResponse({ error: "Invalid doc_type" }, 400, corsHeaders(req));
  }

  if (fileName) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (!ext || !ALLOWED_FILE_EXTENSIONS.includes(ext)) {
      return jsonResponse({ error: "Unsupported file type" }, 400, corsHeaders(req));
    }
  }

  if (typeof fileSizeMb === "number" && fileSizeMb > MAX_FILE_SIZE_MB) {
    return jsonResponse({ error: "File size exceeds limit" }, 400, corsHeaders(req));
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
        endpoint: "ai-documents-ingest",
        agencyId,
        clientId,
      });
      return jsonResponse(lockdown.body, lockdown.status, corsHeaders(req));
    }
    return jsonResponse({ error: "Forbidden" }, 403, corsHeaders(req));
  }

  // Phase 2: contextual ingestion allowlist (poisoning defense).
  // When enabled, every {source_type, source_ref} must be explicitly allowlisted for this agency_id.
  if (isContextualIngestionEnabled() && isPhase2EnabledForAgency(agencyId)) {
    const { data: sourceRow } = await supabase
      .from("ai_ingestion_sources")
      .select("id, allowed, source_url, manifest_sha256")
      .eq("agency_id", agencyId)
      .eq("source_type", sourceType)
      .eq("source_ref", sourceRef)
      .maybeSingle();

    if (!sourceRow || sourceRow.allowed !== true) {
      return jsonResponse({ error: "source_not_allowlisted" }, 403, corsHeaders(req));
    }

    if (sourceRow.source_url && body.source_url && String(sourceRow.source_url) !== String(body.source_url)) {
      return jsonResponse({ error: "source_url_mismatch" }, 403, corsHeaders(req));
    }

    // Optional manifest validation: if allowlisted record has manifest_sha256, require exact match from request.
    const requiredManifest = (sourceRow as any).manifest_sha256 ? String((sourceRow as any).manifest_sha256) : "";
    if (requiredManifest) {
      const provided = (body.manifest_sha256 as string | undefined)?.trim() ?? "";
      if (!provided || provided !== requiredManifest) {
        return jsonResponse({ error: "manifest_mismatch" }, 403, corsHeaders(req));
      }
    }
  }

  const extractedText = content.slice(0, MAX_EXTRACTED_CHARS);
  const tokens = tokenize(extractedText);
  const chunks = buildChunks(tokens, CHUNK_SIZE_TOKENS, OVERLAP_TOKENS, MAX_CHUNKS);

  if (chunks.length === 0) {
    return jsonResponse({ error: "No content to ingest" }, 400, corsHeaders(req));
  }

  const { data: documentRow, error: documentError } = await supabase
    .from("ai_documents")
    .insert({
      agency_id: agencyId,
      client_id: clientId ?? null,
      doc_type: docType,
      title,
      content,
      extracted_text: extractedText,
      source: { source_type: sourceType, source_ref: sourceRef },
      source_url: body.source_url ?? null,
      file_ref: body.file_ref ?? null,
      file_name: fileName ?? null,
      file_size_mb: fileSizeMb ?? null,
      mime_type: body.mime_type ?? null,
      metadata: {
        chunk_size_tokens: CHUNK_SIZE_TOKENS,
        overlap_tokens: OVERLAP_TOKENS,
        max_chunks_per_doc: MAX_CHUNKS,
        token_count: tokens.length,
      },
    })
    .select("id")
    .single();

  if (documentError || !documentRow) {
    return jsonResponse({ error: documentError?.message ?? "Failed to create document" }, 400, corsHeaders(req));
  }

  const embeddingApiKey = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("OPENAI_API_KEY");
  const embeddingModel = Deno.env.get("EMBEDDING_MODEL_ID") ?? "text-embedding-3-small";
  const expectedDim = getExpectedEmbeddingDim();
  const shadowEnabled = isShadowGeminiEnabled();
  const shadowModel = getShadowGeminiModelId();
  const shadowDim = getShadowEmbeddingDim();
  const shadowApiKey = Deno.env.get("GEMINI_API_KEY") ?? null;

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const { data: chunkRow, error: chunkError } = await supabase
      .from("ai_document_chunks")
      .insert({
        document_id: documentRow.id,
        chunk_index: index,
        chunk_text: chunk.text,
        token_count: chunk.tokenCount,
        chunk_meta: { start_token: chunk.start, end_token: chunk.end },
        embedding_status: "failed",
        chunk_summary_status: "pending",
      })
      .select("id")
      .single();

    if (chunkError || !chunkRow) {
      return jsonResponse({ error: chunkError?.message ?? "Failed to create chunk" }, 400, corsHeaders(req));
    }

    let embeddingResult;
    // Phase 2: contextual ingestion summary generation (50-100 tokens) stored per chunk.
    if (isContextualIngestionEnabled() && isPhase2EnabledForAgency(agencyId)) {
      try {
        const summaryRes = await ai.run({
          taskType: TaskType.SUMMARIZE,
          input: chunk.text,
          context: { environment: "prod", supabase, skipUsageLog: true },
          metadata: {
            systemPrompt:
              "Summarize this text into 50-100 tokens. Keep factual content. No PII. Output plain text only.",
          },
        });
        const summaryText = typeof summaryRes.text === "string" ? summaryRes.text.trim() : "";
        const summaryTokens = summaryText ? summaryText.split(/\\s+/).filter(Boolean).length : 0;
        await supabase
          .from("ai_document_chunks")
          .update({
            chunk_summary: summaryText || null,
            chunk_summary_tokens: summaryTokens || null,
            chunk_summary_model: (summaryRes.meta as any)?.model ?? null,
            chunk_summary_status: summaryText ? "ok" : "failed",
          })
          .eq("id", chunkRow.id)
          .eq("document_id", documentRow.id);
      } catch {
        await supabase
          .from("ai_document_chunks")
          .update({ chunk_summary_status: "failed" })
          .eq("id", chunkRow.id)
          .eq("document_id", documentRow.id);
      }
    } else {
      await supabase
        .from("ai_document_chunks")
        .update({ chunk_summary_status: "failed" })
        .eq("id", chunkRow.id)
        .eq("document_id", documentRow.id);
    }

    try {
      embeddingResult = await embedWithPolicy({
        text: chunk.text,
        apiKey: embeddingApiKey ?? undefined,
        failHard,
        embed: (text) => embedText(text, "", embeddingModel),
      });
    } catch (error: any) {
      if (error?.code === "MISSING_API_KEY") {
        return jsonResponse(
          {
            error: "AI embeddings API key is not configured",
            message: "Configure GEMINI_API_KEY (or OPENAI_API_KEY if using OpenAI embeddings) and retry.",
            code: "MISSING_API_KEY",
          },
          500,
          corsHeaders(req),
        );
      }
      if (error?.code === "EMBEDDING_FAILED") {
        return jsonResponse({ error: "Embedding failed", code: "EMBEDDING_FAILED" }, 500, corsHeaders(req));
      }
      throw error;
    }

    const persistResult = await persistEmbeddingResult({
      supabase,
      chunkId: chunkRow.id,
      embeddingResult,
      embeddingPayload: {
        agency_id: agencyId,
        client_id: clientId ?? null,
        doc_type: docType,
        document_id: documentRow.id,
        chunk_id: chunkRow.id,
        embedding: [],
        model: embeddingModel,
        metadata: {
          similarity: "cosine",
          embedding_dim: expectedDim,
        },
      },
    });

    if (!persistResult.stored && persistResult.errorCode === "EMBEDDING_DIM_MISMATCH") {
      return jsonResponse({ error: "Embedding dimension mismatch", code: "EMBEDDING_DIM_MISMATCH" }, 500, corsHeaders(req));
    }

    if (shadowEnabled) {
      const shadowResult = await embedWithPolicy({
        text: chunk.text,
        apiKey: shadowApiKey ?? undefined,
        failHard: false,
        embed: (text) => embedTextShadowGemini(text),
      });

      await persistShadowEmbeddingResult({
        supabase,
        embeddingResult: shadowResult,
        embeddingPayload: {
          agency_id: agencyId,
          client_id: clientId ?? null,
          doc_type: docType,
          document_id: documentRow.id,
          chunk_id: chunkRow.id,
          embedding_json: [],
          model: shadowModel,
          metadata: {
            similarity: "cosine",
            embedding_dim: shadowDim ?? null,
            shadow: true,
          },
        },
      });
    }
  }

  await supabase.from("ai_usage_logs").insert({
    agency_id: agencyId,
    client_id: clientId ?? null,
    endpoint: "ai-documents-ingest",
    model: embeddingModel,
    tokens_estimate: tokens.length,
    tokens_in: tokens.length,
    tokens_out: 0,
    latency_ms: Date.now() - startTime,
    unknown: false,
  });

    return jsonResponse(
      {
        success: true,
        document_id: documentRow.id,
        chunks_created: chunks.length,
        token_count: tokens.length,
      },
      200,
      corsHeaders(req)
    );
  })();

  await logOtelSpan(supabase, {
    traceId,
    spanId,
    stage: "edge.ai-documents-ingest",
    taskType: TaskType.TOOL_EXECUTION,
    agencyId,
    clientId,
    userId,
    latencyMs: Date.now() - spanStart,
    attributes: { http_status: response?.status ?? 0 },
  });

  return response!;
});

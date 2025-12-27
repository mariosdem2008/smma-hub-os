import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { buildChunks, DEFAULT_EMBEDDING_DIM, embedText, tokenize } from "../_shared/embeddings.ts";
import { embedWithPolicy } from "../_shared/embedding-policy.ts";

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
  const failHard = Deno.env.get("AI_EMBEDDING_FAIL_HARD") === "true";
  const body = await req.json().catch(() => ({}));
  const agencyId = body.agency_id as string | undefined;
  const clientId = body.client_id as string | undefined;
  const docType = body.doc_type as string | undefined;
  const title = body.title as string | undefined;
  const content = body.content as string | undefined;
  const sourceType = body.source_type as string | undefined;
  const sourceRef = body.source_ref as string | undefined;
  const fileName = body.file_name as string | undefined;
  const fileSizeMb = body.file_size_mb as number | undefined;

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
    return jsonResponse({ error: "Forbidden" }, 403, corsHeaders(req));
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

  const embeddingApiKey = Deno.env.get("OPENAI_API_KEY");
  const embeddingModel = Deno.env.get("EMBEDDING_MODEL_ID") ?? "text-embedding-3-small";
  const zeroVector = Array(DEFAULT_EMBEDDING_DIM).fill(0);

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
      })
      .select("id")
      .single();

    if (chunkError || !chunkRow) {
      return jsonResponse({ error: chunkError?.message ?? "Failed to create chunk" }, 400, corsHeaders(req));
    }

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

    const { error: embeddingError } = await supabase.from("ai_embeddings").insert({
      agency_id: agencyId,
      client_id: clientId ?? null,
      doc_type: docType,
      document_id: documentRow.id,
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

    if (embeddingError) {
      return jsonResponse({ error: embeddingError.message }, 400, corsHeaders(req));
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
});

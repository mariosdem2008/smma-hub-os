import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

const ALLOWED_DOC_TYPES = [
  "agency_exemplar_strategy",
  "agency_sop",
  "client_guidelines",
  "client_notes",
  "approved_posts",
  "ai_artifact",
];

const ALLOWED_FILE_EXTENSIONS = ["pdf", "docx", "txt", "md"];
const CHUNK_SIZE_TOKENS = 900;
const OVERLAP_TOKENS = 140;
const MAX_CHUNKS = 120;
const MAX_EXTRACTED_CHARS = 150000;
const MAX_FILE_SIZE_MB = 20;
const EMBEDDING_DIM = 1536;

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function tokenize(text: string) {
  return text.trim().split(/\s+/).filter(Boolean);
}

function buildChunks(tokens: string[]) {
  const chunks: { text: string; tokenCount: number; start: number; end: number }[] = [];
  if (tokens.length === 0) return chunks;

  const step = Math.max(CHUNK_SIZE_TOKENS - OVERLAP_TOKENS, 1);
  for (let start = 0; start < tokens.length && chunks.length < MAX_CHUNKS; start += step) {
    const end = Math.min(start + CHUNK_SIZE_TOKENS, tokens.length);
    const slice = tokens.slice(start, end);
    chunks.push({
      text: slice.join(" "),
      tokenCount: slice.length,
      start,
      end,
    });
    if (end === tokens.length) break;
  }
  return chunks;
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
  const chunks = buildChunks(tokens);

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

  const embeddingModel = Deno.env.get("EMBEDDING_MODEL_ID") ?? "EMBEDDING_MODEL";
  const zeroVector = Array(EMBEDDING_DIM).fill(0);

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

    const { error: embeddingError } = await supabase.from("ai_embeddings").insert({
      agency_id: agencyId,
      client_id: clientId ?? null,
      doc_type: docType,
      document_id: documentRow.id,
      chunk_id: chunkRow.id,
      embedding: zeroVector,
      model: embeddingModel,
      metadata: { similarity: "cosine", embedding_dim: EMBEDDING_DIM },
    });

    if (embeddingError) {
      return jsonResponse({ error: embeddingError.message }, 400, corsHeaders(req));
    }
  }

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

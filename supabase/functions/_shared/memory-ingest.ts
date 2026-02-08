import { buildChunks, embedText, embedTextShadowGemini, getExpectedEmbeddingDim, getShadowEmbeddingDim, getShadowGeminiModelId, isShadowGeminiEnabled, tokenize } from "./embeddings.ts";
import { embedWithPolicy } from "./embedding-policy.ts";
import { persistEmbeddingResult, persistShadowEmbeddingResult } from "./embedding-store.ts";

const CHUNK_SIZE_TOKENS = 900;
const OVERLAP_TOKENS = 140;
const MAX_CHUNKS = 24;
const MAX_EXTRACTED_CHARS = 150000;

export async function ingestMemoryItemAsDocument(opts: {
  supabase: any;
  agencyId: string;
  clientId: string | null;
  memoryItemId: string;
  docType: "client_memory" | "agency_memory" | "client_episodic" | "agency_episodic";
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}): Promise<{ documentId: string | null; chunksCreated: number }> {
  const extractedText = opts.content.slice(0, MAX_EXTRACTED_CHARS);
  const tokens = tokenize(extractedText);
  const chunks = buildChunks(tokens, CHUNK_SIZE_TOKENS, OVERLAP_TOKENS, MAX_CHUNKS);
  if (chunks.length === 0) return { documentId: null, chunksCreated: 0 };

  const { data: docRow, error: docError } = await opts.supabase
    .from("ai_documents")
    .insert({
      agency_id: opts.agencyId,
      client_id: opts.clientId,
      doc_type: opts.docType,
      title: opts.title,
      content: extractedText,
      extracted_text: extractedText,
      source: { source_type: "ai_memory_item", source_ref: opts.memoryItemId },
      metadata: {
        ...opts.metadata,
        chunk_size_tokens: CHUNK_SIZE_TOKENS,
        overlap_tokens: OVERLAP_TOKENS,
        max_chunks_per_doc: MAX_CHUNKS,
        token_count: tokens.length,
      },
    })
    .select("id")
    .single();

  if (docError || !docRow?.id) {
    throw new Error(docError?.message ?? "Failed to create memory ai_document");
  }

  const embeddingApiKey = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("OPENAI_API_KEY");
  const embeddingModel = Deno.env.get("EMBEDDING_MODEL_ID") ?? "text-embedding-3-small";
  const expectedDim = getExpectedEmbeddingDim();
  const failHard = Deno.env.get("AI_EMBEDDING_FAIL_HARD") === "true";
  const shadowEnabled = isShadowGeminiEnabled();
  const shadowModel = getShadowGeminiModelId();
  const shadowDim = getShadowEmbeddingDim();
  const shadowApiKey = Deno.env.get("GEMINI_API_KEY") ?? null;

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const { data: chunkRow, error: chunkError } = await opts.supabase
      .from("ai_document_chunks")
      .insert({
        document_id: docRow.id,
        chunk_index: index,
        chunk_text: chunk.text,
        token_count: chunk.tokenCount,
        chunk_meta: { start_token: chunk.start, end_token: chunk.end },
        embedding_status: "failed",
      })
      .select("id")
      .single();

    if (chunkError || !chunkRow?.id) {
      throw new Error(chunkError?.message ?? "Failed to create memory chunk");
    }

    const embeddingResult = await embedWithPolicy({
      text: chunk.text,
      apiKey: embeddingApiKey ?? undefined,
      failHard,
      embed: (text) => embedText(text, "", embeddingModel),
    });

    await persistEmbeddingResult({
      supabase: opts.supabase,
      chunkId: chunkRow.id,
      embeddingResult,
      embeddingPayload: {
        agency_id: opts.agencyId,
        client_id: opts.clientId,
        doc_type: opts.docType,
        document_id: docRow.id,
        chunk_id: chunkRow.id,
        embedding: [],
        model: embeddingModel,
        metadata: {
          similarity: "cosine",
          embedding_dim: expectedDim,
        },
      },
    });

    if (shadowEnabled) {
      const shadowResult = await embedWithPolicy({
        text: chunk.text,
        apiKey: shadowApiKey ?? undefined,
        failHard: false,
        embed: (text) => embedTextShadowGemini(text),
      });

      await persistShadowEmbeddingResult({
        supabase: opts.supabase,
        embeddingResult: shadowResult,
        embeddingPayload: {
          agency_id: opts.agencyId,
          client_id: opts.clientId,
          doc_type: opts.docType,
          document_id: docRow.id,
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

  return { documentId: docRow.id, chunksCreated: chunks.length };
}

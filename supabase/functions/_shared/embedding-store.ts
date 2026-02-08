import type { EmbedPolicyResult } from "./embedding-policy.ts";

type MinimalSupabase = {
  from: (table: string) => any;
};

export async function persistEmbeddingResult(opts: {
  supabase: MinimalSupabase;
  chunkId: string;
  embeddingResult: EmbedPolicyResult;
  embeddingPayload: {
    agency_id: string;
    client_id: string | null;
    doc_type: string;
    document_id: string;
    chunk_id: string;
    embedding: number[];
    model: string;
    metadata: Record<string, unknown>;
  };
}) {
  if (opts.embeddingResult.status !== "ok" || !opts.embeddingResult.vector) {
    await opts.supabase.from("ai_document_chunks").update({ embedding_status: "failed" }).eq("id", opts.chunkId);
    return { stored: false, errorCode: opts.embeddingResult.errorCode };
  }

  const { error: embedError } = await opts.supabase.from("ai_embeddings").insert({
    ...opts.embeddingPayload,
    embedding: opts.embeddingResult.vector,
  });
  if (embedError) {
    throw embedError;
  }

  await opts.supabase.from("ai_document_chunks").update({ embedding_status: "ok" }).eq("id", opts.chunkId);

  return { stored: true, errorCode: undefined };
}

export async function persistShadowEmbeddingResult(opts: {
  supabase: MinimalSupabase;
  embeddingResult: EmbedPolicyResult;
  embeddingPayload: {
    agency_id: string;
    client_id: string | null;
    doc_type: string;
    document_id: string;
    chunk_id: string;
    embedding_json: number[];
    model: string;
    metadata: Record<string, unknown>;
  };
}) {
  if (opts.embeddingResult.status !== "ok" || !opts.embeddingResult.vector) {
    return { stored: false, errorCode: opts.embeddingResult.errorCode };
  }

  const { error: embedError } = await opts.supabase.from("ai_embeddings_shadow_gemini").insert({
    ...opts.embeddingPayload,
    embedding_json: opts.embeddingResult.vector,
  });
  if (embedError) {
    throw embedError;
  }

  // Phase 2 cutover readiness: best-effort pgvector write for Gemini embeddings.
  // This enables vector search without changing the existing JSON shadow table.
  try {
    const vec = opts.embeddingResult.vector;
    // PostgREST/pgvector accepts the literal form: "[1,2,3]".
    const pgVector = `[${vec.join(",")}]`;
    const { error: vecError } = await opts.supabase.from("ai_embeddings_shadow_gemini_vector").insert({
      agency_id: opts.embeddingPayload.agency_id,
      client_id: opts.embeddingPayload.client_id,
      doc_type: opts.embeddingPayload.doc_type,
      document_id: opts.embeddingPayload.document_id,
      chunk_id: opts.embeddingPayload.chunk_id,
      embedding: pgVector,
      model: opts.embeddingPayload.model,
      metadata: opts.embeddingPayload.metadata,
    });
    if (vecError) {
      // Do not fail the whole ingest on shadow vector insert; JSON shadow table remains the source of truth.
    }
  } catch {
    // swallow
  }

  return { stored: true, errorCode: undefined };
}

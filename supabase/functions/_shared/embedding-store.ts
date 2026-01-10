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

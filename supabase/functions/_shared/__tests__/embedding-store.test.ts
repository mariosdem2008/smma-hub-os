import { describe, expect, it, vi } from "vitest";
import { persistEmbeddingResult } from "../embedding-store.ts";

describe("embedding store", () => {
  it("marks chunk failed and skips embedding insert on failure", async () => {
    const updates: any[] = [];
    const inserts: any[] = [];
    const supabase = {
      from: (table: string) => {
        if (table === "ai_document_chunks") {
          return {
            update: (payload: any) => {
              updates.push(payload);
              return { eq: async () => ({ data: null, error: null }) };
            },
          };
        }
        if (table === "ai_embeddings") {
          return {
            insert: (payload: any) => {
              inserts.push(payload);
              return { data: null, error: null };
            },
          };
        }
        return {};
      },
    };

    const result = await persistEmbeddingResult({
      supabase: supabase as any,
      chunkId: "chunk-1",
      embeddingResult: { status: "failed", errorCode: "EMBEDDING_FAILED" },
      embeddingPayload: {
        agency_id: "agency-1",
        client_id: null,
        doc_type: "ai_artifact",
        document_id: "doc-1",
        chunk_id: "chunk-1",
        embedding: [],
        model: "model",
        metadata: { embedding_dim: 1536 },
      },
    });

    expect(result.stored).toBe(false);
    expect(inserts.length).toBe(0);
    expect(updates).toContainEqual({ embedding_status: "failed" });
  });
});

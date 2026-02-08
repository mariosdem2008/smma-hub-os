import { describe, expect, it, vi } from "vitest";
import { ingestBrainDocumentForRag } from "../brain-documents.ts";
import { embedWithPolicy } from "../embedding-policy.ts";

vi.mock("../embedding-policy.ts", () => ({
  embedWithPolicy: vi.fn(),
}));

describe("brain document ingest", () => {
  it("writes embeddings for approved brain documents", async () => {
    const inserts: Record<string, any[]> = {
      ai_documents: [],
      ai_document_chunks: [],
      ai_embeddings: [],
      ai_embeddings_shadow_gemini: [],
    };
    const updates: Record<string, any[]> = {
      ai_document_chunks: [],
    };
    const deletes: { ai_documents: Array<{ column: string; value: any }> } = { ai_documents: [] };

    const supabase = {
      from: (table: string) => {
        if (table === "ai_documents") {
          return {
            delete: () => ({
              eq: (column: string, value: any) => {
                deletes.ai_documents.push({ column, value });
                return {
                  eq: (column2: string, value2: any) => {
                    deletes.ai_documents.push({ column: column2, value: value2 });
                    return {
                      eq: async (column3: string, value3: any) => {
                        deletes.ai_documents.push({ column: column3, value: value3 });
                        return { data: null, error: null };
                      },
                    };
                  },
                };
              },
            }),
            insert: (payload: any) => {
              inserts.ai_documents.push(payload);
              return {
                select: () => ({
                  single: async () => ({ data: { id: "doc-1" }, error: null }),
                }),
              };
            },
          };
        }
        if (table === "ai_document_chunks") {
          return {
            insert: (payload: any) => {
              inserts.ai_document_chunks.push(payload);
              return {
                select: () => ({
                  single: async () => ({ data: { id: `chunk-${payload.chunk_index}` }, error: null }),
                }),
              };
            },
            update: (payload: any) => ({
              eq: async () => {
                updates.ai_document_chunks.push(payload);
                return { data: null, error: null };
              },
            }),
          };
        }
        if (table === "ai_embeddings") {
          return {
            insert: (payload: any) => {
              inserts.ai_embeddings.push(payload);
              return { error: null };
            },
          };
        }
        if (table === "ai_embeddings_shadow_gemini") {
          return {
            insert: (payload: any) => {
              inserts.ai_embeddings_shadow_gemini.push(payload);
              return { error: null };
            },
          };
        }
        return {};
      },
    };

    (embedWithPolicy as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "ok",
      vector: [0.01, 0.02, 0.03],
    });

    const doc = {
      id: "brain-doc-1",
      agency_id: "agency-1",
      module: "bootstrap",
      title: "Bootstrap",
      content_json: { agency_name: "Test Agency", services: ["A", "B"] },
      status: "approved",
      version: 2,
      approved_at: "2026-01-08T12:00:00.000Z",
      approved_by: "user-1",
      parent_version_id: null,
      source: "manual",
      created_by: "user-1",
      created_at: "2026-01-08T11:00:00.000Z",
      updated_at: "2026-01-08T12:00:00.000Z",
    };

    const result = await ingestBrainDocumentForRag(supabase as any, doc, {
      embeddingApiKey: "test-key",
      embeddingModel: "text-embedding-3-small",
      failHard: false,
    });

    expect(result.documentId).toBe("doc-1");
    expect(inserts.ai_documents.length).toBe(1);
    expect(inserts.ai_document_chunks.length).toBeGreaterThan(0);
    expect(inserts.ai_embeddings.length).toBe(inserts.ai_document_chunks.length);
    // Shadow writes are best-effort; ensure the mock supports them when enabled.
    expect(inserts.ai_embeddings_shadow_gemini.length).toBe(inserts.ai_document_chunks.length);
    expect(updates.ai_document_chunks).toContainEqual({ embedding_status: "ok" });
    expect(deletes.ai_documents).toContainEqual({ column: "agency_id", value: "agency-1" });
    expect(deletes.ai_documents).toContainEqual({ column: "doc_type", value: "brain_document" });
    expect(deletes.ai_documents).toContainEqual({ column: "metadata->>module", value: "bootstrap" });
  });
});

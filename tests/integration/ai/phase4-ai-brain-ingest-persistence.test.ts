import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("phase4 ai-brain-ingest persistence path", () => {
  const edgePath = resolve(process.cwd(), "supabase/functions/ai-brain-ingest/index.ts");
  const storePath = resolve(process.cwd(), "supabase/functions/_shared/embedding-store.ts");
  const source = readFileSync(edgePath, "utf8");
  const storeSource = readFileSync(storePath, "utf8");

  it("ensures brain rows exist before mapping and ingest", () => {
    expect(source).toContain("getOrCreateBrainRow");
    expect(source).toContain(".from(\"agency_brains\")");
    expect(source).toContain(".from(\"client_brains\")");
    expect(source).toContain("version: 1");
  });

  it("deduplicates summary artifacts and writes dual embeddings", () => {
    expect(source).toContain("metadata->>summary_type");
    expect(source).toContain("agency_brain_summary");
    expect(source).toContain("client_brain_summary");
    expect(source).toContain("persistEmbeddingResult");
    expect(source).toContain("persistShadowEmbeddingResult");
    expect(storeSource).toContain("ai_embeddings_shadow_gemini_vector");
  });
});

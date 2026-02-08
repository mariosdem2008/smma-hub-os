import { describe, it, expect } from "vitest";

// Phase 2: contextual ingestion summary generation.
// Skipped by default; requires live Edge function + DB migrations.
describe.skip("phase2 contextual ingestion summaries", () => {
  it("ai_document_chunks stores 50-100 token summaries when ENABLE_CONTEXTUAL_INGESTION is on", () => {
    // TODO: call ai-documents-ingest in staging and assert chunk_summary is non-null.
    expect(true).toBe(true);
  });
});


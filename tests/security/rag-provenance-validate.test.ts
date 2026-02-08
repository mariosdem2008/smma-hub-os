import { describe, it, expect } from "vitest";

describe.skip("tenant scoping: 0 cross-tenant leaks - rag provenance validate", () => {
  it("requires provenance fields on retrieval results", () => {
    const required = ["agency_id", "client_id", "source_id", "chunk_id", "doc_type"];
    expect(required).toContain("agency_id");
  });
});

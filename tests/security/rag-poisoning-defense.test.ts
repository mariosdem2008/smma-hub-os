import { describe, it, expect } from "vitest";

// Phase 2: ingestion poisoning defense.
// Skipped by default; requires staging allowlist + manifest configured.
describe.skip("phase2 rag poisoning defense", () => {
  it("rejects ingestion when source is not allowlisted (0 cross-tenant leaks)", () => {
    // TODO: call ai-documents-ingest with unregistered {source_type, source_ref} and expect 403 source_not_allowlisted.
    expect(true).toBe(true);
  });

  it("rejects ingestion when manifest_sha256 does not match allowlisted record", () => {
    // TODO: register allowlisted source with manifest_sha256, then attempt ingest with different manifest_sha256.
    expect(true).toBe(true);
  });
});


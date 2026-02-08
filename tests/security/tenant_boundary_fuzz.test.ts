import { describe, test } from "vitest";

describe.skip("tenant boundary fuzz (planning only)", () => {
  test("TODO: cross-tenant retrieval negative cases", () => {
    // TODO-01: retrieval with mismatched agency_id
    // TODO-02: retrieval with mismatched client_id
    // TODO-03: retrieval without tenant_id
    // TODO-04: retrieval with forged tenant_id
    // TODO-05: retrieval with doc_type outside scope
    // TODO-06: retrieval with wildcard doc_type
    // TODO-07: tool scope escalation attempt
    // TODO-08: tool call without required scope
    // TODO-09: RLS bypass regression on ai_embeddings
    // TODO-10: RLS bypass regression on brain_documents
    // TODO-11: log leakage across tenants
    // TODO-12: memory read across tenants
  });
});

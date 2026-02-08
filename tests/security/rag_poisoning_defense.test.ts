import { describe, test } from "vitest";

describe.skip("rag poisoning defense (planning only)", () => {
  test("TODO: poisoning defense cases", () => {
    // TODO-01: unknown source manifest entry rejected
    // TODO-02: mismatched checksum rejected
    // TODO-03: cross-tenant source rejected
    // TODO-04: oversized chunk rejected
    // TODO-05: malformed provenance rejected
    // TODO-06: duplicate chunk with conflicting metadata rejected
    // TODO-07: prompt injection markers flagged
    // TODO-08: missing tenant_id rejected
  });
});

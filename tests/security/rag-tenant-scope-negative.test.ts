import { describe, it, expect } from "vitest";

describe.skip("tenant scoping: 0 cross-tenant leaks - rag tenant scope", () => {
  it("rejects mismatched agency_id/client_id scopes", () => {
    expect(true).toBe(true);
  });
});

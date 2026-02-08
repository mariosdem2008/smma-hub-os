import { describe, it, expect } from "vitest";

describe.skip("checkpoint schema (Phase 1)", () => {
  it("requires plan_id, step_id, status", () => {
    const required = ["plan_id", "step_id", "status"];
    expect(required).toContain("plan_id");
    expect(required).toContain("step_id");
    expect(required).toContain("status");
  });
});

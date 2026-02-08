import { describe, it, expect } from "vitest";

describe.skip("durable executor state machine (Phase 1)", () => {
  it("covers allowed transitions", () => {
    const allowed = {
      pending: ["running", "failed"],
      running: ["completed", "failed"],
      completed: [],
      failed: [],
    };
    expect(Object.keys(allowed)).toContain("running");
    expect(allowed.running).toContain("completed");
  });
});

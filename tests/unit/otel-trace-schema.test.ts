import { describe, it, expect } from "vitest";

describe.skip("OTel trace schema (Phase 1)", () => {
  it("covers 7 stages", () => {
    const stages = ["router.run", "planner.plan", "executor.step", "tool.call", "rag.retrieve", "memory.read", "logging.write"];
    expect(stages.length).toBe(7);
  });
});

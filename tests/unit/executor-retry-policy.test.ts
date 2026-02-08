import { describe, it, expect } from "vitest";
import { TOOL_REGISTRY } from "../../src/ai/toolSchemas.ts";

describe.skip("executor retry policy (Phase 1)", () => {
  it("all tools define retries", () => {
    const retryCounts = Object.values(TOOL_REGISTRY).map((tool) => tool.retries);
    expect(retryCounts.every((v) => typeof v === "number")).toBe(true);
  });
});

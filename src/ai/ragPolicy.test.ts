import { describe, expect, it } from "vitest";
import { applyRagPolicy, getRagConfig } from "./ragPolicy.ts";
import { TaskType } from "./taskTypes.ts";

describe("ragPolicy", () => {
  it("returns default config for client portal QA", () => {
    const config = getRagConfig(TaskType.CLIENT_PORTAL_QA);
    expect(config.client_memory_top_k).toBe(6);
    expect(config.agency_memory_top_k).toBe(4);
    expect(config.exemplar_top_k).toBe(2);
    expect(config.max_context_chars).toBe(6000);
  });

  it("selects top matches per bucket and orders by similarity", () => {
    const config = getRagConfig(TaskType.STRATEGY_PLAN);
    const matches = [
      { doc_type: "client_guidelines", chunk_text: "c1", similarity: 0.2 },
      { doc_type: "client_guidelines", chunk_text: "c2", similarity: 0.9 },
      { doc_type: "agency_sop", chunk_text: "a1", similarity: 0.5 },
      { doc_type: "agency_sop", chunk_text: "a2", similarity: 0.8 },
      { doc_type: "agency_exemplar_strategy", chunk_text: "e1", similarity: 0.3 },
      { doc_type: "agency_exemplar_strategy", chunk_text: "e2", similarity: 0.7 },
    ];

    const result = applyRagPolicy(matches, { ...config, client_memory_top_k: 1, agency_memory_top_k: 1, exemplar_top_k: 1 });
    expect(result.selectedMatches.map((m) => m.chunk_text)).toEqual(["c2", "a2", "e2"]);
    expect(result.retrievalCount).toBe(3);
  });

  it("truncates context when exceeding max chars", () => {
    const config = getRagConfig(TaskType.STRATEGY_PLAN);
    const matches = [
      { doc_type: "client_guidelines", chunk_text: "a".repeat(50), similarity: 0.9 },
    ];

    const result = applyRagPolicy(matches, { ...config, max_context_chars: 10 });
    expect(result.contextTruncated).toBe(true);
    expect(result.context.length).toBeGreaterThan(10);
  });
});

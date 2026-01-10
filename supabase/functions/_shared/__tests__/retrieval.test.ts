import { describe, expect, it } from "vitest";
import { capMatchesByTokenBudget, clampMatchCount } from "../retrieval.ts";

describe("retrieval helpers", () => {
  it("clamps match count to hard cap", () => {
    expect(clampMatchCount(0)).toBe(1);
    expect(clampMatchCount(50)).toBe(12);
    expect(clampMatchCount(8)).toBe(8);
  });

  it("caps matches by token budget", () => {
    const matches = [
      { chunk_text: "one two three" },
      { chunk_text: "four five six" },
      { chunk_text: "seven eight nine" },
    ];

    const result = capMatchesByTokenBudget(matches, 6);
    expect(result.matches.length).toBe(2);
    expect(result.truncated).toBe(true);
  });
});

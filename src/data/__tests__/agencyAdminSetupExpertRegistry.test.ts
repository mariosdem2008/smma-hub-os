import { describe, expect, it } from "vitest";
import { EXPERT_QUESTION_REGISTRY } from "../../../supabase/functions/_shared/agency-admin-setup-expert-questions";

describe("agency admin setup expert registry", () => {
  it("is importable from the setup handler module area", () => {
    expect(Array.isArray(EXPERT_QUESTION_REGISTRY)).toBe(true);
    expect(EXPERT_QUESTION_REGISTRY.length).toBeGreaterThan(0);
  });

  it("enforces schema sanity for all entries", () => {
    for (const entry of EXPERT_QUESTION_REGISTRY) {
      expect(typeof entry.id).toBe("string");
      expect(entry.id.trim().length).toBeGreaterThan(0);
      expect([1, 2, 3, 4, 5]).toContain(entry.depthLevel);
      expect(typeof entry.intent).toBe("string");
      expect(entry.intent.trim().length).toBeGreaterThan(0);
      expect(Array.isArray(entry.requiredFields)).toBe(true);
      expect(entry.requiredFields.length).toBeGreaterThan(0);
      for (const field of entry.requiredFields) {
        expect(typeof field).toBe("string");
        expect(field.trim().length).toBeGreaterThan(0);
      }
      expect(typeof entry.exampleQuestion).toBe("string");
      expect(entry.exampleQuestion.trim().length).toBeGreaterThan(0);
    }
  });

  it("has unique ids", () => {
    const ids = EXPERT_QUESTION_REGISTRY.map((entry) => entry.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

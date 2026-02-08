import { describe, it, expect } from "vitest";
import * as mock from "../../src/ai/providers/mock.ts";
import * as openai from "../../src/ai/providers/openai.ts";
import * as gemini from "../../src/ai/providers/gemini.ts";
import * as anthropic from "../../src/ai/providers/anthropic.ts";

describe.skip("provider facade contract (Phase 1)", () => {
  it("supports generate + embed shape", async () => {
    const generated = await mock.generate({ model: "mock-model", messages: [{ role: "user", content: "Hi" }] });
    expect(typeof generated.text).toBe("string");
    const embedded = await mock.embed({ model: "mock-model", input: "hello", outputDimensionality: 3 });
    expect(Array.isArray(embedded.embedding)).toBe(true);
  });

  it("exports provider methods", () => {
    expect(typeof openai.generate).toBe("function");
    expect(typeof openai.embed).toBe("function");
    expect(typeof gemini.generate).toBe("function");
    expect(typeof gemini.embed).toBe("function");
    expect(typeof anthropic.generate).toBe("function");
  });
});

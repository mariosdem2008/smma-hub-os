import { describe, expect, it } from "vitest";
import { loadPromptText } from "../promptRegistry.ts";

describe("prompt registry", () => {
  it("does not cache empty prompts", () => {
    expect(() => loadPromptText("admin_chat/empty_test.md")).toThrow();
    expect(() => loadPromptText("admin_chat/empty_test.md")).toThrow();
  });
});

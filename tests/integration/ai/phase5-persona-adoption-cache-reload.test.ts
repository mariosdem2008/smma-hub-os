import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("phase5 persona adoption and prompt cache reload", () => {
  it("invalidates prompt cache version when onboarding completes", () => {
    const source = readFileSync(resolve(process.cwd(), "supabase/functions/ai-onboarding/index.ts"), "utf8");
    expect(source).toContain("prompt_cache_version");
    expect(source).toContain("prompt_cache_invalidated_at");
    expect(source).toContain("persona_reload_");
  });

  it("injects persona traits into assistant system prompts", () => {
    const assistantSource = readFileSync(resolve(process.cwd(), "supabase/functions/ai-assistant/index.ts"), "utf8");
    const adminPromptSource = readFileSync(resolve(process.cwd(), "src/ai/prompts/adminGeneralChat.ts"), "utf8");

    expect(assistantSource).toContain("resolvePersonaPromptContext");
    expect(assistantSource).toContain("Tone traits:");
    expect(assistantSource).toContain("Expertise traits:");
    expect(adminPromptSource).toContain("assistant_name");
    expect(adminPromptSource).toContain("Tone traits:");
    expect(adminPromptSource).toContain("Expertise traits:");
  });
});

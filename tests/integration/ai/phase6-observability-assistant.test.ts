import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("phase6 assistant observability instrumentation", () => {
  it("logs persona context reload span and turn-end attributes", () => {
    const source = readFileSync(resolve(process.cwd(), "supabase/functions/ai-assistant/index.ts"), "utf8");
    expect(source).toContain("stage: \"edge.ai-assistant.persona_context\"");
    expect(source).toContain("persona_reloaded");
    expect(source).toContain("persona_source");
    expect(source).toContain("persona_cache_version");
    expect(source).toContain("context_request_count");
  });

  it("propagates prompt cache and persona source in admin chat ai_runs metadata", () => {
    const source = readFileSync(resolve(process.cwd(), "supabase/functions/_shared/agency-admin-general-ai.ts"), "utf8");
    expect(source).toContain("prompt_cache_version");
    expect(source).toContain("persona_source");
  });
});

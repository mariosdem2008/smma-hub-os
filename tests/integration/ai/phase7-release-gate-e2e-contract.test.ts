import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("phase7 release gate e2e contract coverage", () => {
  it("keeps completion -> ingest -> cache invalidation -> persona reload chain wired", () => {
    const onboardingSource = readFileSync(resolve(process.cwd(), "supabase/functions/ai-onboarding/index.ts"), "utf8");
    const ingestSource = readFileSync(resolve(process.cwd(), "supabase/functions/ai-brain-ingest/index.ts"), "utf8");
    const assistantSource = readFileSync(resolve(process.cwd(), "supabase/functions/ai-assistant/index.ts"), "utf8");

    expect(onboardingSource).toContain("runCompletionIngest");
    expect(onboardingSource).toContain("prompt_cache_version");
    expect(onboardingSource).toContain("prompt_cache_invalidated_at");
    expect(ingestSource).toContain("persistEmbeddingResult");
    expect(ingestSource).toContain("persistShadowEmbeddingResult");
    expect(assistantSource).toContain("resolvePersonaPromptContext");
    expect(assistantSource).toContain("persona_cache_version");
  });

  it("keeps observability linkage on onboarding and assistant turn-end spans", () => {
    const onboardingSource = readFileSync(resolve(process.cwd(), "supabase/functions/ai-onboarding/index.ts"), "utf8");
    const assistantSource = readFileSync(resolve(process.cwd(), "supabase/functions/ai-assistant/index.ts"), "utf8");

    expect(onboardingSource).toContain("stage: \"edge.ai-onboarding.turn_end\"");
    expect(onboardingSource).toContain("missing_fields_count");
    expect(onboardingSource).toContain("suggestions_fallback");
    expect(assistantSource).toContain("stage: \"edge.ai-assistant\"");
    expect(assistantSource).toContain("persona_reloaded");
    expect(assistantSource).toContain("context_request_count");
  });
});

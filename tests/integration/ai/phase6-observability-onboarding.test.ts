import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("phase6 onboarding observability instrumentation", () => {
  const source = readFileSync(resolve(process.cwd(), "supabase/functions/ai-onboarding/index.ts"), "utf8");

  it("logs staged onboarding spans for auth, resolver, suggestions, ingest, and persist", () => {
    expect(source).toContain("stage: \"onboarding.auth\"");
    expect(source).toContain("stage: \"onboarding.snapshot.load\"");
    expect(source).toContain("stage: \"onboarding.resolver\"");
    expect(source).toContain("stage: \"onboarding.suggestions\"");
    expect(source).toContain("stage: \"onboarding.ingest\"");
    expect(source).toContain("stage: \"onboarding.persist\"");
  });

  it("records observability keys on turn end and ai_runs metadata", () => {
    expect(source).toContain("missing_fields_count");
    expect(source).toContain("suggestions_fallback");
    expect(source).toContain("repair_attempted");
    expect(source).toContain("ingest_status");
    expect(source).toContain("cache_invalidated");
    expect(source).toContain("trace_id: params.traceId");
    expect(source).toContain("request_id: params.requestId");
    expect(source).toContain("module_key: params.moduleKey");
  });
});

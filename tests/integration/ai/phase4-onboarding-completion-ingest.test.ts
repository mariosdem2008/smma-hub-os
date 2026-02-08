import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("phase4 onboarding completion bridge", () => {
  const edgePath = resolve(process.cwd(), "supabase/functions/ai-onboarding/index.ts");
  const source = readFileSync(edgePath, "utf8");

  it("invokes ai-brain-ingest when completion criteria are met", () => {
    expect(source).toContain("runCompletionIngest");
    expect(source).toContain("functions/v1/ai-brain-ingest");
    expect(source).toContain("ONBOARDING_COMPLETION_INGEST_FAILED");
    expect(source).toContain("finalStatusValue = \"in_progress\"");
  });

  it("tracks completion ingest idempotency in onboarding metadata", () => {
    expect(source).toContain("hashSnapshot");
    expect(source).toContain("completion_ingest");
    expect(source).toContain("snapshot_hash");
    expect(source).toContain("completionIngest.status !== \"ok\"");
  });
});

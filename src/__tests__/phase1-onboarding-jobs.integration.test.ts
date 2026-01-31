import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("phase 1 onboarding job pipeline", () => {
  it("enqueues ingest_client_brain on onboarding completion", () => {
    const migration = read("supabase/migrations/20260129121500_onboarding_enqueues_brain_ingest_job.sql");
    expect(migration).toContain("complete_onboarding_profile");
    expect(migration).toContain("'ingest_client_brain'");
    expect(migration).toContain("'ingest_client_brain:' || p_client_id::text");
  });

  it("job worker supports ingest_client_brain and can enqueue seed_strategy", () => {
    const worker = read("supabase/functions/ai-job-worker/index.ts");
    expect(worker).toContain('jobType === "ingest_client_brain"');
    expect(worker).toContain('jobType: "seed_strategy"');
    expect(worker).toContain("mapV3AnswersToClientBrain");
    expect(worker).toContain("evaluateClientBrainForStrategy");
  });

  it("onboarding UIs no longer call ai-brains-client or ai-brain-ingest directly", () => {
    const v5 = read("src/components/onboarding-v5/OnboardingV5Wizard.tsx");
    expect(v5).not.toContain("ai-brains-client");
    expect(v5).not.toContain("ai-brain-ingest");
    expect(v5).not.toContain("ai-strategy-generate");
  });
});

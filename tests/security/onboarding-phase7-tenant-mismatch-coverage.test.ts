import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("phase7 onboarding tenant mismatch guard coverage", () => {
  it("keeps explicit tenant membership checks in onboarding and ingest edge functions", () => {
    const onboardingSource = readFileSync(resolve(process.cwd(), "supabase/functions/ai-onboarding/index.ts"), "utf8");
    const ingestSource = readFileSync(resolve(process.cwd(), "supabase/functions/ai-brain-ingest/index.ts"), "utf8");
    const assistantSource = readFileSync(resolve(process.cwd(), "supabase/functions/ai-assistant/index.ts"), "utf8");

    expect(onboardingSource).toContain("ensureAgencyMembership");
    expect(onboardingSource).toContain("ensureClientBelongsToAgency");
    expect(ingestSource).toContain(".from(\"agency_members\")");
    expect(ingestSource).toContain(".eq(\"agency_id\", agencyId)");
    expect(assistantSource).toContain("requireMembership");
    expect(assistantSource).toContain("getClientAndAgency");
  });

  it("retains service-role only edge client construction for protected flows", () => {
    const onboardingSource = readFileSync(resolve(process.cwd(), "supabase/functions/ai-onboarding/index.ts"), "utf8");
    const ingestSource = readFileSync(resolve(process.cwd(), "supabase/functions/ai-brain-ingest/index.ts"), "utf8");
    const assistantSource = readFileSync(resolve(process.cwd(), "supabase/functions/ai-assistant/index.ts"), "utf8");

    expect(onboardingSource).toContain("createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    expect(ingestSource).toContain("createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    expect(assistantSource).toContain("createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  });
});

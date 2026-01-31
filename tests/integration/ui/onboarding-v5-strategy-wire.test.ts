import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("onboarding v5 strategy wiring", () => {
  it("completes onboarding and relies on server-side jobs", () => {
    const filePath = resolve(process.cwd(), "src/components/onboarding-v5/OnboardingV5Wizard.tsx");
    const content = readFileSync(filePath, "utf8");
    expect(content).toContain("complete_onboarding_profile");
    expect(content).not.toContain("ai-brain-ingest");
    expect(content).not.toContain("ai-strategy-generate");
  });
});

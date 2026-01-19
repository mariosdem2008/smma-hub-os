import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("onboarding v5 strategy wiring", () => {
  it("invokes ai-strategy-generate after ai-brain-ingest", () => {
    const filePath = resolve(process.cwd(), "src/components/onboarding-v5/OnboardingV5Wizard.tsx");
    const content = readFileSync(filePath, "utf8");
    expect(content).toContain("ai-brain-ingest");
    expect(content).toContain("ai-strategy-generate");
  });
});


import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("dashboard AI setup completion source", () => {
  it("derives AI setup completion from brain_documents (not onboarding answers_json)", () => {
    const filePath = resolve(process.cwd(), "src/pages/Dashboard.tsx");
    const content = readFileSync(filePath, "utf8");
    expect(content).toContain("brain_documents");
    expect(content).not.toContain("agency_onboarding_sessions");
    expect(content).toContain("AI_SETUP_CORE_MODULES");
  });
});


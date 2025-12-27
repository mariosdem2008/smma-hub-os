import { describe, expect, it } from "vitest";
import { buildAdminSetupGuidedPrompt } from "../prompts/adminSetupGuided";

describe("admin setup guided prompt", () => {
  it("forbids re-asking name/website when present in snapshot", () => {
    const prompt = buildAdminSetupGuidedPrompt({
      agencyBrain: {},
      conversation: "",
      latestUserMessage: "",
      contextSnapshot: { agency: { name: "Rocket Agency", website: "https://rocket.test" } },
    });
    const system = prompt.find((msg) => msg.role === "system")?.content ?? "";
    expect(system).toContain("Do NOT ask for the agency name");
    expect(system).toContain("Do NOT ask for the agency website");
  });

  it("keeps required structure invariants", () => {
    const prompt = buildAdminSetupGuidedPrompt({
      agencyBrain: {},
      conversation: "",
      latestUserMessage: "",
      contextSnapshot: { agency: { name: "Rocket Agency", website: "https://rocket.test" } },
    });
    const system = prompt.find((msg) => msg.role === "system")?.content ?? "";
    expect(system).toContain("BOOTSTRAP DATA AWARENESS:");
    expect(system).toContain("Level 1 (Foundation)");
    expect(system).toContain("Level 2 (Differentiation)");
    expect(system).toContain("Level 3 (Operations)");
    expect(system).toContain("Level 4 (Voice & Safety)");
    expect(system).toContain("Level 5 (Expert)");
    expect(system).toContain("system may still follow a deterministic order until orchestration is enabled");
    expect(system).toContain("Do NOT ask for the agency name");
    expect(system).toContain("Do NOT ask for the agency website");
  });

  it("allows asking name/website when missing in snapshot", () => {
    const prompt = buildAdminSetupGuidedPrompt({
      agencyBrain: {},
      conversation: "",
      latestUserMessage: "",
      contextSnapshot: { agency: { name: null, website: null } },
    });
    const system = prompt.find((msg) => msg.role === "system")?.content ?? "";
    expect(system).toContain("Agency name is missing. You MAY ask for the agency name if needed.");
    expect(system).toContain("Agency website is missing. You MAY ask for the agency website if needed.");
  });
});

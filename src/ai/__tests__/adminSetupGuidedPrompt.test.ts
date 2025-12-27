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

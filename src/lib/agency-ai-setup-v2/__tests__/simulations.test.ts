import { describe, expect, it } from "vitest";
import { getAgencyAiSimulationScenarios, runAgencyAiSetupSimulation } from "@/lib/agency-ai-setup-v2/simulations";

describe("agency AI setup simulations", () => {
  it("returns scenario packs for each agent class", () => {
    const scenarios = getAgencyAiSimulationScenarios("strategy");
    expect(scenarios.length).toBeGreaterThan(0);
    expect(scenarios[0].key).toBe("strategy_readiness_certification");
  });

  it("fails blocked setups with low governance", () => {
    const result = runAgencyAiSetupSimulation({
      agentClass: "creator",
      unlockState: "blocked",
      activationMode: null,
      activated: false,
      readinessLabel: "Needs Definition",
      blockers: ["Quality bar missing", "Approval matrix missing", "Claims guardrails missing"],
      readinessScores: {
        knowledge_coverage: 45,
        process_definition: 35,
        quality_definition: 42,
        compliance_safety: 38,
        approval_governance: 40,
        evidence_strength: 50,
      },
    });

    expect(result.result).toBe("fail");
    expect(result.dimensionScores.compliance_safety).toBeLessThan(70);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it("passes operational setups with strong readiness", () => {
    const result = runAgencyAiSetupSimulation({
      agentClass: "strategy",
      unlockState: "operational",
      activationMode: "operational",
      activated: true,
      readinessLabel: "Expert-Quality Ready",
      blockers: [],
      readinessScores: {
        knowledge_coverage: 92,
        process_definition: 90,
        quality_definition: 91,
        compliance_safety: 94,
        approval_governance: 93,
        evidence_strength: 88,
      },
    });

    expect(result.result).toBe("pass");
    expect(result.summary).toMatch(/passed/i);
    expect(result.dimensionScores.operator_usefulness).toBeGreaterThan(80);
  });
});

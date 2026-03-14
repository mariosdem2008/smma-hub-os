import { describe, expect, it } from "vitest";
import {
  AGENCY_AI_ACTIVATION_MODE_CAPABILITIES,
  formatUnlockStateLabel,
  getActivationModeRank,
  getAvailableActivationModes,
  getMissingCertificationScenarios,
} from "../config";

describe("agency ai setup activation policies", () => {
  it("orders modes from preview to operational", () => {
    expect(getActivationModeRank("preview_only")).toBeLessThan(getActivationModeRank("internal_assist_only"));
    expect(getActivationModeRank("internal_assist_only")).toBeLessThan(getActivationModeRank("operational"));
  });

  it("returns available activation modes up to the unlock ceiling", () => {
    expect(getAvailableActivationModes("strategy", "blocked")).toEqual([]);
    expect(getAvailableActivationModes("strategy", "preview_only")).toEqual(["preview_only"]);
    expect(getAvailableActivationModes("strategy", "internal_assist_only")).toEqual(["preview_only", "internal_assist_only"]);
    expect(getAvailableActivationModes("strategy", "operational")).toEqual(["preview_only", "internal_assist_only"]);
    expect(getAvailableActivationModes("strategy", "operational", ["strategy_readiness_certification"])).toEqual([
      "preview_only",
      "internal_assist_only",
      "operational",
    ]);
  });

  it("exposes labels and capability text", () => {
    expect(formatUnlockStateLabel("preview_only")).toBe("Preview Only");
    expect(AGENCY_AI_ACTIVATION_MODE_CAPABILITIES.operational).toContain("Participate in live workflow under approvals");
  });

  it("reports missing certification scenarios per agent class", () => {
    expect(getMissingCertificationScenarios("creator", [])).toEqual(["creator_brief_certification"]);
    expect(getMissingCertificationScenarios("creator", ["creator_brief_certification"])).toEqual([]);
  });
});

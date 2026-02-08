import { describe, expect, it } from "vitest";
import { countRequiredComplete, getNextQuestion, QUESTION_BANK } from "../onboardingScript.ts";

describe("onboardingScript", () => {
  it("returns the first missing P0 question", () => {
    const snapshot = {};
    const question = getNextQuestion(snapshot, {});
    expect(question?.priority).toBe("P0");
    expect(question?.field_path).toBe("bootstrap.agency_name");
  });

  it("marks required complete when all P0 fields are answered", () => {
    const snapshot: Record<string, unknown> = {
      bootstrap: {
        agency_name: "Orbit",
        locale: "Europe/Athens, English",
        team_size: "5",
        active_clients: "8",
        target_industries: ["SaaS"],
        services: ["SMM"],
      },
      positioning: {
        icp_best: "B2B SaaS",
        differentiators: ["48h turnaround"],
      },
      offer_stack: {
        core_offer_high_margin: "Retainer",
        core_offers: ["Retainer"],
        pricing_model: "Fixed retainer",
      },
    };
    const progress = countRequiredComplete(snapshot);
    expect(progress.requiredComplete).toBe(true);
  });

  it("skips optional questions when flagged", () => {
    const snapshot: Record<string, unknown> = {};
    const optional = QUESTION_BANK.find((q) => q.priority !== "P0");
    const skipped: Record<string, boolean> = optional ? { [optional.field_path]: true } : {};
    const next = getNextQuestion(snapshot, skipped);
    expect(next?.priority).toBe("P0");
  });
});

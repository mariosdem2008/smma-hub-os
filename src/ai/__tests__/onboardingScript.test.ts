import { describe, expect, it } from "vitest";
import { countRequiredComplete, getNextQuestion, QUESTION_BANK } from "../onboardingScript.ts";

describe("onboardingScript", () => {
  it("returns the first missing P0 question", () => {
    const snapshot = {};
    const question = getNextQuestion(snapshot, {});
    expect(question?.priority).toBe("P0");
    expect(question?.field_path).toBe("agency.name");
  });

  it("marks required complete when all P0 fields are answered", () => {
    const snapshot: Record<string, unknown> = {
      agency: {
        name: "Orbit",
        timezone: "Europe/Athens",
        primary_client_languages: ["English 80%", "Greek 20%"],
        team_size_total: "5",
        active_paying_clients: "8",
        top_industries: ["SaaS"],
        best_client_summary: "B2B SaaS founder at $40k MRR focused on qualified demo bookings.",
        key_differentiators: ["Fast turnarounds", "Founder-led strategy", "SaaS specialization"],
        service_catalog: ["Paid Ads | Meta and Google campaign management"],
        top_margin_offers: ["Retainer Growth | Weekly strategy; 12 creatives; reporting | 1500-2500 | Reusable workflow"],
        packaged_offers: ["Lead Engine | 40 leads/month | 12 creatives; ad mgmt; reporting | 30 days | 1500-2500"],
        pricing_model: "Fixed retainer | Predictable monthly workload and scope",
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

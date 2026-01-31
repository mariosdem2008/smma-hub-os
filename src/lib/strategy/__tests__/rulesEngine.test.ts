import { describe, expect, it } from "vitest";
import { evaluateStrategyModule } from "../rulesEngine";

describe("strategy rulesEngine", () => {
  it("allows a single enabled channel when translation + CTA rules are complete", () => {
    const content: any = {
      channels: [
        {
          id: "ch1",
          platform: "instagram",
          enabled: true,
          role: "Primary channel",
          formats: ["short_video"],
          hookRules: ["Hook fast"],
          ctaRules: ["DM keyword"],
          visualRules: ["On brand"],
          cadence: "3x/week",
          dos: ["Do A"],
          donts: ["Don't B"],
          examples: ["Reel: ..."],
        },
      ],
      translationTable: [{ coreMessage: "DM keyword to book.", variants: { instagram: "DM keyword to book." } }],
      decisions: { ctasLocked: true, rulesLocked: true },
    };

    const result = evaluateStrategyModule("channel_adaptations", content, {
      modules: { channel_adaptations: content } as any,
      currentStatus: "draft",
      isLocked: false,
    });

    expect(result.blockers.map((b) => b.code)).not.toContain("channels.count_min");
    expect(result.completion_percent).toBe(100);
  });

  it("flags campaign month mismatch (not 'none') when campaigns exist but dates don't match selectedMonth", () => {
    const content: any = {
      selectedMonth: "2026-01",
      campaigns: [
        {
          id: "c1",
          name: "Month 1 Campaign",
          goal: "Goal",
          offer: "Offer",
          cta: "visit_store",
          icp: "ICP",
          pillarIds: ["p1"],
          angle: "Angle",
          assets: [{ name: "Asset 1", completed: false }],
          kpiTargets: { Leads: 10 },
          startDate: "2024-03-01",
          endDate: "2024-03-31",
          status: "planned",
        },
      ],
      stopDoing: [],
      decisions: { monthlyOffersLocked: false, activeCampaignsLocked: false },
    };

    const result = evaluateStrategyModule("campaign_plan", content, {
      modules: { campaign_plan: content } as any,
      currentStatus: "draft",
      isLocked: false,
    });

    const codes = result.blockers.map((b) => b.code);
    expect(codes).toContain("campaigns.month_mismatch");
    expect(codes).not.toContain("campaigns.none");
  });

  it("flags pillars coverage sum when coveragePercent does not total 100", () => {
    const content: any = {
      pillars: [
        {
          id: "p1",
          name: "P1",
          coveragePercent: 40,
          purpose: "authority",
          coreMessage: "Core",
          contentTypes: ["A"],
          bannedAngles: [],
          kpis: [],
          examples: ["e1", "e2", "e3"],
        },
        {
          id: "p2",
          name: "P2",
          coveragePercent: 40,
          purpose: "proof",
          coreMessage: "Core",
          contentTypes: ["B"],
          bannedAngles: [],
          kpis: [],
          examples: ["e1", "e2", "e3"],
        },
      ],
      proofInventory: [],
      decisions: { pillarNamesLocked: true, coverageLocked: true, bannedAnglesLocked: true },
    };

    const result = evaluateStrategyModule("pillars", content, {
      modules: { pillars: content } as any,
      currentStatus: "draft",
      isLocked: false,
    });

    expect(result.blockers.map((b) => b.code)).toContain("pillars.coverage_sum");
  });
});


import { describe, expect, it } from "vitest";
import { buildStrategyExecutionBridgeDraft, summarizePillarCoverage } from "@/lib/strategy/contentPlan";
import type { CampaignPlanContent, ChannelAdaptationsContent, PillarsContent, RulesConstraintsContent } from "@/lib/strategy/types";

const pillars: PillarsContent = {
  pillars: [
    {
      id: "authority",
      name: "Authority",
      coveragePercent: 50,
      purpose: "authority",
      coreMessage: "Teach buyers how to evaluate the category.",
      contentTypes: ["Short-form video"],
      bannedAngles: ["Generic tips"],
      kpis: ["Reach"],
      examples: [],
    },
    {
      id: "proof",
      name: "Proof",
      coveragePercent: 25,
      purpose: "proof",
      coreMessage: "Show process and outcomes with evidence.",
      contentTypes: ["Carousel"],
      bannedAngles: [],
      kpis: ["Saves"],
      examples: [],
    },
    {
      id: "conversion",
      name: "Conversion",
      coveragePercent: 25,
      purpose: "leads",
      coreMessage: "Move qualified buyers to the next step.",
      contentTypes: ["Story"],
      bannedAngles: [],
      kpis: ["Leads"],
      examples: [],
    },
  ],
  proofInventory: [
    { id: "proof-1", title: "Customer audit result", pillarIds: ["proof"] },
    { id: "proof-2", title: "Offer teardown", pillarIds: ["authority", "conversion"] },
  ],
  decisions: {
    pillarNamesLocked: true,
    coverageLocked: true,
    bannedAnglesLocked: true,
  },
};

const campaignPlan: CampaignPlanContent = {
  selectedMonth: "2026-06",
  campaigns: [
    {
      id: "campaign-1",
      name: "Pipeline Sprint",
      goal: "Qualified calls",
      offer: "Strategy sprint",
      cta: "Book a strategy call",
      icp: "Agency founders",
      pillarIds: ["authority", "proof", "conversion"],
      angle: "Diagnose the silent bottleneck",
      assets: [],
      kpiTargets: { leads: 10 },
      startDate: "2026-06-01",
      endDate: "2026-06-30",
      status: "planned",
    },
  ],
  stopDoing: [],
  decisions: {
    monthlyOffersLocked: true,
    activeCampaignsLocked: true,
  },
};

const channelAdaptations: ChannelAdaptationsContent = {
  channels: [
    {
      id: "instagram",
      platform: "instagram",
      enabled: true,
      role: "Primary demand channel",
      formats: ["Reel", "Carousel"],
      hookRules: ["Start with a buyer misconception"],
      ctaRules: ["DM SPRINT"],
      visualRules: ["Use annotated screenshots"],
      cadence: "3x/week",
      dos: ["Use direct commercial language"],
      donts: ["Do not use vague agency claims"],
      examples: [],
    },
    {
      id: "linkedin",
      platform: "linkedin",
      enabled: true,
      role: "Authority channel",
      formats: ["Text post"],
      hookRules: ["Lead with the cost of inaction"],
      ctaRules: ["Book a strategy call"],
      visualRules: [],
      cadence: "2x/week",
      dos: [],
      donts: [],
      examples: [],
    },
  ],
  translationTable: [],
  decisions: {
    ctasLocked: true,
    rulesLocked: true,
  },
};

const rulesConstraints: RulesConstraintsContent = {
  claimsPolicy: [
    { id: "claim-1", claim: "2x pipeline", status: "proof_required", proofLink: "case-study" },
    { id: "claim-2", claim: "Guaranteed growth", status: "forbidden" },
  ],
  bannedWords: ["guaranteed"],
  requiredDisclaimers: ["Results vary by market"],
  approvalTriggers: [{ id: "approval-1", condition: "Performance claim", action: "Request proof" }],
  decisions: {
    forbiddenClaimsLocked: true,
    bannedTermsLocked: true,
  },
};

describe("content plan bridge", () => {
  it("builds a 12-week plan that respects pillar coverage", () => {
    const draft = buildStrategyExecutionBridgeDraft({
      modules: {
        pillars,
        campaign_plan: campaignPlan,
        channel_adaptations: channelAdaptations,
        rules_constraints: rulesConstraints,
      },
      startDate: "2026-06-01T00:00:00.000Z",
    });

    expect(draft.planItems).toHaveLength(36);
    expect(summarizePillarCoverage(draft.planItems)).toEqual({
      authority: 18,
      proof: 9,
      conversion: 9,
    });
  });

  it("uses deterministic dedupe keys and stable schedules", () => {
    const first = buildStrategyExecutionBridgeDraft({
      modules: { pillars, campaign_plan: campaignPlan, channel_adaptations: channelAdaptations },
      startDate: "2026-06-01",
    });
    const second = buildStrategyExecutionBridgeDraft({
      modules: { pillars, campaign_plan: campaignPlan, channel_adaptations: channelAdaptations },
      startDate: "2026-06-01",
    });

    const keys = first.planItems.map((item) => item.dedupeKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.slice(0, 3)).toEqual(["week-01:slot-01", "week-01:slot-02", "week-01:slot-03"]);
    expect(second.planItems.map((item) => item.dedupeKey)).toEqual(keys);
    expect(second.planItems.map((item) => item.scheduledFor)).toEqual(first.planItems.map((item) => item.scheduledFor));
  });

  it("draws CTAs only from approved campaign and channel CTA styles", () => {
    const draft = buildStrategyExecutionBridgeDraft({
      modules: { pillars, campaign_plan: campaignPlan, channel_adaptations: channelAdaptations },
      startDate: "2026-06-01",
    });

    const approvedCtas = new Set(["Book a strategy call", "DM SPRINT"]);
    expect(draft.planItems.every((item) => approvedCtas.has(item.cta))).toBe(true);
  });

  it("creates draft briefs for the first three weeks with rules-aware do and don't guidance", () => {
    const draft = buildStrategyExecutionBridgeDraft({
      modules: {
        pillars,
        campaign_plan: campaignPlan,
        channel_adaptations: channelAdaptations,
        rules_constraints: rulesConstraints,
      },
      startDate: "2026-06-01",
    });

    expect(draft.contentBriefs).toHaveLength(9);
    expect(draft.contentBriefs[0].briefKey).toBe("brief:week-01:slot-01");
    expect(draft.contentBriefs[0].dos.join(" ")).toContain("Use proof for: 2x pipeline");
    expect(draft.contentBriefs[0].donts.join(" ")).toContain("Guaranteed growth");
  });
});

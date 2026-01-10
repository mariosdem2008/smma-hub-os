import { describe, expect, it, vi } from "vitest";

vi.mock("../zod.edge.ts", async () => {
  const mod = await import("zod");
  return { z: mod.z };
});

import { strategyOutputSchema } from "../strategy-output.ts";

describe("strategy output schema", () => {
  it("rejects open_questions over limit", () => {
    const payload = {
      modules: {
        positioning: {
          meta: {},
          sentence: { target: "a", category: "b", differentiator: "c", benefit: "d" },
          finalSentence: "final",
          proofPoints: [],
          differentiators: [],
          boundaries: { allowedPromises: [], riskyPromises: [], forbiddenPromises: [] },
          decisions: { sentenceLocked: false, differentiatorsLocked: false },
          facts_used: [],
          assumptions: [],
          open_questions: ["1", "2", "3", "4", "5", "6"],
          confidence_0_100: 50,
        },
        pillars: {
          meta: {},
          pillars: [],
          proofInventory: [],
          decisions: { pillarNamesLocked: false, coverageLocked: false, bannedAnglesLocked: false },
          facts_used: [],
          assumptions: [],
          open_questions: [],
          confidence_0_100: 50,
        },
        campaign_plan: {
          meta: {},
          selectedMonth: "2026-01",
          campaigns: [],
          stopDoing: [],
          decisions: { monthlyOffersLocked: false, activeCampaignsLocked: false },
          facts_used: [],
          assumptions: [],
          open_questions: [],
          confidence_0_100: 50,
        },
        weekly_plan: {
          meta: {},
          selectedWeek: "2026-W01",
          weeklyFocus: { objective: "x", primaryCampaignId: "c1", priorityPillarIds: [], kpiFocus: [] },
          cadenceMatrix: {},
          productionChecklist: [],
          weeklyReview: { wins: [], losses: [], changesNextWeek: [] },
          decisions: { objectiveLocked: false, cadenceLocked: false },
          facts_used: [],
          assumptions: [],
          open_questions: [],
          confidence_0_100: 50,
        },
        channel_adaptations: {
          meta: {},
          channels: [],
          translationTable: [],
          decisions: { ctasLocked: false, rulesLocked: false },
          facts_used: [],
          assumptions: [],
          open_questions: [],
          confidence_0_100: 50,
        },
        rules_constraints: {
          meta: {},
          claimsPolicy: [],
          bannedWords: [],
          requiredDisclaimers: [],
          approvalTriggers: [],
          decisions: { forbiddenClaimsLocked: false, bannedTermsLocked: false },
          facts_used: [],
          assumptions: [],
          open_questions: [],
          confidence_0_100: 50,
        },
      },
      document: { markdown: "# Strategy" },
    };

    const result = strategyOutputSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});

import { z } from "./zod.edge.ts";
import type { OutputSchema } from "../../../src/ai/schema.ts";

const confidenceSchema = z.number().min(0).max(100);
const evidenceSchema = z.object({
  facts_used: z.array(z.string()),
  assumptions: z.array(z.string()),
  open_questions: z.array(z.string()).max(5),
  confidence_0_100: confidenceSchema,
});

const metaSchema = z.object({
  source: z.string().optional(),
  generated_at: z.string().optional(),
}).optional();

const positioningSchema = z
  .object({
    meta: metaSchema,
    sentence: z.object({
      target: z.string(),
      category: z.string(),
      differentiator: z.string(),
      benefit: z.string(),
    }),
    finalSentence: z.string(),
    proofPoints: z.array(
      z.object({
        id: z.string(),
        claim: z.string(),
        evidence: z.string(),
        confidence: z.number().int().min(1).max(5),
      })
    ),
    differentiators: z.array(
      z.object({
        id: z.string(),
        rank: z.number().int().min(1),
        approvedPhrasing: z.string(),
        bannedPhrasing: z.array(z.string()),
      })
    ),
    boundaries: z.object({
      allowedPromises: z.array(z.string()),
      riskyPromises: z.array(z.string()),
      forbiddenPromises: z.array(z.string()),
    }),
    decisions: z.object({
      sentenceLocked: z.boolean(),
      differentiatorsLocked: z.boolean(),
    }),
  })
  .merge(evidenceSchema)
  .strict();

const pillarsSchema = z
  .object({
    meta: metaSchema,
    pillars: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        coveragePercent: z.number().min(0).max(100),
        purpose: z.enum(["reach", "authority", "leads", "proof"]),
        coreMessage: z.string(),
        contentTypes: z.array(z.string()),
        bannedAngles: z.array(z.string()),
        kpis: z.array(z.string()),
        examples: z.array(z.string()),
      })
    ),
    proofInventory: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        pillarIds: z.array(z.string()),
        url: z.string().optional(),
      })
    ),
    decisions: z.object({
      pillarNamesLocked: z.boolean(),
      coverageLocked: z.boolean(),
      bannedAnglesLocked: z.boolean(),
    }),
  })
  .merge(evidenceSchema)
  .strict();

const campaignPlanSchema = z
  .object({
    meta: metaSchema,
    selectedMonth: z.string(),
    campaigns: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        goal: z.string(),
        offer: z.string(),
        cta: z.string(),
        icp: z.string(),
        pillarIds: z.array(z.string()),
        angle: z.string(),
        assets: z.array(
          z.object({
            name: z.string(),
            completed: z.boolean(),
          })
        ),
        kpiTargets: z.record(z.number()),
        startDate: z.string(),
        endDate: z.string(),
        status: z.enum(["planned", "active", "completed", "cancelled"]),
      })
    ),
    stopDoing: z.array(z.string()),
    decisions: z.object({
      monthlyOffersLocked: z.boolean(),
      activeCampaignsLocked: z.boolean(),
    }),
  })
  .merge(evidenceSchema)
  .strict();

const weeklyPlanSchema = z
  .object({
    meta: metaSchema,
    selectedWeek: z.string(),
    weeklyFocus: z.object({
      objective: z.string(),
      primaryCampaignId: z.string(),
      priorityPillarIds: z.array(z.string()),
      kpiFocus: z.array(z.string()),
    }),
    cadenceMatrix: z.record(z.number()),
    productionChecklist: z.array(
      z.object({
        id: z.string(),
        type: z.enum(["script", "shoot", "edit", "approval"]),
        title: z.string(),
        owner: z.string(),
        dueDate: z.string(),
        completed: z.boolean(),
      })
    ),
    weeklyReview: z.object({
      wins: z.array(z.string()),
      losses: z.array(z.string()),
      changesNextWeek: z.array(z.string()),
    }),
    decisions: z.object({
      objectiveLocked: z.boolean(),
      cadenceLocked: z.boolean(),
    }),
  })
  .merge(evidenceSchema)
  .strict();

const channelAdaptationsSchema = z
  .object({
    meta: metaSchema,
    channels: z.array(
      z.object({
        id: z.string(),
        platform: z.enum([
          "instagram",
          "tiktok",
          "linkedin",
          "facebook",
          "youtube",
          "youtube_shorts",
          "google_business_profile",
          "pinterest",
          "x",
        ]),
        enabled: z.boolean(),
        role: z.string(),
        formats: z.array(z.string()),
        hookRules: z.array(z.string()),
        ctaRules: z.array(z.string()),
        visualRules: z.array(z.string()),
        cadence: z.string(),
        dos: z.array(z.string()),
        donts: z.array(z.string()),
        examples: z.array(z.string()),
      })
    ),
    translationTable: z.array(
      z.object({
        coreMessage: z.string(),
        variants: z.record(z.string()),
      })
    ),
    defaultGuidance: z.string().optional(),
    decisions: z.object({
      ctasLocked: z.boolean(),
      rulesLocked: z.boolean(),
    }),
  })
  .merge(evidenceSchema)
  .strict();

const rulesConstraintsSchema = z
  .object({
    meta: metaSchema,
    claimsPolicy: z.array(
      z.object({
        id: z.string(),
        claim: z.string(),
        status: z.enum(["allowed", "proof_required", "forbidden"]),
        proofLink: z.string().optional(),
      })
    ),
    bannedWords: z.array(z.string()),
    requiredDisclaimers: z.array(z.string()),
    approvalTriggers: z.array(
      z.object({
        id: z.string(),
        condition: z.string(),
        action: z.string(),
      })
    ),
    decisions: z.object({
      forbiddenClaimsLocked: z.boolean(),
      bannedTermsLocked: z.boolean(),
    }),
  })
  .merge(evidenceSchema)
  .strict();

export const strategyOutputSchema = z
  .object({
    modules: z.object({
      positioning: positioningSchema,
      pillars: pillarsSchema,
      campaign_plan: campaignPlanSchema,
      weekly_plan: weeklyPlanSchema,
      channel_adaptations: channelAdaptationsSchema,
      rules_constraints: rulesConstraintsSchema,
    }),
    document: z.object({
      markdown: z.string().min(1),
    }),
    decisions: z
      .array(
        z.object({
          module: z.enum([
            "positioning",
            "pillars",
            "campaign_plan",
            "weekly_plan",
            "channel_adaptations",
            "rules_constraints",
          ]),
          decision_key: z.string(),
          value: z.any().nullable().optional(),
          locked: z.boolean().optional(),
        })
      )
      .optional(),
    tasks: z
      .array(
        z.object({
          module: z
            .enum([
              "positioning",
              "pillars",
              "campaign_plan",
              "weekly_plan",
              "channel_adaptations",
              "rules_constraints",
            ])
            .optional(),
          title: z.string(),
          description: z.string().optional(),
          priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
          period_key: z.string().optional(),
          slug: z.string().optional(),
          dedupe_key: z.string().optional(),
        })
      )
      .optional(),
  })
  .strict();

export type StrategyOutput = z.infer<typeof strategyOutputSchema>;

export function buildStrategyOutputSchema(): OutputSchema<StrategyOutput> {
  return {
    name: "strategy_plan_v2",
    validate: (value: unknown) => {
      const parsed = strategyOutputSchema.safeParse(value);
      if (!parsed.success) {
        return {
          ok: false,
          errors: parsed.error.errors.map((error) => error.message),
        };
      }
      return { ok: true, data: parsed.data };
    },
  };
}

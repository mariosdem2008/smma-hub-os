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
  .passthrough();

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
  .passthrough();

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
  .passthrough();

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
  .passthrough();

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
  .passthrough();

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
  .passthrough();

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
  .passthrough();

export type StrategyOutput = z.infer<typeof strategyOutputSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function clampConfidence(value: unknown): number {
  const num = asNumber(value, 0);
  return Math.max(0, Math.min(100, Math.round(num)));
}

function createEmptyStrategyOutput(): StrategyOutput {
  const evidence = {
    facts_used: [] as string[],
    assumptions: [] as string[],
    open_questions: [] as string[],
    confidence_0_100: 0,
  };

  return {
    modules: {
      positioning: {
        sentence: { target: "", category: "", differentiator: "", benefit: "" },
        finalSentence: "",
        proofPoints: [],
        differentiators: [],
        boundaries: { allowedPromises: [], riskyPromises: [], forbiddenPromises: [] },
        decisions: { sentenceLocked: false, differentiatorsLocked: false },
        ...evidence,
      } as any,
      pillars: {
        pillars: [],
        proofInventory: [],
        decisions: { pillarNamesLocked: false, coverageLocked: false, bannedAnglesLocked: false },
        ...evidence,
      } as any,
      campaign_plan: {
        selectedMonth: "",
        campaigns: [],
        stopDoing: [],
        decisions: { monthlyOffersLocked: false, activeCampaignsLocked: false },
        ...evidence,
      } as any,
      weekly_plan: {
        selectedWeek: "",
        weeklyFocus: { objective: "", primaryCampaignId: "", priorityPillarIds: [], kpiFocus: [] },
        cadenceMatrix: {},
        productionChecklist: [],
        weeklyReview: { wins: [], losses: [], changesNextWeek: [] },
        decisions: { objectiveLocked: false, cadenceLocked: false },
        ...evidence,
      } as any,
      channel_adaptations: {
        channels: [],
        translationTable: [],
        decisions: { ctasLocked: false, rulesLocked: false },
        ...evidence,
      } as any,
      rules_constraints: {
        claimsPolicy: [],
        bannedWords: [],
        requiredDisclaimers: [],
        approvalTriggers: [],
        decisions: { forbiddenClaimsLocked: false, bannedTermsLocked: false },
        ...evidence,
      } as any,
    },
    document: { markdown: "" },
  };
}

function normalizeEvidence(target: any, source: any) {
  target.facts_used = asStringArray(source?.facts_used);
  target.assumptions = asStringArray(source?.assumptions);
  target.open_questions = asStringArray(source?.open_questions).slice(0, 5);
  target.confidence_0_100 = clampConfidence(source?.confidence_0_100);
}

function normalizeStrategyOutput(value: unknown): StrategyOutput {
  const output = createEmptyStrategyOutput();
  if (!isRecord(value)) return output;

  const modules = isRecord(value.modules) ? value.modules : {};

  // Document
  const document = isRecord(value.document) ? value.document : {};
  output.document.markdown = asString(document.markdown, "");

  // decisions/tasks (optional)
  if (Array.isArray(value.decisions)) output.decisions = value.decisions as any;
  if (Array.isArray(value.tasks)) output.tasks = value.tasks as any;

  // Positioning
  const positioning = isRecord(modules.positioning) ? modules.positioning : {};
  output.modules.positioning.meta = isRecord(positioning.meta) ? (positioning.meta as any) : undefined;
  const sentence = isRecord(positioning.sentence) ? positioning.sentence : {};
  output.modules.positioning.sentence = {
    target: asString(sentence.target),
    category: asString(sentence.category),
    differentiator: asString(sentence.differentiator),
    benefit: asString(sentence.benefit),
  };
  output.modules.positioning.finalSentence = asString(positioning.finalSentence);
  output.modules.positioning.proofPoints = Array.isArray(positioning.proofPoints)
    ? positioning.proofPoints.map((p: any) => ({
        id: asString(p?.id),
        claim: asString(p?.claim),
        evidence: asString(p?.evidence),
        confidence: Math.max(1, Math.min(5, Math.trunc(asNumber(p?.confidence, 3)))),
      }))
    : [];
  output.modules.positioning.differentiators = Array.isArray(positioning.differentiators)
    ? positioning.differentiators.map((d: any) => ({
        id: asString(d?.id),
        rank: Math.max(1, Math.trunc(asNumber(d?.rank, 1))),
        approvedPhrasing: asString(d?.approvedPhrasing),
        bannedPhrasing: asStringArray(d?.bannedPhrasing),
      }))
    : [];
  const boundaries = isRecord(positioning.boundaries) ? positioning.boundaries : {};
  output.modules.positioning.boundaries = {
    allowedPromises: asStringArray(boundaries.allowedPromises),
    riskyPromises: asStringArray(boundaries.riskyPromises),
    forbiddenPromises: asStringArray(boundaries.forbiddenPromises),
  };
  const positioningDecisions = isRecord(positioning.decisions) ? positioning.decisions : {};
  output.modules.positioning.decisions = {
    sentenceLocked: asBoolean(positioningDecisions.sentenceLocked),
    differentiatorsLocked: asBoolean(positioningDecisions.differentiatorsLocked),
  };
  normalizeEvidence(output.modules.positioning as any, positioning);

  // Pillars
  const pillars = isRecord(modules.pillars) ? modules.pillars : {};
  output.modules.pillars.meta = isRecord(pillars.meta) ? (pillars.meta as any) : undefined;
  output.modules.pillars.pillars = Array.isArray(pillars.pillars)
    ? pillars.pillars.map((p: any) => ({
        id: asString(p?.id),
        name: asString(p?.name),
        coveragePercent: Math.max(0, Math.min(100, asNumber(p?.coveragePercent, 0))),
        purpose: asString(p?.purpose) as any,
        coreMessage: asString(p?.coreMessage),
        contentTypes: asStringArray(p?.contentTypes),
        bannedAngles: asStringArray(p?.bannedAngles),
        kpis: asStringArray(p?.kpis),
        examples: asStringArray(p?.examples),
      }))
    : [];
  output.modules.pillars.proofInventory = Array.isArray(pillars.proofInventory)
    ? pillars.proofInventory.map((pi: any) => ({
        id: asString(pi?.id),
        title: asString(pi?.title),
        pillarIds: asStringArray(pi?.pillarIds),
        ...(typeof pi?.url === "string" ? { url: pi.url } : {}),
      }))
    : [];
  const pillarsDecisions = isRecord(pillars.decisions) ? pillars.decisions : {};
  output.modules.pillars.decisions = {
    pillarNamesLocked: asBoolean(pillarsDecisions.pillarNamesLocked),
    coverageLocked: asBoolean(pillarsDecisions.coverageLocked),
    bannedAnglesLocked: asBoolean(pillarsDecisions.bannedAnglesLocked),
  };
  normalizeEvidence(output.modules.pillars as any, pillars);

  // Campaign plan
  const campaign = isRecord(modules.campaign_plan) ? modules.campaign_plan : {};
  output.modules.campaign_plan.meta = isRecord(campaign.meta) ? (campaign.meta as any) : undefined;
  output.modules.campaign_plan.selectedMonth = asString(campaign.selectedMonth);
  output.modules.campaign_plan.campaigns = Array.isArray(campaign.campaigns)
    ? campaign.campaigns.map((c: any) => ({
        id: asString(c?.id),
        name: asString(c?.name),
        goal: asString(c?.goal),
        offer: asString(c?.offer),
        cta: asString(c?.cta),
        icp: asString(c?.icp),
        pillarIds: asStringArray(c?.pillarIds),
        angle: asString(c?.angle),
        assets: Array.isArray(c?.assets)
          ? c.assets.map((a: any) => ({ name: asString(a?.name), completed: asBoolean(a?.completed) }))
          : [],
        kpiTargets: isRecord(c?.kpiTargets) ? (c.kpiTargets as any) : {},
        startDate: asString(c?.startDate),
        endDate: asString(c?.endDate),
        status: asString(c?.status) as any,
      }))
    : [];
  output.modules.campaign_plan.stopDoing = asStringArray(campaign.stopDoing);
  const campaignDecisions = isRecord(campaign.decisions) ? campaign.decisions : {};
  output.modules.campaign_plan.decisions = {
    monthlyOffersLocked: asBoolean(campaignDecisions.monthlyOffersLocked),
    activeCampaignsLocked: asBoolean(campaignDecisions.activeCampaignsLocked),
  };
  normalizeEvidence(output.modules.campaign_plan as any, campaign);

  // Weekly plan
  const weekly = isRecord(modules.weekly_plan) ? modules.weekly_plan : {};
  output.modules.weekly_plan.meta = isRecord(weekly.meta) ? (weekly.meta as any) : undefined;
  output.modules.weekly_plan.selectedWeek = asString(weekly.selectedWeek);
  const weeklyFocus = isRecord(weekly.weeklyFocus) ? weekly.weeklyFocus : {};
  output.modules.weekly_plan.weeklyFocus = {
    objective: asString(weeklyFocus.objective),
    primaryCampaignId: asString(weeklyFocus.primaryCampaignId),
    priorityPillarIds: asStringArray(weeklyFocus.priorityPillarIds),
    kpiFocus: asStringArray(weeklyFocus.kpiFocus),
  };
  output.modules.weekly_plan.cadenceMatrix = isRecord(weekly.cadenceMatrix) ? (weekly.cadenceMatrix as any) : {};
  output.modules.weekly_plan.productionChecklist = Array.isArray(weekly.productionChecklist)
    ? weekly.productionChecklist.map((item: any) => ({
        id: asString(item?.id),
        type: asString(item?.type) as any,
        title: asString(item?.title),
        owner: asString(item?.owner),
        dueDate: asString(item?.dueDate),
        completed: asBoolean(item?.completed),
      }))
    : [];
  const weeklyReview = isRecord(weekly.weeklyReview) ? weekly.weeklyReview : {};
  output.modules.weekly_plan.weeklyReview = {
    wins: asStringArray(weeklyReview.wins),
    losses: asStringArray(weeklyReview.losses),
    changesNextWeek: asStringArray(weeklyReview.changesNextWeek),
  };
  const weeklyDecisions = isRecord(weekly.decisions) ? weekly.decisions : {};
  output.modules.weekly_plan.decisions = {
    objectiveLocked: asBoolean(weeklyDecisions.objectiveLocked),
    cadenceLocked: asBoolean(weeklyDecisions.cadenceLocked),
  };
  normalizeEvidence(output.modules.weekly_plan as any, weekly);

  // Channel adaptations
  const channels = isRecord(modules.channel_adaptations) ? modules.channel_adaptations : {};
  output.modules.channel_adaptations.meta = isRecord(channels.meta) ? (channels.meta as any) : undefined;
  output.modules.channel_adaptations.channels = Array.isArray(channels.channels)
    ? channels.channels.map((ch: any) => ({
        id: asString(ch?.id),
        platform: asString(ch?.platform) as any,
        enabled: asBoolean(ch?.enabled, true),
        role: asString(ch?.role),
        formats: asStringArray(ch?.formats),
        hookRules: asStringArray(ch?.hookRules),
        ctaRules: asStringArray(ch?.ctaRules),
        visualRules: asStringArray(ch?.visualRules),
        cadence: asString(ch?.cadence),
        dos: asStringArray(ch?.dos),
        donts: asStringArray(ch?.donts),
        examples: asStringArray(ch?.examples),
      }))
    : [];
  output.modules.channel_adaptations.translationTable = Array.isArray(channels.translationTable)
    ? channels.translationTable.map((row: any) => ({
        coreMessage: asString(row?.coreMessage),
        variants: isRecord(row?.variants) ? (row.variants as any) : {},
      }))
    : [];
  if (typeof channels.defaultGuidance === "string") {
    output.modules.channel_adaptations.defaultGuidance = channels.defaultGuidance;
  }
  const channelDecisions = isRecord(channels.decisions) ? channels.decisions : {};
  output.modules.channel_adaptations.decisions = {
    ctasLocked: asBoolean(channelDecisions.ctasLocked),
    rulesLocked: asBoolean(channelDecisions.rulesLocked),
  };
  normalizeEvidence(output.modules.channel_adaptations as any, channels);

  // Rules + constraints
  const rules = isRecord(modules.rules_constraints) ? modules.rules_constraints : {};
  output.modules.rules_constraints.meta = isRecord(rules.meta) ? (rules.meta as any) : undefined;
  output.modules.rules_constraints.claimsPolicy = Array.isArray(rules.claimsPolicy)
    ? rules.claimsPolicy.map((cp: any) => ({
        id: asString(cp?.id),
        claim: asString(cp?.claim),
        status: asString(cp?.status) as any,
        ...(typeof cp?.proofLink === "string" ? { proofLink: cp.proofLink } : {}),
      }))
    : [];
  output.modules.rules_constraints.bannedWords = asStringArray(rules.bannedWords);
  output.modules.rules_constraints.requiredDisclaimers = asStringArray(rules.requiredDisclaimers);
  output.modules.rules_constraints.approvalTriggers = Array.isArray(rules.approvalTriggers)
    ? rules.approvalTriggers.map((t: any) => ({
        id: asString(t?.id),
        condition: asString(t?.condition),
        action: asString(t?.action),
      }))
    : [];
  const rulesDecisions = isRecord(rules.decisions) ? rules.decisions : {};
  output.modules.rules_constraints.decisions = {
    forbiddenClaimsLocked: asBoolean(rulesDecisions.forbiddenClaimsLocked),
    bannedTermsLocked: asBoolean(rulesDecisions.bannedTermsLocked),
  };
  normalizeEvidence(output.modules.rules_constraints as any, rules);

  return output;
}

export function buildStrategyOutputSchema(): OutputSchema<StrategyOutput> {
  return {
    name: "strategy_plan_v2",
    validate: (value: unknown) => {
      const normalized = normalizeStrategyOutput(value);
      const parsed = strategyOutputSchema.safeParse(normalized);
      if (!parsed.success) {
        return { ok: false, errors: parsed.error.errors.map((error) => error.message) };
      }
      return { ok: true, data: parsed.data };
    },
  };
}

import type { AiContext, AiRunResult } from "../../../src/ai/router.ts";
import { reportInsightSchema, type ReportInsight } from "../../../src/ai/schema.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";
import {
  gradeAgainstGovernance as defaultGradeAgainstGovernance,
  persistAiGrading as defaultPersistAiGrading,
  type ComposedGovernance,
  type GovernanceInput,
  type GradingResult,
} from "../_shared/answer-grading.ts";

export type MonthlyReportKpis = {
  followersStart: number;
  followersEnd: number;
  followersGrowth: number;
  postsCount: number;
  totalImpressions: number;
  totalReach: number;
  totalEngagement: number;
  avgEngagementRate: number;
  profileVisits: number;
};

export type ReportTopPost = {
  platform?: string | null;
  platform_post_id?: string | null;
  date?: string | null;
  impressions?: number | null;
  reach?: number | null;
  engagement?: number | null;
  engagementRate?: number | null;
};

export type ClientStrategyContext = {
  sources: string[];
  positioning: string | null;
  primary_goal: string | null;
  funnel: string | null;
  pillars: string[];
  offers: string[];
  channels: string[];
  constraints: string[];
  notes: string[];
};

export type DeliveryStateContext = {
  source: "client_blockers" | "live_detector" | "unavailable";
  delivery_state: "on_track" | "at_risk" | "blocked";
  blockers: Array<{
    code?: string;
    severity?: string;
    title?: string;
    detail?: string;
    owner?: string;
    recommended_next_action?: string;
  }>;
  counts: { high: number; med: number; blocked: number };
  scanned_at?: string | null;
};

export type ReportInsightContext = {
  month: string;
  client: {
    id: string;
    name?: string | null;
    company?: string | null;
    niche?: string | null;
  };
  kpis: MonthlyReportKpis;
  topPosts: ReportTopPost[];
  strategy: ClientStrategyContext;
  delivery: DeliveryStateContext;
  governanceSummary: unknown;
  governance?: ComposedGovernance | null;
};

type AiRunner = (options: {
  taskType: TaskType;
  input?: string;
  context: AiContext;
  metadata?: Record<string, unknown>;
}) => Promise<AiRunResult>;

type GradeAgainstGovernance = typeof defaultGradeAgainstGovernance;
type PersistAiGrading = typeof defaultPersistAiGrading;

export type ReportInsightGenerationResult = {
  insight: ReportInsight;
  source: "ai" | "deterministic";
  fallbackReason: string | null;
  model: string | null;
};

export type GovernedReportInsightResult = {
  insight: ReportInsight;
  grading: GradingResult;
  initialGrading: GradingResult;
  blockedByGovernance: boolean;
  gradingPersistError: string | null;
  fallbackReason: string | null;
};

const DEFAULT_REPORT_MODEL = "qwen2.5:7b-instruct";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength = 600) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function compactJson(value: unknown, maxLength = 1_400) {
  try {
    return JSON.stringify(value).slice(0, maxLength);
  } catch {
    return String(value ?? "").slice(0, maxLength);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown): string[] {
  return asArray(value).map((item) => cleanText(item, 240)).filter(Boolean);
}

function uniqueStrings(values: string[], maxItems = 12) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const cleaned = cleanText(value, 500);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
    if (out.length >= maxItems) break;
  }
  return out;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const cleaned = cleanText(value);
    if (cleaned) return cleaned;
  }
  return null;
}

function getPath(root: unknown, path: string[]) {
  let current = root;
  for (const part of path) {
    if (!isRecord(current)) return undefined;
    current = current[part];
  }
  return current;
}

function pushString(target: string[], value: unknown, maxLength = 320) {
  const cleaned = cleanText(value, maxLength);
  if (cleaned) target.push(cleaned);
}

function pushStrings(target: string[], value: unknown, maxLength = 240) {
  for (const item of asStringArray(value)) pushString(target, item, maxLength);
}

function formatNumber(value: number | null | undefined) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0";
  return Math.round(numeric).toLocaleString("en-US");
}

function formatPercent(value: number | null | undefined) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0%";
  const fixed = numeric.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  return `${fixed}%`;
}

function monthLabel(month: string) {
  const [year, monthPart] = month.split("-");
  const date = new Date(Date.UTC(Number(year), Number(monthPart) - 1, 1));
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function normalizeOwner(owner: unknown): "agency" | "client" {
  return cleanText(owner).toLowerCase() === "client" ? "client" : "agency";
}

export function emptyStrategyContext(): ClientStrategyContext {
  return {
    sources: [],
    positioning: null,
    primary_goal: null,
    funnel: null,
    pillars: [],
    offers: [],
    channels: [],
    constraints: [],
    notes: [],
  };
}

export function buildClientStrategyContext(args: {
  client?: Record<string, unknown> | null;
  approvedBrief?: Record<string, unknown> | null;
  approvedArtifacts?: Array<Record<string, unknown>> | null;
  approvedModules?: Array<Record<string, unknown>> | null;
  onboardingProfile?: Record<string, unknown> | null;
  clientBrainJson?: Record<string, unknown> | null;
}): ClientStrategyContext {
  const context = emptyStrategyContext();
  const notes: string[] = [];
  const pillars: string[] = [];
  const offers: string[] = [];
  const channels: string[] = [];
  const constraints: string[] = [];

  const client = asRecord(args.client);
  pushString(notes, client.niche ? `Client niche: ${client.niche}` : "");
  pushString(notes, client.tone_of_voice ? `Client tone: ${client.tone_of_voice}` : "");

  const brief = asRecord(args.approvedBrief?.content_json);
  if (Object.keys(brief).length > 0) {
    context.sources.push(`client_operating_briefs_v2:${args.approvedBrief?.version ?? "latest"}`);
    context.primary_goal = firstString(
      context.primary_goal,
      getPath(brief, ["goals_baselines_success_thresholds", "primary_goal"]),
    );
    context.funnel = firstString(context.funnel, getPath(brief, ["conversion_path", "primary_path"]));
    pushString(offers, getPath(brief, ["offer_priority", "primary_offer"]));
    pushStrings(offers, getPath(brief, ["offer_priority", "secondary_offers"]));
    pushString(notes, getPath(brief, ["business_model", "summary"]));
    pushString(notes, getPath(brief, ["proof_and_differentiators", "differentiators"]));
    pushStrings(constraints, getPath(brief, ["proof_and_differentiators", "claims_limits"]));
    pushStrings(constraints, getPath(brief, ["constraints_and_compliance", "restricted_claims"]));
    pushStrings(constraints, getPath(brief, ["constraints_and_compliance", "required_disclaimers"]));
    pushStrings(channels, getPath(brief, ["channel_state_and_history", "active_channels"]));
    for (const segment of asArray(brief.audience_segments)) {
      pushString(notes, isRecord(segment) ? `Audience: ${cleanText(segment.name)}` : segment);
    }
  }

  for (const artifactRow of args.approvedArtifacts ?? []) {
    const artifactType = cleanText(artifactRow.artifact_type);
    const content = asRecord(artifactRow.content_json);
    const body = asRecord(content.body ?? content);
    context.sources.push(`strategy_artifacts_v2:${artifactType || "artifact"}`);
    pushString(notes, content.summary ?? artifactRow.markdown);

    context.positioning = firstString(
      context.positioning,
      body.strategic_direction,
      getPath(body, ["messaging_direction", "core_message"]),
      getPath(body, ["messaging_core", "core_message"]),
    );
    context.primary_goal = firstString(context.primary_goal, body.strategic_goal);
    context.funnel = firstString(context.funnel, getPath(body, ["chosen_funnel", "path"]));
    pushString(offers, getPath(body, ["chosen_offer_priority", "primary_offer"]));
    pushString(offers, body.primary_offer);
    for (const pillar of asArray(body.pillar_recommendations ?? body.content_pillars)) {
      pushString(pillars, isRecord(pillar) ? pillar.name : pillar);
    }
    for (const channel of asArray(body.channel_priorities)) {
      pushString(channels, isRecord(channel) ? channel.channel : channel);
    }
    pushString(channels, getPath(body, ["channel_execution", "primary_channel"]));
    pushStrings(constraints, getPath(body, ["guardrails", "claims_limits"]));
    pushStrings(constraints, getPath(body, ["guardrails", "required_disclaimers"]));
  }

  for (const moduleRow of args.approvedModules ?? []) {
    const moduleName = cleanText(moduleRow.module);
    const content = asRecord(moduleRow.content_json);
    context.sources.push(`strategy_modules:${moduleName || "module"}`);

    if (moduleName === "positioning") {
      context.positioning = firstString(
        context.positioning,
        content.finalSentence,
        compactJson(content.sentence, 360),
      );
      pushStrings(constraints, getPath(content, ["boundaries", "forbiddenPromises"]));
      pushStrings(constraints, getPath(content, ["boundaries", "riskyPromises"]));
    }

    if (moduleName === "pillars") {
      for (const pillar of asArray(content.pillars)) {
        if (!isRecord(pillar)) continue;
        pushString(pillars, pillar.name);
        pushString(notes, pillar.coreMessage);
      }
    }

    if (moduleName === "campaign_plan") {
      for (const campaign of asArray(content.campaigns)) {
        if (!isRecord(campaign)) continue;
        pushString(notes, campaign.goal ? `Campaign goal: ${cleanText(campaign.goal)}` : "");
        pushString(offers, campaign.offer);
      }
    }

    if (moduleName === "weekly_plan") {
      context.primary_goal = firstString(
        context.primary_goal,
        getPath(content, ["weeklyFocus", "objective"]),
      );
      pushStrings(notes, getPath(content, ["weeklyFocus", "kpiFocus"]));
    }

    if (moduleName === "channel_adaptations") {
      for (const channel of asArray(content.channels)) {
        if (!isRecord(channel)) continue;
        if (channel.enabled === false) continue;
        pushString(channels, channel.platform);
      }
    }

    if (moduleName === "rules_constraints") {
      pushStrings(constraints, content.bannedWords);
      pushStrings(constraints, content.requiredDisclaimers);
      for (const claim of asArray(content.claimsPolicy)) {
        if (!isRecord(claim)) continue;
        if (cleanText(claim.status).toLowerCase() === "forbidden") {
          pushString(constraints, claim.claim);
        }
      }
    }
  }

  const profile = asRecord(args.onboardingProfile);
  if (Object.keys(profile).length > 0) {
    context.sources.push("client_onboarding_profiles");
    context.primary_goal = firstString(context.primary_goal, profile.q17_primary_goal, profile.primary_goal);
    context.funnel = firstString(context.funnel, profile.conversion_path);
    pushString(offers, profile.q6_offer_name);
    pushString(notes, profile.q8_ideal_customer ? `Primary customer: ${cleanText(profile.q8_ideal_customer)}` : "");
    pushStrings(channels, profile.q16_enabled_channels ?? profile.platforms);
    pushStrings(notes, profile.q9_pain_points);
  }

  const brain = asRecord(args.clientBrainJson);
  if (Object.keys(brain).length > 0) {
    context.sources.push("client_brains");
    context.positioning = firstString(context.positioning, brain.positioning, brain.brand_positioning);
    context.primary_goal = firstString(context.primary_goal, brain.primary_goal, brain.goal);
    pushStrings(pillars, brain.pillars ?? brain.content_pillars);
    pushString(offers, brain.core_offer);
    pushStrings(channels, brain.channels ?? brain.platforms);
  }

  context.pillars = uniqueStrings(pillars, 10);
  context.offers = uniqueStrings(offers, 8);
  context.channels = uniqueStrings(channels, 8);
  context.constraints = uniqueStrings(constraints, 10);
  context.notes = uniqueStrings(notes, 10);
  context.sources = uniqueStrings(context.sources, 12);
  return context;
}

function buildKpiEvidenceMap(context: ReportInsightContext) {
  const kpis = context.kpis;
  const topPost = context.topPosts[0];
  const evidence: Record<string, string> = {
    followersStart: `${formatNumber(kpis.followersStart)} followers at month start`,
    followersEnd: `${formatNumber(kpis.followersEnd)} followers at month end`,
    followersGrowth: `${formatPercent(kpis.followersGrowth)} follower growth`,
    postsCount: `${formatNumber(kpis.postsCount)} posts published`,
    totalImpressions: `${formatNumber(kpis.totalImpressions)} impressions`,
    totalReach: `${formatNumber(kpis.totalReach)} reach`,
    totalEngagement: `${formatNumber(kpis.totalEngagement)} engagements`,
    avgEngagementRate: `${formatPercent(kpis.avgEngagementRate)} engagement rate`,
    profileVisits: `${formatNumber(kpis.profileVisits)} profile visits`,
  };

  if (topPost) {
    evidence.topPost = `top post reached ${formatNumber(topPost.reach)} people at ${formatPercent(topPost.engagementRate)} engagement`;
  }

  return evidence;
}

export function buildKpiEvidencePhrases(context: ReportInsightContext) {
  return Object.values(buildKpiEvidenceMap(context)).filter(Boolean);
}

function strategyAnchor(strategy: ClientStrategyContext) {
  return (
    strategy.primary_goal ||
    strategy.pillars[0] ||
    strategy.positioning ||
    strategy.funnel ||
    strategy.offers[0] ||
    "the approved strategy"
  );
}

function hasStrategy(strategy: ClientStrategyContext) {
  return Boolean(
    strategy.positioning ||
      strategy.primary_goal ||
      strategy.funnel ||
      strategy.pillars.length > 0 ||
      strategy.offers.length > 0 ||
      strategy.sources.length > 0,
  );
}

function firstBlocker(delivery: DeliveryStateContext) {
  return delivery.blockers.find((blocker) => cleanText(blocker.title));
}

function monthlyReportRuleApplies(rule: { appliesTo?: string[] }) {
  if (!rule.appliesTo || rule.appliesTo.length === 0) return true;
  return rule.appliesTo.some((item) => {
    const normalized = item.toLowerCase();
    return normalized === "*" || normalized === "monthly_report" || normalized === "report";
  });
}

export function applyRequiredDisclaimersToReportInsight(
  insight: ReportInsight,
  governance: ComposedGovernance | null | undefined,
): ReportInsight {
  if (!governance?.requiredDisclaimers?.length) return insight;
  const existing = buildReportNarrativeText(insight).toLowerCase();
  const missing = governance.requiredDisclaimers
    .filter(monthlyReportRuleApplies)
    .map((rule) => rule.value)
    .filter((value) => value && !existing.includes(value.toLowerCase()));

  if (missing.length === 0) return insight;

  return {
    ...insight,
    performance_summary: [
      insight.performance_summary.trim(),
      missing.map((disclaimer) => `Required note: ${disclaimer}`).join(" "),
    ].filter(Boolean).join("\n\n"),
  };
}

export function buildDeterministicReportInsight(context: ReportInsightContext): ReportInsight {
  const evidence = buildKpiEvidenceMap(context);
  const kpis = context.kpis;
  const clientName = cleanText(context.client.name) || cleanText(context.client.company) || "This account";
  const month = monthLabel(context.month);
  const strategy = context.strategy;
  const delivery = context.delivery;
  const blocker = firstBlocker(delivery);
  const strategyText = hasStrategy(strategy)
    ? `The next actions stay tied to ${strategyAnchor(strategy)}.`
    : "No approved strategy direction was available in the report context.";

  const headline = `${clientName} published ${formatNumber(kpis.postsCount)} posts with ${formatNumber(kpis.totalImpressions)} impressions and ${formatPercent(kpis.avgEngagementRate)} engagement.`;

  const performance_summary = [
    `Based on the ${month} KPI table, the account moved from ${evidence.followersStart} to ${evidence.followersEnd}, with ${evidence.followersGrowth}.`,
    `Content generated ${evidence.totalReach}, ${evidence.totalEngagement}, and ${evidence.profileVisits}.`,
    strategyText,
    delivery.delivery_state === "on_track"
      ? "The latest delivery state is on track."
      : `The latest delivery state is ${delivery.delivery_state.replace(/_/g, " ")}.`,
  ].join(" ");

  const insights: ReportInsight["insights"] = [
    {
      point: kpis.postsCount > 0
        ? "Publishing volume created a measurable base for the month."
        : "Publishing volume was zero, so the month should be treated as a baseline rather than a performance win.",
      evidence: `${evidence.postsCount}; ${evidence.totalImpressions}`,
    },
    {
      point: "Engagement should be reviewed against content format and audience fit before increasing cadence.",
      evidence: `${evidence.avgEngagementRate}; ${evidence.totalEngagement}`,
    },
    {
      point: context.topPosts[0]
        ? "The top post gives the clearest creative signal to inspect for next month's planning."
        : "There was no top-post signal available in the report data.",
      evidence: context.topPosts[0] ? evidence.topPost : evidence.totalReach,
    },
  ];

  const recommendations: ReportInsight["recommendations"] = [];
  recommendations.push({
    action: hasStrategy(strategy)
      ? `Prioritize the next content batch around ${strategyAnchor(strategy)}.`
      : "Set a documented monthly content priority before the next publishing batch.",
    why: hasStrategy(strategy)
      ? `This connects the monthly review to the approved strategy and ${evidence.avgEngagementRate}.`
      : `This keeps planning grounded in ${evidence.postsCount} and ${evidence.totalImpressions} until strategy context is approved.`,
    owner: "agency",
  });

  if (context.topPosts[0]) {
    recommendations.push({
      action: "Review the top post format and brief one follow-up concept using the same evidence-led angle.",
      why: `The strongest visible post signal was ${evidence.topPost}.`,
      owner: "agency",
    });
  } else {
    recommendations.push({
      action: "Publish enough tracked content next month to identify a reliable top-post pattern.",
      why: `The current report has ${evidence.postsCount}, which limits creative read confidence.`,
      owner: "agency",
    });
  }

  if (blocker) {
    const owner = normalizeOwner(blocker.owner);
    recommendations.push({
      action: `Resolve blocker: ${cleanText(blocker.title, 120)}.`,
      why: cleanText(blocker.recommended_next_action, 220) || `Delivery is ${delivery.delivery_state.replace(/_/g, " ")} and this blocker affects execution.`,
      owner,
    });
  } else {
    recommendations.push({
      action: "Keep the monthly review cadence and compare the same KPI set next month.",
      why: `Delivery is on track and the benchmark now includes ${evidence.totalReach} and ${evidence.followersGrowth}.`,
      owner: "agency",
    });
  }

  const risks_or_blockers = blocker
    ? delivery.blockers.slice(0, 4).map((item) => {
        const title = cleanText(item.title, 140) || cleanText(item.code, 80) || "Open blocker";
        const detail = cleanText(item.detail, 220);
        return detail ? `${title}: ${detail}` : title;
      })
    : ["No active delivery blockers in the latest report context."];

  return applyRequiredDisclaimersToReportInsight(
    {
      headline,
      performance_summary,
      insights,
      recommendations,
      risks_or_blockers,
    },
    context.governance,
  );
}

function buildMinimalGovernanceSafeReportInsight(context: ReportInsightContext): ReportInsight {
  const evidence = buildKpiEvidenceMap(context);
  return applyRequiredDisclaimersToReportInsight(
    {
      headline: "Monthly KPI report generated from tracked metrics.",
      performance_summary:
        `Based on the monthly KPI table, the account recorded ${evidence.postsCount}, ${evidence.totalImpressions}, ${evidence.totalReach}, and ${evidence.avgEngagementRate}.`,
      insights: [
        {
          point: "The report is limited to the KPI values available for this month.",
          evidence: `${evidence.postsCount}; ${evidence.totalImpressions}`,
        },
        {
          point: "Audience and engagement should be reviewed against the same KPI set next month.",
          evidence: `${evidence.followersGrowth}; ${evidence.avgEngagementRate}`,
        },
      ],
      recommendations: [
        {
          action: "Review the KPI table internally and approve the next monthly action from verified account data.",
          why: `This keeps the client-facing report grounded in ${evidence.totalReach} and ${evidence.totalEngagement}.`,
          owner: "agency",
        },
      ],
      risks_or_blockers: ["Detailed strategy or blocker wording was withheld from the narrative by governance."],
    },
    context.governance,
  );
}

export function buildReportInsightPromptContext(context: ReportInsightContext) {
  return {
    month: context.month,
    client: context.client,
    kpis: context.kpis,
    top_posts: context.topPosts.slice(0, 5),
    kpi_evidence_phrases: buildKpiEvidencePhrases(context),
    strategy_direction: context.strategy,
    delivery_state: context.delivery,
    governance: context.governanceSummary,
  };
}

function normalizeReportInsight(insight: ReportInsight): ReportInsight {
  return {
    headline: cleanText(insight.headline, 220),
    performance_summary: cleanText(insight.performance_summary, 1_400),
    insights: insight.insights
      .map((item) => ({
        point: cleanText(item.point, 360),
        evidence: cleanText(item.evidence, 360),
      }))
      .filter((item) => item.point && item.evidence)
      .slice(0, 5),
    recommendations: insight.recommendations
      .map((item) => ({
        action: cleanText(item.action, 360),
        why: cleanText(item.why, 460),
        owner: normalizeOwner(item.owner),
      }))
      .filter((item) => item.action && item.why)
      .slice(0, 5),
    risks_or_blockers: uniqueStrings(insight.risks_or_blockers, 8),
  };
}

function findUngroundedInsights(insight: ReportInsight, context: ReportInsightContext) {
  const evidencePhrases = buildKpiEvidencePhrases(context).map((phrase) => phrase.toLowerCase());
  return insight.insights.flatMap((item, index) => {
    const combined = `${item.point} ${item.evidence}`.toLowerCase();
    const grounded = evidencePhrases.some((phrase) => phrase && combined.includes(phrase));
    return grounded ? [] : [`insight_${index + 1}_missing_real_kpi_evidence`];
  });
}

export function normalizeReportInsightOutput(
  value: unknown,
  context: ReportInsightContext,
): { insight: ReportInsight | null; reason: string | null } {
  const validation = reportInsightSchema().validate(value);
  if (!validation.ok || !validation.data) {
    return { insight: null, reason: `schema_invalid:${validation.errors?.join(",") ?? "unknown"}` };
  }

  const normalized = normalizeReportInsight(validation.data);
  if (normalized.insights.length === 0) return { insight: null, reason: "missing_insights" };
  if (normalized.recommendations.length === 0) return { insight: null, reason: "missing_recommendations" };

  const ungrounded = findUngroundedInsights(normalized, context);
  if (ungrounded.length > 0) {
    return { insight: null, reason: `ungrounded:${ungrounded.join(",")}` };
  }

  return {
    insight: applyRequiredDisclaimersToReportInsight(normalized, context.governance),
    reason: null,
  };
}

export async function generateStructuredReportInsight(args: {
  context: ReportInsightContext;
  aiContext: AiContext;
  aiRunner: AiRunner;
  localLlmConfigured: boolean;
  modelOverride?: string | null;
}): Promise<ReportInsightGenerationResult> {
  const fallback = buildDeterministicReportInsight(args.context);
  if (!args.localLlmConfigured) {
    return {
      insight: fallback,
      source: "deterministic",
      fallbackReason: "local_llm_not_configured",
      model: null,
    };
  }

  const promptContext = buildReportInsightPromptContext(args.context);
  try {
    const result = await args.aiRunner({
      taskType: TaskType.REPORT_INSIGHT,
      input: JSON.stringify(promptContext),
      context: args.aiContext,
      metadata: {
        insightContext: promptContext,
        providerOverride: "openai",
        modelOverride: args.modelOverride || DEFAULT_REPORT_MODEL,
      },
    });

    if (result.unknown || result.error || result.schemaOk === false) {
      return {
        insight: fallback,
        source: "deterministic",
        fallbackReason: result.error ?? (result.unknown ? "llm_unknown" : "schema_invalid"),
        model: result.meta?.model ?? null,
      };
    }

    const normalized = normalizeReportInsightOutput(result.output, args.context);
    if (!normalized.insight) {
      return {
        insight: fallback,
        source: "deterministic",
        fallbackReason: normalized.reason ?? "llm_output_invalid",
        model: result.meta?.model ?? null,
      };
    }

    return {
      insight: normalized.insight,
      source: "ai",
      fallbackReason: null,
      model: result.meta?.model ?? null,
    };
  } catch (error) {
    return {
      insight: fallback,
      source: "deterministic",
      fallbackReason: error instanceof Error ? `llm_error:${error.message}`.slice(0, 220) : "llm_error",
      model: null,
    };
  }
}

export function buildReportNarrativeText(insight: ReportInsight) {
  return [
    insight.headline,
    insight.performance_summary,
    ...insight.insights.map((item) => `${item.point} Evidence: ${item.evidence}`),
    ...insight.recommendations.map((item) => `${item.action} Why: ${item.why} Owner: ${item.owner}`),
    ...insight.risks_or_blockers,
  ].filter(Boolean).join("\n");
}

export function reportInsightToLegacyStrings(insight: ReportInsight) {
  const insights = [
    insight.headline,
    "",
    insight.performance_summary,
    "",
    ...insight.insights.map((item) => `- ${item.point}\n  Evidence: ${item.evidence}`),
    "",
    "Risks or blockers:",
    ...insight.risks_or_blockers.map((item) => `- ${item}`),
  ].join("\n").trim();

  const recommendations = insight.recommendations
    .map((item, index) => `${index + 1}. ${item.action}\nWhy: ${item.why}\nOwner: ${item.owner}`)
    .join("\n\n")
    .trim();

  return { insights, recommendations };
}

export async function governReportInsight(args: {
  candidate: ReportInsight;
  context: ReportInsightContext;
  governance: GovernanceInput;
  supabase: any;
  agencyId: string;
  clientId: string;
  createdBy?: string | null;
  aiContext: AiContext;
  runLlmJudge: boolean;
  gradeAgainstGovernance?: GradeAgainstGovernance;
  persistAiGrading?: PersistAiGrading;
}): Promise<GovernedReportInsightResult> {
  const grade = args.gradeAgainstGovernance ?? defaultGradeAgainstGovernance;
  const persist = args.persistAiGrading ?? defaultPersistAiGrading;
  const candidate = applyRequiredDisclaimersToReportInsight(args.candidate, args.context.governance);

  const initialGrading = await grade({
    text: buildReportNarrativeText(candidate),
    governance: args.governance,
    contentType: "monthly_report",
    surface: "generate-monthly-report",
    runLlmJudge: args.runLlmJudge,
    context: args.aiContext,
  });

  const persisted = await persist({
    supabase: args.supabase,
    agencyId: args.agencyId,
    clientId: args.clientId,
    contentType: "monthly_report",
    surface: "generate-monthly-report",
    result: initialGrading,
    createdBy: args.createdBy ?? null,
  });

  if (initialGrading.accepted && initialGrading.hard_violations.length === 0) {
    return {
      insight: candidate,
      grading: initialGrading,
      initialGrading,
      blockedByGovernance: false,
      gradingPersistError: persisted.error,
      fallbackReason: null,
    };
  }

  const fallback = buildDeterministicReportInsight(args.context);
  const fallbackGrading = await grade({
    text: buildReportNarrativeText(fallback),
    governance: args.governance,
    contentType: "monthly_report",
    surface: "generate-monthly-report",
    runLlmJudge: false,
    context: args.aiContext,
  });

  if (fallbackGrading.hard_violations.length > 0) {
    const minimalFallback = buildMinimalGovernanceSafeReportInsight(args.context);
    const minimalGrading = await grade({
      text: buildReportNarrativeText(minimalFallback),
      governance: args.governance,
      contentType: "monthly_report",
      surface: "generate-monthly-report",
      runLlmJudge: false,
      context: args.aiContext,
    });

    return {
      insight: minimalFallback,
      grading: minimalGrading,
      initialGrading,
      blockedByGovernance: true,
      gradingPersistError: persisted.error,
      fallbackReason:
        fallbackGrading.hard_violations.map((issue) => issue.code).join(",") ||
        "minimal_governance_fallback",
    };
  }

  return {
    insight: fallback,
    grading: fallbackGrading,
    initialGrading,
    blockedByGovernance: true,
    gradingPersistError: persisted.error,
    fallbackReason:
      initialGrading.hard_violations.map((issue) => issue.code).join(",") ||
      initialGrading.soft_issues.map((issue) => issue.code).join(",") ||
      "governance_rejected",
  };
}

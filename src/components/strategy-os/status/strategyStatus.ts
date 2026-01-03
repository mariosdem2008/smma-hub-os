import type {
  StrategyModule,
  StrategyModuleRecord,
  ModuleContent,
  PositioningContent,
  PillarsContent,
  CampaignPlanContent,
  WeeklyPlanContent,
  ChannelAdaptationsContent,
  RulesConstraintsContent,
} from "@/lib/strategy/types";
import {
  isPositioningContent,
  isPillarsContent,
  isCampaignPlanContent,
  isWeeklyPlanContent,
  isChannelAdaptationsContent,
  isRulesConstraintsContent,
} from "@/lib/strategy/types";
import { STRATEGY_OS_V3_MODULES } from "../strategyModules";

export type ModuleStatus = "not_started" | "in_progress" | "blocked" | "complete";

export type Blocker = {
  moduleId: StrategyModule;
  title: string;
  detail?: string;
  severity: 1 | 2 | 3;
};

export type StrategyStatusSummary = {
  completedCount: number;
  totalCount: 6;
  blockers: Blocker[];
  perModule: Record<StrategyModule, { status: ModuleStatus; blockers: Blocker[] }>;
  recommendedNextModuleId: StrategyModule;
};

const getStatusFallback = (moduleData?: StrategyModuleRecord): ModuleStatus => {
  if (!moduleData) return "not_started";
  if (moduleData.status === "approved" || moduleData.status === "locked") {
    return "complete";
  }
  if (moduleData.status === "draft" || moduleData.status === "review") {
    return "in_progress";
  }
  return "not_started";
};

const evaluatePositioning = (
  content: ModuleContent | undefined,
  fallbackStatus: ModuleStatus,
) => {
  if (!content || !isPositioningContent(content)) {
    return { status: fallbackStatus, blockers: [] as Blocker[] };
  }
  const sentence = content.sentence ?? ({} as PositioningContent["sentence"]);
  const hasAny =
    Boolean(sentence.target) ||
    Boolean(sentence.benefit) ||
    Boolean(sentence.category) ||
    Boolean(sentence.differentiator);
  const isComplete = Boolean(sentence.target && sentence.benefit);
  if (isComplete) return { status: "complete" as const, blockers: [] as Blocker[] };
  if (hasAny) return { status: "in_progress" as const, blockers: [] as Blocker[] };
  return { status: fallbackStatus, blockers: [] as Blocker[] };
};

const evaluatePillars = (
  moduleId: StrategyModule,
  content: ModuleContent | undefined,
  fallbackStatus: ModuleStatus,
) => {
  if (!content || !isPillarsContent(content)) {
    return { status: fallbackStatus, blockers: [] as Blocker[] };
  }
  const pillars = content.pillars ?? ([] as PillarsContent["pillars"]);
  if (pillars.length === 0) return { status: fallbackStatus, blockers: [] as Blocker[] };
  const coverage = pillars.reduce((sum, pillar) => sum + (pillar.coveragePercent ?? 0), 0);
  if (coverage !== 100) {
    return {
      status: "blocked" as const,
      blockers: [
        {
          moduleId,
          title: "Pillars coverage must equal 100%",
          detail: "Adjust pillar percentages to total 100%.",
          severity: 3,
        },
      ],
    };
  }
  return { status: "complete" as const, blockers: [] as Blocker[] };
};

const evaluateCampaigns = (
  content: ModuleContent | undefined,
  fallbackStatus: ModuleStatus,
) => {
  if (!content || !isCampaignPlanContent(content)) {
    return { status: fallbackStatus, blockers: [] as Blocker[] };
  }
  const campaigns = content.campaigns ?? ([] as CampaignPlanContent["campaigns"]);
  if (campaigns.length > 0) return { status: "complete" as const, blockers: [] as Blocker[] };
  if (content.selectedMonth) return { status: "in_progress" as const, blockers: [] as Blocker[] };
  return { status: fallbackStatus, blockers: [] as Blocker[] };
};

const evaluateWeekly = (
  content: ModuleContent | undefined,
  fallbackStatus: ModuleStatus,
) => {
  if (!content || !isWeeklyPlanContent(content)) {
    return { status: fallbackStatus, blockers: [] as Blocker[] };
  }
  const objective = content.weeklyFocus?.objective?.trim();
  const cadenceValues = Object.values(content.cadenceMatrix ?? {}).filter(
    (value) => Number(value) > 0,
  );
  if (objective || cadenceValues.length > 0) {
    return { status: "complete" as const, blockers: [] as Blocker[] };
  }
  return { status: fallbackStatus, blockers: [] as Blocker[] };
};

const evaluateChannels = (
  content: ModuleContent | undefined,
  fallbackStatus: ModuleStatus,
) => {
  if (!content || !isChannelAdaptationsContent(content)) {
    return { status: fallbackStatus, blockers: [] as Blocker[] };
  }
  const channels = content.channels ?? ([] as ChannelAdaptationsContent["channels"]);
  const translations = content.translationTable ?? [];
  if (channels.length > 0) return { status: "complete" as const, blockers: [] as Blocker[] };
  if (translations.length > 0) return { status: "in_progress" as const, blockers: [] as Blocker[] };
  return { status: fallbackStatus, blockers: [] as Blocker[] };
};

const evaluateRules = (
  content: ModuleContent | undefined,
  fallbackStatus: ModuleStatus,
) => {
  if (!content || !isRulesConstraintsContent(content)) {
    return { status: fallbackStatus, blockers: [] as Blocker[] };
  }
  const claims = content.claimsPolicy ?? ([] as RulesConstraintsContent["claimsPolicy"]);
  const disclaimers = content.requiredDisclaimers ?? [];
  if (claims.length > 0 && disclaimers.length > 0) {
    return { status: "complete" as const, blockers: [] as Blocker[] };
  }
  if (claims.length > 0 || disclaimers.length > 0) {
    return { status: "in_progress" as const, blockers: [] as Blocker[] };
  }
  return { status: fallbackStatus, blockers: [] as Blocker[] };
};

export const buildStrategyStatusSummary = (
  modulesById: Record<StrategyModule, StrategyModuleRecord | undefined>,
): StrategyStatusSummary => {
  const perModule = {} as StrategyStatusSummary["perModule"];
  const blockers: Blocker[] = [];

  STRATEGY_OS_V3_MODULES.forEach((moduleDef) => {
    const moduleData = modulesById[moduleDef.id];
    const fallbackStatus = getStatusFallback(moduleData);
    const content = moduleData?.content_json as ModuleContent | undefined;

    let result: { status: ModuleStatus; blockers: Blocker[] };
    switch (moduleDef.id) {
      case "positioning":
        result = evaluatePositioning(content, fallbackStatus);
        break;
      case "pillars":
        result = evaluatePillars(moduleDef.id, content, fallbackStatus);
        break;
      case "campaign_plan":
        result = evaluateCampaigns(content, fallbackStatus);
        break;
      case "weekly_plan":
        result = evaluateWeekly(content, fallbackStatus);
        break;
      case "channel_adaptations":
        result = evaluateChannels(content, fallbackStatus);
        break;
      case "rules_constraints":
        result = evaluateRules(content, fallbackStatus);
        break;
      default:
        result = { status: fallbackStatus, blockers: [] };
    }

    perModule[moduleDef.id] = result;
    blockers.push(...result.blockers);
  });

  const completedCount = STRATEGY_OS_V3_MODULES.filter(
    (moduleDef) => perModule[moduleDef.id]?.status === "complete",
  ).length;

  const moduleOrder = STRATEGY_OS_V3_MODULES.map((module) => module.id);
  const blockedModules = moduleOrder
    .map((moduleId) => {
      const moduleBlockers = perModule[moduleId]?.blockers ?? [];
      const maxSeverity = moduleBlockers.reduce(
        (max, blocker) => Math.max(max, blocker.severity),
        0,
      );
      return { moduleId, maxSeverity, hasBlockers: moduleBlockers.length > 0 };
    })
    .filter((entry) => entry.hasBlockers)
    .sort((a, b) => b.maxSeverity - a.maxSeverity);

  const recommendedNextModuleId =
    blockedModules[0]?.moduleId ??
    moduleOrder.find((moduleId) => perModule[moduleId]?.status !== "complete") ??
    "weekly_plan";

  return {
    completedCount,
    totalCount: 6,
    blockers,
    perModule,
    recommendedNextModuleId,
  };
};


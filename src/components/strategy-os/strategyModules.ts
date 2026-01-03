import type { StrategyModule } from "@/lib/strategy/types";

export type StrategyModuleDefinition = {
  id: StrategyModule;
  label: string;
  description: string;
};

export const STRATEGY_OS_V3_MODULES: StrategyModuleDefinition[] = [
  {
    id: "positioning",
    label: "Positioning",
    description: "Anchor the core positioning sentence and proof.",
  },
  {
    id: "pillars",
    label: "Pillars",
    description: "Define content pillars, themes, and proof inventory.",
  },
  {
    id: "campaign_plan",
    label: "Campaign plan (monthly)",
    description: "Plan monthly campaigns and offers tied to pillars.",
  },
  {
    id: "weekly_plan",
    label: "Weekly plan",
    description: "Translate strategy into weekly execution and cadence.",
  },
  {
    id: "channel_adaptations",
    label: "Channel adaptations",
    description: "Translate strategy across channels and formats.",
  },
  {
    id: "rules_constraints",
    label: "Rules/Constraints",
    description: "Define claim policy, disclaimers, and guardrails.",
  },
];

export const getStrategyOSV3ModuleDefinition = (moduleId: StrategyModule) =>
  STRATEGY_OS_V3_MODULES.find((module) => module.id === moduleId) ?? STRATEGY_OS_V3_MODULES[0];


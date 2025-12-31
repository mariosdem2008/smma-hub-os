// Strategy OS - Type exports
// Re-export all types from lib/strategy for convenient imports

export type {
  // Module and status types
  StrategyModule,
  StrategyStatus,
  AICopilotMode,
  TaskStatus,
  TaskPriority,
  HistoryEventType,
  StrategyBlocker,
  Platform,
  PillarPurpose,
  CampaignStatus,
  ClaimStatus,
  ProductionItemType,

  // Module content types
  PositioningContent,
  PillarsContent,
  CampaignPlanContent,
  WeeklyPlanContent,
  ChannelAdaptationsContent,
  RulesConstraintsContent,
  ModuleContent,

  // Sub-types
  ProofPoint,
  Differentiator,
  Pillar,
  ProofInventoryItem,
  Campaign,
  CampaignAsset,
  ProductionItem,
  ChannelConfig,
  TranslationRow,
  ClaimPolicy,
  ApprovalTrigger,

  // Database record types
  StrategyModuleRecord,
  StrategyHistoryRecord,
  StrategyTaskRecord,
  StrategyDecisionRecord,
  StrategyRecord,

  // UI state types
  ActiveView,
  StrategyOSState,

  // API types
  UpsertStrategyModuleParams,
  ToggleLockParams,
  AddHistoryParams,
  CreateTaskParams,
  GenerateStrategyParams,
  GenerateStrategyResult,
} from '@/lib/strategy/types';

// Re-export type guards
export {
  isPositioningContent,
  isPillarsContent,
  isCampaignPlanContent,
  isWeeklyPlanContent,
  isChannelAdaptationsContent,
  isRulesConstraintsContent,
} from '@/lib/strategy/types';

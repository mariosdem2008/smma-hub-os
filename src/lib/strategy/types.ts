// Strategy OS - TypeScript Types

// Module identifiers
export type StrategyModule =
  | 'positioning'
  | 'pillars'
  | 'campaign_plan'
  | 'weekly_plan'
  | 'channel_adaptations'
  | 'rules_constraints';

// Status values
export type StrategyStatus =
  | 'empty'
  | 'draft'
  | 'review'
  | 'approved'
  | 'locked';

// AI Copilot modes
export type AICopilotMode = 'assist' | 'draft' | 'autopilot';

// Task status and priority
export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'pushed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

// History event types
export type HistoryEventType =
  | 'created'
  | 'updated'
  | 'locked'
  | 'unlocked'
  | 'seeded'
  | 'approved'
  | 'task_created'
  | 'task_generated'
  | 'task_pushed';

// Channel/Platform types
export type Platform =
  | 'instagram'
  | 'tiktok'
  | 'linkedin'
  | 'facebook'
  | 'youtube'
  | 'youtube_shorts'
  | 'google_business_profile'
  | 'pinterest'
  | 'x';
export type PillarPurpose = 'reach' | 'authority' | 'leads' | 'proof';
export type CampaignStatus = 'planned' | 'active' | 'completed' | 'cancelled';
export type ClaimStatus = 'allowed' | 'proof_required' | 'forbidden';
export type ProductionItemType = 'script' | 'shoot' | 'edit' | 'approval';

export type BlockerSeverity = 'low' | 'med' | 'high';

export interface StrategyBlocker {
  code: string;
  message: string;
  severity: BlockerSeverity;
  field_path?: string;
}

export interface ModuleMeta {
  source?: 'TEMPLATE_DRAFT' | 'MANUAL' | 'IMPORT' | string;
  generated_at?: string;
}

// ============================================================
// Module Content Schemas
// ============================================================

// A) Positioning Module Content
export interface PositioningContent {
  meta?: ModuleMeta;
  sentence: {
    target: string;        // "For [target audience]"
    category: string;      // "who need [category]"
    differentiator: string; // "we are the only [differentiator]"
    benefit: string;       // "that [benefit]"
  };
  finalSentence: string;   // Composed preview
  proofPoints: ProofPoint[];
  differentiators: Differentiator[];
  boundaries: {
    allowedPromises: string[];
    riskyPromises: string[];
    forbiddenPromises: string[];
  };
  decisions: {
    sentenceLocked: boolean;
    differentiatorsLocked: boolean;
  };
}

export interface ProofPoint {
  id: string;
  claim: string;
  evidence: string;
  confidence: 1 | 2 | 3 | 4 | 5;
}

export interface Differentiator {
  id: string;
  rank: number;
  approvedPhrasing: string;
  bannedPhrasing: string[];
}

// B) Pillars Module Content
export interface PillarsContent {
  meta?: ModuleMeta;
  pillars: Pillar[];
  proofInventory: ProofInventoryItem[];
  decisions: {
    pillarNamesLocked: boolean;
    coverageLocked: boolean;
    bannedAnglesLocked: boolean;
  };
}

export interface Pillar {
  id: string;
  name: string;
  coveragePercent: number; // Must sum to 100
  purpose: PillarPurpose;
  coreMessage: string;
  contentTypes: string[];
  bannedAngles: string[];
  kpis: string[];
  examples: string[];
}

export interface ProofInventoryItem {
  id: string;
  title: string;
  pillarIds: string[];
  url?: string;
}

// C) Campaign Plan (Monthly) Content
export interface CampaignPlanContent {
  meta?: ModuleMeta;
  selectedMonth: string; // "2025-01"
  campaigns: Campaign[];
  stopDoing: string[];
  decisions: {
    monthlyOffersLocked: boolean;
    activeCampaignsLocked: boolean;
  };
}

export interface Campaign {
  id: string;
  name: string;
  goal: string;
  offer: string;
  cta: string;
  icp: string;
  pillarIds: string[];
  angle: string;
  assets: CampaignAsset[];
  kpiTargets: Record<string, number>;
  startDate: string;
  endDate: string;
  status: CampaignStatus;
}

export interface CampaignAsset {
  name: string;
  completed: boolean;
}

// D) Weekly Plan Content
export interface WeeklyPlanContent {
  meta?: ModuleMeta;
  selectedWeek: string; // "2025-W01"
  weeklyFocus: {
    objective: string;
    primaryCampaignId: string;
    priorityPillarIds: string[];
    kpiFocus: string[];
  };
  cadenceMatrix: Record<string, number>; // channel -> posts per week
  productionChecklist: ProductionItem[];
  weeklyReview: {
    wins: string[];
    losses: string[];
    changesNextWeek: string[];
  };
  decisions: {
    objectiveLocked: boolean;
    cadenceLocked: boolean;
  };
}

export interface ProductionItem {
  id: string;
  type: ProductionItemType;
  title: string;
  owner: string;
  dueDate: string;
  completed: boolean;
}

// E) Channel Adaptations Content
export interface ChannelAdaptationsContent {
  meta?: ModuleMeta;
  channels: ChannelConfig[];
  translationTable: TranslationRow[];
  defaultGuidance?: string;
  decisions: {
    ctasLocked: boolean;
    rulesLocked: boolean;
  };
}

export interface ChannelConfig {
  id: string;
  platform: Platform;
  enabled: boolean;
  role: string;
  formats: string[];
  hookRules: string[];
  ctaRules: string[];
  visualRules: string[];
  cadence: string;
  dos: string[];
  donts: string[];
  examples: string[];
}

export interface TranslationRow {
  coreMessage: string;
  variants: Record<string, string>; // platform -> variant
}

// F) Rules / Constraints Content
export interface RulesConstraintsContent {
  meta?: ModuleMeta;
  claimsPolicy: ClaimPolicy[];
  bannedWords: string[];
  requiredDisclaimers: string[];
  approvalTriggers: ApprovalTrigger[];
  decisions: {
    forbiddenClaimsLocked: boolean;
    bannedTermsLocked: boolean;
  };
}

export interface ClaimPolicy {
  id: string;
  claim: string;
  status: ClaimStatus;
  proofLink?: string;
}

export interface ApprovalTrigger {
  id: string;
  condition: string;
  action: string;
}

// ============================================================
// Database Record Types
// ============================================================

export interface StrategyModuleRecord {
  id: string;
  client_id: string;
  agency_id: string;
  strategy_id: string;
  module: StrategyModule;
  content_json: ModuleContent;
  status: StrategyStatus;
  completion_percent: number;
  blocker_count: number;
  blockers: StrategyBlocker[];
  next_review_at: string | null;
  locked: boolean;
  locked_at: string | null;
  locked_by: string | null;
  version: number;
  ai_generated: boolean;
  ai_confidence: number | null;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
  last_updated_at: string;
  updated_at: string;
}

export interface StrategyHistoryRecord {
  id: string;
  client_id: string;
  strategy_id: string | null;
  module_id: string | null;
  module: StrategyModule | null;
  event_type: HistoryEventType;
  event_data: Record<string, unknown>;
  actor_id: string | null;
  created_at: string;
}

export interface StrategyTaskRecord {
  id: string;
  client_id: string;
  strategy_id: string | null;
  module_id: string | null;
  module: StrategyModule | null;
  task_id: string | null;
  project_id: string | null;
  period_key: string | null;
  slug: string | null;
  dedupe_key: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  pipeline_task_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StrategyDecisionRecord {
  id: string;
  strategy_id: string;
  client_id: string;
  module: StrategyModule;
  decision_key: string;
  value: Record<string, unknown> | null;
  locked: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StrategyRecord {
  id: string;
  client_id: string;
  agency_id: string;
  version_int: number;
  status: string;
  locked_at: string | null;
  locked_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type StrategyDocumentSource = "ai" | "upload" | "manual";

export interface StrategyDocumentRecord {
  id: string;
  agency_id: string;
  client_id: string;
  content_markdown: string | null;
  content_html: string | null;
  source: StrategyDocumentSource;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  generated_by_user_id: string | null;
  model: string | null;
  generation_instruction: string | null;
  derived_from_hash: string | null;
  file_path: string | null;
  file_name: string | null;
}

// Union type for all module content
export type ModuleContent =
  | PositioningContent
  | PillarsContent
  | CampaignPlanContent
  | WeeklyPlanContent
  | ChannelAdaptationsContent
  | RulesConstraintsContent;

// Type guard helpers for module content
export function isPositioningContent(content: ModuleContent): content is PositioningContent {
  return 'sentence' in content && 'proofPoints' in content;
}

export function isPillarsContent(content: ModuleContent): content is PillarsContent {
  return 'pillars' in content && 'proofInventory' in content;
}

export function isCampaignPlanContent(content: ModuleContent): content is CampaignPlanContent {
  return 'campaigns' in content && 'selectedMonth' in content;
}

export function isWeeklyPlanContent(content: ModuleContent): content is WeeklyPlanContent {
  return 'weeklyFocus' in content && 'cadenceMatrix' in content;
}

export function isChannelAdaptationsContent(content: ModuleContent): content is ChannelAdaptationsContent {
  return 'channels' in content && 'translationTable' in content;
}

export function isRulesConstraintsContent(content: ModuleContent): content is RulesConstraintsContent {
  return 'claimsPolicy' in content && 'bannedWords' in content;
}

// ============================================================
// UI State Types
// ============================================================

export type ActiveView = 'mission-control' | StrategyModule;

export interface StrategyOSState {
  activeView: ActiveView;
  rightRailTab: 'ai' | 'decisions' | 'history' | 'tasks';
  mobileSheetOpen: boolean;
  hasUnsavedChanges: boolean;
  aiCopilotMode: AICopilotMode;
}

// ============================================================
// API / Mutation Types
// ============================================================

export interface UpsertStrategyModuleParams {
  clientId: string;
  agencyId: string;
  strategyId: string;
  module: StrategyModule;
  contentJson: ModuleContent;
  status?: StrategyStatus;
  aiGenerated?: boolean;
  aiConfidence?: number;
}

export interface ToggleLockParams {
  moduleId: string;
  lock: boolean;
}

export interface AddHistoryParams {
  clientId: string;
  strategyId: string;
  moduleId: string | null;
  module: StrategyModule;
  eventType: HistoryEventType;
  eventData?: Record<string, unknown>;
}

export interface CreateTaskParams {
  clientId: string;
  moduleId?: string;
  module?: StrategyModule;
  title: string;
  description?: string;
  priority?: TaskPriority;
}

export interface GenerateStrategyParams {
  clientId: string;
  agencyId: string;
  strategyId: string;
  mode: 'seed_all' | 'improve_module';
  targetModule?: StrategyModule;
}

export interface GenerateStrategyResult {
  modules: Array<{
    module: StrategyModule;
    content: ModuleContent;
    confidence: number;
  }>;
  citations?: Array<{
    doc_type: string;
    document_id: string;
    chunk_id: string;
    score: number;
  }>;
}

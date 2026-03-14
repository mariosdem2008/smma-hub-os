import type { OutputSchema } from "../../../ai/schema.ts";

export type V2ModuleStatus = "draft" | "review" | "approved" | "archived";
export type V2ReadinessState =
  | "insufficient"
  | "diagnosis_ready"
  | "strategy_ready_with_caveats"
  | "strategy_ready"
  | "execution_ready";
export type V2ArtifactType =
  | "strategy_readiness_audit"
  | "strategy_diagnosis"
  | "strategy_recommendation"
  | "strategy_plan_v2"
  | "creator_brief"
  | "strategy_reconciliation";
export type V2ArtifactStatus =
  | "draft"
  | "review"
  | "approved"
  | "rejected"
  | "superseded"
  | "archived";

export interface AgencyOperatingModuleApproval {
  owner_role: string;
  required: boolean;
  status: V2ModuleStatus | "pending_approval";
}

export interface AgencyOperatingModuleSource {
  type: string;
  ref_id: string;
  label: string;
}

export interface AgencyOperatingModuleV2 {
  module_key: string;
  title: string;
  definition: string;
  rules: Array<{
    id: string;
    statement: string;
    when?: string[];
    because?: string;
  }>;
  examples: Array<{
    id: string;
    title: string;
    summary: string;
  }>;
  anti_patterns: Array<{
    id: string;
    statement: string;
  }>;
  edge_cases: Array<{
    id: string;
    condition: string;
    guidance: string;
  }>;
  downstream_usage: string[];
  approval: AgencyOperatingModuleApproval;
  evidence_sources: AgencyOperatingModuleSource[];
  confidence: number;
  last_reviewed_at?: string;
}

export interface ClientOperatingBriefV2 {
  client_id: string;
  agency_id: string;
  business_model: {
    category: string;
    subtype?: string;
    summary: string;
  };
  offer_priority: {
    primary_offer: string;
    secondary_offers: string[];
    offer_constraints: string[];
  };
  audience_segments: Array<{
    id: string;
    name: string;
    jobs_to_be_done: string[];
    pain_points: string[];
  }>;
  conversion_path: {
    primary_path: string;
    secondary_paths: string[];
    handoff_notes: string[];
  };
  sales_process: {
    summary: string;
    response_time_expectation_hours: number | null;
    known_drop_off_points: string[];
  };
  pricing_and_budget: {
    price_positioning: string;
    media_budget_monthly: number | null;
    commercial_constraints: string[];
  };
  proof_and_differentiators: {
    proof_assets: string[];
    differentiators: string[];
    claims_limits: string[];
  };
  goals_baselines_success_thresholds: {
    primary_goal: string;
    baselines: string[];
    success_thresholds: string[];
  };
  channel_state_and_history: {
    active_channels: string[];
    historical_notes: string[];
    performance_context: string[];
  };
  stakeholder_and_approval_map: {
    primary_contact: string;
    final_approver: string;
    approval_turnaround_hours: number | null;
  };
  launch_windows_and_deadlines: {
    next_launch_window: string | null;
    hard_deadlines: string[];
  };
  access_and_asset_readiness: {
    platform_access_ready: boolean;
    missing_assets: string[];
  };
  constraints_and_compliance: {
    regulated_industry: boolean;
    restricted_claims: string[];
    required_disclaimers: string[];
  };
  internal_capacity_and_dependencies: {
    client_capacity_notes: string[];
    dependencies: string[];
  };
  known_blockers: string[];
  open_questions: string[];
}

export interface StrategyArtifactMetaV2 {
  artifact_type: V2ArtifactType;
  version: number;
  brief_version: number;
  agency_module_versions: Record<string, number>;
}

export interface StrategyArtifactEnvelopeV2<TBody = Record<string, unknown>> {
  artifact_meta: StrategyArtifactMetaV2;
  summary: string;
  body: TBody;
  assumptions: string[];
  open_questions: string[];
  citations: Array<Record<string, unknown>>;
  confidence: number;
}

export interface StrategyReadinessAuditBody {
  readiness_state: V2ReadinessState;
  overall_score_0_100: number;
  blocking_gaps: Array<{
    key: string;
    severity: "low" | "medium" | "high";
    message: string;
  }>;
  critical_inputs_present: string[];
  critical_inputs_missing: string[];
  risky_assumptions: string[];
  allowed_scope: string[];
  recommended_next_actions: Array<{
    action_type: string;
    title: string;
  }>;
}

export interface StrategyDiagnosisBody {
  current_state_summary: string;
  business_objective_tree: Array<{
    objective: string;
    drivers: string[];
  }>;
  offer_diagnosis: {
    primary_offer_fit: string;
    issues: string[];
    notes: string[];
  };
  funnel_diagnosis: {
    current_path: string;
    strengths: string[];
    weaknesses: string[];
  };
  audience_clarity: {
    score_0_100: number;
    strengths: string[];
    gaps: string[];
  };
  channel_fit: Array<{
    channel: string;
    fit: string;
    why: string;
  }>;
  risk_summary: string[];
  top_opportunities: string[];
}

export interface StrategyRecommendationBody {
  strategic_direction: string;
  chosen_offer_priority: {
    primary_offer: string;
    why: string;
  };
  chosen_funnel: {
    path: string;
    why: string;
  };
  channel_priorities: Array<{
    channel: string;
    priority: number;
    role: string;
  }>;
  pillar_recommendations: Array<{
    name: string;
    purpose: string;
  }>;
  messaging_direction: {
    core_message: string;
    dos: string[];
    donts: string[];
  };
  risks_and_tradeoffs: string[];
  decision_rationale: Array<{
    decision: string;
    why: string;
  }>;
}

export interface CreatorBriefBody {
  requested_output: {
    mode: "ideas" | "hook" | "caption" | "script" | "rewrite";
    platform: string;
  };
  strategic_goal: string;
  primary_offer: string;
  target_audience: {
    segments: string[];
    jobs_to_be_done: string[];
    pain_points: string[];
  };
  messaging_core: {
    core_message: string;
    supporting_angles: string[];
    approved_phrases: string[];
    banned_phrases: string[];
  };
  channel_execution: {
    primary_channel: string;
    role: string;
    format_guidance: string[];
    CTA: string;
  };
  content_pillars: Array<{
    name: string;
    purpose: string;
  }>;
  proof_points: string[];
  guardrails: {
    claims_limits: string[];
    required_disclaimers: string[];
    compliance_notes: string[];
  };
  production_notes: string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function numberInRange(value: unknown, min: number, max: number) {
  return typeof value === "number" && value >= min && value <= max;
}

function hasKeys(value: Record<string, unknown>, keys: string[]) {
  return keys.filter((key) => !(key in value));
}

export function agencyOperatingModuleSchema(): OutputSchema<AgencyOperatingModuleV2> {
  return {
    name: "agency_operating_module_v2",
    validate: (value: unknown) => {
      if (!isPlainObject(value)) return { ok: false, errors: ["Expected object"] };
      const missing = hasKeys(value, [
        "module_key",
        "title",
        "definition",
        "rules",
        "examples",
        "anti_patterns",
        "edge_cases",
        "downstream_usage",
        "approval",
        "evidence_sources",
        "confidence",
      ]);
      if (missing.length) return { ok: false, errors: missing.map((key) => `Missing key: ${key}`) };
      if (typeof value.module_key !== "string" || !value.module_key.trim()) return { ok: false, errors: ["module_key must be a non-empty string"] };
      if (typeof value.title !== "string" || !value.title.trim()) return { ok: false, errors: ["title must be a non-empty string"] };
      if (typeof value.definition !== "string" || !value.definition.trim()) return { ok: false, errors: ["definition must be a non-empty string"] };
      if (!Array.isArray(value.rules)) return { ok: false, errors: ["rules must be an array"] };
      if (!Array.isArray(value.examples)) return { ok: false, errors: ["examples must be an array"] };
      if (!Array.isArray(value.anti_patterns)) return { ok: false, errors: ["anti_patterns must be an array"] };
      if (!Array.isArray(value.edge_cases)) return { ok: false, errors: ["edge_cases must be an array"] };
      if (!isStringArray(value.downstream_usage)) return { ok: false, errors: ["downstream_usage must be a string array"] };
      if (!isPlainObject(value.approval)) return { ok: false, errors: ["approval must be an object"] };
      if (!Array.isArray(value.evidence_sources)) return { ok: false, errors: ["evidence_sources must be an array"] };
      if (!numberInRange(value.confidence, 0, 100)) return { ok: false, errors: ["confidence must be a number from 0 to 100"] };
      return { ok: true, data: value as AgencyOperatingModuleV2 };
    },
  };
}

export function clientOperatingBriefSchema(): OutputSchema<ClientOperatingBriefV2> {
  return {
    name: "client_operating_brief_v2",
    validate: (value: unknown) => {
      if (!isPlainObject(value)) return { ok: false, errors: ["Expected object"] };
      const missing = hasKeys(value, [
        "client_id",
        "agency_id",
        "business_model",
        "offer_priority",
        "audience_segments",
        "conversion_path",
        "sales_process",
        "pricing_and_budget",
        "proof_and_differentiators",
        "goals_baselines_success_thresholds",
        "channel_state_and_history",
        "stakeholder_and_approval_map",
        "launch_windows_and_deadlines",
        "access_and_asset_readiness",
        "constraints_and_compliance",
        "internal_capacity_and_dependencies",
        "known_blockers",
        "open_questions",
      ]);
      if (missing.length) return { ok: false, errors: missing.map((key) => `Missing key: ${key}`) };
      if (typeof value.client_id !== "string" || typeof value.agency_id !== "string") {
        return { ok: false, errors: ["client_id and agency_id must be strings"] };
      }
      if (!Array.isArray(value.audience_segments)) return { ok: false, errors: ["audience_segments must be an array"] };
      if (!isStringArray(value.known_blockers)) return { ok: false, errors: ["known_blockers must be a string array"] };
      if (!isStringArray(value.open_questions)) return { ok: false, errors: ["open_questions must be a string array"] };
      return { ok: true, data: value as ClientOperatingBriefV2 };
    },
  };
}

function strategyEnvelopeSchema<TBody = Record<string, unknown>>(name: string): OutputSchema<StrategyArtifactEnvelopeV2<TBody>> {
  return {
    name,
    validate: (value: unknown) => {
      if (!isPlainObject(value)) return { ok: false, errors: ["Expected object"] };
      const missing = hasKeys(value, ["artifact_meta", "summary", "body", "assumptions", "open_questions", "citations", "confidence"]);
      if (missing.length) return { ok: false, errors: missing.map((key) => `Missing key: ${key}`) };
      if (!isPlainObject(value.artifact_meta)) return { ok: false, errors: ["artifact_meta must be an object"] };
      if (typeof value.summary !== "string") return { ok: false, errors: ["summary must be a string"] };
      if (!isPlainObject(value.body)) return { ok: false, errors: ["body must be an object"] };
      if (!isStringArray(value.assumptions)) return { ok: false, errors: ["assumptions must be a string array"] };
      if (!isStringArray(value.open_questions)) return { ok: false, errors: ["open_questions must be a string array"] };
      if (!Array.isArray(value.citations)) return { ok: false, errors: ["citations must be an array"] };
      if (!numberInRange(value.confidence, 0, 100)) return { ok: false, errors: ["confidence must be a number from 0 to 100"] };
      return { ok: true, data: value as StrategyArtifactEnvelopeV2<TBody> };
    },
  };
}

export function strategyDiagnosisSchema(): OutputSchema<StrategyArtifactEnvelopeV2<StrategyDiagnosisBody>> {
  return strategyEnvelopeSchema<StrategyDiagnosisBody>("strategy_diagnosis_v2");
}

export function strategyRecommendationSchema(): OutputSchema<StrategyArtifactEnvelopeV2<StrategyRecommendationBody>> {
  return strategyEnvelopeSchema<StrategyRecommendationBody>("strategy_recommendation_v2");
}

export function creatorBriefSchema(): OutputSchema<StrategyArtifactEnvelopeV2<CreatorBriefBody>> {
  return strategyEnvelopeSchema<CreatorBriefBody>("creator_brief_v2");
}

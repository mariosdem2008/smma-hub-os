export type SchemaResult<T> = {
  ok: boolean;
  data?: T;
  errors?: string[];
};

export type OutputSchema<T> = {
  name: string;
  validate: (value: unknown) => SchemaResult<T>;
};

export type IntentResultSchema = {
  mode: "CHAT" | "EXECUTE";
  confidence: number;
  intent?: string;
};

export type ToolCallSchema = {
  tool_id: string;
  args: Record<string, unknown>;
};

export type ToolResultSchema = {
  tool_id: string;
  status: "ok" | "error";
  result?: Record<string, unknown>;
  error?: string;
};

export type PlanStepSchema = {
  id: string;
  tool: ToolCallSchema;
  depends_on?: string[];
};

export type PlanSchemaV1 = {
  steps: PlanStepSchema[];
  notes?: string;
};

export type RetrievalMatchSchema = {
  doc_id: string;
  chunk_id: string;
  doc_type: string;
  score: number;
  text: string;
  tenant_id?: string;
};

export type RetrievalResultSchema = {
  matches: RetrievalMatchSchema[];
  retrieval_count: number;
};

export type MemoryWriteProposalSchema = {
  tenant_id: string;
  fact: string;
  requires_approval: boolean;
  scope?: string;
};

export type StrategyPlanSchema = {
  strategy_name: string;
  target_audience: Record<string, unknown>;
  marketing_channels: Array<Record<string, unknown>>;
  budget: Record<string, unknown> | number;
};

export type AdminChatSchema = {
  assistant_message: string;
  suggestions: string[];
  actions?: Array<{ type: string; payload?: unknown }>;
  escalated: boolean;
  unknown: boolean;
};

export type AdminChatStrategicSchema = {
  playbook: "core_offer" | "strategy" | "copywriting";
  clarifying_questions: string[];
  assumptions?: string[];
  core_offer?: Record<string, unknown> | null;
  strategy?: Record<string, unknown> | null;
  copywriting?: Record<string, unknown> | null;
  unknown?: Record<string, unknown> | null;
  suggestions?: string[];
};

export type OnboardingAnswerCheckSchema = {
  decision: "accept" | "follow_up";
  follow_up?: string;
  reason?: string;
  confidence?: number;
};

export type OnboardingClarifySchema = {
  mode: "follow_up" | "answer_and_continue";
  follow_up_text?: string;
  clarification_text?: string;
  confidence?: number;
};

export type AnswerQualityCheckSchema = {
  score: number;
  soft_issues: Array<{
    code: string;
    message: string;
    severity: "low" | "medium" | "high";
  }>;
  requires_human_approval: boolean;
  suggested_revision?: string;
};

export type ReportInsightRecommendationOwner = "agency" | "client";

export type ReportInsight = {
  headline: string;
  performance_summary: string;
  insights: Array<{
    point: string;
    evidence: string;
  }>;
  recommendations: Array<{
    action: string;
    why: string;
    owner: ReportInsightRecommendationOwner;
  }>;
  risks_or_blockers: string[];
};

export type AiAssistantProposal = {
  id: string;
  module: string;
  title: string;
  summary: string;
  proposed_content_json: Record<string, unknown>;
  risks?: string[];
};

export function arraySchema<T = unknown>(name: string): OutputSchema<T[]> {
  return {
    name,
    validate: (value: unknown) => {
      if (!Array.isArray(value)) {
        return { ok: false, errors: ["Expected array"] };
      }
      return { ok: true, data: value as T[] };
    },
  };
}

export function objectSchema<T = Record<string, unknown>>(name: string, requiredKeys: string[]): OutputSchema<T> {
  return {
    name,
    validate: (value: unknown) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { ok: false, errors: ["Expected object"] };
      }
      const missing = requiredKeys.filter((key) => !(key in (value as Record<string, unknown>)));
      if (missing.length > 0) {
        return { ok: false, errors: missing.map((key) => `Missing key: ${key}`) };
      }
      return { ok: true, data: value as T };
    },
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function intentResultSchema(): OutputSchema<IntentResultSchema> {
  return {
    name: "intent_result_v1",
    validate: (value: unknown) => {
      if (!isPlainObject(value)) return { ok: false, errors: ["Expected object"] };
      const record = value as Record<string, unknown>;
      const required = ["mode", "confidence"];
      const missing = required.filter((key) => !(key in record));
      if (missing.length > 0) return { ok: false, errors: missing.map((key) => `Missing key: ${key}`) };
      if (record.mode !== "CHAT" && record.mode !== "EXECUTE") {
        return { ok: false, errors: ["mode must be CHAT or EXECUTE"] };
      }
      if (typeof record.confidence !== "number") {
        return { ok: false, errors: ["confidence must be a number"] };
      }
      if (record.intent !== undefined && typeof record.intent !== "string") {
        return { ok: false, errors: ["intent must be a string"] };
      }
      return { ok: true, data: record as IntentResultSchema };
    },
  };
}

export function toolCallSchema(): OutputSchema<ToolCallSchema> {
  return {
    name: "tool_call_v1",
    validate: (value: unknown) => {
      if (!isPlainObject(value)) return { ok: false, errors: ["Expected object"] };
      const record = value as Record<string, unknown>;
      if (typeof record.tool_id !== "string" || !record.tool_id.trim()) {
        return { ok: false, errors: ["tool_id must be a non-empty string"] };
      }
      if (!isPlainObject(record.args)) {
        return { ok: false, errors: ["args must be an object"] };
      }
      return { ok: true, data: record as ToolCallSchema };
    },
  };
}

export function toolResultSchema(): OutputSchema<ToolResultSchema> {
  return {
    name: "tool_result_v1",
    validate: (value: unknown) => {
      if (!isPlainObject(value)) return { ok: false, errors: ["Expected object"] };
      const record = value as Record<string, unknown>;
      if (typeof record.tool_id !== "string" || !record.tool_id.trim()) {
        return { ok: false, errors: ["tool_id must be a non-empty string"] };
      }
      if (record.status !== "ok" && record.status !== "error") {
        return { ok: false, errors: ["status must be ok or error"] };
      }
      if (record.result !== undefined && !isPlainObject(record.result)) {
        return { ok: false, errors: ["result must be an object"] };
      }
      if (record.error !== undefined && typeof record.error !== "string") {
        return { ok: false, errors: ["error must be a string"] };
      }
      return { ok: true, data: record as ToolResultSchema };
    },
  };
}

export function planSchemaV1(): OutputSchema<PlanSchemaV1> {
  return {
    name: "plan_schema_v1",
    validate: (value: unknown) => {
      if (!isPlainObject(value)) return { ok: false, errors: ["Expected object"] };
      const record = value as Record<string, unknown>;
      if (!Array.isArray(record.steps)) return { ok: false, errors: ["steps must be an array"] };
      for (const step of record.steps) {
        if (!isPlainObject(step)) return { ok: false, errors: ["step must be an object"] };
        const s = step as Record<string, unknown>;
        if (typeof s.id !== "string" || !s.id.trim()) {
          return { ok: false, errors: ["step.id must be a non-empty string"] };
        }
        if (!isPlainObject(s.tool)) {
          return { ok: false, errors: ["step.tool must be an object"] };
        }
        const tool = s.tool as Record<string, unknown>;
        if (typeof tool.tool_id !== "string" || !tool.tool_id.trim()) {
          return { ok: false, errors: ["step.tool.tool_id must be a non-empty string"] };
        }
        if (!isPlainObject(tool.args)) {
          return { ok: false, errors: ["step.tool.args must be an object"] };
        }
        if (s.depends_on !== undefined) {
          if (!Array.isArray(s.depends_on) || !s.depends_on.every((v) => typeof v === "string")) {
            return { ok: false, errors: ["step.depends_on must be an array of strings"] };
          }
        }
      }
      if (record.notes !== undefined && typeof record.notes !== "string") {
        return { ok: false, errors: ["notes must be a string"] };
      }
      return { ok: true, data: record as PlanSchemaV1 };
    },
  };
}

export function retrievalResultSchema(): OutputSchema<RetrievalResultSchema> {
  return {
    name: "retrieval_result_v1",
    validate: (value: unknown) => {
      if (!isPlainObject(value)) return { ok: false, errors: ["Expected object"] };
      const record = value as Record<string, unknown>;
      if (!Array.isArray(record.matches)) return { ok: false, errors: ["matches must be an array"] };
      if (typeof record.retrieval_count !== "number") {
        return { ok: false, errors: ["retrieval_count must be a number"] };
      }
      for (const match of record.matches) {
        if (!isPlainObject(match)) return { ok: false, errors: ["match must be an object"] };
        const m = match as Record<string, unknown>;
        for (const key of ["doc_id", "chunk_id", "doc_type", "text"]) {
          if (typeof m[key] !== "string" || !(m[key] as string).trim()) {
            return { ok: false, errors: [`match.${key} must be a non-empty string`] };
          }
        }
        if (typeof m.score !== "number") {
          return { ok: false, errors: ["match.score must be a number"] };
        }
        if (m.tenant_id !== undefined && typeof m.tenant_id !== "string") {
          return { ok: false, errors: ["match.tenant_id must be a string"] };
        }
      }
      return { ok: true, data: record as RetrievalResultSchema };
    },
  };
}

export function memoryWriteProposalSchema(): OutputSchema<MemoryWriteProposalSchema> {
  return {
    name: "memory_write_proposal_v1",
    validate: (value: unknown) => {
      if (!isPlainObject(value)) return { ok: false, errors: ["Expected object"] };
      const record = value as Record<string, unknown>;
      for (const key of ["tenant_id", "fact", "requires_approval"]) {
        if (!(key in record)) return { ok: false, errors: [`Missing key: ${key}`] };
      }
      if (typeof record.tenant_id !== "string" || !record.tenant_id.trim()) {
        return { ok: false, errors: ["tenant_id must be a non-empty string"] };
      }
      if (typeof record.fact !== "string" || !record.fact.trim()) {
        return { ok: false, errors: ["fact must be a non-empty string"] };
      }
      if (typeof record.requires_approval !== "boolean") {
        return { ok: false, errors: ["requires_approval must be a boolean"] };
      }
      if (record.scope !== undefined && typeof record.scope !== "string") {
        return { ok: false, errors: ["scope must be a string"] };
      }
      return { ok: true, data: record as MemoryWriteProposalSchema };
    },
  };
}

export function strategyPlanSchema(): OutputSchema<StrategyPlanSchema> {
  return {
    name: "strategy_plan_v1",
    validate: (value: unknown) => {
      if (!isPlainObject(value)) return { ok: false, errors: ["Expected object"] };
      const record = value as Record<string, unknown>;
      const required = ["strategy_name", "target_audience", "marketing_channels", "budget"];
      const missing = required.filter((key) => !(key in record));
      if (missing.length > 0) return { ok: false, errors: missing.map((key) => `Missing key: ${key}`) };
      if (typeof record.strategy_name !== "string" || !record.strategy_name.trim()) {
        return { ok: false, errors: ["strategy_name must be a non-empty string"] };
      }
      if (!isPlainObject(record.target_audience)) {
        return { ok: false, errors: ["target_audience must be an object"] };
      }
      if (!Array.isArray(record.marketing_channels)) {
        return { ok: false, errors: ["marketing_channels must be an array"] };
      }
      const budget = record.budget;
      if (!(typeof budget === "number" || isPlainObject(budget))) {
        return { ok: false, errors: ["budget must be a number or object"] };
      }
      return { ok: true, data: record as StrategyPlanSchema };
    },
  };
}

export function adminChatSchema(): OutputSchema<AdminChatSchema> {
  return {
    name: "agency_admin_general_chat",
    validate: (value: unknown) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { ok: false, errors: ["Expected object"] };
      }

      const record = value as Record<string, unknown>;
      const required = ["assistant_message", "suggestions", "escalated", "unknown"];
      const missing = required.filter((key) => !(key in record));
      if (missing.length > 0) {
        return { ok: false, errors: missing.map((key) => `Missing key: ${key}`) };
      }

      if (typeof record.assistant_message !== "string" || !record.assistant_message.trim()) {
        return { ok: false, errors: ["assistant_message must be a non-empty string"] };
      }

      if (!Array.isArray(record.suggestions)) {
        return { ok: false, errors: ["suggestions must be an array"] };
      }
      if (record.suggestions.length > 6) {
        return { ok: false, errors: ["suggestions must have <= 6 items"] };
      }
      if (!record.suggestions.every((item) => typeof item === "string")) {
        return { ok: false, errors: ["suggestions must be strings"] };
      }

      if (typeof record.escalated !== "boolean") {
        return { ok: false, errors: ["escalated must be a boolean"] };
      }
      if (typeof record.unknown !== "boolean") {
        return { ok: false, errors: ["unknown must be a boolean"] };
      }

      if (record.actions !== undefined) {
        if (!Array.isArray(record.actions)) {
          return { ok: false, errors: ["actions must be an array"] };
        }
        for (const action of record.actions) {
          if (!action || typeof action !== "object" || Array.isArray(action)) {
            return { ok: false, errors: ["actions entries must be objects"] };
          }
          if (typeof (action as Record<string, unknown>).type !== "string") {
            return { ok: false, errors: ["actions.type must be a string"] };
          }
        }
      }

      return { ok: true, data: record as AdminChatSchema };
    },
  };
}

export function adminChatStrategicSchema(): OutputSchema<AdminChatStrategicSchema> {
  return {
    name: "agency_admin_chat_strategic_v1",
    validate: (value: unknown) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { ok: false, errors: ["Expected object"] };
      }

      const record = value as Record<string, unknown>;
      const required = ["playbook", "clarifying_questions"];
      const missing = required.filter((key) => !(key in record));
      if (missing.length > 0) {
        return { ok: false, errors: missing.map((key) => `Missing key: ${key}`) };
      }

      if (typeof record.playbook !== "string") {
        return { ok: false, errors: ["playbook must be a string"] };
      }
      if (!["core_offer", "strategy", "copywriting"].includes(record.playbook)) {
        return { ok: false, errors: ["playbook must be core_offer, strategy, or copywriting"] };
      }
      if (!Array.isArray(record.clarifying_questions)) {
        return { ok: false, errors: ["clarifying_questions must be an array"] };
      }
      if (record.clarifying_questions.length > 3) {
        return { ok: false, errors: ["clarifying_questions must have <= 3 items"] };
      }

      if (record.suggestions !== undefined) {
        if (!Array.isArray(record.suggestions)) {
          return { ok: false, errors: ["suggestions must be an array"] };
        }
        if (record.suggestions.length > 3) {
          return { ok: false, errors: ["suggestions must have <= 3 items"] };
        }
      }

      if (record.unknown !== undefined && record.unknown !== null) {
        if (!record.unknown || typeof record.unknown !== "object" || Array.isArray(record.unknown)) {
          return { ok: false, errors: ["unknown must be an object or null"] };
        }
        const unknownRecord = record.unknown as Record<string, unknown>;
        if (!Array.isArray(unknownRecord.missing) || typeof unknownRecord.question !== "string") {
          return { ok: false, errors: ["unknown must include missing[] and question"] };
        }
      }

      const payloads = {
        core_offer: record.core_offer,
        strategy: record.strategy,
        copywriting: record.copywriting,
      };

      const payloadPresent = Object.entries(payloads)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key]) => key);

      if (record.unknown && payloadPresent.length > 0) {
        return { ok: false, errors: ["unknown responses cannot include playbook payloads"] };
      }

      if (!record.unknown) {
        const expected = record.playbook;
        if (payloadPresent.length !== 1 || payloadPresent[0] !== expected) {
          return { ok: false, errors: ["exactly one playbook payload must be present for the selected playbook"] };
        }
      }

      return { ok: true, data: record as AdminChatStrategicSchema };
    },
  };
}

export function onboardingAnswerCheckSchema(): OutputSchema<OnboardingAnswerCheckSchema> {
  return {
    name: "onboarding_answer_check_v1",
    validate: (value: unknown) => {
      if (!isPlainObject(value)) return { ok: false, errors: ["Expected object"] };
      const record = value as Record<string, unknown>;
      if (record.decision !== "accept" && record.decision !== "follow_up") {
        return { ok: false, errors: ["decision must be accept or follow_up"] };
      }
      if (record.follow_up !== undefined && typeof record.follow_up !== "string") {
        return { ok: false, errors: ["follow_up must be a string"] };
      }
      if (record.reason !== undefined && typeof record.reason !== "string") {
        return { ok: false, errors: ["reason must be a string"] };
      }
      if (record.confidence !== undefined && typeof record.confidence !== "number") {
        return { ok: false, errors: ["confidence must be a number"] };
      }
      return { ok: true, data: record as OnboardingAnswerCheckSchema };
    },
  };
}

export function onboardingClarifySchema(): OutputSchema<OnboardingClarifySchema> {
  return {
    name: "onboarding_clarify_v1",
    validate: (value: unknown) => {
      if (!isPlainObject(value)) return { ok: false, errors: ["Expected object"] };
      const record = value as Record<string, unknown>;
      if (record.mode !== "follow_up" && record.mode !== "answer_and_continue") {
        return { ok: false, errors: ["mode must be follow_up or answer_and_continue"] };
      }
      if (record.follow_up_text !== undefined && typeof record.follow_up_text !== "string") {
        return { ok: false, errors: ["follow_up_text must be a string"] };
      }
      if (record.clarification_text !== undefined && typeof record.clarification_text !== "string") {
        return { ok: false, errors: ["clarification_text must be a string"] };
      }
      if (record.confidence !== undefined && typeof record.confidence !== "number") {
        return { ok: false, errors: ["confidence must be a number"] };
      }
      return { ok: true, data: record as OnboardingClarifySchema };
    },
  };
}

export function answerQualityCheckSchema(): OutputSchema<AnswerQualityCheckSchema> {
  return {
    name: "answer_quality_check_v1",
    validate: (value: unknown) => {
      if (!isPlainObject(value)) return { ok: false, errors: ["Expected object"] };
      const record = value as Record<string, unknown>;
      const required = ["score", "soft_issues", "requires_human_approval"];
      const missing = required.filter((key) => !(key in record));
      if (missing.length > 0) return { ok: false, errors: missing.map((key) => `Missing key: ${key}`) };
      if (typeof record.score !== "number" || record.score < 0 || record.score > 100) {
        return { ok: false, errors: ["score must be a number from 0 to 100"] };
      }
      if (!Array.isArray(record.soft_issues)) {
        return { ok: false, errors: ["soft_issues must be an array"] };
      }
      for (const issue of record.soft_issues) {
        if (!isPlainObject(issue)) return { ok: false, errors: ["soft_issues entries must be objects"] };
        const item = issue as Record<string, unknown>;
        if (typeof item.code !== "string" || !item.code.trim()) {
          return { ok: false, errors: ["soft_issues.code must be a non-empty string"] };
        }
        if (typeof item.message !== "string" || !item.message.trim()) {
          return { ok: false, errors: ["soft_issues.message must be a non-empty string"] };
        }
        if (item.severity !== "low" && item.severity !== "medium" && item.severity !== "high") {
          return { ok: false, errors: ["soft_issues.severity must be low, medium, or high"] };
        }
      }
      if (typeof record.requires_human_approval !== "boolean") {
        return { ok: false, errors: ["requires_human_approval must be a boolean"] };
      }
      if (record.suggested_revision !== undefined && typeof record.suggested_revision !== "string") {
        return { ok: false, errors: ["suggested_revision must be a string"] };
      }
      return { ok: true, data: record as AnswerQualityCheckSchema };
    },
  };
}

function validateStringArray(record: Record<string, unknown>, key: string, maxItems: number) {
  const value = record[key];
  if (!Array.isArray(value)) return [`${key} must be an array`];
  if (value.length > maxItems) return [`${key} must have <= ${maxItems} items`];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) {
      return [`${key} entries must be non-empty strings`];
    }
  }
  return [];
}

export function reportInsightSchema(): OutputSchema<ReportInsight> {
  return {
    name: "report_insight_v1",
    validate: (value: unknown) => {
      if (!isPlainObject(value)) return { ok: false, errors: ["Expected object"] };
      const record = value as Record<string, unknown>;
      const required = ["headline", "performance_summary", "insights", "recommendations", "risks_or_blockers"];
      const missing = required.filter((key) => !(key in record));
      if (missing.length > 0) return { ok: false, errors: missing.map((key) => `Missing key: ${key}`) };

      if (typeof record.headline !== "string" || !record.headline.trim()) {
        return { ok: false, errors: ["headline must be a non-empty string"] };
      }
      if (record.headline.length > 220) {
        return { ok: false, errors: ["headline must be <= 220 characters"] };
      }
      if (typeof record.performance_summary !== "string" || !record.performance_summary.trim()) {
        return { ok: false, errors: ["performance_summary must be a non-empty string"] };
      }

      if (!Array.isArray(record.insights)) return { ok: false, errors: ["insights must be an array"] };
      if (record.insights.length > 5) return { ok: false, errors: ["insights must have <= 5 items"] };
      for (const insight of record.insights) {
        if (!isPlainObject(insight)) return { ok: false, errors: ["insights entries must be objects"] };
        if (typeof insight.point !== "string" || !insight.point.trim()) {
          return { ok: false, errors: ["insights.point must be a non-empty string"] };
        }
        if (typeof insight.evidence !== "string" || !insight.evidence.trim()) {
          return { ok: false, errors: ["insights.evidence must be a non-empty string"] };
        }
      }

      if (!Array.isArray(record.recommendations)) return { ok: false, errors: ["recommendations must be an array"] };
      if (record.recommendations.length > 5) {
        return { ok: false, errors: ["recommendations must have <= 5 items"] };
      }
      for (const recommendation of record.recommendations) {
        if (!isPlainObject(recommendation)) {
          return { ok: false, errors: ["recommendations entries must be objects"] };
        }
        if (typeof recommendation.action !== "string" || !recommendation.action.trim()) {
          return { ok: false, errors: ["recommendations.action must be a non-empty string"] };
        }
        if (typeof recommendation.why !== "string" || !recommendation.why.trim()) {
          return { ok: false, errors: ["recommendations.why must be a non-empty string"] };
        }
        if (recommendation.owner !== "agency" && recommendation.owner !== "client") {
          return { ok: false, errors: ["recommendations.owner must be agency or client"] };
        }
      }

      const riskErrors = validateStringArray(record, "risks_or_blockers", 8);
      if (riskErrors.length > 0) return { ok: false, errors: riskErrors };

      return { ok: true, data: record as ReportInsight };
    },
  };
}

export type AiAssistantContextRequest =
  | {
      type: "brain_module";
      module: string;
      reason?: string;
    }
  | {
      type: "strategy_modules";
      modules?: string[];
      include_locked?: boolean;
      reason?: string;
    }
  | {
      type: "strategy_document";
      reason?: string;
    }
  | {
      type: "client_basics";
      reason?: string;
    }
  | {
      type: "embeddings_search";
      query: string;
      doc_types?: string[];
      modules?: string[];
      match_count?: number;
      min_similarity?: number;
      reason?: string;
    };

export type AiAssistantSchema = {
  assistant_message: string;
  proposals: AiAssistantProposal[];
  unknown: boolean;
  confidence: number;
  context_request?: {
    requests: AiAssistantContextRequest[];
  };
};

export function aiAssistantSchema(): OutputSchema<AiAssistantSchema> {
  return {
    name: "ai_assistant_v1",
    validate: (value: unknown) => {
      const record = value as Record<string, unknown>;
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { ok: false, errors: ["Expected object"] };
      }

      const required = ["assistant_message", "proposals", "unknown", "confidence"];
      const missing = required.filter((key) => !(key in record));
      if (missing.length > 0) {
        return { ok: false, errors: missing.map((key) => `Missing key: ${key}`) };
      }

      if (typeof record.assistant_message !== "string") {
        return { ok: false, errors: ["assistant_message must be a string"] };
      }
      if (typeof record.unknown !== "boolean") {
        return { ok: false, errors: ["unknown must be a boolean"] };
      }
      if (typeof record.confidence !== "number") {
        return { ok: false, errors: ["confidence must be a number"] };
      }

      if (!Array.isArray(record.proposals)) {
        return { ok: false, errors: ["proposals must be an array"] };
      }

      for (const proposal of record.proposals) {
        if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) {
          return { ok: false, errors: ["proposals entries must be objects"] };
        }
        const p = proposal as Record<string, unknown>;
        for (const key of ["id", "module", "title", "summary", "proposed_content_json"]) {
          if (!(key in p)) return { ok: false, errors: [`Missing proposal key: ${key}`] };
        }
        if (typeof p.id !== "string" || !p.id.trim()) return { ok: false, errors: ["proposal.id must be a non-empty string"] };
        if (typeof p.module !== "string" || !p.module.trim()) return { ok: false, errors: ["proposal.module must be a non-empty string"] };
        if (typeof p.title !== "string" || !p.title.trim()) return { ok: false, errors: ["proposal.title must be a non-empty string"] };
        if (typeof p.summary !== "string" || !p.summary.trim()) return { ok: false, errors: ["proposal.summary must be a non-empty string"] };
        if (!p.proposed_content_json || typeof p.proposed_content_json !== "object" || Array.isArray(p.proposed_content_json)) {
          return { ok: false, errors: ["proposal.proposed_content_json must be an object"] };
        }
        if (p.risks !== undefined) {
          if (!Array.isArray(p.risks) || !p.risks.every((r) => typeof r === "string")) {
            return { ok: false, errors: ["proposal.risks must be an array of strings"] };
          }
        }
      }

      const contextRequest = record.context_request;
      if (contextRequest === undefined) {
        return { ok: true, data: record as AiAssistantSchema };
      }
      if (!contextRequest || typeof contextRequest !== "object" || Array.isArray(contextRequest)) {
        return { ok: false, errors: ["context_request must be an object"] };
      }
      const cr = contextRequest as Record<string, unknown>;
      if (!Array.isArray(cr.requests)) {
        return { ok: false, errors: ["context_request.requests must be an array"] };
      }
      for (const req of cr.requests) {
        if (!req || typeof req !== "object" || Array.isArray(req)) {
          return { ok: false, errors: ["context_request.requests entries must be objects"] };
        }
        const r = req as Record<string, unknown>;
        if (typeof r.type !== "string" || !r.type.trim()) {
          return { ok: false, errors: ["context_request.requests.type must be a non-empty string"] };
        }
        if (r.type === "brain_module") {
          if (typeof r.module !== "string" || !r.module.trim()) {
            return { ok: false, errors: ["brain_module.module must be a non-empty string"] };
          }
        } else if (r.type === "strategy_modules") {
          if (r.modules !== undefined) {
            if (!Array.isArray(r.modules) || !r.modules.every((m) => typeof m === "string")) {
              return { ok: false, errors: ["strategy_modules.modules must be an array of strings"] };
            }
          }
          if (r.include_locked !== undefined && typeof r.include_locked !== "boolean") {
            return { ok: false, errors: ["strategy_modules.include_locked must be a boolean"] };
          }
        } else if (r.type === "strategy_document" || r.type === "client_basics") {
          // no extra fields
        } else if (r.type === "embeddings_search") {
          if (typeof r.query !== "string" || !r.query.trim()) {
            return { ok: false, errors: ["embeddings_search.query must be a non-empty string"] };
          }
          if (r.doc_types !== undefined) {
            if (!Array.isArray(r.doc_types) || !r.doc_types.every((d) => typeof d === "string")) {
              return { ok: false, errors: ["embeddings_search.doc_types must be an array of strings"] };
            }
          }
          if (r.modules !== undefined) {
            if (!Array.isArray(r.modules) || !r.modules.every((m) => typeof m === "string")) {
              return { ok: false, errors: ["embeddings_search.modules must be an array of strings"] };
            }
          }
          if (r.match_count !== undefined && typeof r.match_count !== "number") {
            return { ok: false, errors: ["embeddings_search.match_count must be a number"] };
          }
          if (r.min_similarity !== undefined && typeof r.min_similarity !== "number") {
            return { ok: false, errors: ["embeddings_search.min_similarity must be a number"] };
          }
        } else {
          return { ok: false, errors: [`Unknown context_request type: ${String(r.type)}`] };
        }
      }

      return { ok: true, data: record as AiAssistantSchema };
    },
  };
}

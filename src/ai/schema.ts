export type SchemaResult<T> = {
  ok: boolean;
  data?: T;
  errors?: string[];
};

export type OutputSchema<T> = {
  name: string;
  validate: (value: unknown) => SchemaResult<T>;
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

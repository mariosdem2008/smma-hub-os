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

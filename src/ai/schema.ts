export type SchemaResult<T> = {
  ok: boolean;
  data?: T;
  errors?: string[];
};

export type OutputSchema<T> = {
  name: string;
  validate: (value: unknown) => SchemaResult<T>;
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

/**
 * Client-side validation utilities for agency setup questions
 * Mirrors server-side validation logic in agency-admin-setup.ts
 */

export type ValidationRule = {
  type?: "string" | "array" | "object";
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  errorMessages?: {
    minItems?: string;
    maxItems?: string;
    minLength?: string;
    maxLength?: string;
    pattern?: string;
    required?: string;
  };
};

export type ValidationResult = {
  valid: boolean;
  error?: string;
};

/**
 * Check if a value is meaningful (not null, undefined, empty string, or empty array)
 */
function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.filter((v) => String(v ?? "").trim().length > 0).length > 0;
  return true;
}

/**
 * Validate a value against a validation rule
 * Returns {valid: true} if valid, or {valid: false, error: string} if invalid
 */
export function validateValue(value: unknown, validation?: ValidationRule): ValidationResult {
  // If no validation rules, just check if meaningful
  if (!validation) {
    if (!hasMeaningfulValue(value)) {
      return {
        valid: false,
        error: validation?.errorMessages?.required ?? "Please provide an answer to continue.",
      };
    }
    return { valid: true };
  }

  // Check required
  if (!hasMeaningfulValue(value)) {
    return {
      valid: false,
      error: validation.errorMessages?.required ?? "This field is required.",
    };
  }

  // Validate arrays
  if (validation.type === "array" && Array.isArray(value)) {
    const filteredValue = value.filter((v) => String(v ?? "").trim().length > 0);

    if (validation.minItems !== undefined && filteredValue.length < validation.minItems) {
      return {
        valid: false,
        error: validation.errorMessages?.minItems ?? `Please provide at least ${validation.minItems} items.`,
      };
    }

    if (validation.maxItems !== undefined && filteredValue.length > validation.maxItems) {
      return {
        valid: false,
        error: validation.errorMessages?.maxItems ?? `Please provide no more than ${validation.maxItems} items.`,
      };
    }

    return { valid: true };
  }

  // Validate strings
  if (validation.type === "string" && typeof value === "string") {
    const trimmedValue = value.trim();

    if (validation.minLength !== undefined && trimmedValue.length < validation.minLength) {
      return {
        valid: false,
        error:
          validation.errorMessages?.minLength ?? `Please provide at least ${validation.minLength} characters.`,
      };
    }

    if (validation.maxLength !== undefined && trimmedValue.length > validation.maxLength) {
      return {
        valid: false,
        error:
          validation.errorMessages?.maxLength ?? `Please keep your answer under ${validation.maxLength} characters.`,
      };
    }

    if (validation.pattern) {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(trimmedValue)) {
        return {
          valid: false,
          error: validation.errorMessages?.pattern ?? "Please provide a valid format.",
        };
      }
    }

    return { valid: true };
  }

  // Default: value is meaningful
  return { valid: true };
}

/**
 * Validate text input length in real-time
 */
export function validateTextLength(
  value: string,
  minLength?: number,
  maxLength?: number,
): { error?: string; remaining?: number } {
  const length = value.trim().length;

  if (maxLength !== undefined && length > maxLength) {
    return {
      error: `Too long (${length}/${maxLength} characters)`,
    };
  }

  if (maxLength !== undefined) {
    return {
      remaining: maxLength - length,
    };
  }

  if (minLength !== undefined && length > 0 && length < minLength) {
    return {
      error: `At least ${minLength} characters required (${length}/${minLength})`,
    };
  }

  return {};
}

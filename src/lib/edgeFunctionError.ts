/**
 * Standardized error handling for Supabase Edge Function responses.
 */

export interface EdgeFunctionError {
  code: string;
  message: string;
  deepLink?: string;
  missingFields?: string[];
  questions?: string[];
}

export interface ParsedResponse<T = unknown> {
  success: boolean;
  error?: EdgeFunctionError;
  result?: T;
}

const ERROR_MESSAGES: Record<string, string> = {
  BRAIN_INCOMPLETE: "Please complete your client profile before generating a strategy.",
  AGENCY_BRAIN_INCOMPLETE: "Please complete your AI Setup before generating strategies.",
  MISSING_API_KEY: "AI service not configured. Please contact your administrator.",
  RAG_FAILURE: "Failed to retrieve context. Please try again.",
  GENERATION_TIMEOUT: "Strategy generation timed out. Please try again.",
  GENERATION_ERROR: "Failed to generate strategy. Please try again.",
  PERSISTENCE_ERROR: "Failed to save strategy. Please try again.",
  FORBIDDEN: "You do not have permission to perform this action.",
  CLIENT_NOT_FOUND: "Client not found. Please check the client ID.",
  CLIENT_BRAIN_MISSING: "Complete client onboarding before generating strategy.",
};

export function parseEdgeFunctionResponse<T = unknown>(data: unknown): ParsedResponse<T> {
  if (!data || typeof data !== "object") {
    return {
      success: false,
      error: { code: "INVALID_RESPONSE", message: "Invalid response from server" },
    };
  }

  const response = data as Record<string, unknown>;

  if (response.unknown === true) {
    const code = (response.code as string) || "GATED";
    const missingFields = Array.isArray(response.missing_fields) ? (response.missing_fields as string[]) : undefined;
    const questions = Array.isArray(response.questions)
      ? (response.questions as unknown[]).filter((q): q is string => typeof q === "string")
      : undefined;

    if (missingFields?.includes("strategy_generation")) {
      const code = "GENERATION_ERROR";
      return {
        success: false,
        error: {
          code,
          message: ERROR_MESSAGES[code] || "Strategy generation failed. Please retry.",
        },
      };
    }

    const message =
      (response.message as string) ||
      (questions && questions.length ? questions[0] : undefined) ||
      (missingFields && missingFields.length ? `Action required. Missing: ${missingFields.join(", ")}` : undefined) ||
      ERROR_MESSAGES[code] ||
      "Additional information required.";

    return {
      success: false,
      error: {
        code,
        message,
        deepLink: response.deep_link as string | undefined,
        missingFields,
        questions,
      },
    };
  }

  if (response.error) {
    const code = (response.code as string) || "ERROR";
    return {
      success: false,
      error: {
        code,
        message:
          (response.message as string) ||
          ERROR_MESSAGES[code] ||
          (response.error as string) ||
          "An error occurred.",
      },
    };
  }

  return { success: true, result: response as T };
}

export function getErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] || "An unexpected error occurred.";
}

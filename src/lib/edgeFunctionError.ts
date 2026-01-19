/**
 * Standardized error handling for Supabase Edge Function responses.
 */

export interface EdgeFunctionError {
  code: string;
  message: string;
  deepLink?: string;
  missingFields?: string[];
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
    return {
      success: false,
      error: {
        code,
        message: (response.message as string) || ERROR_MESSAGES[code] || "Additional information required.",
        deepLink: response.deep_link as string | undefined,
        missingFields: response.missing_fields as string[] | undefined,
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
          (response.error as string) ||
          ERROR_MESSAGES[code] ||
          "An error occurred.",
      },
    };
  }

  return { success: true, result: response as T };
}

export function getErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] || "An unexpected error occurred.";
}

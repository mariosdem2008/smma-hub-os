import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function readFunctionErrorPayload(error: unknown): Promise<{ code?: string; error?: string; missing?: string[] } | null> {
  if (!error || typeof error !== "object") return null;
  const context = (error as { context?: Response }).context;
  if (!context || typeof (context as any).json !== "function") return null;
  try {
    return (await (context as any).json()) as { code?: string; error?: string; missing?: string[] };
  } catch {
    return null;
  }
}

export class AiAssistantError extends Error {
  code?: string;
  missing?: string[];
}

export type AiAssistantChatMessage = { role: "user" | "assistant"; content: string };

export type AiAssistantProposal = {
  id: string;
  module: string;
  title: string;
  summary: string;
  proposed_content_json: Record<string, unknown>;
  risks?: string[];
};

export type AiAssistantResponseJson = {
  assistant_message: string;
  proposals: AiAssistantProposal[];
  unknown: boolean;
  confidence: number;
  context_request?: unknown;
};

export type AiAssistantLoadResponse = {
  thread_id: string;
  summary: string | null;
  messages: AiAssistantChatMessage[];
};

export type AiAssistantSendResponse = {
  thread_id: string;
  assistant_message: string;
  json: AiAssistantResponseJson | null;
  meta?: { provider: string; model: string };
  usage?: { inputTokens?: number; outputTokens?: number };
  schemaOk?: boolean;
  error?: string | null;
};

export function useAiAssistant() {
  return useMutation({
    mutationFn: async (input: {
      action: "load" | "send";
      clientId: string;
      strategyId?: string | null;
      activeTab?: string | null;
      threadId?: string | null;
      message?: string;
      chatHistory?: AiAssistantChatMessage[];
    }) => {
      const invokePromise = supabase.functions.invoke("ai-assistant", {
        body: {
          action: input.action,
          client_id: input.clientId,
          strategy_id: input.strategyId ?? null,
          active_tab: input.activeTab ?? null,
          thread_id: input.threadId ?? null,
          message: input.message ?? "",
          chat_history: Array.isArray(input.chatHistory) ? input.chatHistory : undefined,
        },
      });

      const timeoutMs = 45_000;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("AI request timed out. Please try again.")), timeoutMs);
      });

      const { data, error } = await Promise.race([invokePromise, timeoutPromise]);

      if (error) {
        const payload = await readFunctionErrorPayload(error);
        if (payload?.code === "AI_SETUP_REQUIRED") {
          const err = new AiAssistantError(payload.error ?? "AI Assistant not configured.");
          err.code = "AI_SETUP_REQUIRED";
          err.missing = payload.missing;
          throw err;
        }
        if (payload?.code === "ENDPOINT_DISABLED") {
          const err = new AiAssistantError(payload.error ?? "AI endpoint disabled.");
          err.code = "ENDPOINT_DISABLED";
          throw err;
        }
        if (payload?.code === "MISSING_API_KEY") {
          const err = new AiAssistantError(payload.error ?? "AI service not configured.");
          err.code = "MISSING_API_KEY";
          throw err;
        }
        throw error;
      }

      return data as AiAssistantLoadResponse | AiAssistantSendResponse;
    },
  });
}

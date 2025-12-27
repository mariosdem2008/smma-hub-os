import { runAiTask, runAiTaskStream } from "./ai-router.ts";
import { calculateCost } from "./budgets.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";
import type { AdminChatSchema } from "../../../src/ai/schema.ts";
import type { AgencyContextSnapshot } from "./ai-context.ts";

export type Suggestion = { id: string; label: string; user_message: string };

export type GeneralChatOutput = {
  assistant_message: string;
  suggestions?: Suggestion[];
  actions?: Array<{ type: string; payload?: unknown }>;
  escalated?: boolean;
  unknown?: boolean;
  outputMode?: "schema" | "legacy_fallback" | "legacy";
  schemaFailed?: boolean;
};

const ASSISTANT_PREFIX = "ASSISTANT_MESSAGE:";
const SUGGESTIONS_PREFIX = "SUGGESTIONS_JSON:";
function validateSuggestions(suggestions?: Suggestion[]) {
  if (!suggestions) return true;
  if (!Array.isArray(suggestions)) return false;
  if (suggestions.length > 3) return false;
  for (const item of suggestions) {
    if (!item || typeof item.id !== "string") return false;
    if (typeof item.label !== "string" || item.label.length > 28) return false;
    if (typeof item.user_message !== "string" || item.user_message.length > 180) return false;
  }
  return true;
}

function readEnvFlag(name: string) {
  if (typeof Deno !== "undefined" && typeof Deno.env?.get === "function") {
    return Deno.env.get(name);
  }
  if (typeof process !== "undefined") {
    return process.env[name];
  }
  return undefined;
}

export function isAdminChatSchemaEnabled() {
  return readEnvFlag("AI_ADMIN_CHAT_SCHEMA") === "true";
}

function parseSuggestions(raw: string): Suggestion[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (!validateSuggestions(parsed)) return [];
    return parsed as Suggestion[];
  } catch {
    return [];
  }
}

export function parseGeneralChatOutputFromText(text: string): GeneralChatOutput | null {
  const assistantIndex = text.indexOf(ASSISTANT_PREFIX);
  if (assistantIndex === -1) return null;
  const afterAssistant = assistantIndex + ASSISTANT_PREFIX.length;
  const suggestionsIndex = text.indexOf(SUGGESTIONS_PREFIX, afterAssistant);
  const assistantText = (suggestionsIndex === -1 ? text.slice(afterAssistant) : text.slice(afterAssistant, suggestionsIndex)).trim();
  const suggestionsText = suggestionsIndex === -1 ? "" : text.slice(suggestionsIndex + SUGGESTIONS_PREFIX.length);
  const suggestions = parseSuggestions(suggestionsText);

  if (!assistantText) return null;
  if (!validateSuggestions(suggestions)) return null;

  return {
    assistant_message: assistantText,
    suggestions,
  };
}

export function extractAssistantMessageFromText(text: string) {
  const assistantIndex = text.indexOf(ASSISTANT_PREFIX);
  if (assistantIndex === -1) return "";
  const afterAssistant = assistantIndex + ASSISTANT_PREFIX.length;
  const suggestionsIndex = text.indexOf(SUGGESTIONS_PREFIX, afterAssistant);
  const assistantText = (suggestionsIndex === -1 ? text.slice(afterAssistant) : text.slice(afterAssistant, suggestionsIndex)).trimStart();
  return assistantText;
}

function normalizeSchemaSuggestions(suggestions: string[]): Suggestion[] {
  return suggestions
    .filter((item) => typeof item === "string" && item.trim().length > 0)
    .slice(0, 6)
    .map((item, index) => {
      const trimmed = item.trim();
      const label = trimmed.slice(0, 28) || `Suggestion ${index + 1}`;
      const userMessage = trimmed.slice(0, 180) || label;
      return {
        id: `suggestion_${index + 1}`,
        label,
        user_message: userMessage,
      };
    });
}

function estimateTokensForCost(text: string) {
  return Math.ceil(text.length / 3);
}

async function logAdminChatRun(opts: {
  supabase: any;
  agencyId: string;
  userId: string;
  model: string | null;
  provider: string | null;
  latencyMs: number;
  assistantMessage: string;
  unknown: boolean;
  escalated: boolean;
  metadata: Record<string, unknown>;
  usage?: { inputTokens?: number; outputTokens?: number } | null;
  contextSizeHint?: string;
}) {
  if (!opts.supabase) return;
  const tokensIn = opts.usage?.inputTokens ?? estimateTokensForCost(opts.contextSizeHint ?? "");
  const tokensOut = opts.usage?.outputTokens ?? estimateTokensForCost(opts.assistantMessage);
  const model = opts.model ?? "unknown";
  const costUsd = calculateCost(opts.provider ?? "openai", model, tokensIn, tokensOut);

  try {
    await opts.supabase.from("ai_runs").insert({
      agency_id: opts.agencyId,
      client_id: null,
      user_id: opts.userId,
      prompt_id: null,
      prompt_version: null,
      model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: costUsd,
      latency_ms: opts.latencyMs,
      success: true,
      citations: {},
      unknown: opts.unknown,
      escalate_to_human: opts.escalated,
      escalation_reason: null,
      metadata: opts.metadata,
    });
  } catch (error) {
    console.error("admin_chat_ai_runs_insert_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function runAdminGeneralChatAi(opts: {
  message: string;
  agencyId: string;
  userId: string;
  snapshot: AgencyContextSnapshot;
  conversation: string;
  supabase: any;
}) {
  const envMode =
    typeof Deno !== "undefined" && typeof Deno.env?.get === "function"
      ? Deno.env.get("AI_MODE")
      : typeof process !== "undefined"
      ? process.env.AI_MODE
      : undefined;
  const mode = envMode === "dev" ? "dev" : "prod";
  const schemaEnabled = isAdminChatSchemaEnabled();
  const startTime = Date.now();
  const result = await runAiTask({
    task_type: TaskType.AGENCY_ADMIN_GENERAL_CHAT,
    mode,
    tenant: { agency_id: opts.agencyId, user_id: opts.userId },
    input: { message: opts.message },
    metadata: {
      contextSnapshot: opts.snapshot,
      conversation: opts.conversation,
      latestUserMessage: opts.message,
    },
    supabase: opts.supabase,
  });

  const fallbackResponse = {
    assistant_message:
      "I couldn't parse that response. Tell me what you need help with (strategy, offers, workflow, or client questions) and I'll jump in.",
    suggestions: [
      { id: "draft_offer", label: "Draft offer", user_message: "Draft our core offer with pricing ranges." },
      { id: "weekly_plan", label: "Weekly plan", user_message: "Create a weekly priorities plan for the agency." },
    ],
  };

  if (schemaEnabled) {
    const schemaOk = result?.schemaOk !== false && result?.json;
    let outputMode: "schema" | "legacy_fallback" = "schema";
    let schemaFailed = false;
    let output: GeneralChatOutput;

    if (schemaOk) {
      const parsedSchema = result?.json as AdminChatSchema;
      output = {
        assistant_message: parsedSchema.assistant_message,
        suggestions: normalizeSchemaSuggestions(parsedSchema.suggestions ?? []),
        actions: parsedSchema.actions ?? [],
        escalated: Boolean(parsedSchema.escalated),
        unknown: Boolean(parsedSchema.unknown),
        outputMode,
        schemaFailed: false,
      };
    } else {
      outputMode = "legacy_fallback";
      schemaFailed = true;
      const rawText = result?.rawText ?? result?.assistant_message ?? "";
      const legacyParsed = parseGeneralChatOutputFromText(rawText);
      output = legacyParsed
        ? {
            assistant_message: legacyParsed.assistant_message,
            suggestions: legacyParsed.suggestions ?? [],
            outputMode,
            schemaFailed,
          }
        : {
            assistant_message: fallbackResponse.assistant_message,
            suggestions: fallbackResponse.suggestions,
            outputMode,
            schemaFailed,
          };
    }

    const latencyMs = Date.now() - startTime;
    const metadata: Record<string, unknown> = {
      admin_chat_output_mode: outputMode,
    };
    if (schemaFailed) {
      metadata.admin_chat_schema_failed = true;
    }

    await logAdminChatRun({
      supabase: opts.supabase,
      agencyId: opts.agencyId,
      userId: opts.userId,
      model: result?.meta?.model ?? null,
      provider: result?.meta?.provider ?? null,
      latencyMs,
      assistantMessage: output.assistant_message,
      unknown: Boolean(output.unknown) || output.assistant_message.trim().startsWith("UNKNOWN"),
      escalated: Boolean(output.escalated),
      metadata,
      usage: result?.usage ?? null,
      contextSizeHint: `${opts.conversation}\n\n${opts.message}`,
    });

    return {
      assistant_message: output.assistant_message,
      suggestions: output.suggestions ?? [],
      actions: output.actions ?? [],
      escalated: output.escalated ?? false,
      unknown: output.unknown ?? false,
      outputMode,
      schemaFailed,
      meta: result?.meta ?? null,
    };
  }

  const parsed = parseGeneralChatOutputFromText(result?.assistant_message ?? "");
  const latencyMs = Date.now() - startTime;
  if (!parsed) {
    await logAdminChatRun({
      supabase: opts.supabase,
      agencyId: opts.agencyId,
      userId: opts.userId,
      model: result?.meta?.model ?? null,
      provider: result?.meta?.provider ?? null,
      latencyMs,
      assistantMessage: fallbackResponse.assistant_message,
      unknown: fallbackResponse.assistant_message.trim().startsWith("UNKNOWN"),
      escalated: false,
      metadata: { admin_chat_output_mode: "legacy", admin_chat_schema_failed: false },
      usage: result?.usage ?? null,
      contextSizeHint: `${opts.conversation}\n\n${opts.message}`,
    });
    return {
      assistant_message: fallbackResponse.assistant_message,
      suggestions: fallbackResponse.suggestions,
      meta: result?.meta ?? null,
      outputMode: "legacy",
    };
  }

  await logAdminChatRun({
    supabase: opts.supabase,
    agencyId: opts.agencyId,
    userId: opts.userId,
    model: result?.meta?.model ?? null,
    provider: result?.meta?.provider ?? null,
    latencyMs,
    assistantMessage: parsed.assistant_message,
    unknown: parsed.assistant_message.trim().startsWith("UNKNOWN"),
    escalated: false,
    metadata: { admin_chat_output_mode: "legacy", admin_chat_schema_failed: false },
    usage: result?.usage ?? null,
    contextSizeHint: `${opts.conversation}\n\n${opts.message}`,
  });

  return {
    assistant_message: parsed.assistant_message,
    suggestions: parsed.suggestions ?? [],
    meta: result?.meta ?? null,
    outputMode: "legacy",
  };
}

export async function runAdminGeneralChatAiStream(opts: {
  message: string;
  agencyId: string;
  userId: string;
  snapshot: AgencyContextSnapshot;
  conversation: string;
  supabase: any;
}) {
  const envMode =
    typeof Deno !== "undefined" && typeof Deno.env?.get === "function"
      ? Deno.env.get("AI_MODE")
      : typeof process !== "undefined"
      ? process.env.AI_MODE
      : undefined;
  const mode = envMode === "dev" ? "dev" : "prod";

  return runAiTaskStream({
    task_type: TaskType.AGENCY_ADMIN_GENERAL_CHAT,
    mode,
    tenant: { agency_id: opts.agencyId, user_id: opts.userId },
    input: { message: opts.message },
    metadata: {
      contextSnapshot: opts.snapshot,
      conversation: opts.conversation,
      latestUserMessage: opts.message,
    },
    supabase: opts.supabase,
  });
}

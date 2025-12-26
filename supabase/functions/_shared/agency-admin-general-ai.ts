import { runAiTask, runAiTaskStream } from "./ai-router.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";
import type { AgencyContextSnapshot } from "./ai-context.ts";

export type Suggestion = { id: string; label: string; user_message: string };

export type GeneralChatOutput = {
  assistant_message: string;
  suggestions?: Suggestion[];
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

  const parsed = parseGeneralChatOutputFromText(result?.text ?? "");
  if (!parsed) {
    return {
      assistant_message:
        "I couldn't parse that response. Tell me what you need help with (strategy, offers, workflow, or client questions) and I'll jump in.",
      suggestions: [
        { id: "draft_offer", label: "Draft offer", user_message: "Draft our core offer with pricing ranges." },
        { id: "weekly_plan", label: "Weekly plan", user_message: "Create a weekly priorities plan for the agency." },
      ],
      meta: result?.meta ?? null,
    };
  }

  return {
    assistant_message: parsed.assistant_message,
    suggestions: parsed.suggestions ?? [],
    meta: result?.meta ?? null,
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

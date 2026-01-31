import { runAiTask, runAiTaskStream } from "./ai-router.ts";
import { calculateCost } from "./budgets.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";
import type { AdminChatSchema } from "../../../src/ai/schema.ts";
import type { AgencyContextSnapshot } from "./ai-context.ts";
import {
  clampClarifyingQuestions,
  formatStrategicAssistantMessage,
  routeAdminChatPlaybook,
  validateStrategicOutput,
  type AdminChatPlaybook,
  type AdminChatStrategicOutput,
} from "../../../src/ai/adminChatStrategic.ts";
import { embedText } from "./embeddings.ts";
import { executeToolAction } from "./tool-executor.ts";
import { capMatchesByTokenBudget, clampMatchCount } from "./retrieval.ts";

export type Suggestion = { id: string; label: string; user_message: string };

export type GeneralChatOutput = {
  assistant_message: string;
  suggestions?: Suggestion[];
  actions?: Array<{ type: string; payload?: unknown }>;
  escalated?: boolean;
  unknown?: boolean;
  outputMode?: "schema" | "legacy_fallback" | "legacy";
  schemaFailed?: boolean;
  playbook?: AdminChatPlaybook;
  statePatch?: Record<string, unknown> | null;
};

type AdminChatState = {
  playbook?: AdminChatPlaybook;
  goal?: string | null;
  stage?: "discover" | "define" | "design" | "decide" | "deliver";
  clarifying_questions_asked?: number;
  open_questions?: string[];
  last_decision?: string;
};

type AdminChatSummary = {
  summary: string;
  key_facts: string[];
  decisions: string[];
  updated_at: string;
};

const ASSISTANT_PREFIX = "ASSISTANT_MESSAGE:";
const SUGGESTIONS_PREFIX = "SUGGESTIONS_JSON:";

const MAX_SUMMARY_CHARS = 900;
const MAX_KEY_FACTS = 10;
const MAX_DECISIONS = 8;
const MAX_OPEN_QUESTIONS = 6;
const MAX_RAG_SNIPPET_CHARS = 2000;

function nowIso() {
  return new Date().toISOString();
}
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

export function isAdminChatStrategicEnabled() {
  return readEnvFlag("AI_ADMIN_CHAT_STRATEGIC") === "true";
}

function extractAdminChatState(brain?: Record<string, unknown> | null): AdminChatState {
  if (!brain || typeof brain !== "object") return {};
  const context = (brain as Record<string, unknown>).ai_context_v1 as Record<string, unknown> | null | undefined;
  const state = context?.admin_chat_state_v1 as Record<string, unknown> | undefined;
  if (!state || typeof state !== "object") return {};
  return {
    playbook: (state.playbook as AdminChatPlaybook | undefined) ?? undefined,
    goal: typeof state.goal === "string" ? state.goal : null,
    stage: typeof state.stage === "string" ? (state.stage as AdminChatState["stage"]) : undefined,
    clarifying_questions_asked: typeof state.clarifying_questions_asked === "number" ? state.clarifying_questions_asked : 0,
    open_questions: Array.isArray(state.open_questions) ? (state.open_questions as string[]) : undefined,
    last_decision: typeof state.last_decision === "string" ? state.last_decision : undefined,
  };
}

function extractAdminChatSummary(brain?: Record<string, unknown> | null): AdminChatSummary | null {
  if (!brain || typeof brain !== "object") return null;
  const context = (brain as Record<string, unknown>).ai_context_v1 as Record<string, unknown> | null | undefined;
  const summary = context?.admin_chat_summary_v1 as Record<string, unknown> | undefined;
  if (!summary || typeof summary !== "object") return null;
  return {
    summary: typeof summary.summary === "string" ? summary.summary : "",
    key_facts: Array.isArray(summary.key_facts) ? (summary.key_facts as string[]) : [],
    decisions: Array.isArray(summary.decisions) ? (summary.decisions as string[]) : [],
    updated_at: typeof summary.updated_at === "string" ? summary.updated_at : "",
  };
}

function clampList(items: string[], maxItems: number) {
  return items.filter((item) => typeof item === "string" && item.trim().length > 0).slice(0, maxItems);
}

function truncateText(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars).trim();
}

function pickStageFromOutput(output: AdminChatStrategicOutput): AdminChatState["stage"] {
  if (output.unknown) return "discover";
  switch (output.playbook) {
    case "strategy":
      return "design";
    case "copywriting":
      return "deliver";
    case "core_offer":
    default:
      return "define";
  }
}

function buildSummaryFromOutput(output: AdminChatStrategicOutput): AdminChatSummary {
  if (output.unknown) {
    const missing = output.unknown.missing?.length ? output.unknown.missing.join(", ") : "missing details";
    return {
      summary: truncateText(`UNKNOWN: Missing ${missing}.`, MAX_SUMMARY_CHARS),
      key_facts: [],
      decisions: [],
      updated_at: nowIso(),
    };
  }

  const keyFacts: string[] = [];
  let summaryText = `Playbook: ${output.playbook}.`;
  let nextAction = "";

  if (output.playbook === "core_offer" && output.core_offer) {
    keyFacts.push(`ICP: ${output.core_offer.icp_primary}`);
    keyFacts.push(`Promise: ${output.core_offer.pain_promise}`);
    keyFacts.push(`Mechanism: ${output.core_offer.offer_mechanism}`);
    keyFacts.push(`Tiers: ${output.core_offer.tiers.map((tier) => tier.name).join(", ")}`);
    nextAction = output.core_offer.next_action;
  }

  if (output.playbook === "strategy" && output.strategy) {
    keyFacts.push(`Goal: ${output.strategy.goal_metric}`);
    keyFacts.push(`Pillars: ${output.strategy.content_pillars.join(", ")}`);
    nextAction = output.strategy.next_action;
  }

  if (output.playbook === "copywriting" && output.copywriting) {
    keyFacts.push(`Hooks: ${output.copywriting.hooks.slice(0, 3).join(" | ")}`);
    nextAction = output.copywriting.next_action;
  }

  if (nextAction) {
    summaryText = `${summaryText} Next action: ${nextAction}`;
  }

  return {
    summary: truncateText(summaryText, MAX_SUMMARY_CHARS),
    key_facts: clampList(keyFacts, MAX_KEY_FACTS),
    decisions: clampList(nextAction ? [`Next action: ${nextAction}`] : [], MAX_DECISIONS),
    updated_at: nowIso(),
  };
}

function mergeAdminChatSummary(previous: AdminChatSummary | null, next: AdminChatSummary): AdminChatSummary {
  const mergedFacts = new Set<string>([...(previous?.key_facts ?? []), ...next.key_facts]);
  const mergedDecisions = new Set<string>([...(previous?.decisions ?? []), ...next.decisions]);
  const summaryText = previous?.summary
    ? `${previous.summary} ${next.summary}`.trim()
    : next.summary;

  return {
    summary: truncateText(summaryText, MAX_SUMMARY_CHARS),
    key_facts: Array.from(mergedFacts).slice(0, MAX_KEY_FACTS),
    decisions: Array.from(mergedDecisions).slice(0, MAX_DECISIONS),
    updated_at: next.updated_at,
  };
}

function buildFallbackStrategicPatch(opts: {
  playbook: AdminChatPlaybook;
  previousState: AdminChatState;
  previousSummary: AdminChatSummary | null;
  missingReason: string;
  question: string;
}) {
  const fallbackOutput: AdminChatStrategicOutput = {
    playbook: opts.playbook,
    clarifying_questions: [],
    unknown: { missing: [opts.missingReason], question: opts.question },
  };
  const nextSummary = mergeAdminChatSummary(opts.previousSummary, buildSummaryFromOutput(fallbackOutput));
  const nextState = {
    ...opts.previousState,
    playbook: opts.playbook,
    stage: opts.previousState.stage ?? "discover",
  };
  return {
    admin_chat_state_v1: nextState,
    admin_chat_summary_v1: nextSummary,
  };
}

function buildNextAdminChatState(previous: AdminChatState, output: AdminChatStrategicOutput): AdminChatState {
  const askedSoFar = previous.clarifying_questions_asked ?? 0;
  const askedNow = output.clarifying_questions?.length ?? 0;
  const nextStage = pickStageFromOutput(output);
  const nextGoal = output.playbook === "strategy" ? output.strategy?.goal_metric ?? null : previous.goal ?? null;
  return {
    playbook: output.playbook,
    goal: nextGoal,
    stage: nextStage,
    clarifying_questions_asked: Math.min(3, askedSoFar + askedNow),
    open_questions: clampList(output.clarifying_questions ?? [], MAX_OPEN_QUESTIONS),
    last_decision: output.playbook,
  };
}

function buildAdminChatContextBlob(opts: {
  snapshot: AgencyContextSnapshot;
  brain: Record<string, unknown> | null;
  playbook: AdminChatPlaybook;
  state: AdminChatState;
  memorySnippets: Array<Record<string, unknown>>;
  summary: AdminChatSummary | null;
}) {
  const setupProfile = (opts.brain as any)?.setup_profile_v1 ?? {};
  const agency = setupProfile?.agency ?? {};
  const brand = setupProfile?.brand ?? {};
  const ai = setupProfile?.ai ?? {};

  return {
    context_version: "v1",
    agency_profile: {
      name: opts.snapshot.agency?.name ?? null,
      website: opts.snapshot.agency?.website ?? null,
      niche: opts.snapshot.agency?.niche ?? null,
      positioning: agency.core_offer_outcome ?? null,
      tone: brand.voice_adjectives ?? null,
      offers: agency.primary_services ?? null,
      proof: agency.proof ?? null,
      constraints: ai.boundaries ?? null,
    },
    client_profile: null,
    agency_policies: {
      rep_policy_v1: (opts.brain as any)?.rep_policy_v1 ?? null,
      faq_v1: (opts.brain as any)?.faq_v1 ?? null,
      dos_donts: brand.dos_donts ?? null,
      escalation_rules: ai.escalation_rules ?? null,
    },
    memory_snippets: opts.memorySnippets,
    conversation_state: {
      goal: opts.state.goal ?? null,
      stage: opts.state.stage ?? null,
      last_decision: opts.state.last_decision ?? null,
      open_questions: opts.state.open_questions ?? [],
      clarifying_questions_asked: opts.state.clarifying_questions_asked ?? 0,
      playbook: opts.playbook,
      summary: opts.summary ?? null,
    },
    safety_rules: {
      unknown_policy: "UNKNOWN + missing info + 1 question",
      escalation_policy: "Escalate only with explicit constraint in context.",
      no_hallucinations: true,
    },
  };
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

type ToolActionResult = {
  type: string;
  success: boolean;
  result?: any;
  error?: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeActionPayload(payload: unknown): Record<string, unknown> {
  return isPlainObject(payload) ? payload : {};
}

function buildActionSummary(results: ToolActionResult[]) {
  const successLines = results.filter((result) => result.success).map((result) => {
    const payload = result.result ?? {};
    switch (result.type) {
      case "create_client": {
        const name = payload.name ?? "client";
        return `- create_client: ${payload.existing ? "existing" : "created"} ${name}`;
      }
      case "draft_offer": {
        const serviceType = payload.service_type ?? "offer";
        return `- draft_offer: drafted ${serviceType}`;
      }
      case "update_brain": {
        const field = payload.field ?? "field";
        return `- update_brain: updated ${field}`;
      }
      case "schedule_task": {
        const title = payload.title ?? "task";
        const dueDate = payload.due_date ? ` (due ${payload.due_date})` : "";
        return `- schedule_task: created ${title}${dueDate}`;
      }
      case "create_project": {
        const title = payload.title ?? "project";
        return `- create_project: ${payload.existing ? "existing" : "created"} "${title}"`;
      }
      case "update_project_status": {
        const status = payload.status ?? "status";
        return `- update_project_status: moved to ${status}`;
      }
      case "assign_project_asset": {
        return `- assign_project_asset: linked asset to project`;
      }
      case "schedule_post": {
        const platform = payload.platform ?? "platform";
        const scheduledFor = payload.scheduled_for ? new Date(payload.scheduled_for).toLocaleDateString() : "";
        return `- schedule_post: scheduled for ${platform}${scheduledFor ? ` on ${scheduledFor}` : ""}`;
      }
      case "update_task_status": {
        const status = payload.status ?? "status";
        return `- update_task_status: ${payload.changed ? `changed to ${status}` : `already ${status}`}`;
      }
      case "update_task_priority": {
        const priority = payload.priority ?? "priority";
        return `- update_task_priority: ${payload.changed ? `changed to ${priority}` : `already ${priority}`}`;
      }
      case "request_approval": {
        return `- request_approval: ${payload.existing ? "existing" : "created"} approval request`;
      }
      case "send_message": {
        return `- send_message: sent to conversation`;
      }
      default:
        return `- ${result.type}: completed`;
    }
  });

  const errorLines = results.filter((result) => !result.success).map((result) => {
    const error = result.error ?? "failed";
    return `- ${result.type}: ${error}`;
  });

  const sections: string[] = [];
  if (successLines.length) {
    sections.push(["Actions completed:", ...successLines].join("\n"));
  }
  if (errorLines.length) {
    sections.push(["Actions failed:", ...errorLines].join("\n"));
  }
  return sections.join("\n\n");
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
  promptVersion?: number;
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
      prompt_version: opts.promptVersion ?? null,
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

async function fetchAgencyRagSnippets(opts: {
  supabase: any;
  agencyId: string;
  query: string;
}): Promise<Array<Record<string, unknown>>> {
  try {
    if (!opts.supabase?.rpc) return [];
    const embeddingModel = typeof Deno !== "undefined"
      ? Deno.env.get("EMBEDDING_MODEL_ID") ?? "text-embedding-3-small"
      : process.env.EMBEDDING_MODEL_ID ?? "text-embedding-3-small";

    const queryEmbedding = await embedText(opts.query, "", embeddingModel);

    const { data: matches } = await opts.supabase.rpc("match_ai_embeddings", {
      p_agency_id: opts.agencyId,
      p_client_id: null,
      p_query_embedding: queryEmbedding,
      p_match_count: clampMatchCount(5),
      p_doc_types: null,
      p_modules: null,
      p_min_similarity: 0.2,
    });

    if (!matches || matches.length === 0) {
      return [];
    }

    const capped = capMatchesByTokenBudget(matches, 600);
    const mapped = capped.matches.map((match: any, index: number) => ({
      rank: index + 1,
      text: match.chunk_text ?? "",
      doc_type: match.doc_type ?? null,
      title: match.title ?? null,
      score: match.score ?? null,
      source: match.source ?? null,
      source_url: match.source_url ?? null,
    }));
    return trimMemorySnippets(mapped);
  } catch (error) {
    console.error("admin_chat_rag_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function formatRagSnippets(snippets: Array<Record<string, unknown>>) {
  if (!snippets.length) return "";
  return snippets
    .map((snippet, index) => `[${index + 1}] ${(snippet.text as string) ?? ""}`)
    .join("\n\n");
}

function trimMemorySnippets(snippets: Array<Record<string, unknown>>) {
  if (!snippets.length) return [];
  const trimmed: Array<Record<string, unknown>> = [];
  let remaining = MAX_RAG_SNIPPET_CHARS;
  for (const snippet of snippets.slice(0, 5)) {
    if (remaining <= 0) break;
    const text = String(snippet.text ?? "");
    const clipped = text.length > remaining ? text.slice(0, remaining) : text;
    trimmed.push({ ...snippet, text: clipped });
    remaining -= clipped.length;
  }
  return trimmed;
}

export async function runAdminGeneralChatAi(opts: {
  message: string;
  agencyId: string;
  userId: string;
  snapshot: AgencyContextSnapshot;
  brain?: Record<string, unknown> | null;
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
  const schemaEnabled = isAdminChatSchemaEnabled() || isAdminChatStrategicEnabled();
  const startTime = Date.now();

  const ragSnippets = await fetchAgencyRagSnippets({
    supabase: opts.supabase,
    agencyId: opts.agencyId,
    query: opts.message,
  });
  const ragContext = formatRagSnippets(ragSnippets);

  const strategicEnabled = isAdminChatStrategicEnabled();
  const playbook = strategicEnabled ? routeAdminChatPlaybook(opts.message) : null;
  const previousState = strategicEnabled ? extractAdminChatState(opts.brain ?? null) : {};
  const previousSummary = strategicEnabled ? extractAdminChatSummary(opts.brain ?? null) : null;
  const contextBlob = strategicEnabled
    ? buildAdminChatContextBlob({
        snapshot: opts.snapshot,
        brain: opts.brain ?? null,
        playbook: playbook ?? "core_offer",
        state: previousState,
        memorySnippets: ragSnippets,
        summary: previousSummary,
      })
    : undefined;

  const result = await runAiTask({
    task_type: TaskType.AGENCY_ADMIN_GENERAL_CHAT,
    mode,
    tenant: { agency_id: opts.agencyId, user_id: opts.userId },
    input: { message: opts.message },
    metadata: {
      contextSnapshot: opts.snapshot,
      conversation: opts.conversation,
      latestUserMessage: opts.message,
      ragContext,
      contextBlob,
      playbook,
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
      if (strategicEnabled) {
        const parsedStrategic = result?.json as AdminChatStrategicOutput;
        parsedStrategic.clarifying_questions = clampClarifyingQuestions(parsedStrategic.clarifying_questions ?? []);

        const validation = validateStrategicOutput(parsedStrategic);
        if (!validation.ok) {
          outputMode = "legacy_fallback";
          schemaFailed = true;
          output = {
            assistant_message: "UNKNOWN\n\nNeed: valid strategic output\n\nNext Question: What should I help with first?",
            suggestions: [],
            outputMode,
            schemaFailed,
            unknown: true,
            statePatch: buildFallbackStrategicPatch({
              playbook: playbook ?? "core_offer",
              previousState,
              previousSummary,
              missingReason: "valid strategic output",
              question: "What should I help with first?",
            }),
          };
        } else {
          const nextSummary = mergeAdminChatSummary(previousSummary, buildSummaryFromOutput(parsedStrategic));
          const assistantMessage = formatStrategicAssistantMessage(parsedStrategic);
          const nextState = buildNextAdminChatState(previousState, parsedStrategic);
          output = {
            assistant_message: assistantMessage,
            suggestions: normalizeSchemaSuggestions(parsedStrategic.suggestions ?? []),
            actions: [],
            escalated: false,
            unknown: Boolean(parsedStrategic.unknown),
            outputMode,
            schemaFailed: false,
            playbook: parsedStrategic.playbook,
            statePatch: {
              admin_chat_state_v1: nextState,
              admin_chat_summary_v1: nextSummary,
            },
          };
        }
      } else {
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
      }
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
      if (strategicEnabled) {
        output.statePatch = buildFallbackStrategicPatch({
          playbook: playbook ?? "core_offer",
          previousState,
          previousSummary,
          missingReason: "valid strategic output",
          question: "What should I help with first?",
        });
      }
    }

    const actionResults: ToolActionResult[] = [];
    if (output.actions && output.actions.length > 0) {
      for (const action of output.actions) {
        try {
          const result = await executeToolAction({
            tool: { type: action.type, payload: normalizeActionPayload(action.payload) },
            supabase: opts.supabase,
            agencyId: opts.agencyId,
            userId: opts.userId,
          });
          actionResults.push({ type: action.type, ...result });
          if (!result.success) {
            console.warn("admin_chat_tool_failed", { tool: action.type, error: result.error });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          actionResults.push({ type: action.type, success: false, error: message });
          console.error("admin_chat_tool_exception", { tool: action.type, error: message });
        }
      }
    }

    if (actionResults.length > 0) {
      const summary = buildActionSummary(actionResults);
      if (summary) {
        output.assistant_message = `${output.assistant_message}\n\n${summary}`;
      }
      console.info("admin_chat_tool_results", {
        agency_id: opts.agencyId,
        user_id: opts.userId,
        results: actionResults,
      });
    }

    const latencyMs = Date.now() - startTime;
    const metadata: Record<string, unknown> = {
      admin_chat_output_mode: outputMode,
    };
    if (strategicEnabled) {
      metadata.admin_chat_prompt_version = 1;
      metadata.admin_chat_playbook = output.playbook ?? playbook ?? null;
    }
    if (schemaFailed) {
      metadata.admin_chat_schema_failed = true;
    }
    if (actionResults.length > 0) {
      metadata.admin_chat_tool_results = actionResults;
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
      promptVersion: strategicEnabled ? 1 : undefined,
    });

    return {
      assistant_message: output.assistant_message,
      suggestions: output.suggestions ?? [],
      actions: output.actions ?? [],
      escalated: output.escalated ?? false,
      unknown: output.unknown ?? false,
      outputMode,
      schemaFailed,
      playbook: output.playbook,
      statePatch: output.statePatch,
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

  const ragSnippets = await fetchAgencyRagSnippets({
    supabase: opts.supabase,
    agencyId: opts.agencyId,
    query: opts.message,
  });
  const ragContext = formatRagSnippets(ragSnippets);

  return runAiTaskStream({
    task_type: TaskType.AGENCY_ADMIN_GENERAL_CHAT,
    mode,
    tenant: { agency_id: opts.agencyId, user_id: opts.userId },
    input: { message: opts.message },
    metadata: {
      contextSnapshot: opts.snapshot,
      conversation: opts.conversation,
      latestUserMessage: opts.message,
      ragContext,
    },
    supabase: opts.supabase,
  });
}

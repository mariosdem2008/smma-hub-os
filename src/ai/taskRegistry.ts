import { buildAdminSetupGuidedPrompt } from "./prompts/adminSetupGuided.ts"
import { buildAdminGeneralChatPrompt } from "./prompts/adminGeneralChat.ts"
import { buildAdminSetupExtractPrompt } from "./prompts/adminSetupExtract.ts"
import { buildChatGeneralPrompt } from "./prompts/chatGeneral.ts"
import { buildClassifyIntentPrompt } from "./prompts/classifyIntent.ts"
import { buildClientPortalQaPrompt } from "./prompts/clientPortalQa.ts"
import { buildContentIdeasPrompt } from "./prompts/contentIdeas.ts"
import { buildExtractStructuredPrompt } from "./prompts/extractStructured.ts"
import { buildOnboardingAudiencePrompt, buildOnboardingDifferentiatorsPrompt, buildOnboardingOffersPrompt } from "./prompts/onboardingGuide.ts"
import { buildStrategyPlanPrompt } from "./prompts/strategyPlan.ts"
import { buildSummarizePrompt } from "./prompts/summarize.ts"
import { buildToolExecutionPrompt } from "./prompts/toolExecution.ts"
import { resolveModelPolicy } from "./modelPolicy.ts"
import { arraySchema, objectSchema, OutputSchema } from "./schema.ts"
import { TaskType } from "./taskTypes.ts"
import type { ChatMessage } from "./providers/types.ts"

export type SafetyMode = "strict_unknown" | "normal";
export type OutputMode = "freeform" | "json_schema" | "embedding";

export type BrainRequirements = {
  agency: boolean;
  client: boolean;
};

export type PromptBuilderArgs = {
  input?: string;
  metadata?: Record<string, unknown>;
  brains?: {
    agency?: Record<string, unknown> | null;
    client?: Record<string, unknown> | null;
  };
};

type TaskConfigBase = {
  taskType: TaskType;
  outputMode: OutputMode;
  safetyMode: SafetyMode;
  promptBuilder?: (args: PromptBuilderArgs) => ChatMessage[];
  requires: BrainRequirements;
  usageEndpoint: string;
  buildUnknown?: (args: { reason: string }) => unknown;
};

type FreeformTaskConfig = TaskConfigBase & {
  outputMode: "freeform";
  freeformReason: string;
  schema?: undefined;
};

type JsonSchemaTaskConfig = TaskConfigBase & {
  outputMode: "json_schema";
  schema: OutputSchema<unknown>;
  freeformReason?: undefined;
};

type EmbeddingTaskConfig = TaskConfigBase & {
  outputMode: "embedding";
  schema?: undefined;
  freeformReason?: undefined;
};

export type TaskConfig = FreeformTaskConfig | JsonSchemaTaskConfig | EmbeddingTaskConfig;

const DEFAULT_UNKNOWN_RESPONSE = { answer: "UNKNOWN", unknown: true, questions: ["What additional context is required?"], confidence: 0 };

export const TASK_REGISTRY: Record<TaskType, TaskConfig> = {
  [TaskType.CHAT_GENERAL]: {
    taskType: TaskType.CHAT_GENERAL,
    outputMode: "freeform",
    freeformReason: "General chat returns conversational text without a rigid schema.",
    safetyMode: "normal",
    promptBuilder: (args) => buildChatGeneralPrompt({ input: args.input ?? "" }),
    requires: { agency: false, client: false },
    usageEndpoint: "ai-router",
  },
  [TaskType.CHAT_ADMIN_ONBOARDING]: {
    taskType: TaskType.CHAT_ADMIN_ONBOARDING,
    outputMode: "freeform",
    freeformReason: "Admin onboarding chat uses conversational replies for guided setup.",
    safetyMode: "strict_unknown",
    promptBuilder: (args) => buildChatGeneralPrompt({ input: args.input ?? "" }),
    requires: { agency: true, client: false },
    usageEndpoint: "ai-agency-admin-chat",
  },
  [TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2]: {
    taskType: TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2,
    outputMode: "json_schema",
    safetyMode: "strict_unknown",
    promptBuilder: (args) =>
      buildAdminSetupGuidedPrompt({
        agencyBrain: args.brains?.agency ?? {},
        conversation: (args.metadata?.conversation as string) ?? "",
        latestUserMessage: (args.metadata?.latestUserMessage as string) ?? "",
        contextSnapshot: (args.metadata?.contextSnapshot as Record<string, unknown>) ?? {},
      }),
    requires: { agency: true, client: false },
    usageEndpoint: "ai-agency-admin-chat",
    schema: objectSchema("agency_admin_setup_guided_v2", [
      "assistant_message",
      "expects",
      "choices",
      "suggestions",
      "progress_percent",
      "done",
      "memory_patch",
      "state",
    ]),
    buildUnknown: () => ({
      assistant_message: "What detail should we start with for your agency setup?",
      expects: "text",
      choices: [],
      suggestions: [],
      progress_percent: 0,
      done: false,
      memory_patch: {},
      state: {
        intent: "CLARIFICATION_REQUEST",
        pending_question_key: null,
        pending_question_text: null,
      },
    }),
  },
  [TaskType.AGENCY_ADMIN_GENERAL_CHAT]: {
    taskType: TaskType.AGENCY_ADMIN_GENERAL_CHAT,
    outputMode: "freeform",
    freeformReason: "Admin chat uses conversational output with suggestion parsing.",
    safetyMode: "strict_unknown",
    promptBuilder: (args) =>
      buildAdminGeneralChatPrompt({
        contextSnapshot: (args.metadata?.contextSnapshot as Record<string, unknown>) ?? {},
        conversation: (args.metadata?.conversation as string) ?? "",
        latestUserMessage: (args.metadata?.latestUserMessage as string) ?? "",
      }),
    requires: { agency: true, client: false },
    usageEndpoint: "ai-agency-admin-chat",
    buildUnknown: () => ({
      assistant_message: "UNKNOWN. I need more details to answer. What should I help with first?",
      suggestions: [],
    }),
  },
  [TaskType.AGENCY_ADMIN_SETUP_EXTRACT]: {
    taskType: TaskType.AGENCY_ADMIN_SETUP_EXTRACT,
    outputMode: "json_schema",
    safetyMode: "normal",
    promptBuilder: (args) =>
      buildAdminSetupExtractPrompt({
        questionKey: (args.metadata?.questionKey as string) ?? "",
        questionText: (args.metadata?.questionText as string) ?? "",
        targetPath: (args.metadata?.targetPath as string) ?? "",
        answer: args.input ?? "",
        contextSnapshot: (args.metadata?.contextSnapshot as Record<string, unknown>) ?? {},
      }),
    requires: { agency: true, client: false },
    usageEndpoint: "ai-agency-admin-chat",
    schema: objectSchema("agency_admin_setup_extract", ["value"]),
    buildUnknown: () => ({ value: null }),
  },
  [TaskType.CLIENT_PORTAL_QA]: {
    taskType: TaskType.CLIENT_PORTAL_QA,
    outputMode: "json_schema",
    safetyMode: "strict_unknown",
    promptBuilder: (args) =>
      buildClientPortalQaPrompt({
        question: args.input ?? "",
        context: (args.metadata?.context as string) ?? "",
      }),
    requires: { agency: false, client: false },
    usageEndpoint: "ai-ask",
    schema: objectSchema("client_portal_qa", ["answer", "unknown", "questions", "confidence"]),
    buildUnknown: () => DEFAULT_UNKNOWN_RESPONSE,
  },
  [TaskType.SUMMARIZE]: {
    taskType: TaskType.SUMMARIZE,
    outputMode: "freeform",
    freeformReason: "Report summarization produces narrative text for email/PDF rendering.",
    safetyMode: "normal",
    promptBuilder: (args) =>
      buildSummarizePrompt({
        input: args.input ?? "",
        systemPrompt: (args.metadata?.systemPrompt as string) ?? undefined,
      }),
    requires: { agency: false, client: false },
    usageEndpoint: "generate-monthly-report",
  },
  [TaskType.EXTRACT_STRUCTURED]: {
    taskType: TaskType.EXTRACT_STRUCTURED,
    outputMode: "json_schema",
    safetyMode: "strict_unknown",
    promptBuilder: (args) =>
      buildExtractStructuredPrompt({
        input: args.input ?? "",
        instructions: (args.metadata?.instructions as string) ?? undefined,
      }),
    requires: { agency: false, client: false },
    usageEndpoint: "ai-router",
    schema: arraySchema("extract_structured"),
    buildUnknown: () => DEFAULT_UNKNOWN_RESPONSE,
  },
  [TaskType.CLASSIFY_INTENT]: {
    taskType: TaskType.CLASSIFY_INTENT,
    outputMode: "json_schema",
    safetyMode: "normal",
    promptBuilder: (args) => buildClassifyIntentPrompt({ input: args.input ?? "" }),
    requires: { agency: false, client: false },
    usageEndpoint: "ai-router",
    schema: objectSchema("classify_intent", ["intent"]),
  },
  [TaskType.STRATEGY_PLAN]: {
    taskType: TaskType.STRATEGY_PLAN,
    outputMode: "json_schema",
    safetyMode: "strict_unknown",
    promptBuilder: (args) =>
      buildStrategyPlanPrompt({
        agencyBrain: args.brains?.agency ?? {},
        clientBrain: args.brains?.client ?? {},
        context: (args.metadata?.context as string) ?? "",
      }),
    requires: { agency: true, client: true },
    usageEndpoint: "ai-strategy-generate",
    schema: objectSchema("strategy_plan", ["summary", "sections"]),
    buildUnknown: () => ({ unknown: true, missing_fields: [], questions: ["What additional context is required?"], escalation: false }),
  },
  [TaskType.CONTENT_IDEAS]: {
    taskType: TaskType.CONTENT_IDEAS,
    outputMode: "json_schema",
    safetyMode: "normal",
    promptBuilder: (args) =>
      buildContentIdeasPrompt({
        mode: (args.metadata?.mode as any) ?? "ideas",
        platform: (args.metadata?.platform as string) ?? undefined,
        brandContext: (args.metadata?.brand_context as string) ?? undefined,
        inputText: (args.metadata?.input_text as string) ?? undefined,
      }),
    requires: { agency: false, client: false },
    usageEndpoint: "generate-ai-content",
    schema: arraySchema("content_ideas"),
  },
  [TaskType.SCRIPT_WRITING]: {
    taskType: TaskType.SCRIPT_WRITING,
    outputMode: "json_schema",
    safetyMode: "normal",
    promptBuilder: (args) =>
      buildContentIdeasPrompt({
        mode: "script",
        platform: (args.metadata?.platform as string) ?? undefined,
        brandContext: (args.metadata?.brand_context as string) ?? undefined,
        inputText: (args.metadata?.input_text as string) ?? undefined,
      }),
    requires: { agency: false, client: false },
    usageEndpoint: "generate-ai-content",
    schema: arraySchema("script_writing"),
  },
  [TaskType.TOOL_EXECUTION]: {
    taskType: TaskType.TOOL_EXECUTION,
    outputMode: "json_schema",
    safetyMode: "normal",
    promptBuilder: (args) => buildToolExecutionPrompt({ input: args.input ?? "" }),
    requires: { agency: false, client: false },
    usageEndpoint: "ai-router",
    schema: objectSchema("tool_execution", []),
  },
  [TaskType.EMBED_TEXT]: {
    taskType: TaskType.EMBED_TEXT,
    outputMode: "embedding",
    safetyMode: "normal",
    requires: { agency: false, client: false },
    usageEndpoint: "ai-embeddings",
  },
};

export function getTaskConfig(taskType: TaskType): TaskConfig {
  return TASK_REGISTRY[taskType];
}

export function resolveTaskModel(taskType: TaskType, env?: "dev" | "prod") {
  return resolveModelPolicy({ taskType, environment: env });
}

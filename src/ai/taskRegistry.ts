import { buildAdminSetupGuidedPrompt } from "./prompts/adminSetupGuided.ts"
import { buildAdminGeneralChatPrompt } from "./prompts/adminGeneralChat.ts"
import { buildAdminSetupExtractPrompt } from "./prompts/adminSetupExtract.ts"
import { buildChatGeneralPrompt } from "./prompts/chatGeneral.ts"
import { buildClassifyIntentPrompt } from "./prompts/classifyIntent.ts"
import { buildClientPortalQaPrompt } from "./prompts/clientPortalQa.ts"
import { buildContentIdeasPrompt } from "./prompts/contentIdeas.ts"
import { buildExtractStructuredPrompt } from "./prompts/extractStructured.ts"
import { buildOnboardingAnswerCheckPrompt } from "./prompts/onboardingAnswerCheck.ts"
import { buildOnboardingClarifyPrompt } from "./prompts/onboardingClarify.ts"
import { buildOnboardingAudiencePrompt, buildOnboardingDifferentiatorsPrompt, buildOnboardingOffersPrompt } from "./prompts/onboardingGuide.ts"
import { buildPlannerPrompt } from "./prompts/planner.ts"
import { buildStrategyDiagnosisPrompt } from "./prompts/strategyDiagnosis.ts"
import { buildStrategyPlanPrompt } from "./prompts/strategyPlan.ts"
import { buildStrategyRecommendationPrompt } from "./prompts/strategyRecommendation.ts"
import { buildSummarizePrompt } from "./prompts/summarize.ts"
import { buildToolExecutionPrompt } from "./prompts/toolExecution.ts"
import { resolveModelPolicy } from "./modelPolicy.ts"
import { adminChatSchema, adminChatStrategicSchema, aiAssistantSchema, arraySchema, intentResultSchema, objectSchema, onboardingAnswerCheckSchema, onboardingClarifySchema, planSchemaV1, OutputSchema } from "./schema.ts"
import { TaskType } from "./taskTypes.ts"
import type { ChatMessage } from "./providers/types.ts"
import { strategyDiagnosisSchema, strategyRecommendationSchema } from "../lib/strategy/v2/contracts.ts"

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

function readEnvFlag(name: string) {
  if (typeof Deno !== "undefined" && typeof (Deno as any)?.env?.get === "function") {
    return (Deno as any).env.get(name) as string | undefined;
  }
  if (typeof process !== "undefined") {
    return process.env[name];
  }
  return undefined;
}

function isAdminChatSchemaEnabled() {
  return readEnvFlag("AI_ADMIN_CHAT_SCHEMA") === "true";
}

function isAdminChatStrategicEnabled() {
  return readEnvFlag("AI_ADMIN_CHAT_STRATEGIC") === "true";
}

const ADMIN_CHAT_SCHEMA_CONFIG: TaskConfig = {
  taskType: TaskType.AGENCY_ADMIN_GENERAL_CHAT,
  outputMode: "json_schema",
  safetyMode: "strict_unknown",
  promptBuilder: (args) =>
    buildAdminGeneralChatPrompt({
      contextSnapshot: (args.metadata?.contextSnapshot as Record<string, unknown>) ?? {},
      conversation: (args.metadata?.conversation as string) ?? "",
      latestUserMessage: (args.metadata?.latestUserMessage as string) ?? "",
      outputMode: "schema",
    }),
  requires: { agency: true, client: false },
  usageEndpoint: "ai-agency-admin-chat",
  schema: adminChatSchema(),
  buildUnknown: () => ({
    assistant_message: "UNKNOWN. I need more details to answer. What should I help with first?",
    suggestions: [],
    actions: [],
    escalated: false,
    unknown: true,
  }),
};

const ADMIN_CHAT_STRATEGIC_CONFIG: TaskConfig = {
  taskType: TaskType.AGENCY_ADMIN_GENERAL_CHAT,
  outputMode: "json_schema",
  safetyMode: "strict_unknown",
  promptBuilder: (args) =>
    buildAdminGeneralChatPrompt({
      contextSnapshot: (args.metadata?.contextSnapshot as Record<string, unknown>) ?? {},
      conversation: (args.metadata?.conversation as string) ?? "",
      latestUserMessage: (args.metadata?.latestUserMessage as string) ?? "",
      outputMode: "strategic",
      ragContext: (args.metadata?.ragContext as string | undefined) ?? undefined,
      contextBlob: (args.metadata?.contextBlob as Record<string, unknown> | undefined) ?? undefined,
      playbook: (args.metadata?.playbook as any) ?? undefined,
    }),
  requires: { agency: true, client: false },
  usageEndpoint: "ai-agency-admin-chat",
  schema: adminChatStrategicSchema(),
  buildUnknown: () => ({
    playbook: "core_offer",
    clarifying_questions: [],
    assumptions: [],
    core_offer: null,
    strategy: null,
    copywriting: null,
    unknown: { missing: ["context"], question: "What should I help with first?" },
    suggestions: [],
  }),
};

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
        outputMode: "legacy",
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
    schema: intentResultSchema(),
  },
  [TaskType.PLANNER]: {
    taskType: TaskType.PLANNER,
    outputMode: "json_schema",
    safetyMode: "normal",
    promptBuilder: (args) =>
      buildPlannerPrompt({
        input: args.input ?? "",
        intent: (args.metadata?.intent as string | undefined) ?? undefined,
      }),
    requires: { agency: false, client: false },
    usageEndpoint: "ai-router",
    schema: planSchemaV1(),
  },
  [TaskType.STRATEGY_PLAN]: {
    taskType: TaskType.STRATEGY_PLAN,
    outputMode: "json_schema",
    safetyMode: "strict_unknown",
    promptBuilder: (args) =>
      buildStrategyPlanPrompt({
        agencyBrain: args.brains?.agency ?? {},
        clientBrain: (args.metadata?.client_brain as any) ?? args.brains?.client ?? {},
        context: (args.metadata?.context as string) ?? "",
        instruction: (args.metadata?.instruction as string | undefined) ?? undefined,
      }),
    requires: { agency: false, client: false },
    usageEndpoint: "ai-strategy-generate",
    schema: objectSchema("strategy_plan", ["summary", "sections"]),
    buildUnknown: ({ reason }) => ({
      unknown: true,
      reason,
      missing_fields: [],
      questions: ["What additional context is required?"],
      escalation: false,
    }),
  },
  [TaskType.STRATEGY_DIAGNOSIS]: {
    taskType: TaskType.STRATEGY_DIAGNOSIS,
    outputMode: "json_schema",
    safetyMode: "strict_unknown",
    promptBuilder: (args) =>
      buildStrategyDiagnosisPrompt({
        context: (args.metadata?.context as string) ?? "",
      }),
    requires: { agency: false, client: false },
    usageEndpoint: "ai-strategy-generate",
    schema: strategyDiagnosisSchema(),
    buildUnknown: ({ reason }) => ({
      unknown: true,
      reason,
      questions: ["What additional client context is required before diagnosis can continue?"],
    }),
  },
  [TaskType.STRATEGY_RECOMMENDATION]: {
    taskType: TaskType.STRATEGY_RECOMMENDATION,
    outputMode: "json_schema",
    safetyMode: "strict_unknown",
    promptBuilder: (args) =>
      buildStrategyRecommendationPrompt({
        context: (args.metadata?.context as string) ?? "",
      }),
    requires: { agency: false, client: false },
    usageEndpoint: "ai-strategy-generate",
    schema: strategyRecommendationSchema(),
    buildUnknown: ({ reason }) => ({
      unknown: true,
      reason,
      questions: ["What additional client or agency context is required before recommendation can continue?"],
    }),
  },
  [TaskType.AI_ASSISTANT]: {
    taskType: TaskType.AI_ASSISTANT,
    outputMode: "json_schema",
    safetyMode: "strict_unknown",
    // Messages are usually provided by the edge function (chat + on-demand context).
    promptBuilder: () => [],
    requires: { agency: true, client: true },
    usageEndpoint: "ai-assistant",
    schema: aiAssistantSchema(),
    buildUnknown: ({ reason }) => ({
      assistant_message: reason ? `UNKNOWN (${reason}). What should I help with?` : "UNKNOWN. What should I help with?",
      proposals: [],
      unknown: true,
      confidence: 0,
    }),
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
  [TaskType.ONBOARDING_ANSWER_CHECK]: {
    taskType: TaskType.ONBOARDING_ANSWER_CHECK,
    outputMode: "json_schema",
    safetyMode: "strict_unknown",
    promptBuilder: (args) =>
      buildOnboardingAnswerCheckPrompt({
        questionText: (args.metadata?.questionText as string) ?? "",
        fieldPath: (args.metadata?.fieldPath as string) ?? "",
        inputType: (args.metadata?.inputType as string) ?? "text",
        priority: (args.metadata?.priority as string) ?? "P1",
        examples: (args.metadata?.examples as string[]) ?? [],
        answer: args.input ?? "",
      }),
    requires: { agency: true, client: false },
    usageEndpoint: "ai-onboarding",
    schema: onboardingAnswerCheckSchema(),
    buildUnknown: ({ reason }) => ({
      decision: "accept",
      follow_up: "",
      reason: reason ?? "unknown",
      confidence: 0,
    }),
  },
  [TaskType.ONBOARDING_CLARIFY]: {
    taskType: TaskType.ONBOARDING_CLARIFY,
    outputMode: "json_schema",
    safetyMode: "strict_unknown",
    promptBuilder: (args) =>
      buildOnboardingClarifyPrompt({
        questionText: (args.metadata?.questionText as string) ?? "",
        fieldPath: (args.metadata?.fieldPath as string) ?? "",
        inputType: (args.metadata?.inputType as string) ?? "text",
        priority: (args.metadata?.priority as string) ?? "P1",
        examples: (args.metadata?.examples as string[]) ?? [],
        userMessage: args.input ?? "",
        whyNeeded: (args.metadata?.whyNeeded as string) ?? "",
        impact: (args.metadata?.impact as string) ?? "",
      }),
    requires: { agency: true, client: false },
    usageEndpoint: "ai-onboarding",
    schema: onboardingClarifySchema(),
    buildUnknown: ({ reason }) => ({
      mode: "follow_up",
      follow_up_text: "Can you share a bit more detail so I can capture it correctly?",
      clarification_text: reason ?? "This helps me personalize your agency brain.",
      confidence: 0,
    }),
  },
};

export function getTaskConfig(taskType: TaskType): TaskConfig {
  if (taskType === TaskType.AGENCY_ADMIN_GENERAL_CHAT && isAdminChatStrategicEnabled()) {
    return ADMIN_CHAT_STRATEGIC_CONFIG;
  }
  if (taskType === TaskType.AGENCY_ADMIN_GENERAL_CHAT && isAdminChatSchemaEnabled()) {
    return ADMIN_CHAT_SCHEMA_CONFIG;
  }
  return TASK_REGISTRY[taskType];
}

export function resolveTaskModel(taskType: TaskType, env?: "dev" | "prod") {
  return resolveModelPolicy({ taskType, environment: env });
}

import { TaskType } from "./taskTypes.ts"
import { getEnvVar } from "./utils.ts"
import type {
  EnvMode,
  ModelParams,
  ModelSelection,
  ModelSelectionInput,
  PlanTier,
  Provider,
  QualityTier,
} from "./modelTypes.ts"

type BaseModelConfig = {
  provider: Provider
  model: string
  params?: ModelParams
}

type TaskModelPolicy = {
  dev: BaseModelConfig
  prod: BaseModelConfig
  legacyModelEnv?: string
  qualityTierOverrides?: Partial<Record<QualityTier, Partial<BaseModelConfig>>>
}

/**
 * COST / QUALITY NOTES
 * - Text models change frequently across providers; prefer per-task overrides for production.
 * - Gemini 1.5 models were shut down in 2025; use `gemini-flash-latest` or a specific 2.x/3.x model.
 * - Embeddings should use a stable, widely available model with known dimensionality.
 */

// Default text model/provider should be broadly available.
const DEFAULT_TEXT_MODEL = "gpt-4o-mini";
const DEFAULT_STRATEGY_MODEL = "gemini-flash-latest";
const DEFAULT_EMBED_MODEL = "text-embedding-3-small";

const DEFAULT_POLICIES: Record<TaskType, TaskModelPolicy> = {
  [TaskType.CHAT_GENERAL]: {
    dev: { provider: "openai", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.4 } },
    prod: { provider: "openai", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.4 } },
  },

  [TaskType.CHAT_ADMIN_ONBOARDING]: {
    dev: { provider: "openai", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
    prod: { provider: "openai", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
  },

  [TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2]: {
    dev: { provider: "openai", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2, max_tokens: 350 } },
    prod: { provider: "openai", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2, max_tokens: 350 } },
  },

  [TaskType.AGENCY_ADMIN_GENERAL_CHAT]: {
    dev: { provider: "openai", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.4 } },
    prod: { provider: "openai", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.4 } },
  },

  [TaskType.AGENCY_ADMIN_SETUP_EXTRACT]: {
    dev: { provider: "openai", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.1 } },
    prod: { provider: "openai", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.1 } },
  },

  [TaskType.CLIENT_PORTAL_QA]: {
    dev: { provider: "openai", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
    prod: { provider: "openai", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
    legacyModelEnv: "RAG_MODEL_ID",
  },

  [TaskType.SUMMARIZE]: {
    dev: { provider: "openai", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
    prod: { provider: "openai", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
  },

  [TaskType.EXTRACT_STRUCTURED]: {
    dev: { provider: "openai", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.1 } },
    prod: { provider: "openai", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.1 } },
  },

  [TaskType.CLASSIFY_INTENT]: {
    dev: { provider: "openai", model: DEFAULT_TEXT_MODEL, params: { temperature: 0, max_tokens: 120 } },
    prod: { provider: "openai", model: DEFAULT_TEXT_MODEL, params: { temperature: 0, max_tokens: 120 } },
  },

  [TaskType.PLANNER]: {
    dev: { provider: "openai", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.1, max_tokens: 160 } },
    prod: { provider: "openai", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.1, max_tokens: 160 } },
  },

  [TaskType.STRATEGY_PLAN]: {
    dev: { provider: "gemini", model: DEFAULT_STRATEGY_MODEL, params: { temperature: 0.2 } },
    prod: { provider: "gemini", model: DEFAULT_STRATEGY_MODEL, params: { temperature: 0.2 } },
    legacyModelEnv: "STRATEGY_MODEL_ID",
  },

  [TaskType.AI_ASSISTANT]: {
    dev: { provider: "gemini", model: DEFAULT_STRATEGY_MODEL, params: { temperature: 0.3 } },
    prod: { provider: "gemini", model: DEFAULT_STRATEGY_MODEL, params: { temperature: 0.3 } },
  },

  [TaskType.CONTENT_IDEAS]: {
    dev: { provider: "openai", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.8 } },
    prod: { provider: "openai", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.8 } },
  },

  [TaskType.SCRIPT_WRITING]: {
    dev: { provider: "openai", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.8 } },
    prod: { provider: "openai", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.8 } },
  },

  [TaskType.TOOL_EXECUTION]: {
    dev: { provider: "openai", model: DEFAULT_TEXT_MODEL, params: { temperature: 0 } },
    prod: { provider: "openai", model: DEFAULT_TEXT_MODEL, params: { temperature: 0 } },
  },

  [TaskType.EMBED_TEXT]: {
    dev: { provider: "openai", model: DEFAULT_EMBED_MODEL },
    prod: { provider: "openai", model: DEFAULT_EMBED_MODEL },
    legacyModelEnv: "EMBEDDING_MODEL_ID",
  },
  [TaskType.ONBOARDING_ANSWER_CHECK]: {
    dev: { provider: "gemini", model: DEFAULT_STRATEGY_MODEL, params: { temperature: 0.1, max_tokens: 160 } },
    prod: { provider: "gemini", model: DEFAULT_STRATEGY_MODEL, params: { temperature: 0.1, max_tokens: 160 } },
  },
  [TaskType.ONBOARDING_CLARIFY]: {
    dev: { provider: "gemini", model: DEFAULT_STRATEGY_MODEL, params: { temperature: 0.3, max_tokens: 220 } },
    prod: { provider: "gemini", model: DEFAULT_STRATEGY_MODEL, params: { temperature: 0.3, max_tokens: 220 } },
  },
}

const DEFAULT_MODE: EnvMode = "dev"
const DEFAULT_PLAN: PlanTier = "free"

function readEnv(key: string): string | undefined {
  const value = getEnvVar(key)
  if (!value) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function resolveMode(mode?: EnvMode): EnvMode {
  if (mode === "prod" || mode === "dev") return mode
  const envMode = readEnv("AI_MODE")
  return envMode === "prod" ? "prod" : envMode === "dev" ? "dev" : DEFAULT_MODE
}

function resolveProviderOverride(taskType: TaskType, mode: EnvMode): Provider | undefined {
  const perTask = readEnv(`AI_PROVIDER__${taskType}__${mode}`) ?? readEnv(`AI_PROVIDER__${taskType}`);
  const perMode = readEnv(`AI_PROVIDER__${mode}`);
  const global = readEnv("AI_PROVIDER");

  if (taskType === TaskType.EMBED_TEXT) {
    return perTask as Provider | undefined;
  }

  // Strategy tasks are intentionally pinned to their defaults (Gemini) and should not be
  // accidentally overridden by global provider env vars in production.
  // If you need to override these, use per-task env vars (AI_PROVIDER__TASKTYPE...).
  if (
    taskType === TaskType.STRATEGY_PLAN ||
    taskType === TaskType.AI_ASSISTANT
  ) {
    return perTask as Provider | undefined;
  }

  return (perTask ?? perMode ?? global) as Provider | undefined;
}

function resolveModelOverride(taskType: TaskType, mode: EnvMode, legacyModelEnv?: string): string | undefined {
  const perTask = readEnv(`AI_MODEL__${taskType}__${mode}`) ?? readEnv(`AI_MODEL__${taskType}`);
  const legacy = legacyModelEnv ? readEnv(legacyModelEnv) : undefined;

  // Same pinning rule as provider: avoid global text model overrides impacting strategy tasks.
  if (
    taskType === TaskType.STRATEGY_PLAN ||
    taskType === TaskType.AI_ASSISTANT
  ) {
    return perTask ?? legacy;
  }

  return perTask ??
    legacy ??
    (taskType === TaskType.EMBED_TEXT ? undefined : readEnv("AI_TEXT_MODEL_DEFAULT")) ??
    readEnv(`AI_MODEL__${mode}`) ??
    readEnv("AI_MODEL")
}

export function getQualityTierForPlan(planTier: PlanTier = DEFAULT_PLAN, mode?: EnvMode): QualityTier {
  const resolvedMode = resolveMode(mode)
  if (resolvedMode === "dev") return "cheap"
  switch (planTier) {
    case "free":
      return "cheap"
    case "starter":
    case "growth":
      return "standard"
    case "pro":
      return "premium"
    default:
      return "standard"
  }
}

export function getModelForTask(input: ModelSelectionInput): ModelSelection {
  const policy = DEFAULT_POLICIES[input.taskType]
  if (!policy) throw new Error(`Unknown task type: ${input.taskType}`)

  const mode = resolveMode(input.mode)
  const planTier = input.planTier ?? DEFAULT_PLAN
  const qualityTier = getQualityTierForPlan(planTier, mode)
  const baseDefaults = policy[mode]

  const qualityOverride = policy.qualityTierOverrides?.[qualityTier]
  const base: BaseModelConfig = {
    provider: qualityOverride?.provider ?? baseDefaults.provider,
    model: qualityOverride?.model ?? baseDefaults.model,
    params: qualityOverride?.params ?? baseDefaults.params,
  }

  const providerOverride = resolveProviderOverride(input.taskType, mode)
  const modelOverride = resolveModelOverride(input.taskType, mode, policy.legacyModelEnv)

  return {
    provider: providerOverride ?? input.preferredProvider ?? base.provider,
    model: modelOverride ?? base.model,
    params: base.params,
    qualityTier,
  }
}

export function resolveModelPolicy({
  taskType,
  environment,
}: {
  taskType: TaskType
  environment?: EnvMode
}): ModelSelection {
  return getModelForTask({ taskType, mode: environment })
}

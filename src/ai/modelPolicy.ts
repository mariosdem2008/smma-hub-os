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
 * COST / QUALITY NOTES (Standard pricing reference)
 * - gemini-1.5-flash: fastest + lower cost for most text tasks
 * - gemini-1.5-pro: higher quality when needed
 *
 * If you need a different model, set env overrides per task.
 */

const DEFAULT_TEXT_MODEL = "gemini-1.5-flash";

const DEFAULT_POLICIES: Record<TaskType, TaskModelPolicy> = {
  [TaskType.CHAT_GENERAL]: {
    dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.4 } },
    prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.4 } },
  },

  [TaskType.CHAT_ADMIN_ONBOARDING]: {
    dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
    prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
  },

  [TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2]: {
    dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.3 } },
    prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.3 } },
  },

  [TaskType.AGENCY_ADMIN_GENERAL_CHAT]: {
    dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.4 } },
    prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.4 } },
  },

  [TaskType.AGENCY_ADMIN_SETUP_EXTRACT]: {
    dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.1 } },
    prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.1 } },
  },

  [TaskType.CLIENT_PORTAL_QA]: {
    dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
    prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
    legacyModelEnv: "RAG_MODEL_ID",
  },

  [TaskType.SUMMARIZE]: {
    dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
    prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
  },

  [TaskType.EXTRACT_STRUCTURED]: {
    dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.1 } },
    prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.1 } },
  },

  [TaskType.CLASSIFY_INTENT]: {
    dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0 } },
    prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0 } },
  },

  [TaskType.STRATEGY_PLAN]: {
    dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
    prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
    legacyModelEnv: "STRATEGY_MODEL_ID",
  },

  [TaskType.CONTENT_IDEAS]: {
    dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.8 } },
    prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.8 } },
  },

  [TaskType.SCRIPT_WRITING]: {
    dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.8 } },
    prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.8 } },
  },

  [TaskType.TOOL_EXECUTION]: {
    dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0 } },
    prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0 } },
  },

  [TaskType.EMBED_TEXT]: {
    dev: { provider: "openai", model: "text-embedding-3-small" },
    prod: { provider: "openai", model: "text-embedding-3-small" },
    legacyModelEnv: "EMBEDDING_MODEL_ID",
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

  return (perTask ?? perMode ?? global) as Provider | undefined;
}

function resolveModelOverride(taskType: TaskType, mode: EnvMode, legacyModelEnv?: string): string | undefined {
  return (
    readEnv(`AI_MODEL__${taskType}__${mode}`) ??
    readEnv(`AI_MODEL__${taskType}`) ??
    (legacyModelEnv ? readEnv(legacyModelEnv) : undefined) ??
    (taskType === TaskType.EMBED_TEXT ? undefined : readEnv("AI_TEXT_MODEL_DEFAULT")) ??
    readEnv(`AI_MODEL__${mode}`) ??
    readEnv("AI_MODEL")
  )
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

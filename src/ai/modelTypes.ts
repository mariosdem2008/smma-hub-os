import { TaskType } from "./taskTypes.ts"

export type Provider = "openai" | "anthropic";
export type EnvMode = "dev" | "prod";
export type PlanTier = "free" | "starter" | "growth" | "pro";
export type QualityTier = "cheap" | "standard" | "premium";

export type ModelParams = {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
};

export type ModelSelection = {
  provider: Provider;
  model: string;
  params?: ModelParams;
  qualityTier: QualityTier;
};

export type ModelSelectionInput = {
  taskType: TaskType;
  mode?: EnvMode;
  planTier?: PlanTier;
  preferredProvider?: Provider;
};

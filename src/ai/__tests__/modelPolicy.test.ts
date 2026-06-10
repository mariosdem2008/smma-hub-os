import { afterEach, describe, expect, it } from "vitest";
import { getModelForTask } from "../modelPolicy.ts"
import { TaskType } from "../taskTypes.ts"

const ENV_KEYS = [
  "AI_MODE",
  "AI_PROVIDER",
  "AI_MODEL",
  "AI_PROVIDER__dev",
  "AI_MODEL__dev",
  "AI_PROVIDER__prod",
  "AI_MODEL__prod",
  "AI_PROVIDER__CHAT_GENERAL",
  "AI_MODEL__CHAT_GENERAL",
  "AI_PROVIDER__CHAT_GENERAL__dev",
  "AI_MODEL__CHAT_GENERAL__dev",
  "AI_PROVIDER__CHAT_GENERAL__prod",
  "AI_MODEL__CHAT_GENERAL__prod",
  "AI_MODEL__TOOL_EXECUTION__prod",
  "AI_PROVIDER__STRATEGY_PLAN",
  "AI_MODEL__STRATEGY_PLAN",
  "AI_PROVIDER__AI_ASSISTANT",
  "AI_MODEL__AI_ASSISTANT",
  "AI_PROVIDER__ANSWER_QUALITY_CHECK",
  "AI_MODEL__ANSWER_QUALITY_CHECK",
  "AI_TEXT_MODEL_DEFAULT",
];

function clearEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

afterEach(() => {
  clearEnv();
});

describe("model policy", () => {
  it("defaults match current models for each task", () => {
    const defaults = {
      [TaskType.CHAT_GENERAL]: { dev: "gpt-4o-mini", prod: "gpt-4o-mini" },
      [TaskType.CHAT_ADMIN_ONBOARDING]: { dev: "gpt-4o-mini", prod: "gpt-4o-mini" },
      [TaskType.CLIENT_PORTAL_QA]: { dev: "gpt-4o-mini", prod: "gpt-4o-mini" },
      [TaskType.SUMMARIZE]: { dev: "gpt-4o-mini", prod: "gpt-4o-mini" },
      [TaskType.EXTRACT_STRUCTURED]: { dev: "gpt-4o-mini", prod: "gpt-4o-mini" },
      [TaskType.CLASSIFY_INTENT]: { dev: "gpt-4o-mini", prod: "gpt-4o-mini" },
      [TaskType.STRATEGY_PLAN]: { dev: "gemini-flash-latest", prod: "gemini-flash-latest" },
      [TaskType.AI_ASSISTANT]: { dev: "gemini-flash-latest", prod: "gemini-flash-latest" },
      [TaskType.CONTENT_IDEAS]: { dev: "gpt-4o-mini", prod: "gpt-4o-mini" },
      [TaskType.SCRIPT_WRITING]: { dev: "gpt-4o-mini", prod: "gpt-4o-mini" },
      [TaskType.TOOL_EXECUTION]: { dev: "gpt-4o-mini", prod: "gpt-4o-mini" },
      [TaskType.ANSWER_QUALITY_CHECK]: { dev: "qwen2.5:7b-instruct", prod: "qwen2.5:7b-instruct" },
    } as const;

    for (const [taskType, expected] of Object.entries(defaults)) {
      const devResult = getModelForTask({
        taskType: taskType as TaskType,
        mode: "dev",
        planTier: "free",
      });
      expect(devResult.model).toBe(expected.dev);

      const prodResult = getModelForTask({
        taskType: taskType as TaskType,
        mode: "prod",
        planTier: "free",
      });
      expect(prodResult.model).toBe(expected.prod);
    }
  });

  it("selects DEV mapping when AI_MODE=dev", () => {
    process.env.AI_MODE = "dev";
    const result = getModelForTask({ taskType: TaskType.TOOL_EXECUTION, planTier: "pro" });
    expect(result.model).toBe("gpt-4o-mini");
  });

  it("selects PROD mapping when AI_MODE=prod", () => {
    process.env.AI_MODE = "prod";
    const result = getModelForTask({ taskType: TaskType.TOOL_EXECUTION, planTier: "pro" });
    expect(result.model).toBe("gpt-4o-mini");
  });

  it("defaults to openai for text + embeddings, except strategy plan", () => {
    const text = getModelForTask({ taskType: TaskType.SUMMARIZE, mode: "prod", planTier: "free" });
    expect(text.provider).toBe("openai");

    const embed = getModelForTask({ taskType: TaskType.EMBED_TEXT, mode: "prod", planTier: "free" });
    expect(embed.provider).toBe("openai");

    const strategy = getModelForTask({ taskType: TaskType.STRATEGY_PLAN, mode: "prod", planTier: "free" });
    expect(strategy.provider).toBe("gemini");

    const grader = getModelForTask({ taskType: TaskType.ANSWER_QUALITY_CHECK, mode: "prod", planTier: "free" });
    expect(grader.provider).toBe("openai");
    expect(grader.model).toBe("qwen2.5:7b-instruct");
  });

  it("does not allow global provider/model overrides to change strategy tasks", () => {
    process.env.AI_PROVIDER = "openai";
    process.env.AI_MODEL = "gpt-4o-mini-2024-07-18";
    process.env.AI_TEXT_MODEL_DEFAULT = "gpt-4o-mini-2024-07-18";

    const chat = getModelForTask({ taskType: TaskType.CHAT_GENERAL, mode: "prod", planTier: "free" });
    expect(chat.provider).toBe("openai");
    expect(chat.model).toBe("gpt-4o-mini-2024-07-18");

    const strategyPlan = getModelForTask({ taskType: TaskType.STRATEGY_PLAN, mode: "prod", planTier: "free" });
    expect(strategyPlan.provider).toBe("gemini");
    expect(strategyPlan.model).toBe("gemini-flash-latest");

    const aiAssistant = getModelForTask({ taskType: TaskType.AI_ASSISTANT, mode: "prod", planTier: "free" });
    expect(aiAssistant.provider).toBe("gemini");
    expect(aiAssistant.model).toBe("gemini-flash-latest");

    const grader = getModelForTask({ taskType: TaskType.ANSWER_QUALITY_CHECK, mode: "prod", planTier: "free" });
    expect(grader.provider).toBe("openai");
    expect(grader.model).toBe("qwen2.5:7b-instruct");
  });

  it("allows per-task overrides for AI assistant", () => {
    process.env.AI_PROVIDER__AI_ASSISTANT = "openai";
    process.env.AI_MODEL__AI_ASSISTANT = "override-model";

    const aiAssistant = getModelForTask({ taskType: TaskType.AI_ASSISTANT, mode: "prod", planTier: "free" });
    expect(aiAssistant.provider).toBe("openai");
    expect(aiAssistant.model).toBe("override-model");
  });

  it("allows per-task overrides for the local answer quality judge", () => {
    process.env.AI_PROVIDER__ANSWER_QUALITY_CHECK = "openai";
    process.env.AI_MODEL__ANSWER_QUALITY_CHECK = "qwen2.5-coder:1.5b";

    const grader = getModelForTask({ taskType: TaskType.ANSWER_QUALITY_CHECK, mode: "prod", planTier: "free" });
    expect(grader.provider).toBe("openai");
    expect(grader.model).toBe("qwen2.5-coder:1.5b");
  });

  it("uses per-task per-mode override when set", () => {
    process.env.AI_MODEL__CHAT_GENERAL__prod = "override-model";
    const result = getModelForTask({ taskType: TaskType.CHAT_GENERAL, mode: "prod", planTier: "free" });
    expect(result.model).toBe("override-model");
  });

  it("uses global per-mode override when set", () => {
    process.env.AI_MODEL__prod = "global-prod-model";
    const result = getModelForTask({ taskType: TaskType.CHAT_GENERAL, mode: "prod", planTier: "free" });
    expect(result.model).toBe("global-prod-model");
  });

  it("throws for unknown task type", () => {
    expect(() =>
      getModelForTask({ taskType: "UNKNOWN_TASK" as TaskType, mode: "dev", planTier: "free" }),
    ).toThrow();
  });
});

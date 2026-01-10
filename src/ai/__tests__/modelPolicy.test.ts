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
      [TaskType.CHAT_GENERAL]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
      [TaskType.CHAT_ADMIN_ONBOARDING]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
      [TaskType.CLIENT_PORTAL_QA]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
      [TaskType.SUMMARIZE]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
      [TaskType.EXTRACT_STRUCTURED]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
      [TaskType.CLASSIFY_INTENT]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
      [TaskType.STRATEGY_PLAN]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
      [TaskType.CONTENT_IDEAS]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
      [TaskType.SCRIPT_WRITING]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
      [TaskType.TOOL_EXECUTION]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
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
    expect(result.model).toBe("gemini-1.5-flash");
  });

  it("selects PROD mapping when AI_MODE=prod", () => {
    process.env.AI_MODE = "prod";
    const result = getModelForTask({ taskType: TaskType.TOOL_EXECUTION, planTier: "pro" });
    expect(result.model).toBe("gemini-1.5-flash");
  });

  it("defaults to gemini for text tasks and openai for embeddings", () => {
    const text = getModelForTask({ taskType: TaskType.SUMMARIZE, mode: "prod", planTier: "free" });
    expect(text.provider).toBe("gemini");

    const embed = getModelForTask({ taskType: TaskType.EMBED_TEXT, mode: "prod", planTier: "free" });
    expect(embed.provider).toBe("openai");
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

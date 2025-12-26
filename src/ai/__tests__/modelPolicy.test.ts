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
      [TaskType.CHAT_GENERAL]: { dev: "gpt-5-nano", prod: "gpt-5-mini" },
      [TaskType.CHAT_ADMIN_ONBOARDING]: { dev: "gpt-5-nano", prod: "gpt-5-mini" },
      [TaskType.CLIENT_PORTAL_QA]: { dev: "gpt-5-nano", prod: "gpt-5-mini" },
      [TaskType.SUMMARIZE]: { dev: "gpt-5-nano", prod: "gpt-5-nano" },
      [TaskType.EXTRACT_STRUCTURED]: { dev: "gpt-5-nano", prod: "gpt-5-nano" },
      [TaskType.CLASSIFY_INTENT]: { dev: "gpt-5-nano", prod: "gpt-5-nano" },
      [TaskType.STRATEGY_PLAN]: { dev: "gpt-5-nano", prod: "gpt-5-mini" },
      [TaskType.CONTENT_IDEAS]: { dev: "gpt-5-nano", prod: "gpt-5-mini" },
      [TaskType.SCRIPT_WRITING]: { dev: "gpt-5-nano", prod: "gpt-5-mini" },
      [TaskType.TOOL_EXECUTION]: { dev: "gpt-5-nano", prod: "gpt-5-mini" },
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
    expect(result.model).toBe("gpt-5-nano");
  });

  it("selects PROD mapping when AI_MODE=prod", () => {
    process.env.AI_MODE = "prod";
    const result = getModelForTask({ taskType: TaskType.TOOL_EXECUTION, planTier: "pro" });
    expect(result.model).toBe("gpt-5-mini");
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

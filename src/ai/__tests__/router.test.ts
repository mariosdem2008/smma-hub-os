import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createAiRouter } from "../router.ts"
import { TaskType } from "../taskTypes.ts"

describe("ai router", () => {
  const baseProvider = {
    generate: vi.fn(async () => ({ text: "OK", usage: { inputTokens: 1, outputTokens: 1 } })),
    embed: vi.fn(async () => ({ embedding: [0.1, 0.2] })),
  };

  const providers = {
    openai: baseProvider,
    anthropic: { generate: vi.fn(async () => ({ text: "OK" })) },
    gemini: baseProvider,
  };

  beforeEach(() => {
    baseProvider.generate.mockClear();
    baseProvider.embed.mockClear();
  });

  afterEach(() => {
    delete process.env.AI_MODEL__TOOL_EXECUTION__prod;
  });

  it("selects dev/prod mapping based on environment", async () => {
    const router = createAiRouter({ providers });
    await router.run({
      taskType: TaskType.TOOL_EXECUTION,
      input: "Run tool",
      context: { environment: "dev" },
    });
    const devCall = baseProvider.generate.mock.calls.at(-1)?.[0];
    expect(devCall.model).toBe("gemini-1.5-flash");

    await router.run({
      taskType: TaskType.TOOL_EXECUTION,
      input: "Run tool",
      context: { environment: "prod" },
    });
    const prodCall = baseProvider.generate.mock.calls.at(-1)?.[0];
    expect(prodCall.model).toBe("gemini-1.5-flash");
  });

  it("uses env override when set", async () => {
    process.env.AI_MODEL__TOOL_EXECUTION__prod = "override-model";
    const router = createAiRouter({ providers });
    await router.run({
      taskType: TaskType.TOOL_EXECUTION,
      input: "Run tool",
      context: { environment: "prod" },
    });
    const call = baseProvider.generate.mock.calls.at(-1)?.[0];
    expect(call.model).toBe("override-model");
  });

  it("retries once on schema validation failure", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ text: "not-json" })
      .mockResolvedValueOnce({ text: "[{\"id\":\"one\"}]" });
    const router = createAiRouter({
      providers: { ...providers, gemini: { ...baseProvider, generate } },
    });
    const result = await router.run({
      taskType: TaskType.EXTRACT_STRUCTURED,
      input: "Give data",
      context: { environment: "dev" },
    });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(Array.isArray(result.output)).toBe(true);
  });

  it("returns UNKNOWN when required brain context is missing", async () => {
    const router = createAiRouter({ providers });
    const result = await router.run({
      taskType: TaskType.STRATEGY_PLAN,
      input: "",
      context: { environment: "dev" },
    });
    expect(result.unknown).toBe(true);
    expect(result.text).toBe("UNKNOWN");
  });

  it("passes expected shape to provider adapter", async () => {
    const router = createAiRouter({ providers });
    await router.run({
      taskType: TaskType.CONTENT_IDEAS,
      input: "",
      context: { environment: "dev" },
      metadata: { mode: "ideas", platform: "Instagram" },
    });
    const call = baseProvider.generate.mock.calls.at(-1)?.[0];
    expect(Array.isArray(call.messages)).toBe(true);
    expect(call.messages[0].role).toBe("system");
    expect(call.temperature).toBe(0.8);
  });

  it("throws on strict JSON provider failure without logging", async () => {
    const generateJson = vi.fn(async () => {
      const error = new Error("invalid json") as Error & { code?: string };
      error.code = "INVALID_JSON";
      throw error;
    });
    const supabase = {
      from: vi.fn(() => ({
        insert: vi.fn(),
      })),
    };
    const router = createAiRouter({
      providers: { ...providers, gemini: { ...baseProvider, generateJson } as any },
    });
    await expect(
      router.run({
        taskType: TaskType.EXTRACT_STRUCTURED,
        input: "Give data",
        context: { environment: "dev", supabase: supabase as any },
      }),
    ).rejects.toThrow("invalid json");
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

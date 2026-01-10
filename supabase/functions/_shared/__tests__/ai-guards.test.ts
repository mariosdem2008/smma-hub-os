import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAiTask } from "../ai.ts";
import { TaskType } from "../../../../src/ai/taskTypes.ts";
import { ai } from "../../../../src/ai/router.ts";

vi.mock("../../../../src/ai/router.ts", () => ({
  ai: {
    run: vi.fn(),
    runStream: vi.fn(),
  },
}));

type RateRow = { id: string; used_count: number; limit_per_day: number };

function createSupabaseMock(opts: { rateRow: RateRow | null; budgetAllowed: boolean }) {
  const inserts: Record<string, any[]> = {
    ai_runs: [],
    ai_usage_logs: [],
    ai_rate_limits: [],
    ai_budgets: [],
  };

  const supabase = {
    from: (table: string) => {
      if (table === "ai_rate_limits") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: opts.rateRow, error: null }),
                }),
              }),
            }),
          }),
          insert: async (payload: any) => {
            inserts.ai_rate_limits.push(payload);
            return { data: null, error: null };
          },
          update: () => ({
            eq: () => ({
              eq: () => ({
                eq: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        };
      }

      if (table === "ai_runs") {
        return {
          insert: async (payload: any) => {
            inserts.ai_runs.push(payload);
            return { data: null, error: null };
          },
        };
      }

      if (table === "ai_usage_logs") {
        return {
          insert: async (payload: any) => {
            inserts.ai_usage_logs.push(payload);
            return { data: null, error: null };
          },
        };
      }

      if (table === "ai_budgets") {
        return {
          insert: async (payload: any) => {
            inserts.ai_budgets.push(payload);
            return { data: null, error: null };
          },
        };
      }

      return {
        insert: async () => ({ data: null, error: null }),
      };
    },
    rpc: vi.fn(async () => ({
      data: {
        allowed: opts.budgetAllowed,
        budget_id: "budget-1",
        spent_usd: 10,
        budget_usd: 50,
        hard_stop: true,
      },
      error: null,
    })),
  };

  return { supabase, inserts };
}

describe("ai guards", () => {
  const runMock = ai.run as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    runMock.mockReset();
  });

  it("blocks when budget exceeded before provider call", async () => {
    const { supabase, inserts } = createSupabaseMock({
      rateRow: { id: "rate-1", used_count: 0, limit_per_day: 20 },
      budgetAllowed: false,
    });

    const result = await runAiTask({
      task_type: TaskType.SUMMARIZE,
      tenant: { agency_id: "agency-1", user_id: "user-1", client_id: "client-1" },
      input: { message: "hello" },
      supabase,
    });

    expect(result.error?.code).toBe("AI_BUDGET_EXCEEDED");
    expect(runMock).not.toHaveBeenCalled();
    expect(inserts.ai_runs.length).toBe(1);
    expect(inserts.ai_usage_logs.length).toBe(1);
  });

  it("blocks when rate limit exceeded before provider call", async () => {
    const { supabase, inserts } = createSupabaseMock({
      rateRow: { id: "rate-1", used_count: 20, limit_per_day: 20 },
      budgetAllowed: true,
    });

    const result = await runAiTask({
      task_type: TaskType.SUMMARIZE,
      tenant: { agency_id: "agency-1", user_id: "user-1", client_id: "client-1" },
      input: { message: "hello" },
      supabase,
    });

    expect(result.error?.code).toBe("AI_RATE_LIMIT");
    expect(runMock).not.toHaveBeenCalled();
    expect(inserts.ai_runs.length).toBe(1);
    expect(inserts.ai_usage_logs.length).toBe(1);
  });

  it("logs ai_runs on success and failure", async () => {
    const { supabase, inserts } = createSupabaseMock({
      rateRow: { id: "rate-1", used_count: 0, limit_per_day: 20 },
      budgetAllowed: true,
    });

    runMock.mockResolvedValueOnce({
      text: "OK",
      output: { ok: true },
      usage: { inputTokens: 10, outputTokens: 5 },
      rawText: "OK",
      schemaOk: true,
      meta: { provider: "openai", model: "gpt-5-mini" },
    });

    const success = await runAiTask({
      task_type: TaskType.SUMMARIZE,
      tenant: { agency_id: "agency-1", user_id: "user-1", client_id: "client-1" },
      input: { message: "hello" },
      supabase,
    });

    expect(success.assistant_message).toBe("OK");
    expect(inserts.ai_runs.length).toBe(1);
    expect(inserts.ai_usage_logs.length).toBe(1);

    inserts.ai_runs.length = 0;
    inserts.ai_usage_logs.length = 0;

    runMock.mockRejectedValueOnce(new Error("boom"));

    await expect(runAiTask({
      task_type: TaskType.SUMMARIZE,
      tenant: { agency_id: "agency-1", user_id: "user-1", client_id: "client-1" },
      input: { message: "hello" },
      supabase,
    })).rejects.toThrow("boom");

    expect(inserts.ai_runs.length).toBe(1);
    expect(inserts.ai_runs[0].success).toBe(false);
    expect(inserts.ai_usage_logs.length).toBe(1);
  });
});

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { runAdminGeneralChatAi } from "../../../supabase/functions/_shared/agency-admin-general-ai";
import * as aiRouter from "../../../supabase/functions/_shared/ai-router.ts";

const runAiTaskMock = vi.spyOn(aiRouter, "runAiTask");

type InsertLog = Record<string, Array<Record<string, unknown>>>;

function createSupabaseMock() {
  const inserts: InsertLog = {};
  const supabase = {
    from: (table: string) => ({
      insert: async (payload: Record<string, unknown>) => {
        if (!inserts[table]) inserts[table] = [];
        inserts[table].push(payload);
        return { error: null };
      },
    }),
  };
  return { supabase, inserts };
}

function resetEnv() {
  delete process.env.AI_ADMIN_CHAT_SCHEMA;
}

beforeEach(() => {
  runAiTaskMock.mockReset();
  resetEnv();
});

afterEach(() => {
  resetEnv();
});

describe("agency admin chat schema mode", () => {
  it("returns parsed JSON output with suggestions array", async () => {
    process.env.AI_ADMIN_CHAT_SCHEMA = "true";
    runAiTaskMock.mockResolvedValue({
      assistant_message: JSON.stringify({
        assistant_message: "Hello team",
        suggestions: ["Draft a weekly plan"],
        actions: [{ type: "notify", payload: { channel: "slack" } }],
        escalated: false,
        unknown: false,
      }),
      json: {
        assistant_message: "Hello team",
        suggestions: ["Draft a weekly plan"],
        actions: [{ type: "notify", payload: { channel: "slack" } }],
        escalated: false,
        unknown: false,
      },
      schemaOk: true,
      usage: { inputTokens: 10, outputTokens: 5 },
      meta: { provider: "openai", model: "gpt-5-mini" },
    });

    const { supabase, inserts } = createSupabaseMock();
    const result = await runAdminGeneralChatAi({
      message: "Help with planning",
      agencyId: "agency-1",
      userId: "user-1",
      snapshot: { agency: { name: "Rocket" } } as any,
      conversation: "USER: Help with planning",
      supabase,
    });

    expect(result.assistant_message).toBe("Hello team");
    expect(result.suggestions?.length).toBe(1);
    expect(result.suggestions?.[0]?.label).toBe("Draft a weekly plan");
    expect(result.actions?.[0]?.type).toBe("notify");
    expect(inserts.ai_runs?.length ?? 0).toBe(1);
    const metadata = inserts.ai_runs?.[0]?.metadata as Record<string, unknown>;
    expect(metadata.admin_chat_output_mode).toBe("schema");
    expect(metadata.admin_chat_schema_failed).toBeUndefined();
  });

  it("falls back to legacy parsing on invalid JSON and sets metadata", async () => {
    process.env.AI_ADMIN_CHAT_SCHEMA = "true";
    const legacyText = [
      "ASSISTANT_MESSAGE:",
      "Fallback response",
      "",
      "SUGGESTIONS_JSON:",
      "[]",
    ].join("\n");

    runAiTaskMock.mockResolvedValue({
      assistant_message: legacyText,
      rawText: legacyText,
      schemaOk: false,
      json: undefined,
      meta: { provider: "openai", model: "gpt-5-mini" },
    });

    const { supabase, inserts } = createSupabaseMock();
    const result = await runAdminGeneralChatAi({
      message: "Help",
      agencyId: "agency-1",
      userId: "user-1",
      snapshot: {} as any,
      conversation: "USER: Help",
      supabase,
    });

    expect(result.assistant_message).toBe("Fallback response");
    expect(inserts.ai_runs?.length ?? 0).toBe(1);
    const metadata = inserts.ai_runs?.[0]?.metadata as Record<string, unknown>;
    expect(metadata.admin_chat_output_mode).toBe("legacy_fallback");
    expect(metadata.admin_chat_schema_failed).toBe(true);
  });

  it("keeps legacy mode unchanged when flag is off", async () => {
    const legacyText = [
      "ASSISTANT_MESSAGE:",
      "Legacy response",
      "",
      "SUGGESTIONS_JSON:",
      "[]",
    ].join("\n");

    runAiTaskMock.mockResolvedValue({
      assistant_message: legacyText,
      meta: { provider: "openai", model: "gpt-5-mini" },
    });

    const { supabase, inserts } = createSupabaseMock();
    const result = await runAdminGeneralChatAi({
      message: "Legacy",
      agencyId: "agency-1",
      userId: "user-1",
      snapshot: {} as any,
      conversation: "USER: Legacy",
      supabase,
    });

    expect(result.assistant_message).toBe("Legacy response");
    expect(inserts.ai_runs?.length ?? 0).toBe(1);
    const metadata = inserts.ai_runs?.[0]?.metadata as Record<string, unknown>;
    expect(metadata.admin_chat_output_mode).toBe("legacy");
    expect(metadata.admin_chat_schema_failed).toBe(false);
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { handleAgencyAdminSetup, buildIntroPayload, buildClarificationForOffers, isReadyConfirmation } from "../../../supabase/functions/_shared/agency-admin-setup";
import { SETUP_QUESTIONS } from "../../../supabase/functions/_shared/agency-admin-setup-questions";
import * as orchestrator from "../../../supabase/functions/_shared/agency-admin-setup-orchestrator";
import * as aiRouter from "../../../supabase/functions/_shared/ai-router.ts";

const runAiTaskMock = vi.spyOn(aiRouter, "runAiTask");
const selectNextQuestionMock = vi.spyOn(orchestrator, "selectNextAdminSetupQuestion");

function createSupabaseMock(opts?: {
  agency?: { id: string; name: string | null; website?: string | null; niche?: string | null } | null;
}) {
  const messages: Array<any> = [];
  let brain: any = {};
  const agency =
    opts?.agency === undefined
      ? { id: "agency-1", name: "Rocket Agency", website: "https://rocket.test", niche: "SaaS" }
      : opts.agency;
  const profile = { id: "user-1", full_name: "Mario Rossi" };
  const onboarding = { answers_json: { agency_name: "Rocket Agency", niche: "SaaS" } };

  const supabase = {
    from: (table: string) => {
      const state: { filters: Record<string, any>; table: string } = { filters: {}, table };
      const builder: any = {
        select: () => builder,
        eq: (col: string, val: any) => {
          state.filters[col] = val;
          return builder;
        },
        order: () => builder,
        limit: () => builder,
        maybeSingle: async () => {
          if (table === "agency_brains") {
            return { data: { id: "brain-1", brain_json: brain }, error: null };
          }
          if (table === "agencies") {
            return { data: agency ?? null, error: null };
          }
          if (table === "profiles") {
            return { data: profile, error: null };
          }
          if (table === "agency_onboarding_sessions") {
            return { data: onboarding, error: null };
          }
          if (table === "agency_ai_chat_messages") {
            const role = state.filters["role"];
            const filtered = role ? messages.filter((m) => m.role === role) : messages;
            const last = filtered[filtered.length - 1] ?? null;
            return { data: last, error: null };
          }
          return { data: null, error: null };
        },
        insert: (payload: any) => {
          if (table === "agency_ai_chat_messages") {
            messages.push({ ...payload, created_at: new Date().toISOString() });
          }
          if (table === "agency_brains") {
            brain = payload.brain_json;
          }
          return {
            select: () => ({
              single: async () => ({ data: { id: "id-1" }, error: null }),
            }),
          };
        },
        update: (payload: any) => ({
          eq: () => ({
            select: () => ({
              maybeSingle: async () => {
                if (table === "agency_brains") {
                  brain = payload.brain_json;
                }
                return { data: { id: "id-1" }, error: null };
              },
            }),
          }),
        }),
      };
      return builder;
    },
  };

  return { supabase, messages, getBrain: () => brain };
}

beforeEach(() => {
  runAiTaskMock.mockReset();
  selectNextQuestionMock.mockReset();
});

describe("agency admin setup guided", () => {
  it("first primed message includes READY confirmation and one question", () => {
    const intro = buildIntroPayload();
    expect(intro.assistant_message.toUpperCase()).toContain("READY");
    expect((intro.assistant_message.match(/\?/g) ?? []).length).toBe(1);
  });

  it("treats 'Let's go' as READY confirmation", () => {
    expect(isReadyConfirmation("Let's go")).toBe(true);
  });

  it("clarification for offers provides examples and re-asks pending question", () => {
    const out = buildClarificationForOffers({
      pending_question_key: "agency.primary_services",
      pending_question_text: "What are your primary services?",
    });
    expect(out.assistant_message).toContain("Examples for SMMA-style agencies:");
    expect(out.assistant_message).toContain("What are your primary services?");
    expect(out.assistant_message.toUpperCase()).not.toContain("UNKNOWN");
  });

  it("ready confirmation starts question 1", async () => {
    const { supabase } = createSupabaseMock();
    const result = await handleAgencyAdminSetup({
      supabase: supabase as any,
      userId: "user-1",
      agencyId: "agency-1",
      threadId: "thread-1",
      message: "Let's go",
    });
    expect(result.status).toBe(200);
    if ("error" in result.body) throw new Error("Unexpected error response");
    expect(result.body.assistant_message).toContain(SETUP_QUESTIONS[0].question_text);
  });

  it("clarification request re-asks pending question without UNKNOWN", async () => {
    const { supabase, messages } = createSupabaseMock();
    messages.push({
      role: "assistant",
      content: SETUP_QUESTIONS[0].question_text,
      meta_json: { state: { intent: "ANSWER_TO_ONBOARDING_QUESTION", pending_question_key: SETUP_QUESTIONS[0].key, pending_question_text: SETUP_QUESTIONS[0].question_text } },
      created_at: new Date().toISOString(),
    });
    const result = await handleAgencyAdminSetup({
      supabase: supabase as any,
      userId: "user-1",
      agencyId: "agency-1",
      threadId: "thread-1",
      message: "what do you mean about offers",
    });
    if ("error" in result.body) throw new Error("Unexpected error response");
    expect(result.body.assistant_message.toUpperCase()).not.toContain("UNKNOWN");
    expect(result.body.assistant_message).toContain(SETUP_QUESTIONS[0].question_text);
  });

  it("answer advances to next question with progress", async () => {
    const { supabase, messages } = createSupabaseMock();
    messages.push({
      role: "assistant",
      content: SETUP_QUESTIONS[0].question_text,
      meta_json: { state: { intent: "ANSWER_TO_ONBOARDING_QUESTION", pending_question_key: SETUP_QUESTIONS[0].key, pending_question_text: SETUP_QUESTIONS[0].question_text } },
      created_at: new Date().toISOString(),
    });
    runAiTaskMock.mockResolvedValueOnce({
      assistant_message: "",
      json: { value: ["Social media management"] },
      meta: { provider: "openai", model: "gpt-5-nano" },
    });
    const result = await handleAgencyAdminSetup({
      supabase: supabase as any,
      userId: "user-1",
      agencyId: "agency-1",
      threadId: "thread-1",
      message: "Social media management",
    });
    if ("error" in result.body) throw new Error("Unexpected error response");
    expect(result.body.progress_percent).toBeGreaterThan(0);
    expect(result.body.assistant_message).toContain(SETUP_QUESTIONS[1].question_text);
  });

  it("flag OFF uses hardcoded next question without orchestrator", async () => {
    process.env.AI_GUIDED_SETUP_ORCHESTRATION = "false";
    const { supabase, messages } = createSupabaseMock();
    messages.push({
      role: "assistant",
      content: SETUP_QUESTIONS[0].question_text,
      meta_json: { state: { intent: "ANSWER_TO_ONBOARDING_QUESTION", pending_question_key: SETUP_QUESTIONS[0].key, pending_question_text: SETUP_QUESTIONS[0].question_text } },
      created_at: new Date().toISOString(),
    });
    runAiTaskMock.mockResolvedValueOnce({
      assistant_message: "",
      json: { value: ["Social media management"] },
      meta: { provider: "openai", model: "gpt-5-nano" },
    });

    const result = await handleAgencyAdminSetup({
      supabase: supabase as any,
      userId: "user-1",
      agencyId: "agency-1",
      threadId: "thread-1",
      message: "Social media management",
    });

    expect(selectNextQuestionMock).not.toHaveBeenCalled();
    if ("error" in result.body) throw new Error("Unexpected error response");
    expect(result.body.assistant_message).toContain(SETUP_QUESTIONS[1].question_text);
    delete process.env.AI_GUIDED_SETUP_ORCHESTRATION;
  });

  it("flag ON uses orchestrator result exactly once", async () => {
    process.env.AI_GUIDED_SETUP_ORCHESTRATION = "true";
    const { supabase, messages } = createSupabaseMock();
    messages.push({
      role: "assistant",
      content: SETUP_QUESTIONS[0].question_text,
      meta_json: { state: { intent: "ANSWER_TO_ONBOARDING_QUESTION", pending_question_key: SETUP_QUESTIONS[0].key, pending_question_text: SETUP_QUESTIONS[0].question_text } },
      created_at: new Date().toISOString(),
    });
    runAiTaskMock.mockResolvedValueOnce({
      assistant_message: "",
      json: { value: ["Social media management"] },
      meta: { provider: "openai", model: "gpt-5-nano" },
    });
    selectNextQuestionMock.mockResolvedValueOnce({
      question: SETUP_QUESTIONS[2],
      registryId: "deliverables_standard",
    });

    const result = await handleAgencyAdminSetup({
      supabase: supabase as any,
      userId: "user-1",
      agencyId: "agency-1",
      threadId: "thread-1",
      message: "Social media management",
    });

    expect(selectNextQuestionMock).toHaveBeenCalledTimes(1);
    if ("error" in result.body) throw new Error("Unexpected error response");
    expect(result.body.assistant_message).toContain(SETUP_QUESTIONS[2].question_text);
    delete process.env.AI_GUIDED_SETUP_ORCHESTRATION;
  });

  it("prefills context snapshot with agency name and website for extraction", async () => {
    const { supabase, messages } = createSupabaseMock();
    messages.push({
      role: "assistant",
      content: SETUP_QUESTIONS[0].question_text,
      meta_json: { state: { intent: "ANSWER_TO_ONBOARDING_QUESTION", pending_question_key: SETUP_QUESTIONS[0].key, pending_question_text: SETUP_QUESTIONS[0].question_text } },
      created_at: new Date().toISOString(),
    });
    runAiTaskMock.mockResolvedValueOnce({
      assistant_message: "",
      json: { value: ["Social media management"] },
      meta: { provider: "openai", model: "gpt-5-nano" },
    });

    const result = await handleAgencyAdminSetup({
      supabase: supabase as any,
      userId: "user-1",
      agencyId: "agency-1",
      threadId: "thread-1",
      message: "Social media management",
    });

    expect(result.status).toBe(200);
    expect(runAiTaskMock).toHaveBeenCalledTimes(1);
    const call = runAiTaskMock.mock.calls[0]?.[0] as any;
    const snapshot = call?.metadata?.contextSnapshot as any;
    expect(snapshot?.agency?.name).toBe("Rocket Agency");
    expect(snapshot?.agency?.website).toBe("https://rocket.test");
    if ("error" in result.body) throw new Error("Unexpected error response");
    expect(result.body.assistant_message).toContain(SETUP_QUESTIONS[1].question_text);
  });

  it("handles missing agency name and website in context snapshot", async () => {
    const { supabase, messages } = createSupabaseMock({
      agency: { id: "agency-1", name: null, website: null, niche: null },
    });
    messages.push({
      role: "assistant",
      content: SETUP_QUESTIONS[0].question_text,
      meta_json: { state: { intent: "ANSWER_TO_ONBOARDING_QUESTION", pending_question_key: SETUP_QUESTIONS[0].key, pending_question_text: SETUP_QUESTIONS[0].question_text } },
      created_at: new Date().toISOString(),
    });
    runAiTaskMock.mockResolvedValueOnce({
      assistant_message: "",
      json: { value: ["Social media management"] },
      meta: { provider: "openai", model: "gpt-5-nano" },
    });

    const result = await handleAgencyAdminSetup({
      supabase: supabase as any,
      userId: "user-1",
      agencyId: "agency-1",
      threadId: "thread-1",
      message: "Social media management",
    });

    expect(result.status).toBe(200);
    expect(runAiTaskMock).toHaveBeenCalledTimes(1);
    const call = runAiTaskMock.mock.calls[0]?.[0] as any;
    const snapshot = call?.metadata?.contextSnapshot as any;
    expect(snapshot?.agency?.name ?? null).toBeNull();
    expect(snapshot?.agency?.website ?? null).toBeNull();
    if ("error" in result.body) throw new Error("Unexpected error response");
    expect(result.body.assistant_message).toContain(SETUP_QUESTIONS[1].question_text);
  });

  it("invalid JSON extraction triggers deterministic parse failure", async () => {
    const { supabase, messages } = createSupabaseMock();
    messages.push({
      role: "assistant",
      content: SETUP_QUESTIONS[0].question_text,
      meta_json: { state: { intent: "ANSWER_TO_ONBOARDING_QUESTION", pending_question_key: SETUP_QUESTIONS[0].key, pending_question_text: SETUP_QUESTIONS[0].question_text } },
      created_at: new Date().toISOString(),
    });
    runAiTaskMock.mockResolvedValueOnce({
      assistant_message: "",
      json: { value: null },
      meta: { provider: "openai", model: "gpt-5-nano" },
    });
    const result = await handleAgencyAdminSetup({
      supabase: supabase as any,
      userId: "user-1",
      agencyId: "agency-1",
      threadId: "thread-1",
      message: "SMMA",
    });
    if ("error" in result.body) throw new Error("Unexpected error response");
    expect(result.body.assistant_message).toContain("I couldn't parse");
    expect(result.body.assistant_message).toContain(SETUP_QUESTIONS[0].question_text);
  });

  it("UNKNOWN triggers only for missing agency-specific facts", async () => {
    const { supabase } = createSupabaseMock();
    const result = await handleAgencyAdminSetup({
      supabase: supabase as any,
      userId: "user-1",
      agencyId: "agency-1",
      threadId: "thread-1",
      message: "What is your pricing?",
    });
    if ("error" in result.body) throw new Error("Unexpected error response");
    expect(result.body.assistant_message.toUpperCase()).toContain("UNKNOWN");
    expect((result.body.assistant_message.match(/\?/g) ?? []).length).toBeLessThanOrEqual(1);
  });
});

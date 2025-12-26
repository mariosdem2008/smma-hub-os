import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleAgencyAdminChat } from "../../../supabase/functions/_shared/agency-admin-chat";
import * as aiRouter from "../../../supabase/functions/_shared/ai-router.ts";

const runAiTaskMock = vi.spyOn(aiRouter, "runAiTask");

function createSupabaseMock(opts: {
  adminAgencyId?: string | null;
  threadAgencyIdById?: Record<string, string>;
  threadKindById?: Record<string, string>;
}) {
  const inserts: Array<{ table: string; payload: any }> = [];
  let brain: any = {};

  const supabase = {
    inserts,
    from: (table: string) => {
      const state: { filters: Record<string, any>; table: string } = { filters: {}, table };

      const builder: any = {
        select: () => builder,
        eq: (col: string, val: any) => {
          state.filters[col] = val;
          return builder;
        },
        limit: () => builder,
        order: () => builder,
        maybeSingle: async () => {
          if (table === "agency_members") {
            const wantsAdmin = state.filters["role"] === "admin";
            if (!wantsAdmin) return { data: null, error: null };
            const agencyId = opts.adminAgencyId ?? null;
            return { data: agencyId ? { agency_id: agencyId } : null, error: null };
          }

          if (table === "agency_ai_chat_threads") {
            const threadId = state.filters["id"];
            const agencyId = threadId ? opts.threadAgencyIdById?.[threadId] : null;
            const kind = threadId ? opts.threadKindById?.[threadId] : null;
            return { data: agencyId ? { id: threadId, agency_id: agencyId, kind } : null, error: null };
          }

          if (table === "agency_brains") {
            return { data: { id: "brain-1", brain_json: brain }, error: null };
          }

          if (table === "agencies") {
            return { data: { id: opts.adminAgencyId ?? "agency-1", name: "Rocket Agency", website: null, niche: "SaaS" }, error: null };
          }

          if (table === "profiles") {
            return { data: { id: "user-1", full_name: "Mario Rossi" }, error: null };
          }

          if (table === "agency_onboarding_sessions") {
            return { data: { answers_json: { agency_name: "Rocket Agency" } }, error: null };
          }

          return { data: null, error: null };
        },
        insert: (payload: any) => {
          inserts.push({ table, payload });
          if (table === "agency_brains") {
            brain = payload.brain_json;
          }
          return {
            select: () => ({
              single: async () => {
                if (table === "agency_ai_chat_threads") return { data: { id: "thread-1" }, error: null };
                if (table === "agency_ai_chat_messages") return { data: { id: "msg-1" }, error: null };
                return { data: { id: "id-1" }, error: null };
              },
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

  return supabase;
}

describe("handleAgencyAdminChat", () => {
  beforeEach(() => {
    runAiTaskMock.mockReset();
  });

  it("returns 403 for non-admin", async () => {
    const supabase = createSupabaseMock({ adminAgencyId: null });
    const result = await handleAgencyAdminChat({
      supabase: supabase as any,
      userId: "user-1",
      body: { message: "hello" },
    });

    expect(result.status).toBe(403);
  });

  it("admin can create thread and store messages", async () => {
    runAiTaskMock.mockResolvedValueOnce({
      assistant_message: "Sure, I can help with that.",
      json: {
        assistant_message: "Sure, I can help with that.",
        suggestions: [{ id: "next", label: "Next step", user_message: "Plan next steps." }],
      },
      meta: { provider: "openai", model: "gpt-5-nano" },
    });
    const supabase = createSupabaseMock({ adminAgencyId: "agency-1" });
    const result = await handleAgencyAdminChat({
      supabase: supabase as any,
      userId: "user-1",
      body: { message: "help me plan the week" },
    });

    expect(result.status).toBe(200);
    if ("error" in result.body) throw new Error("Unexpected error response");
    expect(result.body.thread_id).toBe("thread-1");
    expect(result.body.assistant_message).toContain("help");
    expect(result.body.step_id).toBeUndefined();

    const tables = (supabase as any).inserts.map((i: any) => i.table);
    expect(tables).toContain("agency_ai_chat_threads");
    expect(tables.filter((t: string) => t === "agency_ai_chat_messages").length).toBe(2);
  });

  it("routes setup thread to guided handler with step_id", async () => {
    let brain: any = null;
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
            if (table === "agency_members") {
              return { data: { agency_id: "agency-1" }, error: null };
            }
            if (table === "agency_ai_chat_threads") {
              return { data: { id: "thread-setup", agency_id: "agency-1", kind: "setup" }, error: null };
            }
            if (table === "agency_brains") {
              return { data: brain ? { id: "brain-1", brain_json: brain } : null, error: null };
            }
            if (table === "agencies") {
              return { data: { id: "agency-1", name: "Rocket Agency", website: null, niche: "SaaS" }, error: null };
            }
            if (table === "profiles") {
              return { data: { id: "user-1", full_name: "Mario Rossi" }, error: null };
            }
            if (table === "agency_onboarding_sessions") {
              return { data: { answers_json: { agency_name: "Rocket Agency" } }, error: null };
            }
            return { data: null, error: null };
          },
          insert: (payload: any) => {
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
                single: async () => {
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

    const result = await handleAgencyAdminChat({
      supabase: supabase as any,
      userId: "user-1",
      body: { thread_id: "thread-setup", message: "" },
    });

    expect(result.status).toBe(200);
    if ("error" in result.body) throw new Error("Unexpected error response");
    expect(result.body.thread_id).toBe("thread-setup");
    expect(result.body.progress_percent).toBeTypeOf("number");
    expect(typeof result.body.assistant_message).toBe("string");
  });

  it("routes general thread to general handler without step_id", async () => {
    runAiTaskMock.mockResolvedValueOnce({
      assistant_message: "Here is a quick status update.",
      json: {
        assistant_message: "Here is a quick status update.",
        suggestions: [{ id: "next", label: "Next step", user_message: "Plan next steps." }],
      },
      meta: { provider: "openai", model: "gpt-5-nano" },
    });
    const supabase = createSupabaseMock({
      adminAgencyId: "agency-1",
      threadAgencyIdById: { "thread-general": "agency-1" },
      threadKindById: { "thread-general": "general" },
    });

    const result = await handleAgencyAdminChat({
      supabase: supabase as any,
      userId: "user-1",
      body: { thread_id: "thread-general", message: "status update" },
    });

    expect(result.status).toBe(200);
    if ("error" in result.body) throw new Error("Unexpected error response");
    expect(result.body.step_id).toBeUndefined();
    expect(result.body.suggestions?.length).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from "vitest";
import { handleAgencyAdminChat } from "../../../supabase/functions/_shared/agency-admin-chat";

function createSupabaseMock(opts: {
  adminAgencyId?: string | null;
  threadAgencyIdById?: Record<string, string>;
}) {
  const inserts: Array<{ table: string; payload: any }> = [];

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
            return { data: agencyId ? { id: threadId, agency_id: agencyId } : null, error: null };
          }

          return { data: null, error: null };
        },
        insert: (payload: any) => {
          inserts.push({ table, payload });
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
      };

      return builder;
    },
  };

  return supabase;
}

describe("handleAgencyAdminChat", () => {
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
    const supabase = createSupabaseMock({ adminAgencyId: "agency-1" });
    const result = await handleAgencyAdminChat({
      supabase: supabase as any,
      userId: "user-1",
      body: { message: "help me plan the week" },
    });

    expect(result.status).toBe(200);
    if ("error" in result.body) throw new Error("Unexpected error response");
    expect(result.body.thread_id).toBe("thread-1");
    expect(result.body.assistant_message).toContain("Revelation Chat (v1)");

    const tables = (supabase as any).inserts.map((i: any) => i.table);
    expect(tables).toContain("agency_ai_chat_threads");
    expect(tables.filter((t: string) => t === "agency_ai_chat_messages").length).toBe(2);
  });
});


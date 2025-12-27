import { describe, it, expect } from "vitest";
import { executeToolAction } from "../tool-executor.ts";

describe("tool executor", () => {
  const mockSupabase = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          ilike: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
          order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        }),
        maybeSingle: async () => ({ data: null, error: null }),
      }),
      insert: () => ({
        select: () => ({
          single: async () => ({ data: { id: "test-id", name: "Test" }, error: null }),
        }),
      }),
    }),
  };

  it("rejects unknown tool type", async () => {
    const result = await executeToolAction({
      tool: { type: "unknown_tool", payload: {} },
      supabase: mockSupabase,
      agencyId: "agency-1",
      userId: "user-1",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown tool");
  });

  it("validates required parameters", async () => {
    const result = await executeToolAction({
      tool: { type: "create_client", payload: {} },
      supabase: mockSupabase,
      agencyId: "agency-1",
      userId: "user-1",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Missing required parameter: name");
  });

  it("rejects non-object payload", async () => {
    const result = await executeToolAction({
      tool: { type: "create_client", payload: "invalid" as any },
      supabase: mockSupabase,
      agencyId: "agency-1",
      userId: "user-1",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Tool payload must be an object");
  });

  it("validates string parameters", async () => {
    const result = await executeToolAction({
      tool: { type: "create_client", payload: { name: 123 } },
      supabase: mockSupabase,
      agencyId: "agency-1",
      userId: "user-1",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Parameter name must be a string");
  });

  it("rejects empty required strings", async () => {
    const result = await executeToolAction({
      tool: { type: "create_client", payload: { name: "   " } },
      supabase: mockSupabase,
      agencyId: "agency-1",
      userId: "user-1",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Parameter name must be a non-empty string");
  });

  it("draft_offer generates text", async () => {
    const result = await executeToolAction({
      tool: { type: "draft_offer", payload: { service_type: "Social Media Management" } },
      supabase: mockSupabase,
      agencyId: "agency-1",
      userId: "user-1",
    });
    expect(result.success).toBe(true);
    expect(result.result.offer_text).toContain("Social Media Management");
  });

  it("schedule_task validates ISO date format", async () => {
    const result = await executeToolAction({
      tool: { type: "schedule_task", payload: { title: "Test", due_date: "invalid-date" } },
      supabase: mockSupabase,
      agencyId: "agency-1",
      userId: "user-1",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("due_date must be a valid ISO date string");
  });

  describe("create_client", () => {
    it("creates new client successfully", async () => {
      const mockSupabaseCreate = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              ilike: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            }),
          }),
          insert: (data: any) => ({
            select: () => ({
              single: async () => ({ data: { id: "client-123", name: "Tesla Inc" }, error: null }),
            }),
          }),
        }),
      };

      const result = await executeToolAction({
        tool: { type: "create_client", payload: { name: "Tesla Inc", website: "https://tesla.com" } },
        supabase: mockSupabaseCreate,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.result.client_id).toBe("client-123");
      expect(result.result.existing).toBe(false);
    });

    it("returns existing client (idempotency)", async () => {
      const mockSupabaseExisting = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              ilike: () => ({
                maybeSingle: async () => ({ data: { id: "existing-client", name: "Tesla Inc" }, error: null }),
              }),
            }),
          }),
        }),
      };

      const result = await executeToolAction({
        tool: { type: "create_client", payload: { name: "Tesla Inc" } },
        supabase: mockSupabaseExisting,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.result.client_id).toBe("existing-client");
      expect(result.result.existing).toBe(true);
    });

    it("handles DB error gracefully", async () => {
      const mockSupabaseError = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              ilike: () => ({ maybeSingle: async () => ({ data: null, error: { message: "Database connection failed" } }) }),
            }),
          }),
        }),
      };

      const result = await executeToolAction({
        tool: { type: "create_client", payload: { name: "Tesla" } },
        supabase: mockSupabaseError,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Database connection failed");
    });
  });

  describe("draft_offer", () => {
    it("includes pricing range when provided", async () => {
      const result = await executeToolAction({
        tool: {
          type: "draft_offer",
          payload: { service_type: "SEO Optimization", pricing_range: "$2000-$5000/month" },
        },
        supabase: mockSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.result.offer_text).toContain("SEO Optimization");
      expect(result.result.offer_text).toContain("$2000-$5000/month");
    });

    it("handles missing pricing_range gracefully", async () => {
      const result = await executeToolAction({
        tool: { type: "draft_offer", payload: { service_type: "Content Marketing" } },
        supabase: mockSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.result.offer_text).toContain("Content Marketing");
      expect(result.result.offer_text).toContain("Custom quote");
    });
  });

  describe("update_brain", () => {
    it("rejects FORBIDDEN_KEYS (__proto__)", async () => {
      const result = await executeToolAction({
        tool: { type: "update_brain", payload: { field: "__proto__", value: "malicious" } },
        supabase: mockSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("field path is not allowed");
    });

    it("rejects FORBIDDEN_KEYS (constructor)", async () => {
      const result = await executeToolAction({
        tool: { type: "update_brain", payload: { field: "constructor", value: "bad" } },
        supabase: mockSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("field path is not allowed");
    });

    it("rejects FORBIDDEN_KEYS (prototype)", async () => {
      const result = await executeToolAction({
        tool: { type: "update_brain", payload: { field: "prototype", value: "bad" } },
        supabase: mockSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("field path is not allowed");
    });

    it("requires both field and value parameters", async () => {
      const result1 = await executeToolAction({
        tool: { type: "update_brain", payload: { value: "test" } },
        supabase: mockSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result1.success).toBe(false);
      expect(result1.error).toContain("Missing required parameter: field");

      const result2 = await executeToolAction({
        tool: { type: "update_brain", payload: { field: "test" } },
        supabase: mockSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result2.success).toBe(false);
      expect(result2.error).toContain("Missing required parameter: value");
    });
  });

  describe("schedule_task", () => {
    it("creates new task successfully", async () => {
      const mockTaskSupabase = {
        from: (table: string) => ({
          select: () => ({
            eq: (key: string, value: any) => ({
              eq: (key: string, value: any) => ({
                eq: (key: string, value: any) => ({
                  eq: (key: string, value: any) => ({
                    eq: (key: string, value: any) => ({
                      maybeSingle: async () => ({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          }),
          insert: (data: any) => ({
            select: () => ({
              single: async () => ({ data: { id: "task-123" }, error: null }),
            }),
          }),
        }),
      };

      const result = await executeToolAction({
        tool: {
          type: "schedule_task",
          payload: { title: "Follow up", due_date: "2025-01-15T10:00:00Z", client_id: "client-1" },
        },
        supabase: mockTaskSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.result.task_id).toBe("task-123");
      expect(result.result.existing).toBe(false);
    });

    it("returns existing task (idempotency)", async () => {
      const mockTaskSupabase = {
        from: (table: string) => ({
          select: () => ({
            eq: (key: string, value: any) => ({
              eq: (key: string, value: any) => ({
                eq: (key: string, value: any) => ({
                  eq: (key: string, value: any) => ({
                    eq: (key: string, value: any) => ({
                      maybeSingle: async () => ({ data: { id: "existing-task" }, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      };

      const result = await executeToolAction({
        tool: {
          type: "schedule_task",
          payload: { title: "Follow up", due_date: "2025-01-15T10:00:00Z", client_id: "client-1" },
        },
        supabase: mockTaskSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.result.task_id).toBe("existing-task");
      expect(result.result.existing).toBe(true);
    });

    it("defaults to most recent client when client_id omitted", async () => {
      const mockTaskSupabase = {
        from: (table: string) => ({
          select: () => ({
            eq: (key: string, value: any) => {
              if (table === "clients") {
                return {
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({ data: { id: "recent-client", name: "Recent" }, error: null }),
                    }),
                  }),
                };
              }
              return {
                eq: (key: string, value: any) => ({
                  eq: (key: string, value: any) => ({
                    eq: (key: string, value: any) => ({
                      eq: (key: string, value: any) => ({
                        maybeSingle: async () => ({ data: null, error: null }),
                      }),
                    }),
                  }),
                }),
              };
            },
          }),
          insert: (data: any) => ({
            select: () => ({
              single: async () => ({ data: { id: "task-456" }, error: null }),
            }),
          }),
        }),
      };

      const result = await executeToolAction({
        tool: { type: "schedule_task", payload: { title: "Test Task", due_date: "2025-01-15T10:00:00Z" } },
        supabase: mockTaskSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.result.defaulted_client).toBe(true);
    });

    it("fails when no clients exist and client_id omitted", async () => {
      const mockTaskSupabase = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
      };

      const result = await executeToolAction({
        tool: { type: "schedule_task", payload: { title: "Test Task", due_date: "2025-01-15T10:00:00Z" } },
        supabase: mockTaskSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("No clients found for agency");
    });
  });
});

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
});

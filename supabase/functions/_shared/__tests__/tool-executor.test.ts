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

  describe("create_project", () => {
    it("creates new project successfully", async () => {
      const mockProjectSupabase = {
        from: (table: string) => {
          if (table === "clients") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: { id: "client-123", agency_id: "agency-1", name: "Test Client" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "projects") {
            return {
              select: () => ({
                eq: () => ({
                  ilike: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
              insert: () => ({
                select: () => ({
                  single: async () => ({ data: { id: "project-456" }, error: null }),
                }),
              }),
            };
          }
          return {};
        },
      };

      const result = await executeToolAction({
        tool: {
          type: "create_project",
          payload: { title: "Summer Campaign", client_id: "client-123", platforms: "instagram,tiktok" },
        },
        supabase: mockProjectSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.result.project_id).toBe("project-456");
      expect(result.result.existing).toBe(false);
      expect(result.result.platforms).toEqual(["instagram", "tiktok"]);
    });

    it("returns existing project (idempotency)", async () => {
      const mockProjectSupabase = {
        from: (table: string) => {
          if (table === "clients") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: { id: "client-123", agency_id: "agency-1", name: "Test Client" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "projects") {
            return {
              select: () => ({
                eq: () => ({
                  ilike: () => ({
                    maybeSingle: async () => ({ data: { id: "existing-project" }, error: null }),
                  }),
                }),
              }),
            };
          }
          return {};
        },
      };

      const result = await executeToolAction({
        tool: { type: "create_project", payload: { title: "Summer Campaign", client_id: "client-123" } },
        supabase: mockProjectSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.result.project_id).toBe("existing-project");
      expect(result.result.existing).toBe(true);
    });

    it("validates required title parameter", async () => {
      const result = await executeToolAction({
        tool: { type: "create_project", payload: { client_id: "client-123" } },
        supabase: mockSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required parameter: title");
    });

    it("validates client belongs to agency", async () => {
      const mockWrongAgencySupabase = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { id: "client-123", agency_id: "other-agency", name: "Test Client" },
                error: null,
              }),
            }),
          }),
        }),
      };

      const result = await executeToolAction({
        tool: { type: "create_project", payload: { title: "Test", client_id: "client-123" } },
        supabase: mockWrongAgencySupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Client not found or unauthorized");
    });

    it("parses platforms CSV correctly", async () => {
      const mockProjectSupabase = {
        from: (table: string) => {
          if (table === "clients") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: { id: "client-123", agency_id: "agency-1", name: "Test Client" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "projects") {
            return {
              select: () => ({
                eq: () => ({
                  ilike: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
              insert: () => ({
                select: () => ({
                  single: async () => ({ data: { id: "project-456" }, error: null }),
                }),
              }),
            };
          }
          return {};
        },
      };

      const result = await executeToolAction({
        tool: {
          type: "create_project",
          payload: { title: "Multi-Platform", client_id: "client-123", platforms: "instagram, tiktok, youtube" },
        },
        supabase: mockProjectSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.result.platforms).toEqual(["instagram", "tiktok", "youtube"]);
    });
  });

  describe("update_project_status", () => {
    it("updates project status successfully", async () => {
      const mockProjectSupabase = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { id: "project-123", status: "idea", agency_id: "agency-1" },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: () => ({ error: null }),
          }),
        }),
      };

      const result = await executeToolAction({
        tool: { type: "update_project_status", payload: { project_id: "project-123", status: "production" } },
        supabase: mockProjectSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.result.status).toBe("production");
      expect(result.result.changed).toBe(true);
    });

    it("returns success if already in target status (idempotency)", async () => {
      const mockProjectSupabase = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { id: "project-123", status: "production", agency_id: "agency-1" },
                error: null,
              }),
            }),
          }),
        }),
      };

      const result = await executeToolAction({
        tool: { type: "update_project_status", payload: { project_id: "project-123", status: "production" } },
        supabase: mockProjectSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.result.changed).toBe(false);
    });

    it("validates status enum", async () => {
      const result = await executeToolAction({
        tool: { type: "update_project_status", payload: { project_id: "project-123", status: "invalid_status" } },
        supabase: mockSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid status");
    });

    it("validates project belongs to agency", async () => {
      const mockWrongAgencySupabase = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { id: "project-123", status: "idea", agency_id: "other-agency" },
                error: null,
              }),
            }),
          }),
        }),
      };

      const result = await executeToolAction({
        tool: { type: "update_project_status", payload: { project_id: "project-123", status: "production" } },
        supabase: mockWrongAgencySupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Project not found or unauthorized");
    });

    it("validates required parameters", async () => {
      const result = await executeToolAction({
        tool: { type: "update_project_status", payload: { project_id: "project-123" } },
        supabase: mockSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required parameter: status");
    });
  });

  describe("assign_project_asset", () => {
    it("assigns asset to project successfully", async () => {
      const mockProjectSupabase = {
        from: (table: string) => {
          if (table === "projects") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({ data: { id: "project-123", agency_id: "agency-1" }, error: null }),
                }),
              }),
            };
          }
          if (table === "assets") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: { id: "asset-456", client_id: "client-123", clients: { agency_id: "agency-1" } },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "project_assets") {
            return {
              upsert: () => ({
                select: () => ({
                  single: async () => ({ data: { id: "project-asset-789" }, error: null }),
                }),
              }),
            };
          }
          return {};
        },
      };

      const result = await executeToolAction({
        tool: {
          type: "assign_project_asset",
          payload: { project_id: "project-123", asset_id: "asset-456", is_final_content: "true" },
        },
        supabase: mockProjectSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.result.project_asset_id).toBe("project-asset-789");
      expect(result.result.is_final_content).toBe(true);
    });

    it("validates required parameters", async () => {
      const result = await executeToolAction({
        tool: { type: "assign_project_asset", payload: { project_id: "project-123" } },
        supabase: mockSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required parameter: asset_id");
    });

    it("validates project belongs to agency", async () => {
      const mockWrongAgencySupabase = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { id: "project-123", agency_id: "other-agency" }, error: null }),
            }),
          }),
        }),
      };

      const result = await executeToolAction({
        tool: { type: "assign_project_asset", payload: { project_id: "project-123", asset_id: "asset-456" } },
        supabase: mockWrongAgencySupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Project not found or unauthorized");
    });

    it("validates asset belongs to agency", async () => {
      const mockWrongAssetAgencySupabase = {
        from: (table: string) => {
          if (table === "projects") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({ data: { id: "project-123", agency_id: "agency-1" }, error: null }),
                }),
              }),
            };
          }
          if (table === "assets") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: { id: "asset-456", client_id: "client-123", clients: { agency_id: "other-agency" } },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        },
      };

      const result = await executeToolAction({
        tool: { type: "assign_project_asset", payload: { project_id: "project-123", asset_id: "asset-456" } },
        supabase: mockWrongAssetAgencySupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Asset not found or unauthorized");
    });

    it("parses is_final_content boolean", async () => {
      const mockProjectSupabase = {
        from: (table: string) => {
          if (table === "projects") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({ data: { id: "project-123", agency_id: "agency-1" }, error: null }),
                }),
              }),
            };
          }
          if (table === "assets") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: { id: "asset-456", client_id: "client-123", clients: { agency_id: "agency-1" } },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "project_assets") {
            return {
              upsert: () => ({
                select: () => ({
                  single: async () => ({ data: { id: "project-asset-789" }, error: null }),
                }),
              }),
            };
          }
          return {};
        },
      };

      const result = await executeToolAction({
        tool: {
          type: "assign_project_asset",
          payload: { project_id: "project-123", asset_id: "asset-456", is_final_content: "false" },
        },
        supabase: mockProjectSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.result.is_final_content).toBe(false);
    });
  });

  describe("schedule_post", () => {
    it("schedules post successfully", async () => {
      const mockScheduleSupabase = {
        from: (table: string) => {
          if (table === "projects") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({ data: { id: "project-123", agency_id: "agency-1" }, error: null }),
                }),
              }),
            };
          }
          if (table === "scheduled_posts") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    gte: () => ({
                      lte: () => ({
                        maybeSingle: async () => ({ data: null, error: null }),
                      }),
                    }),
                  }),
                }),
              }),
              insert: () => ({
                select: () => ({
                  single: async () => ({ data: { id: "scheduled-post-789" }, error: null }),
                }),
              }),
            };
          }
          return {};
        },
      };

      const result = await executeToolAction({
        tool: {
          type: "schedule_post",
          payload: {
            project_id: "project-123",
            platform: "instagram",
            scheduled_for: "2025-02-01T10:00:00Z",
            caption: "Test post",
            hashtags: "#test #post",
          },
        },
        supabase: mockScheduleSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.result.scheduled_post_id).toBe("scheduled-post-789");
      expect(result.result.platform).toBe("instagram");
      expect(result.result.existing).toBe(false);
    });

    it("returns existing scheduled post (idempotency)", async () => {
      const mockScheduleSupabase = {
        from: (table: string) => {
          if (table === "projects") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({ data: { id: "project-123", agency_id: "agency-1" }, error: null }),
                }),
              }),
            };
          }
          if (table === "scheduled_posts") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    gte: () => ({
                      lte: () => ({
                        maybeSingle: async () => ({ data: { id: "existing-post" }, error: null }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          return {};
        },
      };

      const result = await executeToolAction({
        tool: {
          type: "schedule_post",
          payload: { project_id: "project-123", platform: "instagram", scheduled_for: "2025-02-01T10:00:00Z" },
        },
        supabase: mockScheduleSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.result.scheduled_post_id).toBe("existing-post");
      expect(result.result.existing).toBe(true);
    });

    it("validates platform enum", async () => {
      const result = await executeToolAction({
        tool: {
          type: "schedule_post",
          payload: { project_id: "project-123", platform: "invalid_platform", scheduled_for: "2025-02-01T10:00:00Z" },
        },
        supabase: mockSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid platform");
    });

    it("validates ISO date format", async () => {
      const result = await executeToolAction({
        tool: { type: "schedule_post", payload: { project_id: "project-123", platform: "instagram", scheduled_for: "bad-date" } },
        supabase: mockSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("scheduled_for must be a valid ISO date string");
    });

    it("validates project belongs to agency", async () => {
      const mockWrongAgencySupabase = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { id: "project-123", agency_id: "other-agency" }, error: null }),
            }),
          }),
        }),
      };

      const result = await executeToolAction({
        tool: {
          type: "schedule_post",
          payload: { project_id: "project-123", platform: "instagram", scheduled_for: "2025-02-01T10:00:00Z" },
        },
        supabase: mockWrongAgencySupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Project not found or unauthorized");
    });
  });

  describe("update_task_status", () => {
    it("updates task status successfully", async () => {
      const mockTaskSupabase = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { id: "task-123", status: "todo", agency_id: "agency-1" },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: () => ({ error: null }),
          }),
        }),
      };

      const result = await executeToolAction({
        tool: { type: "update_task_status", payload: { task_id: "task-123", status: "in_progress" } },
        supabase: mockTaskSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.result.status).toBe("in_progress");
      expect(result.result.changed).toBe(true);
      expect(result.result.previous_status).toBe("todo");
    });

    it("returns success if already in target status (idempotency)", async () => {
      const mockTaskSupabase = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { id: "task-123", status: "completed", agency_id: "agency-1" },
                error: null,
              }),
            }),
          }),
        }),
      };

      const result = await executeToolAction({
        tool: { type: "update_task_status", payload: { task_id: "task-123", status: "completed" } },
        supabase: mockTaskSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.result.changed).toBe(false);
    });

    it("validates status enum", async () => {
      const result = await executeToolAction({
        tool: { type: "update_task_status", payload: { task_id: "task-123", status: "invalid_status" } },
        supabase: mockSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid status");
    });

    it("validates task belongs to agency", async () => {
      const mockWrongAgencySupabase = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { id: "task-123", status: "todo", agency_id: "other-agency" },
                error: null,
              }),
            }),
          }),
        }),
      };

      const result = await executeToolAction({
        tool: { type: "update_task_status", payload: { task_id: "task-123", status: "in_progress" } },
        supabase: mockWrongAgencySupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found or unauthorized");
    });

    it("validates required parameters", async () => {
      const result = await executeToolAction({
        tool: { type: "update_task_status", payload: { task_id: "task-123" } },
        supabase: mockSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required parameter: status");
    });
  });

  describe("update_task_priority", () => {
    it("updates task priority successfully", async () => {
      const mockTaskSupabase = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { id: "task-123", priority: "medium", agency_id: "agency-1" },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: () => ({ error: null }),
          }),
        }),
      };

      const result = await executeToolAction({
        tool: { type: "update_task_priority", payload: { task_id: "task-123", priority: "high" } },
        supabase: mockTaskSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.result.priority).toBe("high");
      expect(result.result.changed).toBe(true);
      expect(result.result.previous_priority).toBe("medium");
    });

    it("returns success if already at target priority (idempotency)", async () => {
      const mockTaskSupabase = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { id: "task-123", priority: "urgent", agency_id: "agency-1" },
                error: null,
              }),
            }),
          }),
        }),
      };

      const result = await executeToolAction({
        tool: { type: "update_task_priority", payload: { task_id: "task-123", priority: "urgent" } },
        supabase: mockTaskSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.result.changed).toBe(false);
    });

    it("validates priority enum", async () => {
      const result = await executeToolAction({
        tool: { type: "update_task_priority", payload: { task_id: "task-123", priority: "invalid_priority" } },
        supabase: mockSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid priority");
    });

    it("validates task belongs to agency", async () => {
      const mockWrongAgencySupabase = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { id: "task-123", priority: "medium", agency_id: "other-agency" },
                error: null,
              }),
            }),
          }),
        }),
      };

      const result = await executeToolAction({
        tool: { type: "update_task_priority", payload: { task_id: "task-123", priority: "high" } },
        supabase: mockWrongAgencySupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found or unauthorized");
    });

    it("validates required parameters", async () => {
      const result = await executeToolAction({
        tool: { type: "update_task_priority", payload: { task_id: "task-123" } },
        supabase: mockSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required parameter: priority");
    });
  });

  describe("request_approval", () => {
    it("creates approval request successfully", async () => {
      const mockApprovalSupabase = {
        from: (table: string) => {
          if (table === "asset_versions") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: {
                      id: "version-123",
                      asset_id: "asset-456",
                      assets: { id: "asset-456", client_id: "client-789", clients: { agency_id: "agency-1" } },
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "approval_tasks") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
              insert: () => ({
                select: () => ({
                  single: async () => ({ data: { id: "approval-999" }, error: null }),
                }),
              }),
            };
          }
          return {};
        },
      };

      const result = await executeToolAction({
        tool: {
          type: "request_approval",
          payload: { asset_version_id: "version-123", approver_id: "user-456", comments: "Please review" },
        },
        supabase: mockApprovalSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.result.approval_task_id).toBe("approval-999");
      expect(result.result.existing).toBe(false);
    });

    it("returns existing approval request (idempotency)", async () => {
      const mockApprovalSupabase = {
        from: (table: string) => {
          if (table === "asset_versions") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: {
                      id: "version-123",
                      asset_id: "asset-456",
                      assets: { id: "asset-456", client_id: "client-789", clients: { agency_id: "agency-1" } },
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "approval_tasks") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: { id: "existing-approval" }, error: null }),
                  }),
                }),
              }),
            };
          }
          return {};
        },
      };

      const result = await executeToolAction({
        tool: { type: "request_approval", payload: { asset_version_id: "version-123", approver_id: "user-456" } },
        supabase: mockApprovalSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.result.approval_task_id).toBe("existing-approval");
      expect(result.result.existing).toBe(true);
    });

    it("validates required parameters", async () => {
      const result = await executeToolAction({
        tool: { type: "request_approval", payload: { asset_version_id: "version-123" } },
        supabase: mockSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required parameter: approver_id");
    });

    it("validates asset version belongs to agency", async () => {
      const mockWrongAgencySupabase = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: "version-123",
                  asset_id: "asset-456",
                  assets: { id: "asset-456", client_id: "client-789", clients: { agency_id: "other-agency" } },
                },
                error: null,
              }),
            }),
          }),
        }),
      };

      const result = await executeToolAction({
        tool: { type: "request_approval", payload: { asset_version_id: "version-123", approver_id: "user-456" } },
        supabase: mockWrongAgencySupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Asset version not found or unauthorized");
    });

    it("handles optional comments parameter", async () => {
      const mockApprovalSupabase = {
        from: (table: string) => {
          if (table === "asset_versions") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: {
                      id: "version-123",
                      asset_id: "asset-456",
                      assets: { id: "asset-456", client_id: "client-789", clients: { agency_id: "agency-1" } },
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "approval_tasks") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
              insert: () => ({
                select: () => ({
                  single: async () => ({ data: { id: "approval-999" }, error: null }),
                }),
              }),
            };
          }
          return {};
        },
      };

      const result = await executeToolAction({
        tool: { type: "request_approval", payload: { asset_version_id: "version-123", approver_id: "user-456" } },
        supabase: mockApprovalSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("send_message", () => {
    it("sends message successfully", async () => {
      const mockMessageSupabase = {
        from: (table: string) => {
          if (table === "conversations") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({ data: { id: "conv-123" }, error: null }),
                }),
              }),
            };
          }
          if (table === "conversation_participants") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: { id: "participant-456" }, error: null }),
                  }),
                }),
              }),
            };
          }
          if (table === "messages") {
            return {
              insert: () => ({
                select: () => ({
                  single: async () => ({ data: { id: "message-789" }, error: null }),
                }),
              }),
            };
          }
          return {};
        },
      };

      const result = await executeToolAction({
        tool: {
          type: "send_message",
          payload: { conversation_id: "conv-123", body: "Hello team", related_project_id: "project-456" },
        },
        supabase: mockMessageSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.result.message_id).toBe("message-789");
      expect(result.result.conversation_id).toBe("conv-123");
    });

    it("validates required parameters", async () => {
      const result = await executeToolAction({
        tool: { type: "send_message", payload: { conversation_id: "conv-123" } },
        supabase: mockSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required parameter: body");
    });

    it("validates conversation exists", async () => {
      const mockNoConvSupabase = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              single: async () => ({ data: null, error: { message: "Not found" } }),
            }),
          }),
        }),
      };

      const result = await executeToolAction({
        tool: { type: "send_message", payload: { conversation_id: "conv-999", body: "Hello" } },
        supabase: mockNoConvSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Conversation not found");
    });

    it("validates user is participant in conversation", async () => {
      const mockNoParticipantSupabase = {
        from: (table: string) => {
          if (table === "conversations") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({ data: { id: "conv-123" }, error: null }),
                }),
              }),
            };
          }
          if (table === "conversation_participants") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
            };
          }
          return {};
        },
      };

      const result = await executeToolAction({
        tool: { type: "send_message", payload: { conversation_id: "conv-123", body: "Hello" } },
        supabase: mockNoParticipantSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("User not authorized for this conversation");
    });

    it("handles optional related_project_id parameter", async () => {
      const mockMessageSupabase = {
        from: (table: string) => {
          if (table === "conversations") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({ data: { id: "conv-123" }, error: null }),
                }),
              }),
            };
          }
          if (table === "conversation_participants") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: { id: "participant-456" }, error: null }),
                  }),
                }),
              }),
            };
          }
          if (table === "messages") {
            return {
              insert: () => ({
                select: () => ({
                  single: async () => ({ data: { id: "message-789" }, error: null }),
                }),
              }),
            };
          }
          return {};
        },
      };

      const result = await executeToolAction({
        tool: { type: "send_message", payload: { conversation_id: "conv-123", body: "Hello" } },
        supabase: mockMessageSupabase,
        agencyId: "agency-1",
        userId: "user-1",
      });

      expect(result.success).toBe(true);
    });
  });
});

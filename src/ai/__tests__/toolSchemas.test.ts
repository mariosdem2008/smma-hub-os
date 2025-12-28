import { describe, it, expect } from "vitest";
import { ToolType, TOOL_REGISTRY } from "../toolSchemas.ts";

describe("tool schemas", () => {
  it("exports all 12 tool types", () => {
    expect(Object.keys(TOOL_REGISTRY)).toHaveLength(12);
    // Original 4 tools
    expect(TOOL_REGISTRY[ToolType.CREATE_CLIENT]).toBeDefined();
    expect(TOOL_REGISTRY[ToolType.DRAFT_OFFER]).toBeDefined();
    expect(TOOL_REGISTRY[ToolType.UPDATE_BRAIN]).toBeDefined();
    expect(TOOL_REGISTRY[ToolType.SCHEDULE_TASK]).toBeDefined();
    // TASK-017: Project Management (3 tools)
    expect(TOOL_REGISTRY[ToolType.CREATE_PROJECT]).toBeDefined();
    expect(TOOL_REGISTRY[ToolType.UPDATE_PROJECT_STATUS]).toBeDefined();
    expect(TOOL_REGISTRY[ToolType.ASSIGN_PROJECT_ASSET]).toBeDefined();
    // TASK-018: Scheduling & Tasks (3 tools)
    expect(TOOL_REGISTRY[ToolType.SCHEDULE_POST]).toBeDefined();
    expect(TOOL_REGISTRY[ToolType.UPDATE_TASK_STATUS]).toBeDefined();
    expect(TOOL_REGISTRY[ToolType.UPDATE_TASK_PRIORITY]).toBeDefined();
    // TASK-019: Approvals & Communication (2 tools)
    expect(TOOL_REGISTRY[ToolType.REQUEST_APPROVAL]).toBeDefined();
    expect(TOOL_REGISTRY[ToolType.SEND_MESSAGE]).toBeDefined();
  });

  it("enforces schema structure for all entries", () => {
    for (const [key, schema] of Object.entries(TOOL_REGISTRY)) {
      expect(schema).toHaveProperty("type");
      expect(schema).toHaveProperty("description");
      expect(schema).toHaveProperty("parameters");
      expect(schema.description).toBeTruthy();
      expect(typeof schema.parameters).toBe("object");
    }
  });

  it("schedule_task schema includes client_id parameter", () => {
    const schema = TOOL_REGISTRY[ToolType.SCHEDULE_TASK];
    expect(schema.parameters.client_id).toBeDefined();
    expect(schema.parameters.client_id.type).toBe("string");
    expect(schema.parameters.client_id.required).toBe(false);
  });

  it("all required parameters are marked correctly", () => {
    expect(TOOL_REGISTRY[ToolType.CREATE_CLIENT].parameters.name.required).toBe(true);
    expect(TOOL_REGISTRY[ToolType.DRAFT_OFFER].parameters.service_type.required).toBe(true);
    expect(TOOL_REGISTRY[ToolType.UPDATE_BRAIN].parameters.field.required).toBe(true);
    expect(TOOL_REGISTRY[ToolType.UPDATE_BRAIN].parameters.value.required).toBe(true);
    expect(TOOL_REGISTRY[ToolType.SCHEDULE_TASK].parameters.title.required).toBe(true);
    expect(TOOL_REGISTRY[ToolType.SCHEDULE_TASK].parameters.due_date.required).toBe(true);
  });
});

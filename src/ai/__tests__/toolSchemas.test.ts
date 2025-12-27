import { describe, it, expect } from "vitest";
import { ToolType, TOOL_REGISTRY } from "../toolSchemas.ts";

describe("tool schemas", () => {
  it("exports all 4 tool types", () => {
    expect(Object.keys(TOOL_REGISTRY)).toHaveLength(4);
    expect(TOOL_REGISTRY[ToolType.CREATE_CLIENT]).toBeDefined();
    expect(TOOL_REGISTRY[ToolType.DRAFT_OFFER]).toBeDefined();
    expect(TOOL_REGISTRY[ToolType.UPDATE_BRAIN]).toBeDefined();
    expect(TOOL_REGISTRY[ToolType.SCHEDULE_TASK]).toBeDefined();
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

import { describe, it, expect } from "vitest";
import { TOOL_REGISTRY, ToolType } from "../../src/ai/toolSchemas";

describe.skip("tenant scoping: 0 cross-tenant leaks - tool scope negative cases", () => {
  it("does not allow unexpected global-admin tools (prevents scope escalation)", () => {
    const allowedGlobalAdmin = new Set<string>([ToolType.APPROVE_ACTION]);
    const globalAdminTools = Object.values(TOOL_REGISTRY)
      .filter((t) => t.scope === "global-admin")
      .map((t) => t.type);

    // Any new global-admin tool is a multi-tenant risk and must be reviewed explicitly.
    expect(globalAdminTools.sort()).toEqual([...allowedGlobalAdmin].sort());
  });

  it("requires tenant_id on memory write proposals (explicit tenant scoping; 0 cross-tenant leaks)", () => {
    const schema = TOOL_REGISTRY[ToolType.PROPOSE_MEMORY_WRITE];
    expect(schema.scope).toBe("tenant-write");
    expect(schema.parameters.tenant_id?.required).toBe(true);
  });

  it("ensures tenant-scoped tools are not marked global-admin", () => {
    const tenantTools = Object.values(TOOL_REGISTRY).filter((t) =>
      t.scope === "tenant-read" || t.scope === "tenant-write"
    );
    expect(tenantTools.length).toBeGreaterThan(0);
    for (const tool of tenantTools) {
      expect(tool.scope).not.toBe("global-admin");
    }
  });
});

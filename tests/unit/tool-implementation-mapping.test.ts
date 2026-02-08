import { describe, it, expect } from "vitest";
import { TOOL_REGISTRY } from "../../src/ai/toolSchemas.ts";

describe.skip("tool implementation mapping (Phase 1)", () => {
  it("all report tools exist in registry", () => {
    const ids = Object.keys(TOOL_REGISTRY);
    const required = [
      "search_knowledge_base",
      "get_client_history",
      "fetch_campaign_performance",
      "get_account_details",
      "update_client_record",
      "create_new_task",
      "generate_strategy_report",
      "trigger_email_sequence",
      "propose_memory_write",
      "validate_pii",
      "check_compliance_flags",
      "approve_action",
    ];
    for (const tool of required) {
      expect(ids).toContain(tool);
    }
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("phase2 onboarding SQL verification coverage", () => {
  it("includes checks for onboarding idempotency columns and index", () => {
    const sqlPath = resolve(process.cwd(), "supabase/tests/cross-tenant-isolation.sql");
    const sql = readFileSync(sqlPath, "utf8");

    expect(sql).toContain("ai_onboarding_turn_logs_client_turn_id_column");
    expect(sql).toContain("ai_onboarding_turn_logs_response_json_column");
    expect(sql).toContain("ai_onboarding_turn_logs_idempotency_index");
  });
});

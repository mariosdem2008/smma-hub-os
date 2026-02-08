import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("phase1 onboarding RLS verification script coverage", () => {
  it("includes RLS checks for the new phase1 tables", () => {
    const sqlPath = resolve(process.cwd(), "supabase/tests/cross-tenant-isolation.sql");
    const sql = readFileSync(sqlPath, "utf8");

    expect(sql).toContain("ai_onboarding_status_rls");
    expect(sql).toContain("where relname = 'ai_onboarding_status'");

    expect(sql).toContain("ai_persona_vectors_rls");
    expect(sql).toContain("where relname = 'ai_persona_vectors'");

    expect(sql).toContain("ai_onboarding_turn_logs_rls");
    expect(sql).toContain("where relname = 'ai_onboarding_turn_logs'");
  });

  it("includes trigger guard checks for client-agency consistency hardening", () => {
    const sqlPath = resolve(process.cwd(), "supabase/tests/cross-tenant-isolation.sql");
    const sql = readFileSync(sqlPath, "utf8");

    expect(sql).toContain("ai_onboarding_status_client_agency_guard");
    expect(sql).toContain("trg_ai_onboarding_status_client_agency_guard");

    expect(sql).toContain("ai_persona_vectors_client_agency_guard");
    expect(sql).toContain("trg_ai_persona_vectors_client_agency_guard");

    expect(sql).toContain("ai_onboarding_turn_logs_client_agency_guard");
    expect(sql).toContain("trg_ai_onboarding_turn_logs_client_agency_guard");

    expect(sql).toContain("ai_onboarding_turn_logs_status_scope_guard");
    expect(sql).toContain("trg_ai_onboarding_turn_logs_status_scope_guard");
  });
});

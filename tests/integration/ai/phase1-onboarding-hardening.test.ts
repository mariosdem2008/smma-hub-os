import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("phase1 onboarding tenant consistency hardening migration", () => {
  const migrationPath = resolve(
    process.cwd(),
    "supabase/migrations/20260202039000_phase1_tenant_consistency_hardening.sql"
  );

  it("adds client->agency assertion function and trigger guards", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("create or replace function public.assert_client_belongs_to_agency()");
    expect(sql).toContain("from public.clients c");
    expect(sql).toContain("if v_client_agency <> new.agency_id then");

    expect(sql).toContain("create trigger trg_ai_onboarding_status_client_agency_guard");
    expect(sql).toContain("create trigger trg_ai_persona_vectors_client_agency_guard");
    expect(sql).toContain("create trigger trg_ai_onboarding_turn_logs_client_agency_guard");
  });

  it("adds onboarding status scope consistency guard for turn logs", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("create or replace function public.assert_onboarding_log_status_scope_match()");
    expect(sql).toContain("from public.ai_onboarding_status s");
    expect(sql).toContain("onboarding_status_id % client scope mismatch with onboarding_turn_log");
    expect(sql).toContain("create trigger trg_ai_onboarding_turn_logs_status_scope_guard");
  });
});


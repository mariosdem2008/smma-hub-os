import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("phase1 onboarding schema migration", () => {
  const migrationPath = resolve(
    process.cwd(),
    "supabase/migrations/20260202038000_phase1_onboarding_state_persona_and_logs.sql"
  );

  it("creates onboarding state, persona vectors, and onboarding turn logs", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("create table if not exists public.ai_onboarding_status");
    expect(sql).toContain("create table if not exists public.ai_persona_vectors");
    expect(sql).toContain("create table if not exists public.ai_onboarding_turn_logs");
  });

  it("enforces Alex default persona and scope consistency checks", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("assistant_name text not null default 'Alex'");
    expect(sql).toContain("(scope = 'agency' and client_id is null)");
    expect(sql).toContain("(scope = 'client' and client_id is not null)");
  });

  it("enables RLS and creates membership-scoped policies", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("alter table public.ai_onboarding_status enable row level security");
    expect(sql).toContain("alter table public.ai_persona_vectors enable row level security");
    expect(sql).toContain("alter table public.ai_onboarding_turn_logs enable row level security");
    expect(sql).toContain("create policy \"ai_onboarding_status_select\"");
    expect(sql).toContain("create policy \"ai_persona_vectors_select\"");
    expect(sql).toContain("create policy \"ai_onboarding_turn_logs_select\"");
    expect(sql).toContain("agency_members");
  });
});


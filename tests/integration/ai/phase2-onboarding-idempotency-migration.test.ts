import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("phase2 onboarding idempotency migration", () => {
  const migrationPath = resolve(
    process.cwd(),
    "supabase/migrations/20260205091000_phase2_onboarding_turn_idempotency_and_response_payload.sql"
  );

  it("adds idempotency and response payload columns to onboarding turn logs", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("add column if not exists client_turn_id text");
    expect(sql).toContain("add column if not exists response_json jsonb not null default '{}'::jsonb");
  });

  it("creates unique idempotency index scoped to onboarding_status_id", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("create unique index idx_ai_onboarding_turn_logs_idempotency");
    expect(sql).toContain("on public.ai_onboarding_turn_logs(onboarding_status_id, client_turn_id)");
  });
});

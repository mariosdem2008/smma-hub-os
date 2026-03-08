import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function load(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("ai_jobs policy contract", () => {
  it("allows owner/admin reads in ai_jobs select policy migration", () => {
    const migration = load("supabase/migrations/20260307134500_fix_ai_jobs_owner_admin_select_policy.sql");
    expect(migration).toContain("drop policy if exists \"ai_jobs_admin_select\" on public.ai_jobs;");
    expect(migration).toContain("am.role in ('owner', 'admin')");
    expect(migration).toContain("from public.agencies a");
    expect(migration).toContain("a.user_id = auth.uid()");
  });
});

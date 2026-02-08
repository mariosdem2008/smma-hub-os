import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("phase7 onboarding observability RLS verification coverage", () => {
  it("includes ai_runs and ai_otel_spans RLS checks in cross-tenant SQL", () => {
    const sqlPath = resolve(process.cwd(), "supabase/tests/cross-tenant-isolation.sql");
    const sql = readFileSync(sqlPath, "utf8");

    expect(sql).toContain("ai_runs_rls");
    expect(sql).toContain("where relname = 'ai_runs'");
    expect(sql).toContain("ai_otel_spans_rls");
    expect(sql).toContain("where relname = 'ai_otel_spans'");
  });
});

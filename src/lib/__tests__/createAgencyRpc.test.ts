import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("create_agency_with_admin migration", () => {
  it("sets agency_members role=admin for creator", () => {
    const migrationPath = resolve("supabase/migrations/20251225210000_agency_onboarding_and_create_agency_rpc.sql");
    const sql = readFileSync(migrationPath, "utf-8");
    expect(sql).toContain("create_agency_with_admin");
    expect(sql).toContain("insert into public.agency_members");
    expect(sql).toContain("'admin'");
  });
});


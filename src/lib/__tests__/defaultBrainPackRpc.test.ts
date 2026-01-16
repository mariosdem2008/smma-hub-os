import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("seed_default_brain_pack_v1 migration", () => {
  it("creates an idempotent, atomic RPC that inserts drafts + versions", () => {
    const migrationPath = resolve("supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql");
    const sql = readFileSync(migrationPath, "utf-8");

    expect(sql).toContain("create or replace function public.seed_default_brain_pack_v1");
    expect(sql).toContain("jsonb_array_length(p_docs) <> 3");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("where agency_id = p_agency_id");
    expect(sql).toContain("insert into public.brain_documents");
    expect(sql).toContain("'draft'::public.brain_document_status");
    expect(sql).toContain("insert into public.brain_document_versions");
    expect(sql).toContain("return query");
  });
});

describe("repair_default_brain_pack_v1 migration", () => {
  it("creates an idempotent, atomic RPC that inserts only missing modules", () => {
    const migrationPath = resolve("supabase/migrations/20260116210000_repair_default_brain_pack_v1_rpc.sql");
    const sql = readFileSync(migrationPath, "utf-8");

    expect(sql).toContain("create or replace function public.repair_default_brain_pack_v1");
    expect(sql).toContain("jsonb_array_length(p_docs) <> 3");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("am.role in ('owner', 'admin')");
    expect(sql).toContain("insert into public.brain_documents");
    expect(sql).toContain("'draft'::public.brain_document_status");
    expect(sql).toContain("insert into public.brain_document_versions");
  });
});

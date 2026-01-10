import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("brain document RAG filter", () => {
  it("limits brain_document retrieval to approved status", () => {
    const migrationPath = resolve(process.cwd(), "supabase/migrations/20260108123000_brain_documents_rag.sql");
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("brain_document");
    expect(sql).toContain("metadata->>'status'");
    expect(sql).toContain("= 'approved'");
  });
});

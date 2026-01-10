import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("embedding retrieval filter", () => {
  it("filters out failed chunks in match_ai_embeddings", () => {
    const migrationPath = resolve(process.cwd(), "supabase/migrations/20260105140000_embedding_chunk_status.sql");
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("embedding_status = 'ok'");
  });
});

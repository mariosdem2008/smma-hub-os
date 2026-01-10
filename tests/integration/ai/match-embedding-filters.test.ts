import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("match_ai_embeddings filters", () => {
  it("adds module filter, min similarity, and hard cap", () => {
    const migrationPath = resolve(
      process.cwd(),
      "supabase/migrations/20260108134500_match_ai_embeddings_filters.sql"
    );
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("p_modules");
    expect(sql).toContain("metadata->>'module'");
    expect(sql).toContain("p_min_similarity");
    expect(sql).toContain("limit least");
  });
});

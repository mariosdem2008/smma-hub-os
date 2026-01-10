import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("strategy snapshot RPC", () => {
  it("writes modules, documents, decisions, and tasks in one function", () => {
    const migrationPath = resolve(
      process.cwd(),
      "supabase/migrations/20260108143000_strategy_snapshot_rpc.sql"
    );
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("create_strategy_snapshot");
    expect(sql).toContain("strategy_modules");
    expect(sql).toContain("strategy_documents");
    expect(sql).toContain("strategy_decisions");
    expect(sql).toContain("strategy_tasks");
  });
});

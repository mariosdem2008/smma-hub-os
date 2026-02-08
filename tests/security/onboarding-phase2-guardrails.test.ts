import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

function readAllFilesRecursive(root: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(root);
  for (const entry of entries) {
    const fullPath = join(root, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...readAllFilesRecursive(fullPath));
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

describe("phase2 onboarding security guardrails", () => {
  it("allowlists ai-onboarding endpoint explicitly", () => {
    const guardPath = resolve(process.cwd(), "supabase/functions/_shared/endpoint-guard.ts");
    const source = readFileSync(guardPath, "utf8");
    expect(source).toContain("\"ai-onboarding\"");
  });

  it("keeps scoped embedding match RPC usage out of client code", () => {
    const srcRoot = resolve(process.cwd(), "src");
    const files = readAllFilesRecursive(srcRoot).filter((file) =>
      file.endsWith(".ts") || file.endsWith(".tsx")
    );

    const offenders = files.filter((file) => {
      const source = readFileSync(file, "utf8");
      return source.includes("match_ai_embeddings_scoped");
    });

    expect(offenders).toEqual([]);
  });

  it("documents service-role-only privileges for scoped embedding RPC", () => {
    const sqlPath = resolve(process.cwd(), "supabase/tests/cross-tenant-isolation.sql");
    const sql = readFileSync(sqlPath, "utf8");
    expect(sql).toContain("match_ai_embeddings_scoped_privileges");
    expect(sql).toContain("has_function_privilege('service_role', oid, 'execute')");
    expect(sql).toContain("not has_function_privilege('authenticated', oid, 'execute')");
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

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

describe("phase4 onboarding security guardrails", () => {
  it("keeps ai-brain-ingest invocation out of client-side code", () => {
    const srcRoot = resolve(process.cwd(), "src");
    const files = readAllFilesRecursive(srcRoot).filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));

    const offenders = files.filter((file) => {
      const source = readFileSync(file, "utf8");
      return source.includes("functions.invoke(\"ai-brain-ingest\")");
    });

    expect(offenders).toEqual([]);
  });

  it("retains service-role edge execution for onboarding and brain ingest", () => {
    const onboardingSource = readFileSync(
      resolve(process.cwd(), "supabase/functions/ai-onboarding/index.ts"),
      "utf8",
    );
    const ingestSource = readFileSync(
      resolve(process.cwd(), "supabase/functions/ai-brain-ingest/index.ts"),
      "utf8",
    );

    expect(onboardingSource).toContain("createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    expect(ingestSource).toContain("createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  });
});

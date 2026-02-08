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

describe("phase5 persona prompt security guardrails", () => {
  it("keeps persona table access out of client-side code", () => {
    const srcRoot = resolve(process.cwd(), "src");
    const files = readAllFilesRecursive(srcRoot).filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));

    const offenders = files.filter((file) => {
      const source = readFileSync(file, "utf8");
      return source.includes("ai_persona_vectors");
    });

    expect(offenders).toEqual([]);
  });

  it("uses edge service-role for persona prompt context resolution", () => {
    const assistantSource = readFileSync(resolve(process.cwd(), "supabase/functions/ai-assistant/index.ts"), "utf8");
    const onboardingSource = readFileSync(resolve(process.cwd(), "supabase/functions/ai-onboarding/index.ts"), "utf8");

    expect(assistantSource).toContain("createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    expect(assistantSource).toContain("resolvePersonaPromptContext");
    expect(onboardingSource).toContain("prompt_cache_version");
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("strategy generation implementation", () => {
  it("returns gated codes with deep links", () => {
    const fn = read("supabase/functions/ai-strategy-generate/index.ts");
    expect(fn).toContain("BRAIN_INCOMPLETE");
    expect(fn).toContain("AGENCY_BRAIN_INCOMPLETE");
    expect(fn).toContain("/agency/ai-setup");
    expect(fn).toContain("/onboarding/client/");
    expect(fn).toContain("deep_link");
  });

  it("appends references section to generated markdown", () => {
    const fn = read("supabase/functions/ai-strategy-generate/index.ts");
    expect(fn).toContain('replace(/^References:/, "## References")');
  });

  it("extends STRATEGY_PLAN timeout to 3 minutes", () => {
    const router = read("src/ai/router.ts");
    expect(router).toContain("case TaskType.STRATEGY_PLAN");
    expect(router).toContain("180_000");
  });

  it("does not require agency_brains for STRATEGY_PLAN", () => {
    const registry = read("src/ai/taskRegistry.ts");
    expect(registry).toContain("[TaskType.STRATEGY_PLAN]");
    expect(registry).toContain("requires: { agency: false, client: false }");
  });

  it("hardens match_ai_embeddings to service_role only", () => {
    const migration = read("supabase/migrations/20260118000001_harden_match_ai_embeddings_final.sql");
    expect(migration).toMatch(/revoke all on function public\.match_ai_embeddings/i);
    expect(migration).toMatch(/grant execute on function public\.match_ai_embeddings/i);
    expect(migration).toMatch(/service_role/i);
  });
});

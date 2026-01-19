import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("ingestion health module coverage", () => {
  it("does not hardcode default modules only", () => {
    const hookPath = resolve(process.cwd(), "src/hooks/useDefaultBrainPackIngestionHealth.ts");
    const content = readFileSync(hookPath, "utf8");
    expect(content).not.toContain("DEFAULT_MODULES");
  });
});


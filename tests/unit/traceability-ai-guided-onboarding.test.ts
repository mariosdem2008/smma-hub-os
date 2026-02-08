import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const THIS_FILE = fileURLToPath(import.meta.url);
const THIS_DIR = path.dirname(THIS_FILE);
const REPO_ROOT = path.resolve(THIS_DIR, "..", "..");
const SCRIPT_PATH = path.join(REPO_ROOT, "scripts", "traceability", "ai-guided-onboarding.mjs");

describe("ai-guided-onboarding traceability gate", () => {
  it("passes consistency checks in --check mode", () => {
    const result = spawnSync("node", [SCRIPT_PATH, "--check"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });

    expect(result.status, `stderr: ${result.stderr || ""}`).toBe(0);
    expect(result.stdout).toContain("OK: traceability matrix is up to date");
  });
});


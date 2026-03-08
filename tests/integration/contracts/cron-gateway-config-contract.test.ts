import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CRON_FUNCTIONS = [
  "publish-scheduled-posts",
  "refresh-meta-tokens",
  "sync-social-metrics",
  "email-sequence-dispatcher",
  "generate-approval-reminders",
];

function loadConfig() {
  return readFileSync(resolve(process.cwd(), "supabase/config.toml"), "utf8");
}

describe("cron gateway config contract", () => {
  it("sets verify_jwt = false for cron-triggered edge functions", () => {
    const config = loadConfig();
    for (const fnName of CRON_FUNCTIONS) {
      const section = `[functions.${fnName}]`;
      expect(config).toContain(section);
      const sectionIndex = config.indexOf(section);
      const nextSectionIndex = config.indexOf("\n[functions.", sectionIndex + section.length);
      const slice = nextSectionIndex >= 0 ? config.slice(sectionIndex, nextSectionIndex) : config.slice(sectionIndex);
      expect(slice).toContain("verify_jwt = false");
    }
  });
});

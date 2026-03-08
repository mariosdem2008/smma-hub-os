import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CRON_FUNCTIONS = [
  "supabase/functions/email-sequence-dispatcher/index.ts",
  "supabase/functions/generate-approval-reminders/index.ts",
  "supabase/functions/publish-scheduled-posts/index.ts",
  "supabase/functions/refresh-meta-tokens/index.ts",
  "supabase/functions/sync-meta-ads/index.ts",
  "supabase/functions/sync-social-metrics/index.ts",
  "supabase/functions/ai-job-worker/index.ts",
];

function load(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("cron guard contract coverage", () => {
  it("protects scheduled edge functions with verifyCronSecret", () => {
    for (const file of CRON_FUNCTIONS) {
      const source = load(file);
      expect(source).toContain('from "../_shared/cron.ts"');
      expect(source).toContain("verifyCronSecret(");
      expect(source).toContain("if (cronAuth) return cronAuth;");
    }
  });
});

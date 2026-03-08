import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function load(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("oauth lifecycle contracts", () => {
  it("returns a URL field from social-oauth edge function", () => {
    const source = load("supabase/functions/social-oauth/index.ts");
    expect(source).toContain("JSON.stringify({ url })");
  });

  it("accepts URL response shape for reconnect flow in SocialConnectionsSection", () => {
    const source = load("src/components/SocialConnectionsSection.tsx");
    expect(source).toContain("const redirectUrl = data?.url || data?.authUrl;");
    expect(source).toContain("window.location.href = redirectUrl;");
  });
});

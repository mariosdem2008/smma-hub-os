import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function listFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    const entries = readdirSync(current);
    for (const entry of entries) {
      const full = join(current, entry);
      const stats = statSync(full);
      if (stats.isDirectory()) {
        stack.push(full);
      } else if (stats.isFile()) {
        out.push(full);
      }
    }
  }
  return out;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("integration inventory contracts", () => {
  it("ensures every frontend functions.invoke target has a matching edge function directory", () => {
    const srcRoot = resolve(process.cwd(), "src");
    const sourceFiles = listFiles(srcRoot).filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
    const invokeNames = new Set<string>();
    const invokePattern = /functions\.invoke\(\s*["'`]([^"'`]+)["'`]/g;

    for (const file of sourceFiles) {
      const content = readFileSync(file, "utf8");
      let match: RegExpExecArray | null;
      while ((match = invokePattern.exec(content)) !== null) {
        invokeNames.add(match[1]);
      }
    }

    const missing: string[] = [];
    for (const fnName of Array.from(invokeNames).sort()) {
      const entry = resolve(process.cwd(), "supabase/functions", fnName, "index.ts");
      try {
        statSync(entry);
      } catch {
        missing.push(fnName);
      }
    }

    expect(
      missing,
      `Missing edge function implementations for: ${missing.join(", ") || "(none)"}`,
    ).toEqual([]);
  });

  it("ensures frontend rpc targets are present in generated Supabase types", () => {
    const srcRoot = resolve(process.cwd(), "src");
    const sourceFiles = listFiles(srcRoot).filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
    const rpcNames = new Set<string>();
    const rpcPattern = /\.rpc\(\s*["'`]([^"'`]+)["'`]/g;

    for (const file of sourceFiles) {
      const content = readFileSync(file, "utf8");
      let match: RegExpExecArray | null;
      while ((match = rpcPattern.exec(content)) !== null) {
        rpcNames.add(match[1]);
      }
    }

    const typesPath = resolve(process.cwd(), "src/integrations/supabase/types.ts");
    const typesSource = readFileSync(typesPath, "utf8");

    const missingRpc: string[] = [];
    for (const rpcName of Array.from(rpcNames).sort()) {
      const pattern = new RegExp(`\\b${escapeRegex(rpcName)}\\s*:`);
      if (!pattern.test(typesSource)) {
        missingRpc.push(rpcName);
      }
    }

    expect(
      missingRpc,
      `RPCs missing from generated types: ${missingRpc.join(", ") || "(none)"}`,
    ).toEqual([]);
  });
});

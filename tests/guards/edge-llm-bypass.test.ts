import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const PROVIDER_IMPORTS = new Set([
  "openai",
  "anthropic",
  "@anthropic-ai/sdk",
  "cohere-ai",
  "groq-sdk",
  "@mistralai/mistralai",
  "@google/generative-ai",
  "@azure/openai",
  "@aws-sdk/client-bedrock-runtime",
  "@aws-sdk/bedrock-runtime",
]);

const PROVIDER_URL_PATTERNS = [
  /api\.openai\.com/i,
  /api\.anthropic\.com/i,
  /api\.cohere\.ai/i,
  /api\.groq\.com/i,
  /api\.mistral\.ai/i,
  /api\.together\.xyz/i,
  /api\.deepseek\.com/i,
  /generativelanguage\.googleapis\.com/i,
  /bedrock-runtime/i,
];

const ALLOWLIST_DIRS = [path.join("src", "ai", "providers")];

function isAllowedPath(filePath: string) {
  return ALLOWLIST_DIRS.some((dir) => filePath.includes(dir));
}

function walk(dir: string, files: string[] = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function findImports(content: string) {
  const imports: string[] = [];
  const patterns = [
    /import[^'"]+from\s+['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content))) {
      imports.push(match[1]);
    }
  }
  return imports;
}

describe("LLM bypass guards", () => {
  it("allows provider SDK imports only in src/ai/providers", () => {
    const root = process.cwd();
    const files = walk(root);
    const violations: Array<{ file: string; importName: string }> = [];

    for (const file of files) {
      const relPath = path.relative(root, file);
      const content = fs.readFileSync(file, "utf8");
      for (const importName of findImports(content)) {
        if (!PROVIDER_IMPORTS.has(importName)) continue;
        if (isAllowedPath(relPath)) continue;
        violations.push({ file: relPath, importName });
      }
    }

    expect(violations).toEqual([]);
  });

  it("blocks direct provider API calls from supabase/functions", () => {
    const root = process.cwd();
    const functionsDir = path.join(root, "supabase", "functions");
    const files = walk(functionsDir);
    const violations: Array<{ file: string; pattern: string }> = [];

    for (const file of files) {
      const relPath = path.relative(root, file);
      const content = fs.readFileSync(file, "utf8");
      for (const pattern of PROVIDER_URL_PATTERNS) {
        if (pattern.test(content)) {
          violations.push({ file: relPath, pattern: pattern.source });
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

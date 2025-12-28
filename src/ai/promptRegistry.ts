type PromptCache = Map<string, string>;

const PROMPT_CACHE: PromptCache = new Map();

function isProductionEnv() {
  if (typeof Deno !== "undefined" && typeof Deno.env?.get === "function") {
    return Deno.env.get("AI_MODE") === "prod" || Deno.env.get("NODE_ENV") === "production";
  }
  if (typeof process !== "undefined") {
    return process.env.AI_MODE === "prod" || process.env.NODE_ENV === "production";
  }
  return false;
}

function normalizePath(input: string | URL): string | URL {
  if (input instanceof URL) return input;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(input)) {
    try {
      return new URL(input);
    } catch {
      return input;
    }
  }
  return input;
}

function readTextFileSync(path: string | URL): string {
  const normalized = normalizePath(path);
  if (typeof Deno !== "undefined" && typeof (Deno as any).readTextFileSync === "function") {
    return (Deno as any).readTextFileSync(normalized);
  }
  if (typeof process !== "undefined" && process?.versions?.node) {
    let filePath: string | null = null;
    if (normalized instanceof URL) {
      if (normalized.protocol !== "file:") return "";
      filePath = decodeURIComponent(normalized.pathname);
      if (/^\/[A-Za-z]:/.test(filePath)) {
        filePath = filePath.slice(1);
      }
    } else {
      filePath = normalized;
    }
    try {
      const nodeRequire = new Function("return typeof require !== 'undefined' ? require : undefined")();
      if (nodeRequire) {
        const readFileSync = nodeRequire("fs").readFileSync;
        return readFileSync(filePath, "utf8");
      }
    } catch {
      // fall through to binding-based read
    }
    try {
      const fsBinding = (process as any).binding?.("fs");
      if (fsBinding?.readFileUtf8 && filePath) {
        return fsBinding.readFileUtf8(filePath, 0);
      }
    } catch {
      return "";
    }
  }
  try {
    const readFileSync = new Function("return require('fs').readFileSync")();
    return readFileSync(normalized, "utf8");
  } catch {
    return "";
  }
}

function resolvePromptPath(relativePath: string) {
  if (typeof process !== "undefined" && process?.cwd) {
    const separator = process.platform === "win32" ? "\\" : "/";
    const safeRelative = relativePath.split("/").join(separator);
    return `${process.cwd()}${separator}prompts${separator}${safeRelative}`;
  }
  return new URL(`../../prompts/${relativePath}`, import.meta.url);
}

export function loadPromptText(relativePath: string): string {
  if (relativePath.includes("..") || relativePath.startsWith("/") || relativePath.startsWith("\\")) {
    throw new Error(`Invalid prompt path: ${relativePath}`);
  }
  const cached = PROMPT_CACHE.get(relativePath);
  if (cached) return cached;
  const url = resolvePromptPath(relativePath);
  const text = readTextFileSync(url);
  if (!text || !text.trim()) {
    const message = `Prompt missing or empty: ${relativePath}`;
    if (isProductionEnv()) {
      throw new Error(message);
    }
    throw new Error(message);
  }
  PROMPT_CACHE.set(relativePath, text);
  return text;
}

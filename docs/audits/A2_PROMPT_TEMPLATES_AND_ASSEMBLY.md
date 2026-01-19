# A2 — Prompt Templates and Assembly (Current Truth)

## Purpose
Explain how prompt templates are stored, loaded, cached, and assembled into system/user messages across tasks (with emphasis on strategy generation). This matters because prompt path resolution and missing-prompt behavior can cause production breakage or silent degradations if not handled consistently.

## Key Findings Summary
- Prompts are loaded via `loadPromptText(relativePath)` in `src/ai/promptRegistry.ts` with an in-memory cache (`PROMPT_CACHE`).
- `loadPromptText()` validates relative paths (blocks `..` and absolute paths) and throws if prompt text is missing/empty.
- Prompt file resolution is environment-aware: Node uses `process.cwd()/prompts/...`, Deno uses `import.meta.url` relative resolution.
- There is no dedicated `prompts/strategy/*.md` directory in this repo at time of audit (see evidence); strategy prompting is implemented in TypeScript prompt builders under `src/ai/prompts/*` and task registry entries.
- Strategy generation context is injected as a large `context` string passed via `metadata` into the STRATEGY_PLAN prompt builder, rather than assembling from separate `.md` prompt partials.

## Detailed Analysis
### Prompt directory structure (`/prompts`)
- The repo contains a `prompts/` directory with a small set of markdown files; strategy-specific prompt markdown files are not present in `prompts/strategy/` (directory missing).

### Prompt loading mechanism (`src/ai/promptRegistry.ts`)
- `loadPromptText()` reads prompt text synchronously and caches it for subsequent calls.
- Missing/empty prompt content raises an exception (both in prod and non-prod), which will fail the calling AI task early.

### Strategy prompt assembly
- STRATEGY_PLAN uses TypeScript prompt builder(s) in the AI system (see A1 dump) rather than markdown prompt templates.
- Strategy edge function passes a prebuilt `promptContext` string through `metadata.context`.

## Code Evidence
### Command Output (PowerShell equivalent): find prompts -type f -name "*.md" | head -50
```text
C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\prompts\admin_chat\developer_v1.md
C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\prompts\admin_chat\empty_test.md
C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\prompts\admin_chat\output_contracts_v1.md
C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\prompts\admin_chat\playbooks\copywriting_v1.md
C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\prompts\admin_chat\playbooks\offer_core_offer_v1.md
C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\prompts\admin_chat\playbooks\strategy_v1.md
C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\prompts\admin_chat\system_v1.md
```

### Command Output (PowerShell equivalent): tree prompts/ || find prompts -type f
```text
C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\prompts\admin_chat
C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\prompts\admin_chat\developer_v1.md
C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\prompts\admin_chat\empty_test.md
C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\prompts\admin_chat\output_contracts_v1.md
C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\prompts\admin_chat\playbooks
C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\prompts\admin_chat\playbooks\copywriting_v1.md
C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\prompts\admin_chat\playbooks\offer_core_offer_v1.md
C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\prompts\admin_chat\playbooks\strategy_v1.md
C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\prompts\admin_chat\system_v1.md
```

### Prompt tree (directories)
```text

FullName                                                                         
--------                                                                         
C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\prompts\admin_chat          
C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\prompts\admin_chat\playbooks


```

### Prompt files list
```text

FullName                                                                                                
--------                                                                                                
C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\prompts\admin_chat\developer_v1.md                 
C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\prompts\admin_chat\empty_test.md                   
C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\prompts\admin_chat\output_contracts_v1.md          
C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\prompts\admin_chat\playbooks\copywriting_v1.md     
C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\prompts\admin_chat\playbooks\offer_core_offer_v1.md
C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\prompts\admin_chat\playbooks\strategy_v1.md        
C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\prompts\admin_chat\system_v1.md                    


```

### Strategy prompt directory check (`prompts/strategy/*.md`)
```text
No strategy prompts found
```

### Files containing "strategy" in name (and full contents)
```text
=== C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\prompts\admin_chat\playbooks\strategy_v1.md ===
# playbook_strategy_v1
purpose: Produce a tactical growth strategy with measurable outputs.
inputs: context_blob, user_message.
outputs: strategy object in output_contracts_v1.
non_goals: vague plans without metrics, ideas, or experiments.

Required sections:
1) Goal metric
2) Funnel map
3) 3 content pillars
4) 12 content ideas (numbers + formats)
5) 3 experiments
6) 1 next action

Behavior:
- Mark one experiment as RECOMMENDED when ambiguity exists.
- Put any assumptions in assumptions[] only.

```

### Full File (line-numbered): `src/ai/promptRegistry.ts`
```text
    1: type PromptCache = Map<string, string>;
    2: 
    3: const PROMPT_CACHE: PromptCache = new Map();
    4: 
    5: function isProductionEnv() {
    6:   if (typeof Deno !== "undefined" && typeof Deno.env?.get === "function") {
    7:     return Deno.env.get("AI_MODE") === "prod" || Deno.env.get("NODE_ENV") === "production";
    8:   }
    9:   if (typeof process !== "undefined") {
   10:     return process.env.AI_MODE === "prod" || process.env.NODE_ENV === "production";
   11:   }
   12:   return false;
   13: }
   14: 
   15: function normalizePath(input: string | URL): string | URL {
   16:   if (input instanceof URL) return input;
   17:   if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(input)) {
   18:     try {
   19:       return new URL(input);
   20:     } catch {
   21:       return input;
   22:     }
   23:   }
   24:   return input;
   25: }
   26: 
   27: function readTextFileSync(path: string | URL): string {
   28:   const normalized = normalizePath(path);
   29:   if (typeof Deno !== "undefined" && typeof (Deno as any).readTextFileSync === "function") {
   30:     return (Deno as any).readTextFileSync(normalized);
   31:   }
   32:   if (typeof process !== "undefined" && process?.versions?.node) {
   33:     let filePath: string | null = null;
   34:     if (normalized instanceof URL) {
   35:       if (normalized.protocol !== "file:") return "";
   36:       filePath = decodeURIComponent(normalized.pathname);
   37:       if (/^\/[A-Za-z]:/.test(filePath)) {
   38:         filePath = filePath.slice(1);
   39:       }
   40:     } else {
   41:       filePath = normalized;
   42:     }
   43:     try {
   44:       const nodeRequire = new Function("return typeof require !== 'undefined' ? require : undefined")();
   45:       if (nodeRequire) {
   46:         const readFileSync = nodeRequire("fs").readFileSync;
   47:         return readFileSync(filePath, "utf8");
   48:       }
   49:     } catch {
   50:       // fall through to binding-based read
   51:     }
   52:     try {
   53:       const fsBinding = (process as any).binding?.("fs");
   54:       if (fsBinding?.readFileUtf8 && filePath) {
   55:         return fsBinding.readFileUtf8(filePath, 0);
   56:       }
   57:     } catch {
   58:       return "";
   59:     }
   60:   }
   61:   try {
   62:     const readFileSync = new Function("return require('fs').readFileSync")();
   63:     return readFileSync(normalized, "utf8");
   64:   } catch {
   65:     return "";
   66:   }
   67: }
   68: 
   69: function resolvePromptPath(relativePath: string) {
   70:   if (typeof process !== "undefined" && process?.cwd) {
   71:     const separator = process.platform === "win32" ? "\\" : "/";
   72:     const safeRelative = relativePath.split("/").join(separator);
   73:     return `${process.cwd()}${separator}prompts${separator}${safeRelative}`;
   74:   }
   75:   return new URL(`../../prompts/${relativePath}`, import.meta.url);
   76: }
   77: 
   78: export function loadPromptText(relativePath: string): string {
   79:   if (relativePath.includes("..") || relativePath.startsWith("/") || relativePath.startsWith("\\")) {
   80:     throw new Error(`Invalid prompt path: ${relativePath}`);
   81:   }
   82:   const cached = PROMPT_CACHE.get(relativePath);
   83:   if (cached) return cached;
   84:   const url = resolvePromptPath(relativePath);
   85:   const text = readTextFileSync(url);
   86:   if (!text || !text.trim()) {
   87:     const message = `Prompt missing or empty: ${relativePath}`;
   88:     if (isProductionEnv()) {
   89:       throw new Error(message);
   90:     }
   91:     throw new Error(message);
   92:   }
   93:   PROMPT_CACHE.set(relativePath, text);
   94:   return text;
   95: }
```

### Command Output: `rg -n "loadPromptText" --type ts -A 2`
```text
src\ai\__tests__\promptRegistry.test.ts:2:import { loadPromptText } from "../promptRegistry.ts";
src\ai\__tests__\promptRegistry.test.ts-3-
src\ai\__tests__\promptRegistry.test.ts-4-describe("prompt registry", () => {
--
src\ai\__tests__\promptRegistry.test.ts:6:    expect(() => loadPromptText("admin_chat/empty_test.md")).toThrow();
src\ai\__tests__\promptRegistry.test.ts:7:    expect(() => loadPromptText("admin_chat/empty_test.md")).toThrow();
src\ai\__tests__\promptRegistry.test.ts-8-  });
src\ai\__tests__\promptRegistry.test.ts-9-});
--
src\ai\__tests__\adminGeneralChatPrompt.test.ts:3:import { loadPromptText } from "../promptRegistry.ts";
src\ai\__tests__\adminGeneralChatPrompt.test.ts-4-
src\ai\__tests__\adminGeneralChatPrompt.test.ts-5-describe("admin general chat prompt mapping", () => {
--
src\ai\__tests__\adminGeneralChatPrompt.test.ts:23:      const expected = loadPromptText(entry.file).trim();
src\ai\__tests__\adminGeneralChatPrompt.test.ts-24-      expect(system).toContain(expected);
src\ai\__tests__\adminGeneralChatPrompt.test.ts-25-    }
--
src\ai\prompts\adminGeneralChat.ts:2:import { loadPromptText } from "../promptRegistry.ts";
src\ai\prompts\adminGeneralChat.ts-3-
src\ai\prompts\adminGeneralChat.ts-4-type PromptArgs = {
--
src\ai\prompts\adminGeneralChat.ts:17:  const systemRegistry = isStrategic ? loadPromptText("admin_chat/system_v1.md") : "";
src\ai\prompts\adminGeneralChat.ts:18:  const developerRegistry = isStrategic ? loadPromptText("admin_chat/developer_v1.md") : "";
src\ai\prompts\adminGeneralChat.ts:19:  const contractsRegistry = isStrategic ? loadPromptText("admin_chat/output_contracts_v1.md") : "";
src\ai\prompts\adminGeneralChat.ts-20-  const PLAYBOOK_FILES: Record<NonNullable<PromptArgs["playbook"]>, string> = {
src\ai\prompts\adminGeneralChat.ts-21-    core_offer: "admin_chat/playbooks/offer_core_offer_v1.md",
--
src\ai\prompts\adminGeneralChat.ts:26:  const playbookRegistry = isStrategic ? loadPromptText(PLAYBOOK_FILES[selectedPlaybook]) : "";
src\ai\prompts\adminGeneralChat.ts-27-
src\ai\prompts\adminGeneralChat.ts-28-  if (isStrategic) {
--
src\ai\promptRegistry.ts:78:export function loadPromptText(relativePath: string): string {
src\ai\promptRegistry.ts-79-  if (relativePath.includes("..") || relativePath.startsWith("/") || relativePath.startsWith("\\")) {
src\ai\promptRegistry.ts-80-    throw new Error(`Invalid prompt path: ${relativePath}`);
```

### Command Output: `rg -n "STRATEGY" prompts/ -l`
```text
```

## Verification SQL/Commands
```bash
# List prompt files
ls prompts

# Search for prompt usage
rg -n "loadPromptText" src/ai -S

# Verify missing strategy prompt dir
ls prompts/strategy
```

## Problems Found
1. Strategy prompting is not represented as markdown templates under `prompts/strategy/`, despite audit expectations; documentation and tooling should reflect that prompts live in TS under `src/ai/prompts/*` for STRATEGY_PLAN.
2. Prompt loading is synchronous and throws on missing/empty prompts; if any task depends on external prompt files at runtime, deployments must guarantee prompt assets are present in the runtime filesystem.

## Recommendations
1. Decide a single prompt source-of-truth (TS prompt builders vs markdown templates). If markdown is desired, introduce `prompts/strategy/` and update STRATEGY_PLAN to load from it.
2. Add CI checks ensuring all prompts referenced by `loadPromptText()` exist and are non-empty.
3. Document prompt resolution behavior across Node/Deno (cwd-based vs import-meta-based) to avoid path bugs in edge environments.

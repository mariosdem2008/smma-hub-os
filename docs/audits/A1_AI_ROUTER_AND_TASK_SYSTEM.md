# A1 — AI Router and Task System (Current Truth)

## Purpose
Document the current AI router implementation (providers, model selection, timeouts, retries, schema repair), the task registry (task definitions and safety modes), and every known usage site. This matters because strategy generation and other AI features depend on consistent task contracts, correct timeout/error behavior, and a single, debuggable execution path.

## Key Findings Summary
- `src/ai/router.ts` exposes `createAiRouter()` and exports a default singleton `ai` created with default deps; `useBrainResolver` exists but defaults to `false` unless explicitly enabled.
- Task execution uses `TaskType` + `taskRegistry` to decide provider/model/prompt/schema; schema generation prefers provider `generateJson` when available, otherwise falls back to `generate` and attempts JSON extraction.
- STRATEGY_PLAN timeout is configured at 180s in `src/ai/router.ts` (previously 60s).
- `TaskType.STRATEGY_PLAN` is configured in `src/ai/taskRegistry.ts` as `requires: { agency: false, client: false }` to avoid implicit brain loading and allow the edge function to supply explicit context.
- Model selection supports env overrides via `AI_MODEL__{TASK}__{ENV}` (see router tests and model policy code).
- Usage logging in the router writes to `ai_usage_logs` unless `skipUsageLog` is set; the strategy edge function now does its own `ai_runs` logging and sets `skipUsageLog: true` for router calls to avoid double logs.

## Detailed Analysis
### Router configuration (`src/ai/router.ts`)
- Router is instantiated via `createAiRouter(deps)` with injectable `providers`, `now`, and `useBrainResolver`.
- `run()` resolves the task config, builds prompt messages, chooses provider/model, applies timeouts, and validates JSON schema outputs.
- Timeout behavior is centralized in `getTimeoutMs(taskType)`.

### Task registry (`src/ai/taskRegistry.ts`)
- Each task entry defines: output mode, safety mode, prompt builder, required brain context, usage endpoint, and schema requirements.
- Strategy generation uses `TaskType.STRATEGY_PLAN` and is configured for JSON-schema output and strict-unknown safety mode.

### Provider configuration (`src/ai/providers/*`)
- Providers implement `generate()` (and optionally `generateJson()`), plus embedding support where applicable.
- Provider selection is driven by model policy (taskType + environment) and optional overrides passed in metadata.

### Router usage sites
- Usage sites are enumerated in Code Evidence via ripgrep outputs for `ai.run(` and `runAiTask(`.

## Code Evidence
### Command Output: `rg -n "createAiRouter" --type ts -A 5 -B 2`
```text
src\ai\router.ts-188-}
src\ai\router.ts-189-
src\ai\router.ts:190:export function createAiRouter(deps: RouterDeps = {}) {
src\ai\router.ts-191-  const providers = deps.providers ?? defaultProviders;
src\ai\router.ts-192-  const now = deps.now ?? nowMs;
src\ai\router.ts-193-  const useBrainResolver = deps.useBrainResolver ?? false;
src\ai\router.ts-194-
src\ai\router.ts-195-  async function run(options: AiRunOptions): Promise<AiRunResult> {
--
src\ai\router.ts-524-}
src\ai\router.ts-525-
src\ai\router.ts:526:export const ai = createAiRouter();
--
src\ai\__tests__\router.test.ts-1-import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
src\ai\__tests__\router.test.ts:2:import { createAiRouter } from "../router.ts"
src\ai\__tests__\router.test.ts-3-import { TaskType } from "../taskTypes.ts"
src\ai\__tests__\router.test.ts-4-
src\ai\__tests__\router.test.ts-5-describe("ai router", () => {
src\ai\__tests__\router.test.ts-6-  const baseProvider = {
src\ai\__tests__\router.test.ts-7-    generate: vi.fn(async () => ({ text: "OK", usage: { inputTokens: 1, outputTokens: 1 } })),
--
src\ai\__tests__\router.test.ts-25-
src\ai\__tests__\router.test.ts-26-  it("selects dev/prod mapping based on environment", async () => {
src\ai\__tests__\router.test.ts:27:    const router = createAiRouter({ providers });
src\ai\__tests__\router.test.ts-28-    await router.run({
src\ai\__tests__\router.test.ts-29-      taskType: TaskType.TOOL_EXECUTION,
src\ai\__tests__\router.test.ts-30-      input: "Run tool",
src\ai\__tests__\router.test.ts-31-      context: { environment: "dev" },
src\ai\__tests__\router.test.ts-32-    });
--
src\ai\__tests__\router.test.ts-45-  it("uses env override when set", async () => {
src\ai\__tests__\router.test.ts-46-    process.env.AI_MODEL__TOOL_EXECUTION__prod = "override-model";
src\ai\__tests__\router.test.ts:47:    const router = createAiRouter({ providers });
src\ai\__tests__\router.test.ts-48-    await router.run({
src\ai\__tests__\router.test.ts-49-      taskType: TaskType.TOOL_EXECUTION,
src\ai\__tests__\router.test.ts-50-      input: "Run tool",
src\ai\__tests__\router.test.ts-51-      context: { environment: "prod" },
src\ai\__tests__\router.test.ts-52-    });
--
src\ai\__tests__\router.test.ts-60-      .mockResolvedValueOnce({ text: "not-json" })
src\ai\__tests__\router.test.ts-61-      .mockResolvedValueOnce({ text: "[{\"id\":\"one\"}]" });
src\ai\__tests__\router.test.ts:62:    const router = createAiRouter({
src\ai\__tests__\router.test.ts-63-      providers: { ...providers, gemini: { ...baseProvider, generate } },
src\ai\__tests__\router.test.ts-64-    });
src\ai\__tests__\router.test.ts-65-    const result = await router.run({
src\ai\__tests__\router.test.ts-66-      taskType: TaskType.EXTRACT_STRUCTURED,
src\ai\__tests__\router.test.ts-67-      input: "Give data",
--
src\ai\__tests__\router.test.ts-73-
src\ai\__tests__\router.test.ts-74-  it("returns UNKNOWN when required brain context is missing", async () => {
src\ai\__tests__\router.test.ts:75:    const router = createAiRouter({ providers });
src\ai\__tests__\router.test.ts-76-    const result = await router.run({
src\ai\__tests__\router.test.ts-77-      taskType: TaskType.STRATEGY_PLAN,
src\ai\__tests__\router.test.ts-78-      input: "",
src\ai\__tests__\router.test.ts-79-      context: { environment: "dev" },
src\ai\__tests__\router.test.ts-80-    });
--
src\ai\__tests__\router.test.ts-84-
src\ai\__tests__\router.test.ts-85-  it("passes expected shape to provider adapter", async () => {
src\ai\__tests__\router.test.ts:86:    const router = createAiRouter({ providers });
src\ai\__tests__\router.test.ts-87-    await router.run({
src\ai\__tests__\router.test.ts-88-      taskType: TaskType.CONTENT_IDEAS,
src\ai\__tests__\router.test.ts-89-      input: "",
src\ai\__tests__\router.test.ts-90-      context: { environment: "dev" },
src\ai\__tests__\router.test.ts-91-      metadata: { mode: "ideas", platform: "Instagram" },
--
src\ai\__tests__\router.test.ts-108-      })),
src\ai\__tests__\router.test.ts-109-    };
src\ai\__tests__\router.test.ts:110:    const router = createAiRouter({
src\ai\__tests__\router.test.ts-111-      providers: { ...providers, gemini: { ...baseProvider, generateJson } as any },
src\ai\__tests__\router.test.ts-112-    });
src\ai\__tests__\router.test.ts-113-    await expect(
src\ai\__tests__\router.test.ts-114-      router.run({
src\ai\__tests__\router.test.ts-115-        taskType: TaskType.EXTRACT_STRUCTURED,
```

### Command Output: `rg -n "TaskType\." --type ts | head -100`
```text
tests\integration\ai\rag-correctness.test.ts:18:    const config = getRagConfig(TaskType.CLIENT_PORTAL_QA);
tests\integration\ai\rag-correctness.test.ts:46:    const config = getRagConfig(TaskType.STRATEGY_PLAN);
tests\integration\ai\rag-correctness.test.ts:77:    const config = getRagConfig(TaskType.CLIENT_PORTAL_QA);
src\__tests__\strategy-generation.integration.test.ts:26:    expect(router).toContain("case TaskType.STRATEGY_PLAN");
src\__tests__\strategy-generation.integration.test.ts:32:    expect(registry).toContain("[TaskType.STRATEGY_PLAN]");
src\ai\modelPolicy.ts:37:  [TaskType.CHAT_GENERAL]: {
src\ai\modelPolicy.ts:42:  [TaskType.CHAT_ADMIN_ONBOARDING]: {
src\ai\modelPolicy.ts:47:  [TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2]: {
src\ai\modelPolicy.ts:52:  [TaskType.AGENCY_ADMIN_GENERAL_CHAT]: {
src\ai\modelPolicy.ts:57:  [TaskType.AGENCY_ADMIN_SETUP_EXTRACT]: {
src\ai\modelPolicy.ts:62:  [TaskType.CLIENT_PORTAL_QA]: {
src\ai\modelPolicy.ts:68:  [TaskType.SUMMARIZE]: {
src\ai\modelPolicy.ts:73:  [TaskType.EXTRACT_STRUCTURED]: {
src\ai\modelPolicy.ts:78:  [TaskType.CLASSIFY_INTENT]: {
src\ai\modelPolicy.ts:83:  [TaskType.STRATEGY_PLAN]: {
src\ai\modelPolicy.ts:89:  [TaskType.CONTENT_IDEAS]: {
src\ai\modelPolicy.ts:94:  [TaskType.SCRIPT_WRITING]: {
src\ai\modelPolicy.ts:99:  [TaskType.TOOL_EXECUTION]: {
src\ai\modelPolicy.ts:104:  [TaskType.EMBED_TEXT]: {
src\ai\modelPolicy.ts:132:  if (taskType === TaskType.EMBED_TEXT) {
src\ai\modelPolicy.ts:144:    (taskType === TaskType.EMBED_TEXT ? undefined : readEnv("AI_TEXT_MODEL_DEFAULT")) ??
supabase\functions\ai-onboarding-suggest\index.ts:106:      task_type: TaskType.EXTRACT_STRUCTURED,
supabase\functions\ai-onboarding-scan\index.ts:272:      task_type: TaskType.EXTRACT_STRUCTURED,
supabase\functions\ai-onboarding-guide\index.ts:324:      taskType: TaskType.EXTRACT_STRUCTURED,
supabase\functions\ai-onboarding-guide\index.ts:356:      taskType: TaskType.EXTRACT_STRUCTURED,
supabase\functions\ai-onboarding-guide\index.ts:385:      taskType: TaskType.EXTRACT_STRUCTURED,
src\ai\__tests__\router.test.ts:29:      taskType: TaskType.TOOL_EXECUTION,
src\ai\__tests__\router.test.ts:37:      taskType: TaskType.TOOL_EXECUTION,
src\ai\__tests__\router.test.ts:49:      taskType: TaskType.TOOL_EXECUTION,
src\ai\__tests__\router.test.ts:66:      taskType: TaskType.EXTRACT_STRUCTURED,
src\ai\__tests__\router.test.ts:77:      taskType: TaskType.STRATEGY_PLAN,
src\ai\__tests__\router.test.ts:88:      taskType: TaskType.CONTENT_IDEAS,
src\ai\__tests__\router.test.ts:115:        taskType: TaskType.EXTRACT_STRUCTURED,
src\ai\router.ts:87:    case TaskType.EMBED_TEXT:
src\ai\router.ts:89:    case TaskType.STRATEGY_PLAN:
src\ai\router.ts:90:    case TaskType.CLIENT_PORTAL_QA:
src\ai\router.ts:92:    case TaskType.SUMMARIZE:
src\ai\router.ts:94:    case TaskType.CHAT_GENERAL:
src\ai\router.ts:95:    case TaskType.CONTENT_IDEAS:
src\ai\__tests__\modelPolicy.test.ts:36:      [TaskType.CHAT_GENERAL]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
src\ai\__tests__\modelPolicy.test.ts:37:      [TaskType.CHAT_ADMIN_ONBOARDING]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
src\ai\__tests__\modelPolicy.test.ts:38:      [TaskType.CLIENT_PORTAL_QA]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
src\ai\__tests__\modelPolicy.test.ts:39:      [TaskType.SUMMARIZE]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
src\ai\__tests__\modelPolicy.test.ts:40:      [TaskType.EXTRACT_STRUCTURED]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
src\ai\__tests__\modelPolicy.test.ts:41:      [TaskType.CLASSIFY_INTENT]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
src\ai\__tests__\modelPolicy.test.ts:42:      [TaskType.STRATEGY_PLAN]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
src\ai\__tests__\modelPolicy.test.ts:43:      [TaskType.CONTENT_IDEAS]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
src\ai\__tests__\modelPolicy.test.ts:44:      [TaskType.SCRIPT_WRITING]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
src\ai\__tests__\modelPolicy.test.ts:45:      [TaskType.TOOL_EXECUTION]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
src\ai\__tests__\modelPolicy.test.ts:67:    const result = getModelForTask({ taskType: TaskType.TOOL_EXECUTION, planTier: "pro" });
src\ai\__tests__\modelPolicy.test.ts:73:    const result = getModelForTask({ taskType: TaskType.TOOL_EXECUTION, planTier: "pro" });
src\ai\__tests__\modelPolicy.test.ts:78:    const text = getModelForTask({ taskType: TaskType.SUMMARIZE, mode: "prod", planTier: "free" });
src\ai\__tests__\modelPolicy.test.ts:81:    const embed = getModelForTask({ taskType: TaskType.EMBED_TEXT, mode: "prod", planTier: "free" });
src\ai\__tests__\modelPolicy.test.ts:87:    const result = getModelForTask({ taskType: TaskType.CHAT_GENERAL, mode: "prod", planTier: "free" });
src\ai\__tests__\modelPolicy.test.ts:93:    const result = getModelForTask({ taskType: TaskType.CHAT_GENERAL, mode: "prod", planTier: "free" });
src\ai\ragPolicy.ts:35:  [TaskType.CLIENT_PORTAL_QA]: {
src\ai\ragPolicy.ts:46:  [TaskType.STRATEGY_PLAN]: {
src\ai\taskToModuleMap.ts:42:  [TaskType.CHAT_GENERAL]: [],
src\ai\taskToModuleMap.ts:45:  [TaskType.CHAT_ADMIN_ONBOARDING]: [
src\ai\taskToModuleMap.ts:54:  [TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2]: [
src\ai\taskToModuleMap.ts:63:  [TaskType.AGENCY_ADMIN_GENERAL_CHAT]: [
src\ai\taskToModuleMap.ts:82:  [TaskType.AGENCY_ADMIN_SETUP_EXTRACT]: [
src\ai\taskToModuleMap.ts:91:  [TaskType.CLIENT_PORTAL_QA]: [
src\ai\taskToModuleMap.ts:105:  [TaskType.SUMMARIZE]: [],
src\ai\taskToModuleMap.ts:108:  [TaskType.EXTRACT_STRUCTURED]: [],
src\ai\taskToModuleMap.ts:111:  [TaskType.CLASSIFY_INTENT]: [],
src\ai\taskToModuleMap.ts:114:  [TaskType.STRATEGY_PLAN]: [
src\ai\taskToModuleMap.ts:138:  [TaskType.CONTENT_IDEAS]: [
src\ai\taskToModuleMap.ts:157:  [TaskType.SCRIPT_WRITING]: [
src\ai\taskToModuleMap.ts:176:  [TaskType.TOOL_EXECUTION]: [],
src\ai\taskToModuleMap.ts:179:  [TaskType.EMBED_TEXT]: [],
src\ai\taskRegistry.ts:86:  taskType: TaskType.AGENCY_ADMIN_GENERAL_CHAT,
src\ai\taskRegistry.ts:109:  taskType: TaskType.AGENCY_ADMIN_GENERAL_CHAT,
src\ai\taskRegistry.ts:138:  [TaskType.CHAT_GENERAL]: {
src\ai\taskRegistry.ts:139:    taskType: TaskType.CHAT_GENERAL,
src\ai\taskRegistry.ts:147:  [TaskType.CHAT_ADMIN_ONBOARDING]: {
src\ai\taskRegistry.ts:148:    taskType: TaskType.CHAT_ADMIN_ONBOARDING,
src\ai\taskRegistry.ts:156:  [TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2]: {
src\ai\taskRegistry.ts:157:    taskType: TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2,
src\ai\taskRegistry.ts:194:  [TaskType.AGENCY_ADMIN_GENERAL_CHAT]: {
src\ai\taskRegistry.ts:195:    taskType: TaskType.AGENCY_ADMIN_GENERAL_CHAT,
src\ai\taskRegistry.ts:213:  [TaskType.AGENCY_ADMIN_SETUP_EXTRACT]: {
src\ai\taskRegistry.ts:214:    taskType: TaskType.AGENCY_ADMIN_SETUP_EXTRACT,
src\ai\taskRegistry.ts:230:  [TaskType.CLIENT_PORTAL_QA]: {
src\ai\taskRegistry.ts:231:    taskType: TaskType.CLIENT_PORTAL_QA,
src\ai\taskRegistry.ts:244:  [TaskType.SUMMARIZE]: {
src\ai\taskRegistry.ts:245:    taskType: TaskType.SUMMARIZE,
src\ai\taskRegistry.ts:257:  [TaskType.EXTRACT_STRUCTURED]: {
src\ai\taskRegistry.ts:258:    taskType: TaskType.EXTRACT_STRUCTURED,
src\ai\taskRegistry.ts:271:  [TaskType.CLASSIFY_INTENT]: {
src\ai\taskRegistry.ts:272:    taskType: TaskType.CLASSIFY_INTENT,
src\ai\taskRegistry.ts:280:  [TaskType.STRATEGY_PLAN]: {
src\ai\taskRegistry.ts:281:    taskType: TaskType.STRATEGY_PLAN,
src\ai\taskRegistry.ts:296:  [TaskType.CONTENT_IDEAS]: {
src\ai\taskRegistry.ts:297:    taskType: TaskType.CONTENT_IDEAS,
src\ai\taskRegistry.ts:311:  [TaskType.SCRIPT_WRITING]: {
src\ai\taskRegistry.ts:312:    taskType: TaskType.SCRIPT_WRITING,
src\ai\taskRegistry.ts:326:  [TaskType.TOOL_EXECUTION]: {
src\ai\taskRegistry.ts:327:    taskType: TaskType.TOOL_EXECUTION,
src\ai\taskRegistry.ts:335:  [TaskType.EMBED_TEXT]: {
```

### Command Output: `rg -n "ai\.run\(" --type ts -A 3`
```text
supabase\functions\ai-ask\index.ts:500:    aiResult = await ai.run({
supabase\functions\ai-ask\index.ts-501-      taskType: TaskType.CLIENT_PORTAL_QA,
supabase\functions\ai-ask\index.ts-502-      input: question,
supabase\functions\ai-ask\index.ts-503-      context: {
--
supabase\functions\generate-monthly-report\index.ts:172:        const aiResult = await ai.run({
supabase\functions\generate-monthly-report\index.ts-173-          taskType: TaskType.SUMMARIZE,
supabase\functions\generate-monthly-report\index.ts-174-          input: aiPrompt,
supabase\functions\generate-monthly-report\index.ts-175-          context: { agencyId: agency_id, clientId: client_id, userId: user.id, environment: "prod", supabase: supabaseClient },
--
supabase\functions\generate-ai-content\index.ts:206:      aiResult = await ai.run({
supabase\functions\generate-ai-content\index.ts-207-        taskType: TaskType.CONTENT_IDEAS,
supabase\functions\generate-ai-content\index.ts-208-        input: "",
supabase\functions\generate-ai-content\index.ts-209-        context: { agencyId: agency_id, clientId: client_id, userId: user.id, environment: "prod", supabase: supabaseClient },
--
supabase\functions\_shared\agency-admin-setup-orchestrator.ts:139:  const result = await ai.run({
supabase\functions\_shared\agency-admin-setup-orchestrator.ts-140-    taskType: TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2,
supabase\functions\_shared\agency-admin-setup-orchestrator.ts-141-    messages: [
supabase\functions\_shared\agency-admin-setup-orchestrator.ts-142-      {
--
supabase\functions\ai-onboarding-guide\index.ts:323:    const aiResult = await ai.run({
supabase\functions\ai-onboarding-guide\index.ts-324-      taskType: TaskType.EXTRACT_STRUCTURED,
supabase\functions\ai-onboarding-guide\index.ts-325-      messages: buildOnboardingOffersPrompt({ website, niche }),
supabase\functions\ai-onboarding-guide\index.ts-326-      context: { environment: "prod" },
--
supabase\functions\ai-onboarding-guide\index.ts:355:    const aiResult = await ai.run({
supabase\functions\ai-onboarding-guide\index.ts-356-      taskType: TaskType.EXTRACT_STRUCTURED,
supabase\functions\ai-onboarding-guide\index.ts-357-      messages: buildOnboardingAudiencePrompt({ niche, offers }),
supabase\functions\ai-onboarding-guide\index.ts-358-      context: { environment: "prod" },
--
supabase\functions\ai-onboarding-guide\index.ts:384:    const aiResult = await ai.run({
supabase\functions\ai-onboarding-guide\index.ts-385-      taskType: TaskType.EXTRACT_STRUCTURED,
supabase\functions\ai-onboarding-guide\index.ts-386-      messages: buildOnboardingDifferentiatorsPrompt({ brand, niche }),
supabase\functions\ai-onboarding-guide\index.ts-387-      context: { environment: "prod" },
--
supabase\functions\ai-strategy-generate\index.ts:629:    aiResult = await ai.run({
supabase\functions\ai-strategy-generate\index.ts-630-      taskType: TaskType.STRATEGY_PLAN,
supabase\functions\ai-strategy-generate\index.ts-631-      input: "",
supabase\functions\ai-strategy-generate\index.ts-632-      context: { agencyId, clientId, userId: actingUserId, environment: "prod", supabase: null, skipUsageLog: true },
--
supabase\functions\_shared\embeddings.ts:46:  const result = await ai.run({
supabase\functions\_shared\embeddings.ts-47-    taskType: TaskType.EMBED_TEXT,
supabase\functions\_shared\embeddings.ts-48-    input: text,
supabase\functions\_shared\embeddings.ts-49-    context: { environment: "prod" },
--
supabase\functions\_shared\ai.ts:274:    const result = await ai.run({
supabase\functions\_shared\ai.ts-275-      taskType: input.task_type,
supabase\functions\_shared\ai.ts-276-      input: input.input?.message ?? "",
supabase\functions\_shared\ai.ts-277-      messages: input.context?.messages,
```

### Command Output: `rg -n "runAiTask\(" --type ts -A 3`
```text
supabase\functions\ai-onboarding-suggest\index.ts:105:    const result = await runAiTask({
supabase\functions\ai-onboarding-suggest\index.ts-106-      task_type: TaskType.EXTRACT_STRUCTURED,
supabase\functions\ai-onboarding-suggest\index.ts-107-      tenant: {
supabase\functions\ai-onboarding-suggest\index.ts-108-        agency_id: opts.agencyId,
--
supabase\functions\ai-onboarding-scan\index.ts:271:    const result = await runAiTask({
supabase\functions\ai-onboarding-scan\index.ts-272-      task_type: TaskType.EXTRACT_STRUCTURED,
supabase\functions\ai-onboarding-scan\index.ts-273-      tenant: {
supabase\functions\ai-onboarding-scan\index.ts-274-        agency_id: opts.agencyId,
--
supabase\functions\_shared\ai.ts:212:export async function runAiTask(input: RunAiTaskInput) {
supabase\functions\_shared\ai.ts-213-  const startTime = Date.now();
supabase\functions\_shared\ai.ts-214-  const supabase = input.supabase as MinimalSupabase | undefined;
supabase\functions\_shared\ai.ts-215-  const agencyId = input.tenant.agency_id;
--
supabase\functions\_shared\agency-admin-general-ai.ts:596:  const result = await runAiTask({
supabase\functions\_shared\agency-admin-general-ai.ts-597-    task_type: TaskType.AGENCY_ADMIN_GENERAL_CHAT,
supabase\functions\_shared\agency-admin-general-ai.ts-598-    mode,
supabase\functions\_shared\agency-admin-general-ai.ts-599-    tenant: { agency_id: opts.agencyId, user_id: opts.userId },
--
supabase\functions\_shared\agency-admin-setup.ts:826:  const result = await runAiTask({
supabase\functions\_shared\agency-admin-setup.ts-827-    task_type: TaskType.SUMMARIZE,
supabase\functions\_shared\agency-admin-setup.ts-828-    mode: getAiMode(),
supabase\functions\_shared\agency-admin-setup.ts-829-    tenant: { agency_id: opts.agencyId, user_id: opts.userId },
--
supabase\functions\_shared\agency-admin-setup.ts:1510:        const result = await runAiTask({
supabase\functions\_shared\agency-admin-setup.ts-1511-          task_type: TaskType.AGENCY_ADMIN_SETUP_EXTRACT,
supabase\functions\_shared\agency-admin-setup.ts-1512-          mode: getAiMode(),
supabase\functions\_shared\agency-admin-setup.ts-1513-          tenant: { agency_id: opts.agencyId, user_id: opts.userId },
--
supabase\functions\_shared\__tests__\ai-guards.test.ts:109:    const result = await runAiTask({
supabase\functions\_shared\__tests__\ai-guards.test.ts-110-      task_type: TaskType.SUMMARIZE,
supabase\functions\_shared\__tests__\ai-guards.test.ts-111-      tenant: { agency_id: "agency-1", user_id: "user-1", client_id: "client-1" },
supabase\functions\_shared\__tests__\ai-guards.test.ts-112-      input: { message: "hello" },
--
supabase\functions\_shared\__tests__\ai-guards.test.ts:128:    const result = await runAiTask({
supabase\functions\_shared\__tests__\ai-guards.test.ts-129-      task_type: TaskType.SUMMARIZE,
supabase\functions\_shared\__tests__\ai-guards.test.ts-130-      tenant: { agency_id: "agency-1", user_id: "user-1", client_id: "client-1" },
supabase\functions\_shared\__tests__\ai-guards.test.ts-131-      input: { message: "hello" },
--
supabase\functions\_shared\__tests__\ai-guards.test.ts:156:    const success = await runAiTask({
supabase\functions\_shared\__tests__\ai-guards.test.ts-157-      task_type: TaskType.SUMMARIZE,
supabase\functions\_shared\__tests__\ai-guards.test.ts-158-      tenant: { agency_id: "agency-1", user_id: "user-1", client_id: "client-1" },
supabase\functions\_shared\__tests__\ai-guards.test.ts-159-      input: { message: "hello" },
--
supabase\functions\_shared\__tests__\ai-guards.test.ts:172:    await expect(runAiTask({
supabase\functions\_shared\__tests__\ai-guards.test.ts-173-      task_type: TaskType.SUMMARIZE,
supabase\functions\_shared\__tests__\ai-guards.test.ts-174-      tenant: { agency_id: "agency-1", user_id: "user-1", client_id: "client-1" },
supabase\functions\_shared\__tests__\ai-guards.test.ts-175-      input: { message: "hello" },
```

### Full File (line-numbered): `src/ai/router.ts`
```text
    1: import { getAgencyBrainContext, getClientBrainContext } from "./brains/index.ts"
    2: import { logUsage } from "./logging.ts"
    3: import { resolveTaskModel, getTaskConfig } from "./taskRegistry.ts"
    4: import { TaskType } from "./taskTypes.ts"
    5: import { nowMs } from "./utils.ts"
    6: import { providers as defaultProviders } from "./providers/index.ts"
    7: import { createBrainResolver, type CalibrationRequirement, type ResolvedBrainContext } from "./brainResolver.ts"
    8: import type { ChatMessage, GenerateResult } from "./providers/types.ts"
    9: import type { OutputSchema } from "./schema.ts"
   10: 
   11: type MinimalSupabase = {
   12:   from: (table: string) => any;
   13: };
   14: 
   15: export type AiContext = {
   16:   agencyId?: string;
   17:   clientId?: string;
   18:   userId?: string;
   19:   role?: string;
   20:   plan?: string;
   21:   environment?: "dev" | "prod";
   22:   supabase?: MinimalSupabase | null;
   23:   skipUsageLog?: boolean;
   24: };
   25: 
   26: export type AiRunOptions = {
   27:   taskType: TaskType;
   28:   input?: string;
   29:   messages?: ChatMessage[];
   30:   context: AiContext;
   31:   metadata?: Record<string, unknown>;
   32:   outputSchema?: OutputSchema<unknown>;
   33: };
   34: 
   35: export type AiRunResult = {
   36:   text: string;
   37:   output?: unknown;
   38:   unknown?: boolean;
   39:   error?: string | null;
   40:   raw?: unknown;
   41:   rawText?: string;
   42:   schemaOk?: boolean;
   43:   usage?: GenerateResult["usage"];
   44:   meta?: {
   45:     provider: string;
   46:     model: string;
   47:   };
   48:   /** Present when on-demand calibration is needed */
   49:   calibrationNeeded?: CalibrationRequirement;
   50:   /** Resolved brain context used for the request */
   51:   resolvedContext?: ResolvedBrainContext;
   52: };
   53: 
   54: export type AiStreamChunk =
   55:   | { type: "delta"; text: string }
   56:   | { type: "done"; result: AiRunResult };
   57: 
   58: type ProviderMap = typeof defaultProviders;
   59: 
   60: type RouterDeps = {
   61:   providers?: ProviderMap;
   62:   now?: () => number;
   63:   /** Enable brain resolver for on-demand calibration */
   64:   useBrainResolver?: boolean;
   65: };
   66: 
   67: function extractJson(text: string) {
   68:   const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
   69:   const rawJson = jsonMatch ? jsonMatch[1] : text;
   70:   return JSON.parse(rawJson);
   71: }
   72: 
   73: function buildUnknownResponse(taskType: TaskType, reason: string) {
   74:   const config = getTaskConfig(taskType);
   75:   if (config?.buildUnknown) {
   76:     return config.buildUnknown({ reason });
   77:   }
   78:   return { answer: "UNKNOWN", unknown: true, questions: ["What additional context is required?"], confidence: 0 };
   79: }
   80: 
   81: function shouldReturnUnknown(contextMissing: boolean, safetyMode: "strict_unknown" | "normal") {
   82:   return contextMissing && safetyMode === "strict_unknown";
   83: }
   84: 
   85: function getTimeoutMs(taskType: TaskType) {
   86:   switch (taskType) {
   87:     case TaskType.EMBED_TEXT:
   88:       return 10_000;
   89:     case TaskType.STRATEGY_PLAN:
   90:     case TaskType.CLIENT_PORTAL_QA:
   91:       return 180_000;
   92:     case TaskType.SUMMARIZE:
   93:       return 45_000;
   94:     case TaskType.CHAT_GENERAL:
   95:     case TaskType.CONTENT_IDEAS:
   96:       return 30_000;
   97:     default:
   98:       return 30_000;
   99:   }
  100: }
  101: 
  102: async function generateWithRetry(opts: {
  103:   provider: { generate: (params: any) => Promise<GenerateResult> };
  104:   params: any;
  105:   schema?: OutputSchema<unknown>;
  106:   taskType: TaskType;
  107: }): Promise<{
  108:   text: string;
  109:   output?: unknown;
  110:   raw?: unknown;
  111:   rawText?: string;
  112:   schemaOk?: boolean;
  113:   usage?: GenerateResult["usage"];
  114:   model?: string;
  115: }> {
  116:   const providerAny = opts.provider as any;
  117:   const generateFn =
  118:     opts.schema && typeof providerAny.generateJson === "function"
  119:       ? providerAny.generateJson.bind(opts.provider)
  120:       : opts.provider.generate.bind(opts.provider);
  121:   const first = await generateFn(opts.params);
  122:   if (!opts.schema) {
  123:     return { text: first.text, raw: first.raw, rawText: first.text, schemaOk: true, usage: first.usage, model: first.model };
  124:   }
  125: 
  126:   try {
  127:     const parsed = extractJson(first.text);
  128:     const validated = opts.schema.validate(parsed);
  129:     if (validated.ok) {
  130:       return {
  131:         text: first.text,
  132:         output: validated.data,
  133:         raw: first.raw,
  134:         rawText: first.text,
  135:         schemaOk: true,
  136:         usage: first.usage,
  137:         model: first.model,
  138:       };
  139:     }
  140:   } catch {
  141:     // fall through to repair
  142:   }
  143: 
  144:   const repairMessages = [
  145:     ...opts.params.messages,
  146:     {
  147:       role: "system",
  148:       content: `Repair the response. Return only valid JSON matching schema: ${opts.schema.name}. No markdown.`,
  149:     },
  150:   ];
  151: 
  152:   const retry = await opts.provider.generate({ ...opts.params, messages: repairMessages });
  153:   try {
  154:     const parsed = extractJson(retry.text);
  155:     const validated = opts.schema.validate(parsed);
  156:     if (validated.ok) {
  157:       return {
  158:         text: retry.text,
  159:         output: validated.data,
  160:         raw: retry.raw,
  161:         rawText: retry.text,
  162:         schemaOk: true,
  163:         usage: retry.usage,
  164:         model: retry.model,
  165:       };
  166:     }
  167:   } catch {
  168:     return {
  169:       text: "UNKNOWN",
  170:       output: buildUnknownResponse(opts.taskType, "schema_repair_failed"),
  171:       raw: retry.raw,
  172:       rawText: retry.text,
  173:       schemaOk: false,
  174:       usage: retry.usage,
  175:       model: retry.model,
  176:     };
  177:   }
  178: 
  179:   return {
  180:     text: "UNKNOWN",
  181:     output: buildUnknownResponse(opts.taskType, "schema_repair_failed"),
  182:     raw: retry.raw,
  183:     rawText: retry.text,
  184:     schemaOk: false,
  185:     usage: retry.usage,
  186:     model: retry.model,
  187:   };
  188: }
  189: 
  190: export function createAiRouter(deps: RouterDeps = {}) {
  191:   const providers = deps.providers ?? defaultProviders;
  192:   const now = deps.now ?? nowMs;
  193:   const useBrainResolver = deps.useBrainResolver ?? false;
  194: 
  195:   async function run(options: AiRunOptions): Promise<AiRunResult> {
  196:     const start = now();
  197:     const taskConfig = getTaskConfig(options.taskType);
  198:     if (!taskConfig) {
  199:       return { text: "UNKNOWN", unknown: true, error: "Unknown task type" };
  200:     }
  201: 
  202:     const context = options.context ?? {};
  203:     const supabase = context.supabase ?? null;
  204:     const contextMissing = (taskConfig.requires.agency && !context.agencyId) ||
  205:       (taskConfig.requires.client && !context.clientId);
  206: 
  207:     if (shouldReturnUnknown(contextMissing, taskConfig.safetyMode)) {
  208:       const latencyMs = now() - start;
  209:       if (!context.skipUsageLog) {
  210:         await logUsage(supabase, {
  211:           taskType: options.taskType,
  212:           endpoint: taskConfig.usageEndpoint,
  213:           provider: "none",
  214:           model: "context-missing",
  215:           agencyId: context.agencyId,
  216:           clientId: context.clientId,
  217:           latencyMs,
  218:           tokensIn: 0,
  219:           tokensOut: 0,
  220:           unknown: true,
  221:           success: true,
  222:           errorCode: "context_missing",
  223:         });
  224:       }
  225:       return { text: "UNKNOWN", output: buildUnknownResponse(options.taskType, "context_missing"), unknown: true };
  226:     }
  227: 
  228:     let agencyBrain: Record<string, unknown> | null = null;
  229:     let clientBrain: Record<string, unknown> | null = null;
  230:     let resolvedContext: ResolvedBrainContext | undefined;
  231: 
  232:     // Use Brain Resolver when enabled (v2 modular documents)
  233:     if (useBrainResolver && context.agencyId && supabase) {
  234:       const resolver = createBrainResolver(supabase);
  235:       const resolveResult = await resolver.resolveContext(options.taskType, context.agencyId);
  236: 
  237:       if (resolveResult.status === "calibration_needed") {
  238:         // Return early with calibration requirement - caller handles on-demand calibration
  239:         return {
  240:           text: "",
  241:           calibrationNeeded: resolveResult.calibration,
  242:           unknown: false,
  243:         };
  244:       }
  245: 
  246:       if (resolveResult.status === "error") {
  247:         return {
  248:           text: "UNKNOWN",
  249:           output: buildUnknownResponse(options.taskType, "brain_resolver_error"),
  250:           unknown: true,
  251:           error: resolveResult.error,
  252:         };
  253:       }
  254: 
  255:       // Use resolved context
  256:       resolvedContext = resolveResult.context;
  257:       agencyBrain = resolver.flattenContext(resolveResult.context);
  258:     } else if (taskConfig.requires.agency && context.agencyId && supabase) {
  259:       // Legacy: use monolithic brain_json
  260:       const res = await getAgencyBrainContext(supabase, context.agencyId);
  261:       agencyBrain = res.data;
  262:       if (!res.data && shouldReturnUnknown(true, taskConfig.safetyMode)) {
  263:         return { text: "UNKNOWN", output: buildUnknownResponse(options.taskType, "agency_brain_missing"), unknown: true };
  264:       }
  265:     }
  266: 
  267:     if (taskConfig.requires.client && context.clientId && supabase) {
  268:       const res = await getClientBrainContext(supabase, context.clientId);
  269:       clientBrain = res.data;
  270:       if (!res.data && shouldReturnUnknown(true, taskConfig.safetyMode)) {
  271:         return { text: "UNKNOWN", output: buildUnknownResponse(options.taskType, "client_brain_missing"), unknown: true };
  272:       }
  273:     }
  274: 
  275:     const modelConfigBase = resolveTaskModel(options.taskType, context.environment);
  276:     const overrideModel = options.metadata?.modelOverride as string | undefined;
  277:     const overrideProvider = options.metadata?.providerOverride as string | undefined;
  278:     const modelConfig = overrideModel ? { ...modelConfigBase, model: overrideModel } : modelConfigBase;
  279:     const providerKey = overrideProvider ?? modelConfig.provider;
  280:     const provider = providers[providerKey];
  281:     if (!provider) {
  282:       return { text: "UNKNOWN", unknown: true, error: "Provider not available" };
  283:     }
  284: 
  285:     if (taskConfig.outputMode === "embedding") {
  286:       if (!("embed" in provider)) {
  287:         return { text: "UNKNOWN", unknown: true, error: "Embedding not supported" };
  288:       }
  289:       const embeddingResult = await (provider as any).embed({
  290:         model: modelConfig.model,
  291:         input: options.input ?? "",
  292:         outputDimensionality: options.metadata?.outputDimensionality,
  293:         timeoutMs: getTimeoutMs(options.taskType),
  294:       });
  295:       const latencyMs = now() - start;
  296:       if (!context.skipUsageLog) {
  297:         await logUsage(supabase, {
  298:           taskType: options.taskType,
  299:           endpoint: taskConfig.usageEndpoint,
  300:           provider: providerKey,
  301:           model: modelConfig.model,
  302:           agencyId: context.agencyId,
  303:           clientId: context.clientId,
  304:           latencyMs,
  305:           tokensIn: 0,
  306:           tokensOut: 0,
  307:           unknown: false,
  308:           success: true,
  309:           errorCode: null,
  310:         });
  311:       }
  312:       return {
  313:         text: "",
  314:         output: embeddingResult.embedding,
  315:         raw: embeddingResult.raw,
  316:         meta: { provider: modelConfig.provider, model: modelConfig.model },
  317:       };
  318:     }
  319: 
  320:     const promptBuilder = taskConfig.promptBuilder;
  321:     const messages = options.messages ?? (promptBuilder
  322:       ? promptBuilder({
  323:           input: options.input,
  324:           metadata: options.metadata,
  325:           brains: { agency: agencyBrain ?? undefined, client: clientBrain ?? undefined },
  326:         })
  327:       : []);
  328: 
  329:     const schema = options.outputSchema ?? taskConfig.schema;
  330:     const result = await generateWithRetry({
  331:       provider: provider as any,
  332:       params: {
  333:         model: modelConfig.model,
  334:         messages,
  335:         temperature: modelConfig.params?.temperature,
  336:         max_tokens: modelConfig.params?.max_tokens,
  337:         top_p: modelConfig.params?.top_p,
  338:         timeoutMs: getTimeoutMs(options.taskType),
  339:       },
  340:       schema,
  341:       taskType: options.taskType,
  342:     });
  343: 
  344:     const latencyMs = now() - start;
  345:     const runtimeModel = result.model ?? modelConfig.model;
  346:     if (!context.skipUsageLog) {
  347:       await logUsage(supabase, {
  348:         taskType: options.taskType,
  349:         endpoint: taskConfig.usageEndpoint,
  350:         provider: providerKey,
  351:         model: runtimeModel,
  352:         agencyId: context.agencyId,
  353:         clientId: context.clientId,
  354:         latencyMs,
  355:         tokensIn: result.usage?.inputTokens,
  356:         tokensOut: result.usage?.outputTokens,
  357:         unknown: result.text.startsWith("UNKNOWN"),
  358:         success: true,
  359:         errorCode: null,
  360:       });
  361:     }
  362: 
  363:     return {
  364:       text: result.text,
  365:       output: result.output,
  366:       raw: result.raw,
  367:       rawText: result.rawText,
  368:       schemaOk: result.schemaOk,
  369:       usage: result.usage,
  370:       unknown: result.text.startsWith("UNKNOWN"),
  371:       meta: { provider: providerKey, model: runtimeModel },
  372:       resolvedContext,
  373:     };
  374:   }
  375: 
  376:   async function* runStream(options: AiRunOptions): AsyncGenerator<AiStreamChunk> {
  377:     const start = now();
  378:     const taskConfig = getTaskConfig(options.taskType);
  379:     if (!taskConfig) {
  380:       yield { type: "done", result: { text: "UNKNOWN", unknown: true, error: "Unknown task type" } };
  381:       return;
  382:     }
  383: 
  384:     const context = options.context ?? {};
  385:     const supabase = context.supabase ?? null;
  386:     const contextMissing = (taskConfig.requires.agency && !context.agencyId) ||
  387:       (taskConfig.requires.client && !context.clientId);
  388: 
  389:     if (shouldReturnUnknown(contextMissing, taskConfig.safetyMode)) {
  390:       const latencyMs = now() - start;
  391:       if (!context.skipUsageLog) {
  392:         await logUsage(supabase, {
  393:           taskType: options.taskType,
  394:           endpoint: taskConfig.usageEndpoint,
  395:           provider: "none",
  396:           model: "context-missing",
  397:           agencyId: context.agencyId,
  398:           clientId: context.clientId,
  399:           latencyMs,
  400:           tokensIn: 0,
  401:           tokensOut: 0,
  402:           unknown: true,
  403:           success: true,
  404:           errorCode: "context_missing",
  405:         });
  406:       }
  407:       const unknownResult: AiRunResult = {
  408:         text: "UNKNOWN",
  409:         output: buildUnknownResponse(options.taskType, "context_missing"),
  410:         unknown: true,
  411:       };
  412:       yield { type: "delta", text: unknownResult.text };
  413:       yield { type: "done", result: unknownResult };
  414:       return;
  415:     }
  416: 
  417:     let agencyBrain: Record<string, unknown> | null = null;
  418:     let clientBrain: Record<string, unknown> | null = null;
  419:     if (taskConfig.requires.agency && context.agencyId && supabase) {
  420:       const res = await getAgencyBrainContext(supabase, context.agencyId);
  421:       agencyBrain = res.data;
  422:       if (!res.data && shouldReturnUnknown(true, taskConfig.safetyMode)) {
  423:         const unknownResult: AiRunResult = {
  424:           text: "UNKNOWN",
  425:           output: buildUnknownResponse(options.taskType, "agency_brain_missing"),
  426:           unknown: true,
  427:         };
  428:         yield { type: "delta", text: unknownResult.text };
  429:         yield { type: "done", result: unknownResult };
  430:         return;
  431:       }
  432:     }
  433:     if (taskConfig.requires.client && context.clientId && supabase) {
  434:       const res = await getClientBrainContext(supabase, context.clientId);
  435:       clientBrain = res.data;
  436:       if (!res.data && shouldReturnUnknown(true, taskConfig.safetyMode)) {
  437:         const unknownResult: AiRunResult = {
  438:           text: "UNKNOWN",
  439:           output: buildUnknownResponse(options.taskType, "client_brain_missing"),
  440:           unknown: true,
  441:         };
  442:         yield { type: "delta", text: unknownResult.text };
  443:         yield { type: "done", result: unknownResult };
  444:         return;
  445:       }
  446:     }
  447: 
  448:     if (taskConfig.outputMode !== "freeform") {
  449:       const result = await run(options);
  450:       yield { type: "delta", text: result.text };
  451:       yield { type: "done", result };
  452:       return;
  453:     }
  454: 
  455:     const modelConfigBase = resolveTaskModel(options.taskType, context.environment);
  456:     const overrideModel = options.metadata?.modelOverride as string | undefined;
  457:     const overrideProvider = options.metadata?.providerOverride as string | undefined;
  458:     const modelConfig = overrideModel ? { ...modelConfigBase, model: overrideModel } : modelConfigBase;
  459:     const providerKey = overrideProvider ?? modelConfig.provider;
  460:     const provider = providers[providerKey];
  461:     if (!provider || !("generateStream" in provider)) {
  462:       const result = await run(options);
  463:       yield { type: "delta", text: result.text };
  464:       yield { type: "done", result };
  465:       return;
  466:     }
  467: 
  468:     const promptBuilder = taskConfig.promptBuilder;
  469:     const messages = options.messages ?? (promptBuilder
  470:       ? promptBuilder({
  471:           input: options.input,
  472:           metadata: options.metadata,
  473:           brains: { agency: agencyBrain ?? undefined, client: clientBrain ?? undefined },
  474:         })
  475:       : []);
  476: 
  477:     const params = {
  478:       model: modelConfig.model,
  479:       messages,
  480:       temperature: modelConfig.params?.temperature,
  481:       max_tokens: modelConfig.params?.max_tokens,
  482:       top_p: modelConfig.params?.top_p,
  483:       timeoutMs: getTimeoutMs(options.taskType),
  484:     };
  485: 
  486:     let text = "";
  487:     for await (const chunk of (provider as any).generateStream(params)) {
  488:       if (chunk?.delta) {
  489:         text += chunk.delta;
  490:         yield { type: "delta", text: chunk.delta };
  491:       }
  492:     }
  493: 
  494:     const latencyMs = now() - start;
  495:     if (!context.skipUsageLog) {
  496:       await logUsage(supabase, {
  497:         taskType: options.taskType,
  498:         endpoint: taskConfig.usageEndpoint,
  499:         provider: providerKey,
  500:         model: modelConfig.model,
  501:         agencyId: context.agencyId,
  502:         clientId: context.clientId,
  503:         latencyMs,
  504:         tokensIn: 0,
  505:         tokensOut: 0,
  506:         unknown: text.startsWith("UNKNOWN"),
  507:         success: true,
  508:         errorCode: null,
  509:       });
  510:     }
  511: 
  512:     const result: AiRunResult = {
  513:       text,
  514:       output: undefined,
  515:       raw: undefined,
  516:       unknown: text.startsWith("UNKNOWN"),
  517:       meta: { provider: providerKey, model: modelConfig.model },
  518:     };
  519: 
  520:     yield { type: "done", result };
  521:   }
  522: 
  523:   return { run, runStream };
  524: }
  525: 
  526: export const ai = createAiRouter();
```

### Full File (line-numbered): `src/ai/taskRegistry.ts`
```text
    1: import { buildAdminSetupGuidedPrompt } from "./prompts/adminSetupGuided.ts"
    2: import { buildAdminGeneralChatPrompt } from "./prompts/adminGeneralChat.ts"
    3: import { buildAdminSetupExtractPrompt } from "./prompts/adminSetupExtract.ts"
    4: import { buildChatGeneralPrompt } from "./prompts/chatGeneral.ts"
    5: import { buildClassifyIntentPrompt } from "./prompts/classifyIntent.ts"
    6: import { buildClientPortalQaPrompt } from "./prompts/clientPortalQa.ts"
    7: import { buildContentIdeasPrompt } from "./prompts/contentIdeas.ts"
    8: import { buildExtractStructuredPrompt } from "./prompts/extractStructured.ts"
    9: import { buildOnboardingAudiencePrompt, buildOnboardingDifferentiatorsPrompt, buildOnboardingOffersPrompt } from "./prompts/onboardingGuide.ts"
   10: import { buildStrategyPlanPrompt } from "./prompts/strategyPlan.ts"
   11: import { buildSummarizePrompt } from "./prompts/summarize.ts"
   12: import { buildToolExecutionPrompt } from "./prompts/toolExecution.ts"
   13: import { resolveModelPolicy } from "./modelPolicy.ts"
   14: import { adminChatSchema, adminChatStrategicSchema, arraySchema, objectSchema, OutputSchema } from "./schema.ts"
   15: import { TaskType } from "./taskTypes.ts"
   16: import type { ChatMessage } from "./providers/types.ts"
   17: 
   18: export type SafetyMode = "strict_unknown" | "normal";
   19: export type OutputMode = "freeform" | "json_schema" | "embedding";
   20: 
   21: export type BrainRequirements = {
   22:   agency: boolean;
   23:   client: boolean;
   24: };
   25: 
   26: export type PromptBuilderArgs = {
   27:   input?: string;
   28:   metadata?: Record<string, unknown>;
   29:   brains?: {
   30:     agency?: Record<string, unknown> | null;
   31:     client?: Record<string, unknown> | null;
   32:   };
   33: };
   34: 
   35: type TaskConfigBase = {
   36:   taskType: TaskType;
   37:   outputMode: OutputMode;
   38:   safetyMode: SafetyMode;
   39:   promptBuilder?: (args: PromptBuilderArgs) => ChatMessage[];
   40:   requires: BrainRequirements;
   41:   usageEndpoint: string;
   42:   buildUnknown?: (args: { reason: string }) => unknown;
   43: };
   44: 
   45: type FreeformTaskConfig = TaskConfigBase & {
   46:   outputMode: "freeform";
   47:   freeformReason: string;
   48:   schema?: undefined;
   49: };
   50: 
   51: type JsonSchemaTaskConfig = TaskConfigBase & {
   52:   outputMode: "json_schema";
   53:   schema: OutputSchema<unknown>;
   54:   freeformReason?: undefined;
   55: };
   56: 
   57: type EmbeddingTaskConfig = TaskConfigBase & {
   58:   outputMode: "embedding";
   59:   schema?: undefined;
   60:   freeformReason?: undefined;
   61: };
   62: 
   63: export type TaskConfig = FreeformTaskConfig | JsonSchemaTaskConfig | EmbeddingTaskConfig;
   64: 
   65: const DEFAULT_UNKNOWN_RESPONSE = { answer: "UNKNOWN", unknown: true, questions: ["What additional context is required?"], confidence: 0 };
   66: 
   67: function readEnvFlag(name: string) {
   68:   if (typeof Deno !== "undefined" && typeof (Deno as any)?.env?.get === "function") {
   69:     return (Deno as any).env.get(name) as string | undefined;
   70:   }
   71:   if (typeof process !== "undefined") {
   72:     return process.env[name];
   73:   }
   74:   return undefined;
   75: }
   76: 
   77: function isAdminChatSchemaEnabled() {
   78:   return readEnvFlag("AI_ADMIN_CHAT_SCHEMA") === "true";
   79: }
   80: 
   81: function isAdminChatStrategicEnabled() {
   82:   return readEnvFlag("AI_ADMIN_CHAT_STRATEGIC") === "true";
   83: }
   84: 
   85: const ADMIN_CHAT_SCHEMA_CONFIG: TaskConfig = {
   86:   taskType: TaskType.AGENCY_ADMIN_GENERAL_CHAT,
   87:   outputMode: "json_schema",
   88:   safetyMode: "strict_unknown",
   89:   promptBuilder: (args) =>
   90:     buildAdminGeneralChatPrompt({
   91:       contextSnapshot: (args.metadata?.contextSnapshot as Record<string, unknown>) ?? {},
   92:       conversation: (args.metadata?.conversation as string) ?? "",
   93:       latestUserMessage: (args.metadata?.latestUserMessage as string) ?? "",
   94:       outputMode: "schema",
   95:     }),
   96:   requires: { agency: true, client: false },
   97:   usageEndpoint: "ai-agency-admin-chat",
   98:   schema: adminChatSchema(),
   99:   buildUnknown: () => ({
  100:     assistant_message: "UNKNOWN. I need more details to answer. What should I help with first?",
  101:     suggestions: [],
  102:     actions: [],
  103:     escalated: false,
  104:     unknown: true,
  105:   }),
  106: };
  107: 
  108: const ADMIN_CHAT_STRATEGIC_CONFIG: TaskConfig = {
  109:   taskType: TaskType.AGENCY_ADMIN_GENERAL_CHAT,
  110:   outputMode: "json_schema",
  111:   safetyMode: "strict_unknown",
  112:   promptBuilder: (args) =>
  113:     buildAdminGeneralChatPrompt({
  114:       contextSnapshot: (args.metadata?.contextSnapshot as Record<string, unknown>) ?? {},
  115:       conversation: (args.metadata?.conversation as string) ?? "",
  116:       latestUserMessage: (args.metadata?.latestUserMessage as string) ?? "",
  117:       outputMode: "strategic",
  118:       ragContext: (args.metadata?.ragContext as string | undefined) ?? undefined,
  119:       contextBlob: (args.metadata?.contextBlob as Record<string, unknown> | undefined) ?? undefined,
  120:       playbook: (args.metadata?.playbook as any) ?? undefined,
  121:     }),
  122:   requires: { agency: true, client: false },
  123:   usageEndpoint: "ai-agency-admin-chat",
  124:   schema: adminChatStrategicSchema(),
  125:   buildUnknown: () => ({
  126:     playbook: "core_offer",
  127:     clarifying_questions: [],
  128:     assumptions: [],
  129:     core_offer: null,
  130:     strategy: null,
  131:     copywriting: null,
  132:     unknown: { missing: ["context"], question: "What should I help with first?" },
  133:     suggestions: [],
  134:   }),
  135: };
  136: 
  137: export const TASK_REGISTRY: Record<TaskType, TaskConfig> = {
  138:   [TaskType.CHAT_GENERAL]: {
  139:     taskType: TaskType.CHAT_GENERAL,
  140:     outputMode: "freeform",
  141:     freeformReason: "General chat returns conversational text without a rigid schema.",
  142:     safetyMode: "normal",
  143:     promptBuilder: (args) => buildChatGeneralPrompt({ input: args.input ?? "" }),
  144:     requires: { agency: false, client: false },
  145:     usageEndpoint: "ai-router",
  146:   },
  147:   [TaskType.CHAT_ADMIN_ONBOARDING]: {
  148:     taskType: TaskType.CHAT_ADMIN_ONBOARDING,
  149:     outputMode: "freeform",
  150:     freeformReason: "Admin onboarding chat uses conversational replies for guided setup.",
  151:     safetyMode: "strict_unknown",
  152:     promptBuilder: (args) => buildChatGeneralPrompt({ input: args.input ?? "" }),
  153:     requires: { agency: true, client: false },
  154:     usageEndpoint: "ai-agency-admin-chat",
  155:   },
  156:   [TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2]: {
  157:     taskType: TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2,
  158:     outputMode: "json_schema",
  159:     safetyMode: "strict_unknown",
  160:     promptBuilder: (args) =>
  161:       buildAdminSetupGuidedPrompt({
  162:         agencyBrain: args.brains?.agency ?? {},
  163:         conversation: (args.metadata?.conversation as string) ?? "",
  164:         latestUserMessage: (args.metadata?.latestUserMessage as string) ?? "",
  165:         contextSnapshot: (args.metadata?.contextSnapshot as Record<string, unknown>) ?? {},
  166:       }),
  167:     requires: { agency: true, client: false },
  168:     usageEndpoint: "ai-agency-admin-chat",
  169:     schema: objectSchema("agency_admin_setup_guided_v2", [
  170:       "assistant_message",
  171:       "expects",
  172:       "choices",
  173:       "suggestions",
  174:       "progress_percent",
  175:       "done",
  176:       "memory_patch",
  177:       "state",
  178:     ]),
  179:     buildUnknown: () => ({
  180:       assistant_message: "What detail should we start with for your agency setup?",
  181:       expects: "text",
  182:       choices: [],
  183:       suggestions: [],
  184:       progress_percent: 0,
  185:       done: false,
  186:       memory_patch: {},
  187:       state: {
  188:         intent: "CLARIFICATION_REQUEST",
  189:         pending_question_key: null,
  190:         pending_question_text: null,
  191:       },
  192:     }),
  193:   },
  194:   [TaskType.AGENCY_ADMIN_GENERAL_CHAT]: {
  195:     taskType: TaskType.AGENCY_ADMIN_GENERAL_CHAT,
  196:     outputMode: "freeform",
  197:     freeformReason: "Admin chat uses conversational output with suggestion parsing.",
  198:     safetyMode: "strict_unknown",
  199:     promptBuilder: (args) =>
  200:       buildAdminGeneralChatPrompt({
  201:         contextSnapshot: (args.metadata?.contextSnapshot as Record<string, unknown>) ?? {},
  202:         conversation: (args.metadata?.conversation as string) ?? "",
  203:         latestUserMessage: (args.metadata?.latestUserMessage as string) ?? "",
  204:         outputMode: "legacy",
  205:       }),
  206:     requires: { agency: true, client: false },
  207:     usageEndpoint: "ai-agency-admin-chat",
  208:     buildUnknown: () => ({
  209:       assistant_message: "UNKNOWN. I need more details to answer. What should I help with first?",
  210:       suggestions: [],
  211:     }),
  212:   },
  213:   [TaskType.AGENCY_ADMIN_SETUP_EXTRACT]: {
  214:     taskType: TaskType.AGENCY_ADMIN_SETUP_EXTRACT,
  215:     outputMode: "json_schema",
  216:     safetyMode: "normal",
  217:     promptBuilder: (args) =>
  218:       buildAdminSetupExtractPrompt({
  219:         questionKey: (args.metadata?.questionKey as string) ?? "",
  220:         questionText: (args.metadata?.questionText as string) ?? "",
  221:         targetPath: (args.metadata?.targetPath as string) ?? "",
  222:         answer: args.input ?? "",
  223:         contextSnapshot: (args.metadata?.contextSnapshot as Record<string, unknown>) ?? {},
  224:       }),
  225:     requires: { agency: true, client: false },
  226:     usageEndpoint: "ai-agency-admin-chat",
  227:     schema: objectSchema("agency_admin_setup_extract", ["value"]),
  228:     buildUnknown: () => ({ value: null }),
  229:   },
  230:   [TaskType.CLIENT_PORTAL_QA]: {
  231:     taskType: TaskType.CLIENT_PORTAL_QA,
  232:     outputMode: "json_schema",
  233:     safetyMode: "strict_unknown",
  234:     promptBuilder: (args) =>
  235:       buildClientPortalQaPrompt({
  236:         question: args.input ?? "",
  237:         context: (args.metadata?.context as string) ?? "",
  238:       }),
  239:     requires: { agency: false, client: false },
  240:     usageEndpoint: "ai-ask",
  241:     schema: objectSchema("client_portal_qa", ["answer", "unknown", "questions", "confidence"]),
  242:     buildUnknown: () => DEFAULT_UNKNOWN_RESPONSE,
  243:   },
  244:   [TaskType.SUMMARIZE]: {
  245:     taskType: TaskType.SUMMARIZE,
  246:     outputMode: "freeform",
  247:     freeformReason: "Report summarization produces narrative text for email/PDF rendering.",
  248:     safetyMode: "normal",
  249:     promptBuilder: (args) =>
  250:       buildSummarizePrompt({
  251:         input: args.input ?? "",
  252:         systemPrompt: (args.metadata?.systemPrompt as string) ?? undefined,
  253:       }),
  254:     requires: { agency: false, client: false },
  255:     usageEndpoint: "generate-monthly-report",
  256:   },
  257:   [TaskType.EXTRACT_STRUCTURED]: {
  258:     taskType: TaskType.EXTRACT_STRUCTURED,
  259:     outputMode: "json_schema",
  260:     safetyMode: "strict_unknown",
  261:     promptBuilder: (args) =>
  262:       buildExtractStructuredPrompt({
  263:         input: args.input ?? "",
  264:         instructions: (args.metadata?.instructions as string) ?? undefined,
  265:       }),
  266:     requires: { agency: false, client: false },
  267:     usageEndpoint: "ai-router",
  268:     schema: arraySchema("extract_structured"),
  269:     buildUnknown: () => DEFAULT_UNKNOWN_RESPONSE,
  270:   },
  271:   [TaskType.CLASSIFY_INTENT]: {
  272:     taskType: TaskType.CLASSIFY_INTENT,
  273:     outputMode: "json_schema",
  274:     safetyMode: "normal",
  275:     promptBuilder: (args) => buildClassifyIntentPrompt({ input: args.input ?? "" }),
  276:     requires: { agency: false, client: false },
  277:     usageEndpoint: "ai-router",
  278:     schema: objectSchema("classify_intent", ["intent"]),
  279:   },
  280:   [TaskType.STRATEGY_PLAN]: {
  281:     taskType: TaskType.STRATEGY_PLAN,
  282:     outputMode: "json_schema",
  283:     safetyMode: "strict_unknown",
  284:     promptBuilder: (args) =>
  285:       buildStrategyPlanPrompt({
  286:         agencyBrain: args.brains?.agency ?? {},
  287:         clientBrain: (args.metadata?.client_brain as any) ?? args.brains?.client ?? {},
  288:         context: (args.metadata?.context as string) ?? "",
  289:         instruction: (args.metadata?.instruction as string | undefined) ?? undefined,
  290:       }),
  291:     requires: { agency: false, client: false },
  292:     usageEndpoint: "ai-strategy-generate",
  293:     schema: objectSchema("strategy_plan", ["summary", "sections"]),
  294:     buildUnknown: () => ({ unknown: true, missing_fields: [], questions: ["What additional context is required?"], escalation: false }),
  295:   },
  296:   [TaskType.CONTENT_IDEAS]: {
  297:     taskType: TaskType.CONTENT_IDEAS,
  298:     outputMode: "json_schema",
  299:     safetyMode: "normal",
  300:     promptBuilder: (args) =>
  301:       buildContentIdeasPrompt({
  302:         mode: (args.metadata?.mode as any) ?? "ideas",
  303:         platform: (args.metadata?.platform as string) ?? undefined,
  304:         brandContext: (args.metadata?.brand_context as string) ?? undefined,
  305:         inputText: (args.metadata?.input_text as string) ?? undefined,
  306:       }),
  307:     requires: { agency: false, client: false },
  308:     usageEndpoint: "generate-ai-content",
  309:     schema: arraySchema("content_ideas"),
  310:   },
  311:   [TaskType.SCRIPT_WRITING]: {
  312:     taskType: TaskType.SCRIPT_WRITING,
  313:     outputMode: "json_schema",
  314:     safetyMode: "normal",
  315:     promptBuilder: (args) =>
  316:       buildContentIdeasPrompt({
  317:         mode: "script",
  318:         platform: (args.metadata?.platform as string) ?? undefined,
  319:         brandContext: (args.metadata?.brand_context as string) ?? undefined,
  320:         inputText: (args.metadata?.input_text as string) ?? undefined,
  321:       }),
  322:     requires: { agency: false, client: false },
  323:     usageEndpoint: "generate-ai-content",
  324:     schema: arraySchema("script_writing"),
  325:   },
  326:   [TaskType.TOOL_EXECUTION]: {
  327:     taskType: TaskType.TOOL_EXECUTION,
  328:     outputMode: "json_schema",
  329:     safetyMode: "normal",
  330:     promptBuilder: (args) => buildToolExecutionPrompt({ input: args.input ?? "" }),
  331:     requires: { agency: false, client: false },
  332:     usageEndpoint: "ai-router",
  333:     schema: objectSchema("tool_execution", []),
  334:   },
  335:   [TaskType.EMBED_TEXT]: {
  336:     taskType: TaskType.EMBED_TEXT,
  337:     outputMode: "embedding",
  338:     safetyMode: "normal",
  339:     requires: { agency: false, client: false },
  340:     usageEndpoint: "ai-embeddings",
  341:   },
  342: };
  343: 
  344: export function getTaskConfig(taskType: TaskType): TaskConfig {
  345:   if (taskType === TaskType.AGENCY_ADMIN_GENERAL_CHAT && isAdminChatStrategicEnabled()) {
  346:     return ADMIN_CHAT_STRATEGIC_CONFIG;
  347:   }
  348:   if (taskType === TaskType.AGENCY_ADMIN_GENERAL_CHAT && isAdminChatSchemaEnabled()) {
  349:     return ADMIN_CHAT_SCHEMA_CONFIG;
  350:   }
  351:   return TASK_REGISTRY[taskType];
  352: }
  353: 
  354: export function resolveTaskModel(taskType: TaskType, env?: "dev" | "prod") {
  355:   return resolveModelPolicy({ taskType, environment: env });
  356: }
```

### Full Dump (line-numbered): `src/ai/**/*.ts` (as requested)
```text
=== src\ai\__tests__\adminChatStrategicSchema.test.ts ===
    1: import { describe, it, expect } from "vitest";
    2: import { adminChatStrategicSchema } from "../schema.ts";
    3: 
    4: describe("admin chat strategic schema", () => {
    5:   it("rejects invalid payloads", () => {
    6:     const schema = adminChatStrategicSchema();
    7:     const invalid = schema.validate({
    8:       playbook: "core_offer",
    9:       clarifying_questions: ["q1", "q2", "q3", "q4"],
   10:       strategy: { goal_metric: "bad" },
   11:       unknown: null,
   12:     });
   13:     expect(invalid.ok).toBe(false);
   14:   });
   15: });

=== src\ai\__tests__\adminGeneralChatPrompt.test.ts ===
    1: import { describe, it, expect } from "vitest";
    2: import { buildAdminGeneralChatPrompt } from "../prompts/adminGeneralChat.ts";
    3: import { loadPromptText } from "../promptRegistry.ts";
    4: 
    5: describe("admin general chat prompt mapping", () => {
    6:   it("loads deterministic playbook prompt files", () => {
    7:     const playbooks = [
    8:       { playbook: "core_offer", file: "admin_chat/playbooks/offer_core_offer_v1.md" },
    9:       { playbook: "strategy", file: "admin_chat/playbooks/strategy_v1.md" },
   10:       { playbook: "copywriting", file: "admin_chat/playbooks/copywriting_v1.md" },
   11:     ] as const;
   12: 
   13:     for (const entry of playbooks) {
   14:       const messages = buildAdminGeneralChatPrompt({
   15:         contextSnapshot: {},
   16:         conversation: "",
   17:         latestUserMessage: "hello",
   18:         outputMode: "strategic",
   19:         contextBlob: {},
   20:         playbook: entry.playbook,
   21:       });
   22:       const system = messages.find((msg) => msg.role === "system")?.content ?? "";
   23:       const expected = loadPromptText(entry.file).trim();
   24:       expect(system).toContain(expected);
   25:     }
   26:   });
   27: });

=== src\ai\__tests__\adminSetupGuidedPrompt.test.ts ===
    1: import { describe, expect, it } from "vitest";
    2: import { buildAdminSetupGuidedPrompt } from "../prompts/adminSetupGuided";
    3: 
    4: describe("admin setup guided prompt", () => {
    5:   it("forbids re-asking name/website when present in snapshot", () => {
    6:     const prompt = buildAdminSetupGuidedPrompt({
    7:       agencyBrain: {},
    8:       conversation: "",
    9:       latestUserMessage: "",
   10:       contextSnapshot: { agency: { name: "Rocket Agency", website: "https://rocket.test" } },
   11:     });
   12:     const system = prompt.find((msg) => msg.role === "system")?.content ?? "";
   13:     expect(system).toContain("Do NOT ask for the agency name");
   14:     expect(system).toContain("Do NOT ask for the agency website");
   15:   });
   16: 
   17:   it("keeps required structure invariants", () => {
   18:     const prompt = buildAdminSetupGuidedPrompt({
   19:       agencyBrain: {},
   20:       conversation: "",
   21:       latestUserMessage: "",
   22:       contextSnapshot: { agency: { name: "Rocket Agency", website: "https://rocket.test" } },
   23:     });
   24:     const system = prompt.find((msg) => msg.role === "system")?.content ?? "";
   25:     expect(system).toContain("BOOTSTRAP DATA AWARENESS:");
   26:     expect(system).toContain("Level 1 (Foundation)");
   27:     expect(system).toContain("Level 2 (Differentiation)");
   28:     expect(system).toContain("Level 3 (Operations)");
   29:     expect(system).toContain("Level 4 (Voice & Safety)");
   30:     expect(system).toContain("Level 5 (Expert)");
   31:     expect(system).toContain("system may still follow a deterministic order until orchestration is enabled");
   32:     expect(system).toContain("Do NOT ask for the agency name");
   33:     expect(system).toContain("Do NOT ask for the agency website");
   34:   });
   35: 
   36:   it("keeps required structure invariants", () => {
   37:     const prompt = buildAdminSetupGuidedPrompt({
   38:       agencyBrain: {},
   39:       conversation: "",
   40:       latestUserMessage: "",
   41:       contextSnapshot: { agency: { name: "Rocket Agency", website: "https://rocket.test" } },
   42:     });
   43:     const system = prompt.find((msg) => msg.role === "system")?.content ?? "";
   44:     expect(system).toContain("BOOTSTRAP DATA AWARENESS:");
   45:     expect(system).toContain("Level 1 (Foundation)");
   46:     expect(system).toContain("Level 2 (Differentiation)");
   47:     expect(system).toContain("Level 3 (Operations)");
   48:     expect(system).toContain("Level 4 (Voice & Safety)");
   49:     expect(system).toContain("Level 5 (Expert)");
   50:     expect(system).toContain("system may still follow a deterministic order until orchestration is enabled");
   51:     expect(system).toContain("Do NOT ask for the agency name");
   52:     expect(system).toContain("Do NOT ask for the agency website");
   53:   });
   54: 
   55:   it("allows asking name/website when missing in snapshot", () => {
   56:     const prompt = buildAdminSetupGuidedPrompt({
   57:       agencyBrain: {},
   58:       conversation: "",
   59:       latestUserMessage: "",
   60:       contextSnapshot: { agency: { name: null, website: null } },
   61:     });
   62:     const system = prompt.find((msg) => msg.role === "system")?.content ?? "";
   63:     expect(system).toContain("Agency name is missing. You MAY ask for the agency name if needed.");
   64:     expect(system).toContain("Agency website is missing. You MAY ask for the agency website if needed.");
   65:   });
   66: });

=== src\ai\__tests__\modelPolicy.test.ts ===
    1: import { afterEach, describe, expect, it } from "vitest";
    2: import { getModelForTask } from "../modelPolicy.ts"
    3: import { TaskType } from "../taskTypes.ts"
    4: 
    5: const ENV_KEYS = [
    6:   "AI_MODE",
    7:   "AI_PROVIDER",
    8:   "AI_MODEL",
    9:   "AI_PROVIDER__dev",
   10:   "AI_MODEL__dev",
   11:   "AI_PROVIDER__prod",
   12:   "AI_MODEL__prod",
   13:   "AI_PROVIDER__CHAT_GENERAL",
   14:   "AI_MODEL__CHAT_GENERAL",
   15:   "AI_PROVIDER__CHAT_GENERAL__dev",
   16:   "AI_MODEL__CHAT_GENERAL__dev",
   17:   "AI_PROVIDER__CHAT_GENERAL__prod",
   18:   "AI_MODEL__CHAT_GENERAL__prod",
   19:   "AI_MODEL__TOOL_EXECUTION__prod",
   20:   "AI_TEXT_MODEL_DEFAULT",
   21: ];
   22: 
   23: function clearEnv() {
   24:   for (const key of ENV_KEYS) {
   25:     delete process.env[key];
   26:   }
   27: }
   28: 
   29: afterEach(() => {
   30:   clearEnv();
   31: });
   32: 
   33: describe("model policy", () => {
   34:   it("defaults match current models for each task", () => {
   35:     const defaults = {
   36:       [TaskType.CHAT_GENERAL]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
   37:       [TaskType.CHAT_ADMIN_ONBOARDING]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
   38:       [TaskType.CLIENT_PORTAL_QA]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
   39:       [TaskType.SUMMARIZE]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
   40:       [TaskType.EXTRACT_STRUCTURED]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
   41:       [TaskType.CLASSIFY_INTENT]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
   42:       [TaskType.STRATEGY_PLAN]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
   43:       [TaskType.CONTENT_IDEAS]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
   44:       [TaskType.SCRIPT_WRITING]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
   45:       [TaskType.TOOL_EXECUTION]: { dev: "gemini-1.5-flash", prod: "gemini-1.5-flash" },
   46:     } as const;
   47: 
   48:     for (const [taskType, expected] of Object.entries(defaults)) {
   49:       const devResult = getModelForTask({
   50:         taskType: taskType as TaskType,
   51:         mode: "dev",
   52:         planTier: "free",
   53:       });
   54:       expect(devResult.model).toBe(expected.dev);
   55: 
   56:       const prodResult = getModelForTask({
   57:         taskType: taskType as TaskType,
   58:         mode: "prod",
   59:         planTier: "free",
   60:       });
   61:       expect(prodResult.model).toBe(expected.prod);
   62:     }
   63:   });
   64: 
   65:   it("selects DEV mapping when AI_MODE=dev", () => {
   66:     process.env.AI_MODE = "dev";
   67:     const result = getModelForTask({ taskType: TaskType.TOOL_EXECUTION, planTier: "pro" });
   68:     expect(result.model).toBe("gemini-1.5-flash");
   69:   });
   70: 
   71:   it("selects PROD mapping when AI_MODE=prod", () => {
   72:     process.env.AI_MODE = "prod";
   73:     const result = getModelForTask({ taskType: TaskType.TOOL_EXECUTION, planTier: "pro" });
   74:     expect(result.model).toBe("gemini-1.5-flash");
   75:   });
   76: 
   77:   it("defaults to gemini for text tasks and openai for embeddings", () => {
   78:     const text = getModelForTask({ taskType: TaskType.SUMMARIZE, mode: "prod", planTier: "free" });
   79:     expect(text.provider).toBe("gemini");
   80: 
   81:     const embed = getModelForTask({ taskType: TaskType.EMBED_TEXT, mode: "prod", planTier: "free" });
   82:     expect(embed.provider).toBe("openai");
   83:   });
   84: 
   85:   it("uses per-task per-mode override when set", () => {
   86:     process.env.AI_MODEL__CHAT_GENERAL__prod = "override-model";
   87:     const result = getModelForTask({ taskType: TaskType.CHAT_GENERAL, mode: "prod", planTier: "free" });
   88:     expect(result.model).toBe("override-model");
   89:   });
   90: 
   91:   it("uses global per-mode override when set", () => {
   92:     process.env.AI_MODEL__prod = "global-prod-model";
   93:     const result = getModelForTask({ taskType: TaskType.CHAT_GENERAL, mode: "prod", planTier: "free" });
   94:     expect(result.model).toBe("global-prod-model");
   95:   });
   96: 
   97:   it("throws for unknown task type", () => {
   98:     expect(() =>
   99:       getModelForTask({ taskType: "UNKNOWN_TASK" as TaskType, mode: "dev", planTier: "free" }),
  100:     ).toThrow();
  101:   });
  102: });

=== src\ai\__tests__\promptRegistry.test.ts ===
    1: import { describe, expect, it } from "vitest";
    2: import { loadPromptText } from "../promptRegistry.ts";
    3: 
    4: describe("prompt registry", () => {
    5:   it("does not cache empty prompts", () => {
    6:     expect(() => loadPromptText("admin_chat/empty_test.md")).toThrow();
    7:     expect(() => loadPromptText("admin_chat/empty_test.md")).toThrow();
    8:   });
    9: });

=== src\ai\__tests__\router.test.ts ===
    1: import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
    2: import { createAiRouter } from "../router.ts"
    3: import { TaskType } from "../taskTypes.ts"
    4: 
    5: describe("ai router", () => {
    6:   const baseProvider = {
    7:     generate: vi.fn(async () => ({ text: "OK", usage: { inputTokens: 1, outputTokens: 1 } })),
    8:     embed: vi.fn(async () => ({ embedding: [0.1, 0.2] })),
    9:   };
   10: 
   11:   const providers = {
   12:     openai: baseProvider,
   13:     anthropic: { generate: vi.fn(async () => ({ text: "OK" })) },
   14:     gemini: baseProvider,
   15:   };
   16: 
   17:   beforeEach(() => {
   18:     baseProvider.generate.mockClear();
   19:     baseProvider.embed.mockClear();
   20:   });
   21: 
   22:   afterEach(() => {
   23:     delete process.env.AI_MODEL__TOOL_EXECUTION__prod;
   24:   });
   25: 
   26:   it("selects dev/prod mapping based on environment", async () => {
   27:     const router = createAiRouter({ providers });
   28:     await router.run({
   29:       taskType: TaskType.TOOL_EXECUTION,
   30:       input: "Run tool",
   31:       context: { environment: "dev" },
   32:     });
   33:     const devCall = baseProvider.generate.mock.calls.at(-1)?.[0];
   34:     expect(devCall.model).toBe("gemini-1.5-flash");
   35: 
   36:     await router.run({
   37:       taskType: TaskType.TOOL_EXECUTION,
   38:       input: "Run tool",
   39:       context: { environment: "prod" },
   40:     });
   41:     const prodCall = baseProvider.generate.mock.calls.at(-1)?.[0];
   42:     expect(prodCall.model).toBe("gemini-1.5-flash");
   43:   });
   44: 
   45:   it("uses env override when set", async () => {
   46:     process.env.AI_MODEL__TOOL_EXECUTION__prod = "override-model";
   47:     const router = createAiRouter({ providers });
   48:     await router.run({
   49:       taskType: TaskType.TOOL_EXECUTION,
   50:       input: "Run tool",
   51:       context: { environment: "prod" },
   52:     });
   53:     const call = baseProvider.generate.mock.calls.at(-1)?.[0];
   54:     expect(call.model).toBe("override-model");
   55:   });
   56: 
   57:   it("retries once on schema validation failure", async () => {
   58:     const generate = vi
   59:       .fn()
   60:       .mockResolvedValueOnce({ text: "not-json" })
   61:       .mockResolvedValueOnce({ text: "[{\"id\":\"one\"}]" });
   62:     const router = createAiRouter({
   63:       providers: { ...providers, gemini: { ...baseProvider, generate } },
   64:     });
   65:     const result = await router.run({
   66:       taskType: TaskType.EXTRACT_STRUCTURED,
   67:       input: "Give data",
   68:       context: { environment: "dev" },
   69:     });
   70:     expect(generate).toHaveBeenCalledTimes(2);
   71:     expect(Array.isArray(result.output)).toBe(true);
   72:   });
   73: 
   74:   it("returns UNKNOWN when required brain context is missing", async () => {
   75:     const router = createAiRouter({ providers });
   76:     const result = await router.run({
   77:       taskType: TaskType.STRATEGY_PLAN,
   78:       input: "",
   79:       context: { environment: "dev" },
   80:     });
   81:     expect(result.unknown).toBe(true);
   82:     expect(result.text).toBe("UNKNOWN");
   83:   });
   84: 
   85:   it("passes expected shape to provider adapter", async () => {
   86:     const router = createAiRouter({ providers });
   87:     await router.run({
   88:       taskType: TaskType.CONTENT_IDEAS,
   89:       input: "",
   90:       context: { environment: "dev" },
   91:       metadata: { mode: "ideas", platform: "Instagram" },
   92:     });
   93:     const call = baseProvider.generate.mock.calls.at(-1)?.[0];
   94:     expect(Array.isArray(call.messages)).toBe(true);
   95:     expect(call.messages[0].role).toBe("system");
   96:     expect(call.temperature).toBe(0.8);
   97:   });
   98: 
   99:   it("throws on strict JSON provider failure without logging", async () => {
  100:     const generateJson = vi.fn(async () => {
  101:       const error = new Error("invalid json") as Error & { code?: string };
  102:       error.code = "INVALID_JSON";
  103:       throw error;
  104:     });
  105:     const supabase = {
  106:       from: vi.fn(() => ({
  107:         insert: vi.fn(),
  108:       })),
  109:     };
  110:     const router = createAiRouter({
  111:       providers: { ...providers, gemini: { ...baseProvider, generateJson } as any },
  112:     });
  113:     await expect(
  114:       router.run({
  115:         taskType: TaskType.EXTRACT_STRUCTURED,
  116:         input: "Give data",
  117:         context: { environment: "dev", supabase: supabase as any },
  118:       }),
  119:     ).rejects.toThrow("invalid json");
  120:     expect(supabase.from).not.toHaveBeenCalled();
  121:   });
  122: });

=== src\ai\__tests__\taskRegistry.test.ts ===
    1: import { describe, expect, it } from "vitest";
    2: import { TASK_REGISTRY } from "../taskRegistry.ts";
    3: 
    4: describe("task registry", () => {
    5:   it("requires freeformReason for freeform tasks", () => {
    6:     const freeformTasks = Object.values(TASK_REGISTRY).filter((task) => task.outputMode === "freeform");
    7:     for (const task of freeformTasks) {
    8:       expect(task.freeformReason).toBeTruthy();
    9:     }
   10:   });
   11: });

=== src\ai\__tests__\toolSchemas.test.ts ===
    1: import { describe, it, expect } from "vitest";
    2: import { ToolType, TOOL_REGISTRY } from "../toolSchemas.ts";
    3: 
    4: describe("tool schemas", () => {
    5:   it("exports all 12 tool types", () => {
    6:     expect(Object.keys(TOOL_REGISTRY)).toHaveLength(12);
    7:     // Original 4 tools
    8:     expect(TOOL_REGISTRY[ToolType.CREATE_CLIENT]).toBeDefined();
    9:     expect(TOOL_REGISTRY[ToolType.DRAFT_OFFER]).toBeDefined();
   10:     expect(TOOL_REGISTRY[ToolType.UPDATE_BRAIN]).toBeDefined();
   11:     expect(TOOL_REGISTRY[ToolType.SCHEDULE_TASK]).toBeDefined();
   12:     // TASK-017: Project Management (3 tools)
   13:     expect(TOOL_REGISTRY[ToolType.CREATE_PROJECT]).toBeDefined();
   14:     expect(TOOL_REGISTRY[ToolType.UPDATE_PROJECT_STATUS]).toBeDefined();
   15:     expect(TOOL_REGISTRY[ToolType.ASSIGN_PROJECT_ASSET]).toBeDefined();
   16:     // TASK-018: Scheduling & Tasks (3 tools)
   17:     expect(TOOL_REGISTRY[ToolType.SCHEDULE_POST]).toBeDefined();
   18:     expect(TOOL_REGISTRY[ToolType.UPDATE_TASK_STATUS]).toBeDefined();
   19:     expect(TOOL_REGISTRY[ToolType.UPDATE_TASK_PRIORITY]).toBeDefined();
   20:     // TASK-019: Approvals & Communication (2 tools)
   21:     expect(TOOL_REGISTRY[ToolType.REQUEST_APPROVAL]).toBeDefined();
   22:     expect(TOOL_REGISTRY[ToolType.SEND_MESSAGE]).toBeDefined();
   23:   });
   24: 
   25:   it("enforces schema structure for all entries", () => {
   26:     for (const [key, schema] of Object.entries(TOOL_REGISTRY)) {
   27:       expect(schema).toHaveProperty("type");
   28:       expect(schema).toHaveProperty("description");
   29:       expect(schema).toHaveProperty("parameters");
   30:       expect(schema.description).toBeTruthy();
   31:       expect(typeof schema.parameters).toBe("object");
   32:     }
   33:   });
   34: 
   35:   it("schedule_task schema includes client_id parameter", () => {
   36:     const schema = TOOL_REGISTRY[ToolType.SCHEDULE_TASK];
   37:     expect(schema.parameters.client_id).toBeDefined();
   38:     expect(schema.parameters.client_id.type).toBe("string");
   39:     expect(schema.parameters.client_id.required).toBe(false);
   40:   });
   41: 
   42:   it("all required parameters are marked correctly", () => {
   43:     expect(TOOL_REGISTRY[ToolType.CREATE_CLIENT].parameters.name.required).toBe(true);
   44:     expect(TOOL_REGISTRY[ToolType.DRAFT_OFFER].parameters.service_type.required).toBe(true);
   45:     expect(TOOL_REGISTRY[ToolType.UPDATE_BRAIN].parameters.field.required).toBe(true);
   46:     expect(TOOL_REGISTRY[ToolType.UPDATE_BRAIN].parameters.value.required).toBe(true);
   47:     expect(TOOL_REGISTRY[ToolType.SCHEDULE_TASK].parameters.title.required).toBe(true);
   48:     expect(TOOL_REGISTRY[ToolType.SCHEDULE_TASK].parameters.due_date.required).toBe(true);
   49:   });
   50: });

=== src\ai\adminChatStrategic.ts ===
    1: export type AdminChatPlaybook = "core_offer" | "strategy" | "copywriting";
    2: 
    3: export type AdminChatStrategicOutput = {
    4:   playbook: AdminChatPlaybook;
    5:   clarifying_questions: string[];
    6:   assumptions?: string[];
    7:   core_offer?: {
    8:     icp_primary: string;
    9:     icp_secondary: string[];
   10:     pain_promise: string;
   11:     offer_mechanism: string;
   12:     tiers: Array<{
   13:       name: string;
   14:       price_range: string;
   15:       deliverables: string[];
   16:       timeline_days: number;
   17:     }>;
   18:     process_timeline: string[];
   19:     pricing_guidance: string;
   20:     risk_reversal: string[];
   21:     client_inputs: string[];
   22:     proof_options: string[];
   23:     proof_collection_7d: string;
   24:     next_action: string;
   25:   } | null;
   26:   strategy?: {
   27:     goal_metric: string;
   28:     funnel_map: string[];
   29:     content_pillars: string[];
   30:     content_ideas: string[];
   31:     experiments: string[];
   32:     next_action: string;
   33:   } | null;
   34:   copywriting?: {
   35:     hooks: string[];
   36:     ad_scripts: string[];
   37:     ctas: string[];
   38:     next_action: string;
   39:   } | null;
   40:   unknown?: { missing: string[]; question: string } | null;
   41:   suggestions?: string[];
   42: };
   43: 
   44: export type ValidationResult = { ok: boolean; errors?: string[] };
   45: 
   46: type ScoredPhrase = { phrase: string; weight: number; wordBoundary?: boolean };
   47: 
   48: const PLAYBOOK_SCORES: Record<AdminChatPlaybook, ScoredPhrase[]> = {
   49:   core_offer: [
   50:     { phrase: "core offer", weight: 4 },
   51:     { phrase: "offer", weight: 2, wordBoundary: true },
   52:     { phrase: "package", weight: 2, wordBoundary: true },
   53:     { phrase: "pricing", weight: 3, wordBoundary: true },
   54:     { phrase: "retainer", weight: 3, wordBoundary: true },
   55:     { phrase: "positioning", weight: 2, wordBoundary: true },
   56:     { phrase: "service menu", weight: 3 },
   57:     { phrase: "tiers", weight: 2, wordBoundary: true },
   58:     { phrase: "guarantee", weight: 1, wordBoundary: true },
   59:   ],
   60:   strategy: [
   61:     { phrase: "strategy", weight: 3, wordBoundary: true },
   62:     { phrase: "growth plan", weight: 3 },
   63:     { phrase: "campaign", weight: 2, wordBoundary: true },
   64:     { phrase: "funnel", weight: 3, wordBoundary: true },
   65:     { phrase: "content pillars", weight: 3 },
   66:     { phrase: "content plan", weight: 2 },
   67:     { phrase: "calendar", weight: 2, wordBoundary: true },
   68:     { phrase: "roadmap", weight: 2, wordBoundary: true },
   69:   ],
   70:   copywriting: [
   71:     { phrase: "copywriting", weight: 3, wordBoundary: true },
   72:     { phrase: "ad scripts", weight: 3, wordBoundary: true },
   73:     { phrase: "ad script", weight: 3, wordBoundary: true },
   74:     { phrase: "hooks", weight: 2, wordBoundary: true },
   75:     { phrase: "headline", weight: 2, wordBoundary: true },
   76:     { phrase: "caption", weight: 2, wordBoundary: true },
   77:     { phrase: "ctas", weight: 2, wordBoundary: true },
   78:     { phrase: "cta", weight: 2, wordBoundary: true },
   79:     { phrase: "creative brief", weight: 2 },
   80:     { phrase: "script", weight: 1, wordBoundary: true },
   81:   ],
   82: };
   83: 
   84: function scorePlaybook(message: string, phrases: ScoredPhrase[]) {
   85:   const normalized = message.toLowerCase();
   86:   let score = 0;
   87:   for (const entry of phrases) {
   88:     if (entry.wordBoundary) {
   89:       const regex = new RegExp(`\\b${entry.phrase.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "i");
   90:       if (regex.test(normalized)) score += entry.weight;
   91:     } else if (normalized.includes(entry.phrase)) {
   92:       score += entry.weight;
   93:     }
   94:   }
   95:   return score;
   96: }
   97: 
   98: export function routeAdminChatPlaybook(message: string): AdminChatPlaybook {
   99:   const scores = (Object.keys(PLAYBOOK_SCORES) as AdminChatPlaybook[]).map((playbook) => ({
  100:     playbook,
  101:     score: scorePlaybook(message, PLAYBOOK_SCORES[playbook]),
  102:   }));
  103: 
  104:   const maxScore = Math.max(...scores.map((item) => item.score));
  105:   if (maxScore <= 0) return "core_offer";
  106: 
  107:   const priority: AdminChatPlaybook[] = ["core_offer", "strategy", "copywriting"];
  108:   const best = scores
  109:     .filter((item) => item.score === maxScore)
  110:     .sort((a, b) => priority.indexOf(a.playbook) - priority.indexOf(b.playbook))[0];
  111:   return best?.playbook ?? "core_offer";
  112: }
  113: 
  114: export function clampClarifyingQuestions(questions: string[]): string[] {
  115:   if (!Array.isArray(questions)) return [];
  116:   return questions.filter((q) => typeof q === "string" && q.trim().length > 0).slice(0, 3);
  117: }
  118: 
  119: export function validateStrategicOutput(output: unknown): ValidationResult {
  120:   const errors: string[] = [];
  121:   if (!output || typeof output !== "object") {
  122:     return { ok: false, errors: ["Output must be an object"] };
  123:   }
  124: 
  125:   const parsed = output as AdminChatStrategicOutput;
  126: 
  127:   const playbooks: AdminChatPlaybook[] = ["core_offer", "strategy", "copywriting"];
  128:   if (!playbooks.includes(parsed.playbook)) {
  129:     errors.push("playbook must be core_offer, strategy, or copywriting");
  130:   }
  131: 
  132:   if (!Array.isArray(parsed.clarifying_questions)) {
  133:     errors.push("clarifying_questions must be an array of strings");
  134:   } else {
  135:     if (parsed.clarifying_questions.length > 3) {
  136:       errors.push("clarifying_questions must have <= 3 items");
  137:     }
  138:     parsed.clarifying_questions.forEach((item, index) => {
  139:       if (typeof item !== "string" || !item.trim()) {
  140:         errors.push(`clarifying_questions[${index}] must be a non-empty string`);
  141:       } else if (item.trim().length > 160) {
  142:         errors.push(`clarifying_questions[${index}] must be <= 160 chars`);
  143:       }
  144:     });
  145:   }
  146: 
  147:   if (parsed.suggestions) {
  148:     if (!Array.isArray(parsed.suggestions)) {
  149:       errors.push("suggestions must be an array");
  150:     } else {
  151:       if (parsed.suggestions.length > 3) {
  152:         errors.push("suggestions must have <= 3 items");
  153:       }
  154:       parsed.suggestions.forEach((item, index) => {
  155:         if (typeof item !== "string" || !item.trim()) {
  156:           errors.push(`suggestions[${index}] must be a non-empty string`);
  157:         } else if (item.trim().length > 120) {
  158:           errors.push(`suggestions[${index}] must be <= 120 chars`);
  159:         }
  160:       });
  161:     }
  162:   }
  163: 
  164:   if (parsed.assumptions) {
  165:     if (!Array.isArray(parsed.assumptions)) {
  166:       errors.push("assumptions must be an array");
  167:     } else {
  168:       if (parsed.assumptions.length > 8) {
  169:         errors.push("assumptions must have <= 8 items");
  170:       }
  171:       parsed.assumptions.forEach((item, index) => {
  172:         if (typeof item !== "string" || !item.trim()) {
  173:           errors.push(`assumptions[${index}] must be a non-empty string`);
  174:         } else if (item.trim().length > 140) {
  175:           errors.push(`assumptions[${index}] must be <= 140 chars`);
  176:         }
  177:       });
  178:     }
  179:   }
  180: 
  181:   const payloads = {
  182:     unknown: parsed.unknown ?? null,
  183:     core_offer: parsed.core_offer ?? null,
  184:     strategy: parsed.strategy ?? null,
  185:     copywriting: parsed.copywriting ?? null,
  186:   };
  187:   const payloadKeys = Object.entries(payloads).filter(([, value]) => value !== null && value !== undefined).map(([key]) => key);
  188:   if (payloadKeys.length !== 1) {
  189:     errors.push("Exactly one payload must be present (unknown/core_offer/strategy/copywriting)");
  190:   }
  191:   if (payloads.unknown && payloadKeys.length > 1) {
  192:     errors.push("unknown payload cannot be combined with other payloads");
  193:   }
  194: 
  195:   if (parsed.unknown) {
  196:     const missing = parsed.unknown.missing ?? [];
  197:     if (!Array.isArray(missing) || missing.length < 1 || missing.length > 10) {
  198:       errors.push("unknown.missing must be an array with 1-10 items");
  199:     } else {
  200:       missing.forEach((item, index) => {
  201:         if (typeof item !== "string" || !item.trim()) {
  202:           errors.push(`unknown.missing[${index}] must be a non-empty string`);
  203:         } else if (item.trim().length > 80) {
  204:           errors.push(`unknown.missing[${index}] must be <= 80 chars`);
  205:         }
  206:       });
  207:     }
  208:     if (typeof parsed.unknown.question !== "string" || !parsed.unknown.question.trim()) {
  209:       errors.push("unknown.question must be a non-empty string");
  210:     } else if (parsed.unknown.question.trim().length > 180) {
  211:       errors.push("unknown.question must be <= 180 chars");
  212:     }
  213:   }
  214: 
  215:   if (parsed.playbook === "core_offer") {
  216:     if (parsed.strategy || parsed.copywriting) {
  217:       errors.push("strategy/copywriting payloads must be absent for core_offer");
  218:     }
  219:     const payload = parsed.core_offer;
  220:     if (!payload) {
  221:       errors.push("core_offer payload is required");
  222:     } else {
  223:       if (!payload.icp_primary?.trim() || payload.icp_primary.length > 120) {
  224:         errors.push("core_offer.icp_primary must be 1-120 chars");
  225:       }
  226:       if (!Array.isArray(payload.icp_secondary) || payload.icp_secondary.length !== 2) {
  227:         errors.push("core_offer.icp_secondary must have exactly 2 items");
  228:       } else {
  229:         payload.icp_secondary.forEach((item, index) => {
  230:           if (typeof item !== "string" || !item.trim() || item.trim().length > 120) {
  231:             errors.push(`core_offer.icp_secondary[${index}] must be <= 120 chars`);
  232:           }
  233:         });
  234:       }
  235:       if (!payload.pain_promise?.trim() || payload.pain_promise.length > 220) {
  236:         errors.push("core_offer.pain_promise must be 1-220 chars");
  237:       }
  238:       if (!payload.offer_mechanism?.trim() || payload.offer_mechanism.length > 280) {
  239:         errors.push("core_offer.offer_mechanism must be 1-280 chars");
  240:       }
  241:       if (!Array.isArray(payload.tiers) || payload.tiers.length !== 3) {
  242:         errors.push("core_offer.tiers must have exactly 3 items");
  243:       } else {
  244:         payload.tiers.forEach((tier, index) => {
  245:           if (!tier?.name?.trim() || tier.name.length > 40) {
  246:             errors.push(`core_offer.tiers[${index}].name must be 1-40 chars`);
  247:           }
  248:           if (!tier?.price_range?.trim() || tier.price_range.length > 40) {
  249:             errors.push(`core_offer.tiers[${index}].price_range must be 1-40 chars`);
  250:           }
  251:           if (!Array.isArray(tier.deliverables) || tier.deliverables.length < 3 || tier.deliverables.length > 20) {
  252:             errors.push(`core_offer.tiers[${index}].deliverables must be 3-20 items`);
  253:           } else {
  254:             tier.deliverables.forEach((item, itemIndex) => {
  255:               if (typeof item !== "string" || !item.trim() || item.trim().length > 120) {
  256:                 errors.push(`core_offer.tiers[${index}].deliverables[${itemIndex}] must be <= 120 chars`);
  257:               }
  258:             });
  259:           }
  260:           if (!Number.isInteger(tier.timeline_days) || tier.timeline_days < 1 || tier.timeline_days > 60) {
  261:             errors.push(`core_offer.tiers[${index}].timeline_days must be integer 1-60`);
  262:           }
  263:         });
  264:       }
  265:       if (!Array.isArray(payload.process_timeline) || payload.process_timeline.length < 3 || payload.process_timeline.length > 12) {
  266:         errors.push("core_offer.process_timeline must be 3-12 items");
  267:       } else {
  268:         payload.process_timeline.forEach((item, index) => {
  269:           if (typeof item !== "string" || !item.trim() || item.trim().length > 140) {
  270:             errors.push(`core_offer.process_timeline[${index}] must be <= 140 chars`);
  271:           }
  272:         });
  273:       }
  274:       if (!payload.pricing_guidance?.trim() || payload.pricing_guidance.length > 220) {
  275:         errors.push("core_offer.pricing_guidance must be 1-220 chars");
  276:       }
  277:       if (!Array.isArray(payload.risk_reversal) || payload.risk_reversal.length < 1 || payload.risk_reversal.length > 5) {
  278:         errors.push("core_offer.risk_reversal must be 1-5 items");
  279:       } else {
  280:         payload.risk_reversal.forEach((item, index) => {
  281:           if (typeof item !== "string" || !item.trim() || item.trim().length > 140) {
  282:             errors.push(`core_offer.risk_reversal[${index}] must be <= 140 chars`);
  283:           }
  284:         });
  285:       }
  286:       if (!Array.isArray(payload.client_inputs) || payload.client_inputs.length < 3 || payload.client_inputs.length > 12) {
  287:         errors.push("core_offer.client_inputs must be 3-12 items");
  288:       } else {
  289:         payload.client_inputs.forEach((item, index) => {
  290:           if (typeof item !== "string" || !item.trim() || item.trim().length > 120) {
  291:             errors.push(`core_offer.client_inputs[${index}] must be <= 120 chars`);
  292:           }
  293:         });
  294:       }
  295:       if (!Array.isArray(payload.proof_options) || payload.proof_options.length < 2 || payload.proof_options.length > 8) {
  296:         errors.push("core_offer.proof_options must be 2-8 items");
  297:       } else {
  298:         payload.proof_options.forEach((item, index) => {
  299:           if (typeof item !== "string" || !item.trim() || item.trim().length > 120) {
  300:             errors.push(`core_offer.proof_options[${index}] must be <= 120 chars`);
  301:           }
  302:         });
  303:       }
  304:       if (!payload.proof_collection_7d?.trim() || payload.proof_collection_7d.length > 220) {
  305:         errors.push("core_offer.proof_collection_7d must be 1-220 chars");
  306:       }
  307:       if (!payload.next_action?.trim() || payload.next_action.length > 160) {
  308:         errors.push("core_offer.next_action must be 1-160 chars");
  309:       }
  310:     }
  311:   }
  312: 
  313:   if (parsed.playbook === "strategy") {
  314:     if (parsed.core_offer || parsed.copywriting) {
  315:       errors.push("core_offer/copywriting payloads must be absent for strategy");
  316:     }
  317:     const payload = parsed.strategy;
  318:     if (!payload) {
  319:       errors.push("strategy payload is required");
  320:     } else {
  321:       if (!payload.goal_metric?.trim() || payload.goal_metric.length > 120) {
  322:         errors.push("strategy.goal_metric must be 1-120 chars");
  323:       }
  324:       if (!Array.isArray(payload.funnel_map) || payload.funnel_map.length < 3 || payload.funnel_map.length > 10) {
  325:         errors.push("strategy.funnel_map must be 3-10 items");
  326:       } else {
  327:         payload.funnel_map.forEach((item, index) => {
  328:           if (typeof item !== "string" || !item.trim() || item.trim().length > 140) {
  329:             errors.push(`strategy.funnel_map[${index}] must be <= 140 chars`);
  330:           }
  331:         });
  332:       }
  333:       if (!Array.isArray(payload.content_pillars) || payload.content_pillars.length !== 3) {
  334:         errors.push("strategy.content_pillars must have exactly 3 items");
  335:       } else {
  336:         payload.content_pillars.forEach((item, index) => {
  337:           if (typeof item !== "string" || !item.trim() || item.trim().length > 90) {
  338:             errors.push(`strategy.content_pillars[${index}] must be <= 90 chars`);
  339:           }
  340:         });
  341:       }
  342:       if (!Array.isArray(payload.content_ideas) || payload.content_ideas.length !== 12) {
  343:         errors.push("strategy.content_ideas must have exactly 12 items");
  344:       } else {
  345:         payload.content_ideas.forEach((item, index) => {
  346:           if (typeof item !== "string" || !item.trim() || item.trim().length > 140) {
  347:             errors.push(`strategy.content_ideas[${index}] must be <= 140 chars`);
  348:           }
  349:         });
  350:       }
  351:       if (!Array.isArray(payload.experiments) || payload.experiments.length !== 3) {
  352:         errors.push("strategy.experiments must have exactly 3 items");
  353:       } else {
  354:         payload.experiments.forEach((item, index) => {
  355:           if (typeof item !== "string" || !item.trim() || item.trim().length > 160) {
  356:             errors.push(`strategy.experiments[${index}] must be <= 160 chars`);
  357:           }
  358:         });
  359:       }
  360:       if (!payload.next_action?.trim() || payload.next_action.length > 160) {
  361:         errors.push("strategy.next_action must be 1-160 chars");
  362:       }
  363:     }
  364:   }
  365: 
  366:   if (parsed.playbook === "copywriting") {
  367:     if (parsed.core_offer || parsed.strategy) {
  368:       errors.push("core_offer/strategy payloads must be absent for copywriting");
  369:     }
  370:     const payload = parsed.copywriting;
  371:     if (!payload) {
  372:       errors.push("copywriting payload is required");
  373:     } else {
  374:       if (!Array.isArray(payload.hooks) || payload.hooks.length !== 10) {
  375:         errors.push("copywriting.hooks must have exactly 10 items");
  376:       } else {
  377:         payload.hooks.forEach((item, index) => {
  378:           if (typeof item !== "string" || !item.trim() || item.trim().length > 120) {
  379:             errors.push(`copywriting.hooks[${index}] must be <= 120 chars`);
  380:           }
  381:         });
  382:       }
  383:       if (!Array.isArray(payload.ad_scripts) || payload.ad_scripts.length !== 3) {
  384:         errors.push("copywriting.ad_scripts must have exactly 3 items");
  385:       } else {
  386:         payload.ad_scripts.forEach((item, index) => {
  387:           if (typeof item !== "string" || !item.trim() || item.trim().length > 600) {
  388:             errors.push(`copywriting.ad_scripts[${index}] must be <= 600 chars`);
  389:           }
  390:         });
  391:       }
  392:       if (!Array.isArray(payload.ctas) || payload.ctas.length !== 3) {
  393:         errors.push("copywriting.ctas must have exactly 3 items");
  394:       } else {
  395:         payload.ctas.forEach((item, index) => {
  396:           if (typeof item !== "string" || !item.trim() || item.trim().length > 80) {
  397:             errors.push(`copywriting.ctas[${index}] must be <= 80 chars`);
  398:           }
  399:         });
  400:       }
  401:       if (!payload.next_action?.trim() || payload.next_action.length > 160) {
  402:         errors.push("copywriting.next_action must be 1-160 chars");
  403:       }
  404:     }
  405:   }
  406: 
  407:   return errors.length ? { ok: false, errors } : { ok: true };
  408: }
  409: 
  410: function formatList(items: string[], prefix = "- ") {
  411:   return items.map((item) => `${prefix}${item}`).join("\n");
  412: }
  413: 
  414: function formatNumbered(items: string[]) {
  415:   return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
  416: }
  417: 
  418: export function formatStrategicAssistantMessage(output: AdminChatStrategicOutput): string {
  419:   if (output.unknown) {
  420:     const missing = output.unknown.missing?.length ? output.unknown.missing.join(", ") : "required details";
  421:     return `UNKNOWN\n\nNeed: ${missing}\n\nNext Question: ${output.unknown.question}`;
  422:   }
  423: 
  424:   const nextQuestion = clampClarifyingQuestions(output.clarifying_questions ?? [])[0];
  425:   const assumptions = output.assumptions?.length ? `\nAssumptions:\n${formatList(output.assumptions)}` : "";
  426:   const nextAction = output.playbook === "core_offer"
  427:     ? output.core_offer?.next_action
  428:     : output.playbook === "strategy"
  429:     ? output.strategy?.next_action
  430:     : output.copywriting?.next_action;
  431: 
  432:   if (output.playbook === "core_offer" && output.core_offer) {
  433:     const tiers = output.core_offer.tiers.map((tier) =>
  434:       `- ${tier.name}: ${tier.price_range} | ${tier.deliverables.join(", ")} | ${tier.timeline_days} days`
  435:     );
  436: 
  437:     const blocks = [
  438:       `ICP:\n- Primary: ${output.core_offer.icp_primary}\n- Secondary: ${output.core_offer.icp_secondary.join(", ")}`,
  439:       `Pain -> Promise: ${output.core_offer.pain_promise}`,
  440:       `Offer Mechanism: ${output.core_offer.offer_mechanism}`,
  441:       `Deliverables (3 tiers):\n${tiers.join("\n")}`,
  442:       `Process + Timeline:\n${formatList(output.core_offer.process_timeline)}`,
  443:       `Pricing Guidance: ${output.core_offer.pricing_guidance}`,
  444:       `Risk Reversal:\n${formatList(output.core_offer.risk_reversal)}`,
  445:       `Proof Options:\n${formatList(output.core_offer.proof_options)}`,
  446:       `Proof in 7 Days: ${output.core_offer.proof_collection_7d}`,
  447:       `Client Inputs:\n${formatList(output.core_offer.client_inputs)}`,
  448:       assumptions.trim(),
  449:       `Next Action: ${nextAction ?? "Reply with any missing constraints."}`,
  450:     ];
  451:     if (nextQuestion) {
  452:       blocks.push(`Next Question: ${nextQuestion}`);
  453:     }
  454:     return blocks.filter((block) => block && block.trim().length > 0).join("\n\n");
  455:   }
  456: 
  457:   if (output.playbook === "strategy" && output.strategy) {
  458:     const blocks = [
  459:       `Goal Metric: ${output.strategy.goal_metric}`,
  460:       `Funnel Map:\n${formatNumbered(output.strategy.funnel_map)}`,
  461:       `Content Pillars:\n${formatList(output.strategy.content_pillars)}`,
  462:       `12 Content Ideas:\n${output.strategy.content_ideas.map((idea, i) => `${i + 1}. ${idea}`).join("\n")}`,
  463:       `Experiments:\n${formatList(output.strategy.experiments)}`,
  464:       assumptions.trim(),
  465:       `Next Action: ${nextAction ?? "Confirm your top priority."}`,
  466:     ];
  467:     if (nextQuestion) {
  468:       blocks.push(`Next Question: ${nextQuestion}`);
  469:     }
  470:     return blocks.filter((block) => block && block.trim().length > 0).join("\n\n");
  471:   }
  472: 
  473:   if (output.playbook === "copywriting" && output.copywriting) {
  474:     const blocks = [
  475:       `Hooks:\n${output.copywriting.hooks.map((hook, i) => `${i + 1}. ${hook}`).join("\n")}`,
  476:       `Ad Scripts (15-30s):\n${output.copywriting.ad_scripts.map((script, i) => `${i + 1}. ${script}`).join("\n")}`,
  477:       `CTAs:\n${formatList(output.copywriting.ctas)}`,
  478:       assumptions.trim(),
  479:       `Next Action: ${nextAction ?? "Pick one angle to ship today."}`,
  480:     ];
  481:     if (nextQuestion) {
  482:       blocks.push(`Next Question: ${nextQuestion}`);
  483:     }
  484:     return blocks.filter((block) => block && block.trim().length > 0).join("\n\n");
  485:   }
  486: 
  487:   return "UNKNOWN\n\nNeed: missing deliverable payload\n\nNext Question: What outcome should I produce?";
  488: }

=== src\ai\brainResolver.ts ===
    1: /**
    2:  * Brain Resolver
    3:  *
    4:  * Runtime context resolution for AI tasks.
    5:  * Loads required brain modules, validates required fields,
    6:  * and triggers on-demand calibration when fields are missing.
    7:  *
    8:  * CRITICAL INVARIANT: Only approved brain documents are used at runtime.
    9:  */
   10: 
   11: import { TaskType } from "./taskTypes.ts";
   12: import {
   13:   type ModuleRequirement,
   14:   getTaskModules,
   15:   getRequiredModules,
   16:   taskRequiresBrain,
   17: } from "./taskToModuleMap.ts";
   18: import type { BrainModule } from "@/lib/ai/brainModules";
   19: 
   20: type MinimalSupabase = {
   21:   from: (table: string) => any;
   22: };
   23: 
   24: /**
   25:  * Resolved brain context for AI consumption
   26:  */
   27: export interface ResolvedBrainContext {
   28:   /** Module name â†’ content mapping */
   29:   modules: Record<string, Record<string, unknown>>;
   30:   /** Whether all required fields are present */
   31:   complete: boolean;
   32:   /** Missing field details if incomplete */
   33:   missing: MissingFieldInfo[];
   34:   /** Source metadata */
   35:   meta: {
   36:     resolvedAt: string;
   37:     moduleCount: number;
   38:     agencyId: string;
   39:   };
   40: }
   41: 
   42: /**
   43:  * Information about a missing required field
   44:  */
   45: export interface MissingFieldInfo {
   46:   /** The brain module */
   47:   module: BrainModule;
   48:   /** The field path (dot notation) */
   49:   fieldPath: string;
   50:   /** Human-readable description */
   51:   description: string;
   52:   /** Suggested calibration question */
   53:   calibrationQuestion?: string;
   54: }
   55: 
   56: /**
   57:  * Calibration requirement when fields are missing
   58:  */
   59: export interface CalibrationRequirement {
   60:   /** Whether calibration is needed */
   61:   needed: boolean;
   62:   /** Missing fields that need calibration */
   63:   missingFields: MissingFieldInfo[];
   64:   /** Suggested questions (max 3) */
   65:   questions: string[];
   66:   /** The modules that need attention */
   67:   modules: BrainModule[];
   68: }
   69: 
   70: /**
   71:  * Result of context resolution
   72:  */
   73: export type ResolveResult =
   74:   | { status: "ready"; context: ResolvedBrainContext }
   75:   | { status: "calibration_needed"; calibration: CalibrationRequirement }
   76:   | { status: "error"; error: string };
   77: 
   78: /**
   79:  * Get a nested value from an object using dot notation
   80:  */
   81: function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
   82:   const parts = path.split(".");
   83:   let current: unknown = obj;
   84: 
   85:   for (const part of parts) {
   86:     if (current === null || current === undefined) {
   87:       return undefined;
   88:     }
   89:     if (typeof current !== "object") {
   90:       return undefined;
   91:     }
   92:     current = (current as Record<string, unknown>)[part];
   93:   }
   94: 
   95:   return current;
   96: }
   97: 
   98: /**
   99:  * Check if a value is "populated" (non-empty)
  100:  */
  101: function isPopulated(value: unknown): boolean {
  102:   if (value === null || value === undefined) {
  103:     return false;
  104:   }
  105:   if (typeof value === "string") {
  106:     return value.trim().length > 0;
  107:   }
  108:   if (Array.isArray(value)) {
  109:     return value.length > 0;
  110:   }
  111:   if (typeof value === "object") {
  112:     return Object.keys(value).length > 0;
  113:   }
  114:   return true; // numbers, booleans are considered populated
  115: }
  116: 
  117: /**
  118:  * Generate a calibration question for a missing field
  119:  */
  120: function generateCalibrationQuestion(
  121:   module: BrainModule,
  122:   fieldPath: string
  123: ): string {
  124:   const questionMap: Record<string, Record<string, string>> = {
  125:     bootstrap: {
  126:       agency_name: "What is your agency's name?",
  127:       services:
  128:         "What services does your agency offer? (e.g., Social Media Management, Content Creation)",
  129:       target_industries:
  130:         "What industries do your clients typically come from?",
  131:       geographic_focus: "What geographic regions do you serve?",
  132:     },
  133:     tone_voice: {
  134:       voice_attributes:
  135:         "How would you describe your brand voice? (e.g., Professional, Friendly, Bold)",
  136:       vocabulary_preferences:
  137:         "Are there specific words or phrases you prefer to use or avoid?",
  138:       writing_guidelines:
  139:         "What writing style guidelines should the AI follow?",
  140:     },
  141:     rep_policy: {
  142:       boundaries:
  143:         "What topics or claims should the AI avoid? (e.g., pricing promises, competitor mentions)",
  144:       escalation_triggers:
  145:         "What situations should be escalated to a human team member?",
  146:       response_limits:
  147:         "Are there any limitations on how the AI should respond?",
  148:     },
  149:     sop_strategy: {
  150:       content_pillars:
  151:         "What are your main content pillars or themes? (e.g., Educational, Behind-the-scenes, Testimonials)",
  152:       posting_cadence: "How frequently do you typically post content?",
  153:       platform_priorities: "Which social platforms are most important for you?",
  154:     },
  155:     sop_scripting: {
  156:       script_structures:
  157:         "What script formats do you prefer? (e.g., Hook-Story-Offer, Problem-Solution)",
  158:       video_styles: "What video styles resonate with your clients?",
  159:     },
  160:     faq_objections: {
  161:       faqs: "What are the most common questions your clients ask?",
  162:       objections: "What objections do you frequently encounter from prospects?",
  163:     },
  164:     offer_stack: {
  165:       core_offers: "What are your main service packages or offerings?",
  166:       pricing_model: "How is your pricing structured?",
  167:     },
  168:     quality_bar: {
  169:       quality_criteria:
  170:         "What quality standards should content meet before approval?",
  171:     },
  172:     ai_permissions: {
  173:       allowed_actions:
  174:         "What actions should the AI be allowed to take autonomously?",
  175:     },
  176:   };
  177: 
  178:   const moduleQuestions = questionMap[module];
  179:   if (moduleQuestions && moduleQuestions[fieldPath]) {
  180:     return moduleQuestions[fieldPath];
  181:   }
  182: 
  183:   // Fallback generic question
  184:   const readableField = fieldPath.replace(/_/g, " ").toLowerCase();
  185:   return `Please provide information about: ${readableField}`;
  186: }
  187: 
  188: /**
  189:  * Fetch approved brain documents for an agency
  190:  */
  191: async function fetchApprovedDocuments(
  192:   supabase: MinimalSupabase,
  193:   agencyId: string
  194: ): Promise<{ module: BrainModule; content: Record<string, unknown> }[]> {
  195:   const res = await supabase
  196:     .from("brain_documents")
  197:     .select("module, content_json")
  198:     .eq("agency_id", agencyId)
  199:     .eq("status", "approved");
  200: 
  201:   if (res?.error) {
  202:     throw new Error(res.error.message ?? "Failed to fetch brain documents");
  203:   }
  204: 
  205:   return (res?.data ?? []).map((doc: any) => ({
  206:     module: doc.module as BrainModule,
  207:     content: doc.content_json as Record<string, unknown>,
  208:   }));
  209: }
  210: 
  211: /**
  212:  * Validate required fields in a module
  213:  */
  214: function validateModuleFields(
  215:   moduleContent: Record<string, unknown> | null,
  216:   requirement: ModuleRequirement
  217: ): MissingFieldInfo[] {
  218:   const missing: MissingFieldInfo[] = [];
  219: 
  220:   if (!moduleContent) {
  221:     // If no field paths specified, the module itself is the requirement
  222:     if (requirement.fieldPaths.length === 0) {
  223:       missing.push({
  224:         module: requirement.module,
  225:         fieldPath: "",
  226:         description: `Module ${requirement.module} is not configured`,
  227:         calibrationQuestion: `Let's configure your ${requirement.module.replace(/_/g, " ")} settings.`,
  228:       });
  229:     } else {
  230:       // All specified fields are missing
  231:       for (const fieldPath of requirement.fieldPaths) {
  232:         missing.push({
  233:           module: requirement.module,
  234:           fieldPath,
  235:           description: `Field ${fieldPath} is not configured`,
  236:           calibrationQuestion: generateCalibrationQuestion(
  237:             requirement.module,
  238:             fieldPath
  239:           ),
  240:         });
  241:       }
  242:     }
  243:     return missing;
  244:   }
  245: 
  246:   // Check each required field path
  247:   for (const fieldPath of requirement.fieldPaths) {
  248:     const value = getNestedValue(moduleContent, fieldPath);
  249:     if (!isPopulated(value)) {
  250:       missing.push({
  251:         module: requirement.module,
  252:         fieldPath,
  253:         description: `Field ${fieldPath} is empty or not configured`,
  254:         calibrationQuestion: generateCalibrationQuestion(
  255:           requirement.module,
  256:           fieldPath
  257:         ),
  258:       });
  259:     }
  260:   }
  261: 
  262:   return missing;
  263: }
  264: 
  265: /**
  266:  * Create a Brain Resolver instance
  267:  */
  268: export function createBrainResolver(supabase: MinimalSupabase) {
  269:   /**
  270:    * Resolve context for a specific task
  271:    *
  272:    * @param taskType - The task being executed
  273:    * @param agencyId - The agency ID
  274:    * @returns Resolved context or calibration requirement
  275:    */
  276:   async function resolveContext(
  277:     taskType: TaskType,
  278:     agencyId: string
  279:   ): Promise<ResolveResult> {
  280:     // Check if task needs brain at all
  281:     if (!taskRequiresBrain(taskType)) {
  282:       return {
  283:         status: "ready",
  284:         context: {
  285:           modules: {},
  286:           complete: true,
  287:           missing: [],
  288:           meta: {
  289:             resolvedAt: new Date().toISOString(),
  290:             moduleCount: 0,
  291:             agencyId,
  292:           },
  293:         },
  294:       };
  295:     }
  296: 
  297:     try {
  298:       // Fetch approved documents
  299:       const documents = await fetchApprovedDocuments(supabase, agencyId);
  300:       const documentMap = new Map<BrainModule, Record<string, unknown>>();
  301:       for (const doc of documents) {
  302:         documentMap.set(doc.module, doc.content);
  303:       }
  304: 
  305:       // Get required modules for this task
  306:       const requirements = getTaskModules(taskType);
  307:       const requiredOnly = getRequiredModules(taskType);
  308: 
  309:       // Check for missing fields in required modules
  310:       const allMissing: MissingFieldInfo[] = [];
  311:       for (const req of requiredOnly) {
  312:         const content = documentMap.get(req.module) ?? null;
  313:         const missing = validateModuleFields(content, req);
  314:         allMissing.push(...missing);
  315:       }
  316: 
  317:       // If there are missing required fields, trigger calibration
  318:       if (allMissing.length > 0) {
  319:         // Generate calibration questions (max 3)
  320:         const questions = allMissing
  321:           .slice(0, 3)
  322:           .map((m) => m.calibrationQuestion)
  323:           .filter((q): q is string => !!q);
  324: 
  325:         const uniqueModules = [
  326:           ...new Set(allMissing.map((m) => m.module)),
  327:         ] as BrainModule[];
  328: 
  329:         return {
  330:           status: "calibration_needed",
  331:           calibration: {
  332:             needed: true,
  333:             missingFields: allMissing,
  334:             questions,
  335:             modules: uniqueModules,
  336:           },
  337:         };
  338:       }
  339: 
  340:       // Build the resolved context with all available modules
  341:       const modules: Record<string, Record<string, unknown>> = {};
  342:       for (const req of requirements) {
  343:         const content = documentMap.get(req.module);
  344:         if (content) {
  345:           modules[req.module] = content;
  346:         }
  347:       }
  348: 
  349:       return {
  350:         status: "ready",
  351:         context: {
  352:           modules,
  353:           complete: true,
  354:           missing: [],
  355:           meta: {
  356:             resolvedAt: new Date().toISOString(),
  357:             moduleCount: Object.keys(modules).length,
  358:             agencyId,
  359:           },
  360:         },
  361:       };
  362:     } catch (error) {
  363:       return {
  364:         status: "error",
  365:         error:
  366:           error instanceof Error ? error.message : "Failed to resolve context",
  367:       };
  368:     }
  369:   }
  370: 
  371:   /**
  372:    * Get a flat brain context (legacy format) from resolved modules
  373:    * Useful for backward compatibility with existing prompts
  374:    */
  375:   function flattenContext(
  376:     resolved: ResolvedBrainContext
  377:   ): Record<string, unknown> {
  378:     const flat: Record<string, unknown> = {};
  379: 
  380:     for (const [module, content] of Object.entries(resolved.modules)) {
  381:       // Merge module content into flat structure
  382:       for (const [key, value] of Object.entries(content)) {
  383:         flat[`${module}_${key}`] = value;
  384:       }
  385:       // Also store the full module
  386:       flat[module] = content;
  387:     }
  388: 
  389:     return flat;
  390:   }
  391: 
  392:   /**
  393:    * Check if calibration is needed for a task without loading full context
  394:    */
  395:   async function checkCalibrationNeeded(
  396:     taskType: TaskType,
  397:     agencyId: string
  398:   ): Promise<boolean> {
  399:     const result = await resolveContext(taskType, agencyId);
  400:     return result.status === "calibration_needed";
  401:   }
  402: 
  403:   /**
  404:    * Get missing modules for a task
  405:    */
  406:   async function getMissingModules(
  407:     taskType: TaskType,
  408:     agencyId: string
  409:   ): Promise<BrainModule[]> {
  410:     const result = await resolveContext(taskType, agencyId);
  411:     if (result.status === "calibration_needed") {
  412:       return result.calibration.modules;
  413:     }
  414:     return [];
  415:   }
  416: 
  417:   return {
  418:     resolveContext,
  419:     flattenContext,
  420:     checkCalibrationNeeded,
  421:     getMissingModules,
  422:   };
  423: }
  424: 
  425: /**
  426:  * Type for the resolver instance
  427:  */
  428: export type BrainResolver = ReturnType<typeof createBrainResolver>;

=== src\ai\brains\agency.ts ===
    1: type MinimalSupabase = {
    2:   from: (table: string) => any;
    3: };
    4: 
    5: export async function getAgencyBrainContext(supabase: MinimalSupabase, agencyId: string) {
    6:   const res = await supabase
    7:     .from("agency_brains")
    8:     .select("brain_json, updated_at, version")
    9:     .eq("agency_id", agencyId)
   10:     .order("version", { ascending: false })
   11:     .limit(1)
   12:     .maybeSingle();
   13:   if (res?.error) {
   14:     return { data: null as Record<string, unknown> | null, error: res.error.message ?? "Failed to load agency brain" };
   15:   }
   16:   return { data: (res?.data?.brain_json as Record<string, unknown>) ?? null, error: null as string | null };
   17: }

=== src\ai\brains\client.ts ===
    1: type MinimalSupabase = {
    2:   from: (table: string) => any;
    3: };
    4: 
    5: export async function getClientBrainContext(supabase: MinimalSupabase, clientId: string) {
    6:   const res = await supabase
    7:     .from("client_brains")
    8:     .select("brain_json, updated_at, version")
    9:     .eq("client_id", clientId)
   10:     .order("version", { ascending: false })
   11:     .limit(1)
   12:     .maybeSingle();
   13:   if (res?.error) {
   14:     return { data: null as Record<string, unknown> | null, error: res.error.message ?? "Failed to load client brain" };
   15:   }
   16:   return { data: (res?.data?.brain_json as Record<string, unknown>) ?? null, error: null as string | null };
   17: }

=== src\ai\brains\index.ts ===
    1: export { getAgencyBrainContext } from "./agency.ts"
    2: export { getClientBrainContext } from "./client.ts"

=== src\ai\budgets.test.ts ===
    1: import { describe, expect, it, vi } from "vitest"
    2: import { calculateCost, checkBudget, incrementBudget } from "./budgets.ts"
    3: 
    4: describe("calculateCost", () => {
    5:   it("calculates gpt-5-nano costs", () => {
    6:     const cost = calculateCost("openai", "gpt-5-nano", 1000, 500)
    7:     expect(cost).toBeCloseTo(0.0045, 6)
    8:   })
    9: 
   10:   it("calculates gpt-5-mini costs", () => {
   11:     const cost = calculateCost("openai", "gpt-5-mini", 1000, 500)
   12:     expect(cost).toBeCloseTo(0.0075, 6)
   13:   })
   14: 
   15:   it("calculates embedding costs", () => {
   16:     const cost = calculateCost("openai", "text-embedding-3-small", 1000, 0)
   17:     expect(cost).toBeCloseTo(0.00002, 8)
   18:   })
   19: 
   20:   it("matches pricing with model suffixes", () => {
   21:     const cost = calculateCost("openai", "gpt-5-mini-2025-01-01", 1000, 0)
   22:     expect(cost).toBeCloseTo(0.0025, 6)
   23:   })
   24: })
   25: 
   26: describe("budget rpc wrappers", () => {
   27:   it("checkBudget uses rpc with zero delta", async () => {
   28:     const rpc = vi.fn().mockResolvedValue({
   29:       data: [
   30:         {
   31:           allowed: true,
   32:           budget_id: "budget-1",
   33:           spent_usd: 1,
   34:           budget_usd: 10,
   35:           hard_stop: true,
   36:         },
   37:       ],
   38:       error: null,
   39:     })
   40:     const supabase = { rpc }
   41:     const result = await checkBudget(supabase, "agency-1", "2025-01")
   42: 
   43:     expect(rpc).toHaveBeenCalledWith("ai_budget_apply_delta", {
   44:       p_agency_id: "agency-1",
   45:       p_month_yyyy_mm: "2025-01",
   46:       p_delta_usd: 0,
   47:       p_enforce: true,
   48:     })
   49:     expect(result.remainingUsd).toBe(9)
   50:     expect(result.allowed).toBe(true)
   51:   })
   52: 
   53:   it("incrementBudget passes delta to rpc", async () => {
   54:     const rpc = vi.fn().mockResolvedValue({
   55:       data: [
   56:         {
   57:           allowed: true,
   58:           budget_id: "budget-1",
   59:           spent_usd: 2,
   60:           budget_usd: 10,
   61:           hard_stop: true,
   62:         },
   63:       ],
   64:       error: null,
   65:     })
   66:     const supabase = { rpc }
   67:     const result = await incrementBudget(supabase, "agency-1", "2025-01", 1)
   68: 
   69:     expect(rpc).toHaveBeenCalledWith("ai_budget_apply_delta", {
   70:       p_agency_id: "agency-1",
   71:       p_month_yyyy_mm: "2025-01",
   72:       p_delta_usd: 1,
   73:       p_enforce: true,
   74:     })
   75:     expect(result.spentUsd).toBe(2)
   76:   })
   77: })

=== src\ai\budgets.ts ===
    1: import { PRICING } from "./pricing.ts"
    2: 
    3: type MinimalSupabase = {
    4:   rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data?: any; error?: any }>
    5: }
    6: 
    7: export type BudgetCheckResult = {
    8:   allowed: boolean
    9:   budgetId: string | null
   10:   spentUsd: number
   11:   budgetUsd: number
   12:   hardStop: boolean
   13:   remainingUsd: number
   14: }
   15: 
   16: type BudgetRpcRow = {
   17:   allowed: boolean
   18:   budget_id: string | null
   19:   spent_usd: number
   20:   budget_usd: number
   21:   hard_stop: boolean
   22: }
   23: 
   24: function pickPricing(model: string) {
   25:   if (PRICING[model]) return PRICING[model]
   26:   const match = Object.keys(PRICING).find((key) => model.startsWith(key))
   27:   return match ? PRICING[match] : undefined
   28: }
   29: 
   30: export function calculateCost(
   31:   provider: string,
   32:   model: string,
   33:   tokensIn: number = 0,
   34:   tokensOut: number = 0,
   35: ) {
   36:   if (provider !== "openai") return 0
   37:   const pricing = pickPricing(model)
   38:   if (!pricing) return 0
   39:   const inputCost = Math.max(0, tokensIn) * pricing.inputPerToken
   40:   const outputCost = Math.max(0, tokensOut) * pricing.outputPerToken
   41:   return inputCost + outputCost
   42: }
   43: 
   44: async function applyBudgetDelta(
   45:   supabase: MinimalSupabase,
   46:   agencyId: string,
   47:   monthKey: string,
   48:   deltaUsd: number,
   49:   enforce: boolean,
   50: ): Promise<BudgetCheckResult> {
   51:   const { data, error } = await supabase.rpc("ai_budget_apply_delta", {
   52:     p_agency_id: agencyId,
   53:     p_month_yyyy_mm: monthKey,
   54:     p_delta_usd: deltaUsd,
   55:     p_enforce: enforce,
   56:   })
   57: 
   58:   if (error) throw error
   59:   const row = (Array.isArray(data) ? data[0] : data) as BudgetRpcRow | null | undefined
   60:   if (!row) {
   61:     return {
   62:       allowed: false,
   63:       budgetId: null,
   64:       spentUsd: 0,
   65:       budgetUsd: 0,
   66:       hardStop: true,
   67:       remainingUsd: 0,
   68:     }
   69:   }
   70: 
   71:   const remainingUsd = Number(row.budget_usd) - Number(row.spent_usd)
   72:   return {
   73:     allowed: Boolean(row.allowed),
   74:     budgetId: row.budget_id ?? null,
   75:     spentUsd: Number(row.spent_usd),
   76:     budgetUsd: Number(row.budget_usd),
   77:     hardStop: Boolean(row.hard_stop),
   78:     remainingUsd,
   79:   }
   80: }
   81: 
   82: export async function checkBudget(supabase: MinimalSupabase, agencyId: string, monthKey: string) {
   83:   return await applyBudgetDelta(supabase, agencyId, monthKey, 0, true)
   84: }
   85: 
   86: export async function incrementBudget(
   87:   supabase: MinimalSupabase,
   88:   agencyId: string,
   89:   monthKey: string,
   90:   costUsd: number,
   91:   enforce: boolean = true,
   92: ) {
   93:   return await applyBudgetDelta(supabase, agencyId, monthKey, costUsd, enforce)
   94: }

=== src\ai\citations.ts ===
    1: export type Citation = {
    2:   doc_id?: string;
    3:   chunk_id?: string;
    4:   doc_type?: string;
    5:   similarity?: number;
    6: };
    7: 
    8: export type CitationSources = {
    9:   memory_citations?: Citation[];
   10:   client_brain_fields?: string[];
   11:   agency_brain_fields?: string[];
   12: };
   13: 
   14: export type CitationValidationResult = {
   15:   valid: boolean;
   16:   errors: string[];
   17:   coverage: number;
   18: };
   19: 
   20: export function validateCitations(
   21:   output: { sources?: CitationSources; unknown?: boolean; escalate_to_human?: boolean },
   22:   ragMatches: Array<{ doc_id?: string; document_id?: string }>,
   23: ): CitationValidationResult {
   24:   const errors: string[] = [];
   25:   const sources = output.sources ?? {};
   26:   const memoryCitations = sources.memory_citations ?? [];
   27:   const clientBrainFields = sources.client_brain_fields ?? [];
   28:   const agencyBrainFields = sources.agency_brain_fields ?? [];
   29: 
   30:   const hasCitations = memoryCitations.length > 0 || clientBrainFields.length > 0 || agencyBrainFields.length > 0;
   31:   const requiresCitations = !output.unknown && !output.escalate_to_human;
   32:   if (requiresCitations && !hasCitations) {
   33:     errors.push("missing_citations");
   34:   }
   35: 
   36:   const validDocIds = new Set(
   37:     ragMatches
   38:       .map((match) => match.doc_id ?? match.document_id)
   39:       .filter((value): value is string => typeof value === "string"),
   40:   );
   41:   for (const citation of memoryCitations) {
   42:     if (!citation.doc_id || !validDocIds.has(citation.doc_id)) {
   43:       errors.push(`invalid_citation:${citation.doc_id ?? "missing_doc_id"}`);
   44:     }
   45:   }
   46: 
   47:   const coverage = ragMatches.length > 0 ? memoryCitations.length / ragMatches.length : 0;
   48:   return { valid: errors.length === 0, errors, coverage };
   49: }

=== src\ai\logging.ts ===
    1: import { TaskType } from "./taskTypes.ts"
    2: 
    3: type MinimalSupabase = {
    4:   from: (table: string) => any;
    5: };
    6: 
    7: export type UsageLogInput = {
    8:   taskType: TaskType;
    9:   endpoint: string;
   10:   provider: string;
   11:   model: string;
   12:   agencyId?: string | null;
   13:   clientId?: string | null;
   14:   latencyMs: number;
   15:   tokensIn?: number;
   16:   tokensOut?: number;
   17:   unknown?: boolean;
   18:   success: boolean;
   19:   errorCode?: string | null;
   20: };
   21: 
   22: export async function logUsage(supabase: MinimalSupabase | null, input: UsageLogInput) {
   23:   if (!supabase) return;
   24:   await supabase.from("ai_usage_logs").insert({
   25:     agency_id: input.agencyId ?? null,
   26:     client_id: input.clientId ?? null,
   27:     endpoint: input.endpoint,
   28:     model: input.model,
   29:     tokens_estimate: input.tokensIn ?? 0,
   30:     tokens_in: input.tokensIn ?? 0,
   31:     tokens_out: input.tokensOut ?? 0,
   32:     latency_ms: input.latencyMs,
   33:     unknown: input.unknown ?? false,
   34:   });
   35: }

=== src\ai\modelPolicy.ts ===
    1: import { TaskType } from "./taskTypes.ts"
    2: import { getEnvVar } from "./utils.ts"
    3: import type {
    4:   EnvMode,
    5:   ModelParams,
    6:   ModelSelection,
    7:   ModelSelectionInput,
    8:   PlanTier,
    9:   Provider,
   10:   QualityTier,
   11: } from "./modelTypes.ts"
   12: 
   13: type BaseModelConfig = {
   14:   provider: Provider
   15:   model: string
   16:   params?: ModelParams
   17: }
   18: 
   19: type TaskModelPolicy = {
   20:   dev: BaseModelConfig
   21:   prod: BaseModelConfig
   22:   legacyModelEnv?: string
   23:   qualityTierOverrides?: Partial<Record<QualityTier, Partial<BaseModelConfig>>>
   24: }
   25: 
   26: /**
   27:  * COST / QUALITY NOTES (Standard pricing reference)
   28:  * - gemini-1.5-flash: fastest + lower cost for most text tasks
   29:  * - gemini-1.5-pro: higher quality when needed
   30:  *
   31:  * If you need a different model, set env overrides per task.
   32:  */
   33: 
   34: const DEFAULT_TEXT_MODEL = "gemini-1.5-flash";
   35: 
   36: const DEFAULT_POLICIES: Record<TaskType, TaskModelPolicy> = {
   37:   [TaskType.CHAT_GENERAL]: {
   38:     dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.4 } },
   39:     prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.4 } },
   40:   },
   41: 
   42:   [TaskType.CHAT_ADMIN_ONBOARDING]: {
   43:     dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
   44:     prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
   45:   },
   46: 
   47:   [TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2]: {
   48:     dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.3 } },
   49:     prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.3 } },
   50:   },
   51: 
   52:   [TaskType.AGENCY_ADMIN_GENERAL_CHAT]: {
   53:     dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.4 } },
   54:     prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.4 } },
   55:   },
   56: 
   57:   [TaskType.AGENCY_ADMIN_SETUP_EXTRACT]: {
   58:     dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.1 } },
   59:     prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.1 } },
   60:   },
   61: 
   62:   [TaskType.CLIENT_PORTAL_QA]: {
   63:     dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
   64:     prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
   65:     legacyModelEnv: "RAG_MODEL_ID",
   66:   },
   67: 
   68:   [TaskType.SUMMARIZE]: {
   69:     dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
   70:     prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
   71:   },
   72: 
   73:   [TaskType.EXTRACT_STRUCTURED]: {
   74:     dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.1 } },
   75:     prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.1 } },
   76:   },
   77: 
   78:   [TaskType.CLASSIFY_INTENT]: {
   79:     dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0 } },
   80:     prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0 } },
   81:   },
   82: 
   83:   [TaskType.STRATEGY_PLAN]: {
   84:     dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
   85:     prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.2 } },
   86:     legacyModelEnv: "STRATEGY_MODEL_ID",
   87:   },
   88: 
   89:   [TaskType.CONTENT_IDEAS]: {
   90:     dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.8 } },
   91:     prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.8 } },
   92:   },
   93: 
   94:   [TaskType.SCRIPT_WRITING]: {
   95:     dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.8 } },
   96:     prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0.8 } },
   97:   },
   98: 
   99:   [TaskType.TOOL_EXECUTION]: {
  100:     dev: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0 } },
  101:     prod: { provider: "gemini", model: DEFAULT_TEXT_MODEL, params: { temperature: 0 } },
  102:   },
  103: 
  104:   [TaskType.EMBED_TEXT]: {
  105:     dev: { provider: "openai", model: "text-embedding-3-small" },
  106:     prod: { provider: "openai", model: "text-embedding-3-small" },
  107:     legacyModelEnv: "EMBEDDING_MODEL_ID",
  108:   },
  109: }
  110: 
  111: const DEFAULT_MODE: EnvMode = "dev"
  112: const DEFAULT_PLAN: PlanTier = "free"
  113: 
  114: function readEnv(key: string): string | undefined {
  115:   const value = getEnvVar(key)
  116:   if (!value) return undefined
  117:   const trimmed = value.trim()
  118:   return trimmed.length > 0 ? trimmed : undefined
  119: }
  120: 
  121: function resolveMode(mode?: EnvMode): EnvMode {
  122:   if (mode === "prod" || mode === "dev") return mode
  123:   const envMode = readEnv("AI_MODE")
  124:   return envMode === "prod" ? "prod" : envMode === "dev" ? "dev" : DEFAULT_MODE
  125: }
  126: 
  127: function resolveProviderOverride(taskType: TaskType, mode: EnvMode): Provider | undefined {
  128:   const perTask = readEnv(`AI_PROVIDER__${taskType}__${mode}`) ?? readEnv(`AI_PROVIDER__${taskType}`);
  129:   const perMode = readEnv(`AI_PROVIDER__${mode}`);
  130:   const global = readEnv("AI_PROVIDER");
  131: 
  132:   if (taskType === TaskType.EMBED_TEXT) {
  133:     return perTask as Provider | undefined;
  134:   }
  135: 
  136:   return (perTask ?? perMode ?? global) as Provider | undefined;
  137: }
  138: 
  139: function resolveModelOverride(taskType: TaskType, mode: EnvMode, legacyModelEnv?: string): string | undefined {
  140:   return (
  141:     readEnv(`AI_MODEL__${taskType}__${mode}`) ??
  142:     readEnv(`AI_MODEL__${taskType}`) ??
  143:     (legacyModelEnv ? readEnv(legacyModelEnv) : undefined) ??
  144:     (taskType === TaskType.EMBED_TEXT ? undefined : readEnv("AI_TEXT_MODEL_DEFAULT")) ??
  145:     readEnv(`AI_MODEL__${mode}`) ??
  146:     readEnv("AI_MODEL")
  147:   )
  148: }
  149: 
  150: export function getQualityTierForPlan(planTier: PlanTier = DEFAULT_PLAN, mode?: EnvMode): QualityTier {
  151:   const resolvedMode = resolveMode(mode)
  152:   if (resolvedMode === "dev") return "cheap"
  153:   switch (planTier) {
  154:     case "free":
  155:       return "cheap"
  156:     case "starter":
  157:     case "growth":
  158:       return "standard"
  159:     case "pro":
  160:       return "premium"
  161:     default:
  162:       return "standard"
  163:   }
  164: }
  165: 
  166: export function getModelForTask(input: ModelSelectionInput): ModelSelection {
  167:   const policy = DEFAULT_POLICIES[input.taskType]
  168:   if (!policy) throw new Error(`Unknown task type: ${input.taskType}`)
  169: 
  170:   const mode = resolveMode(input.mode)
  171:   const planTier = input.planTier ?? DEFAULT_PLAN
  172:   const qualityTier = getQualityTierForPlan(planTier, mode)
  173:   const baseDefaults = policy[mode]
  174: 
  175:   const qualityOverride = policy.qualityTierOverrides?.[qualityTier]
  176:   const base: BaseModelConfig = {
  177:     provider: qualityOverride?.provider ?? baseDefaults.provider,
  178:     model: qualityOverride?.model ?? baseDefaults.model,
  179:     params: qualityOverride?.params ?? baseDefaults.params,
  180:   }
  181: 
  182:   const providerOverride = resolveProviderOverride(input.taskType, mode)
  183:   const modelOverride = resolveModelOverride(input.taskType, mode, policy.legacyModelEnv)
  184: 
  185:   return {
  186:     provider: providerOverride ?? input.preferredProvider ?? base.provider,
  187:     model: modelOverride ?? base.model,
  188:     params: base.params,
  189:     qualityTier,
  190:   }
  191: }
  192: 
  193: export function resolveModelPolicy({
  194:   taskType,
  195:   environment,
  196: }: {
  197:   taskType: TaskType
  198:   environment?: EnvMode
  199: }): ModelSelection {
  200:   return getModelForTask({ taskType, mode: environment })
  201: }

=== src\ai\modelTypes.ts ===
    1: import { TaskType } from "./taskTypes.ts"
    2: 
    3: export type Provider = "openai" | "anthropic" | "gemini";
    4: export type EnvMode = "dev" | "prod";
    5: export type PlanTier = "free" | "starter" | "growth" | "pro";
    6: export type QualityTier = "cheap" | "standard" | "premium";
    7: 
    8: export type ModelParams = {
    9:   temperature?: number;
   10:   max_tokens?: number;
   11:   top_p?: number;
   12: };
   13: 
   14: export type ModelSelection = {
   15:   provider: Provider;
   16:   model: string;
   17:   params?: ModelParams;
   18:   qualityTier: QualityTier;
   19: };
   20: 
   21: export type ModelSelectionInput = {
   22:   taskType: TaskType;
   23:   mode?: EnvMode;
   24:   planTier?: PlanTier;
   25:   preferredProvider?: Provider;
   26: };

=== src\ai\pricing.ts ===
    1: export const PRICING: Record<string, { inputPerToken: number; outputPerToken: number }> = {
    2:   "gpt-5-nano": { inputPerToken: 0.0000015, outputPerToken: 0.000006 },
    3:   "gpt-5-mini": { inputPerToken: 0.0000025, outputPerToken: 0.00001 },
    4:   "text-embedding-3-small": { inputPerToken: 0.00000002, outputPerToken: 0 },
    5: };

=== src\ai\promptRegistry.ts ===
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

=== src\ai\prompts\adminGeneralChat.ts ===
    1: import type { ChatMessage } from "../providers/types.ts";
    2: import { loadPromptText } from "../promptRegistry.ts";
    3: 
    4: type PromptArgs = {
    5:   contextSnapshot: Record<string, unknown>;
    6:   conversation: string;
    7:   latestUserMessage: string;
    8:   outputMode?: "legacy" | "schema" | "strategic";
    9:   ragContext?: string;
   10:   contextBlob?: Record<string, unknown>;
   11:   playbook?: "core_offer" | "strategy" | "copywriting";
   12: };
   13: 
   14: export function buildAdminGeneralChatPrompt(args: PromptArgs): ChatMessage[] {
   15:   const mode = args.outputMode ?? "legacy";
   16:   const isStrategic = mode === "strategic";
   17:   const systemRegistry = isStrategic ? loadPromptText("admin_chat/system_v1.md") : "";
   18:   const developerRegistry = isStrategic ? loadPromptText("admin_chat/developer_v1.md") : "";
   19:   const contractsRegistry = isStrategic ? loadPromptText("admin_chat/output_contracts_v1.md") : "";
   20:   const PLAYBOOK_FILES: Record<NonNullable<PromptArgs["playbook"]>, string> = {
   21:     core_offer: "admin_chat/playbooks/offer_core_offer_v1.md",
   22:     strategy: "admin_chat/playbooks/strategy_v1.md",
   23:     copywriting: "admin_chat/playbooks/copywriting_v1.md",
   24:   };
   25:   const selectedPlaybook = args.playbook ?? "core_offer";
   26:   const playbookRegistry = isStrategic ? loadPromptText(PLAYBOOK_FILES[selectedPlaybook]) : "";
   27: 
   28:   if (isStrategic) {
   29:     const contextBlob = JSON.stringify(args.contextBlob ?? {}, null, 2);
   30:     const playbook = selectedPlaybook;
   31:     const systemPrompt = [systemRegistry, contractsRegistry, playbookRegistry].filter(Boolean).join("\n\n");
   32:     const developerPrompt = developerRegistry;
   33:     const userPrompt = [
   34:       "context_blob:",
   35:       contextBlob,
   36:       "",
   37:       "playbook:",
   38:       playbook,
   39:       "",
   40:       "latest_user_message:",
   41:       args.latestUserMessage || "(none)",
   42:       "",
   43:       "Return JSON only.",
   44:     ].join("\n");
   45: 
   46:     return [
   47:       { role: "system", content: systemPrompt },
   48:       { role: "developer", content: developerPrompt },
   49:       { role: "user", content: userPrompt },
   50:     ];
   51:   }
   52:   const systemPrompt = mode === "schema"
   53:     ? [
   54:         "You are the agency's AI representative inside SMMAHUB.",
   55:         "Be professional, concise, and practical. Keep responses under 6 lines.",
   56:         "Do not ask multiple questions. If you must ask a question, ask only one.",
   57:         "If asked for agency-specific facts you do not have, respond with UNKNOWN and ask one clarifying question.",
   58:         "",
   59:         "AVAILABLE ACTIONS (use sparingly, only when explicitly requested):",
   60:         "",
   61:         "CLIENT & SETUP:",
   62:         "- create_client: Create client (params: name, website, niche)",
   63:         "- draft_offer: Draft offer (params: service_type, pricing_range)",
   64:         "- update_brain: Update agency brain (params: field, value)",
   65:         "",
   66:         "PROJECTS:",
   67:         "- create_project: New project (params: title, client_id, description, platforms)",
   68:         "- update_project_status: Change status (params: project_id, status)",
   69:         "- assign_project_asset: Link asset (params: project_id, asset_id, is_final_content)",
   70:         "",
   71:         "SCHEDULING & TASKS:",
   72:         "- schedule_task: Create task (params: title, due_date, notes, client_id)",
   73:         "- schedule_post: Schedule to platform (params: project_id, platform, scheduled_for, caption, hashtags)",
   74:         "- update_task_status: Update status (params: task_id, status)",
   75:         "- update_task_priority: Update priority (params: task_id, priority)",
   76:         "",
   77:         "APPROVALS & COMMUNICATION:",
   78:         "- request_approval: Create approval (params: asset_version_id, approver_id, comments)",
   79:         "- send_message: Send message (params: conversation_id, body, related_project_id)",
   80:         "",
   81:         "Return actions array ONLY when user explicitly asks to create/draft/update something.",
   82:         "Do NOT use actions for questions or informational requests.",
   83:         "",
   84:         "Return ONLY strict JSON (no markdown, no prefixes) with this schema:",
   85:         "{",
   86:         '  "assistant_message": "string",',
   87:         '  "suggestions": ["string", "..."],',
   88:         '  "actions": [{"type": "create_client", "payload": {"name": "..."}}],',
   89:         '  "escalated": false,',
   90:         '  "unknown": false',
   91:         "}",
   92:         "suggestions must be 0-6 short strings. actions can be [] or omitted.",
   93:       ].join("\n")
   94:     : [
   95:       "You are the agency's AI representative inside SMMAHUB.",
   96:       "Be professional, concise, and practical. Keep responses under 6 lines.",
   97:       "Do not ask multiple questions. If you must ask a question, ask only one.",
   98:       "If asked for agency-specific facts you do not have, respond with UNKNOWN and ask one clarifying question.",
   99:       "Return plain text with the exact format:",
  100:       "ASSISTANT_MESSAGE:",
  101:       "<your response>",
  102:       "",
  103:       "SUGGESTIONS_JSON:",
  104:       "[{\"id\":\"...\",\"label\":\"...\",\"user_message\":\"...\"}]",
  105:       "Suggestions must be 0-3 items (label <= 28 chars, user_message <= 180 chars).",
  106:     ].join("\n");
  107: 
  108:   const userPrompt = [
  109:     "AGENCY CONTEXT (from embeddings - most relevant):",
  110:     args.ragContext || "(No RAG context available)",
  111:     "",
  112:     "FULL BRAIN (structured):",
  113:     JSON.stringify(args.contextSnapshot ?? {}),
  114:     "",
  115:     "Conversation so far:",
  116:     args.conversation || "(none)",
  117:     "",
  118:     "Latest user message:",
  119:     args.latestUserMessage || "(none)",
  120:     "",
  121:     "Return using the exact format defined above.",
  122:   ].join("\n");
  123: 
  124:   return [
  125:     { role: "system", content: systemPrompt },
  126:     { role: "user", content: userPrompt },
  127:   ];
  128: }

=== src\ai\prompts\adminSetupExtract.ts ===
    1: import type { ChatMessage } from "../providers/types.ts";
    2: 
    3: type PromptArgs = {
    4:   questionKey: string;
    5:   questionText: string;
    6:   targetPath: string;
    7:   answer: string;
    8:   contextSnapshot: Record<string, unknown>;
    9: };
   10: 
   11: export function buildAdminSetupExtractPrompt(args: PromptArgs): ChatMessage[] {
   12:   const systemPrompt = [
   13:     "You extract a structured value from an admin answer.",
   14:     "Return STRICT JSON only (no markdown).",
   15:     "Output schema: { value }",
   16:     "If the answer is unclear or empty, return {\"value\": null}.",
   17:     "For FAQ collection, return value as an array of {q, a}.",
   18:   ].join("\n");
   19: 
   20:   const userPrompt = [
   21:     "Context snapshot:",
   22:     JSON.stringify(args.contextSnapshot ?? {}),
   23:     "",
   24:     `Question key: ${args.questionKey}`,
   25:     `Question: ${args.questionText}`,
   26:     `Target path: ${args.targetPath}`,
   27:     "",
   28:     `Admin answer: ${args.answer}`,
   29:     "",
   30:     "Return JSON with:",
   31:     "- value: string | string[] | {q,a}[] | null",
   32:   ].join("\n");
   33: 
   34:   return [
   35:     { role: "system", content: systemPrompt },
   36:     { role: "user", content: userPrompt },
   37:   ];
   38: }

=== src\ai\prompts\adminSetupGuided.ts ===
    1: import type { ChatMessage } from "../providers/types.ts";
    2: 
    3: type PromptArgs = {
    4:   agencyBrain: Record<string, unknown>;
    5:   conversation: string;
    6:   latestUserMessage: string;
    7:   contextSnapshot?: Record<string, unknown>;
    8: };
    9: 
   10: export function buildAdminSetupGuidedPrompt(args: PromptArgs): ChatMessage[] {
   11:   const agencyName = (args.contextSnapshot?.agency as Record<string, unknown>)?.name ?? null;
   12:   const agencyWebsite = (args.contextSnapshot?.agency as Record<string, unknown>)?.website ?? null;
   13:   const agencyNameRule = agencyName
   14:     ? `Agency name is already known ("${agencyName}"). Do NOT ask for the agency name.`
   15:     : "Agency name is missing. You MAY ask for the agency name if needed.";
   16:   const agencyWebsiteRule = agencyWebsite
   17:     ? `Agency website is already known ("${agencyWebsite}"). Do NOT ask for the agency website.`
   18:     : "Agency website is missing. You MAY ask for the agency website if needed.";
   19: 
   20:   const systemPrompt = [
   21:     "You are the agency's AI representative. You work for the agency to make work easier.",
   22:     "If this is the first assistant message, introduce yourself with confidence (who you are inside SMMAHUB), state your mission (make work easier/smarter, help scale, act as the agency representative), and explain you ask one question at a time. Then ask: Are you ready to start? Reply READY.",
   23:     "",
   24:     "BOOTSTRAP DATA AWARENESS:",
   25:     `- ${agencyNameRule}`,
   26:     `- ${agencyWebsiteRule}`,
   27:     "- If bootstrap data exists, acknowledge it and skip directly to deeper questions",
   28:     "",
   29:     "This is a guided onboarding conversation for agency admins. Ask exactly ONE question per turn.",
   30:     "Start by asking if the admin is ready. They must reply READY or a clear yes. Until then, keep asking a short readiness question.",
   31:     "After readiness, run an awareness mission to understand the agency using progressive depth levels.",
   32:     "You suggest the next question based on depth and missing fields; the system may still follow a deterministic order until orchestration is enabled.",
   33:     "",
   34:     "QUESTION TYPES BY DEPTH LEVEL:",
   35:     "Level 1 (Foundation): primary_services, niche_industries, target_client_profile",
   36:     "Level 2 (Differentiation): core_offer_outcome, unique_differentiators, competitor_comparison",
   37:     "Level 3 (Operations): deliverables_standard, workflow_stages, approvals_sla, pricing_structure",
   38:     "Level 4 (Voice & Safety): voice_adjectives, dos_donts, boundaries, escalation_rules",
   39:     "Level 5 (Expert): faq_seed_top10, guarantees_sla, acquisition_strategy",
   40:     "",
   41:     "EXPERT QUESTIONS (ask these when foundational questions are answered):",
   42:     "- 'What makes your agency different from 10,000 other SMM agencies?'",
   43:     "- 'What is your pricing structure or typical package range?'",
   44:     "- 'What is your primary client acquisition strategy?'",
   45:     "- 'What guarantees or SLAs do you offer clients?'",
   46:     "- 'Walk me through your content approval process - how do clients review and approve?'",
   47:     "- 'What are your most common client objections and how do you handle them?'",
   48:     "",
   49:     "The admin may ask unrelated questions mid-onboarding. Answer briefly, then continue onboarding with ONE question.",
   50:     "UNKNOWN is only for missing agency-specific facts (pricing/guarantees/SOP/client data/internal policies). Do NOT use UNKNOWN for clarification or off-topic questions.",
   51:     "Classify each user message intent as one of: READY_CONFIRMATION, ANSWER_TO_ONBOARDING_QUESTION, CLARIFICATION_REQUEST, OFFTOPIC_QUESTION, STOP_OR_PAUSE.",
   52:     "CLARIFICATION_REQUEST: answer clearly with examples, then re-ask the pending question.",
   53:     "OFFTOPIC_QUESTION: answer briefly, then return to onboarding with one question.",
   54:     "STOP_OR_PAUSE: set setup_progress_v1.status='paused' and offer to resume.",
   55:     "Suggestions should be realistic quick answers to the pending question (or mirror choices). Return 2-3 suggestions whenever the admin can reply.",
   56:     "Return STRICT JSON only (no markdown).",
   57:     "Output schema:",
   58:     "{ assistant_message, expects, choices, suggestions, progress_percent, done, memory_patch, state }",
   59:   ].join("\n");
   60: 
   61:   const userPrompt = [
   62:     "Current agency brain (partial):",
   63:     JSON.stringify(args.agencyBrain || {}),
   64:     "",
   65:     "Context snapshot:",
   66:     JSON.stringify(args.contextSnapshot || {}),
   67:     "",
   68:     "Conversation so far:",
   69:     args.conversation || "(none)",
   70:     "",
   71:     "Latest user message:",
   72:     args.latestUserMessage || "(none)",
   73:     "",
   74:     "Return JSON with:",
   75:     "- assistant_message: string (include UNKNOWN only when missing agency-specific facts; ask 1 clarifying question)",
   76:     "- expects: \"text\"|\"choice\"|\"faq_pair\"",
   77:     "- choices: array of {id,label} (use when expects=\"choice\")",
   78:     "- suggestions: 0-3 items {id,label,user_message} (label <= 28 chars, user_message <= 180 chars)",
   79:     "- progress_percent: 0-100",
   80:     "- done: boolean",
   81:     "- memory_patch: { rep_policy_v1?, faq_v1?, setup_progress_v1? } (only safe updates)",
   82:     "- state: { intent, pending_question_key, pending_question_text }",
   83:   ].join("\n");
   84: 
   85:   return [
   86:     { role: "system", content: systemPrompt },
   87:     { role: "user", content: userPrompt },
   88:   ];
   89: }

=== src\ai\prompts\chatGeneral.ts ===
    1: import type { ChatMessage } from "../providers/types.ts";
    2: 
    3: type PromptArgs = {
    4:   input: string;
    5: };
    6: 
    7: export function buildChatGeneralPrompt(args: PromptArgs): ChatMessage[] {
    8:   return [
    9:     { role: "system", content: "You are an AI assistant helping an agency team." },
   10:     { role: "user", content: args.input },
   11:   ];
   12: }

=== src\ai\prompts\classifyIntent.ts ===
    1: import type { ChatMessage } from "../providers/types.ts";
    2: 
    3: type PromptArgs = {
    4:   input: string;
    5: };
    6: 
    7: export function buildClassifyIntentPrompt(args: PromptArgs): ChatMessage[] {
    8:   return [
    9:     { role: "system", content: "Classify the user's intent into a short label. Return JSON: {\"intent\":\"\"}." },
   10:     { role: "user", content: args.input },
   11:   ];
   12: }

=== src\ai\prompts\clientPortalQa.ts ===
    1: import type { ChatMessage } from "../providers/types.ts";
    2: 
    3: type PromptArgs = {
    4:   question: string;
    5:   context: string;
    6: };
    7: 
    8: export function buildClientPortalQaPrompt(args: PromptArgs): ChatMessage[] {
    9:   const systemPrompt =
   10:     "You are an AI assistant. Answer strictly using the provided context. If context is insufficient, respond with UNKNOWN.";
   11:   const userPrompt = `Question: ${args.question}\n\nContext:\n${args.context}\n\nReturn JSON: {"answer":"", "unknown": false, "questions": [], "confidence": 0-100}`;
   12: 
   13:   return [
   14:     { role: "system", content: systemPrompt },
   15:     { role: "user", content: userPrompt },
   16:   ];
   17: }

=== src\ai\prompts\contentIdeas.ts ===
    1: import type { ChatMessage } from "../providers/types.ts";
    2: 
    3: type PromptArgs = {
    4:   mode: "ideas" | "hook" | "caption" | "script" | "rewrite";
    5:   platform?: string;
    6:   brandContext?: string;
    7:   inputText?: string;
    8: };
    9: 
   10: export function buildContentIdeasPrompt(args: PromptArgs): ChatMessage[] {
   11:   const platform = args.platform || "social media";
   12:   const brandInfo = args.brandContext || "";
   13: 
   14:   switch (args.mode) {
   15:     case "ideas":
   16:       return [
   17:         { role: "system", content: "You are a creative content strategist. Generate innovative, actionable content ideas." },
   18:         {
   19:           role: "user",
   20:           content: `Generate 5 content ideas for ${platform}. ${brandInfo}\n\nReturn as JSON array: [{"title": "...", "description": "..."}]`,
   21:         },
   22:       ];
   23:     case "hook":
   24:       return [
   25:         { role: "system", content: "You are an expert copywriter. Generate attention-grabbing hooks for social media content." },
   26:         {
   27:           role: "user",
   28:           content: `Generate 5 powerful hooks for ${platform} content. ${brandInfo}\n\nReturn as JSON array: [{"text": "..."}]`,
   29:         },
   30:       ];
   31:     case "caption":
   32:       return [
   33:         { role: "system", content: "You are an expert social media content creator. Generate engaging captions optimized for the platform." },
   34:         {
   35:           role: "user",
   36:           content: `Generate 3 captions for ${platform}. ${brandInfo}\n\nReturn as JSON array: [{"text": "..."}]`,
   37:         },
   38:       ];
   39:     case "script":
   40:       return [
   41:         { role: "system", content: "You are a video script writer. Generate engaging video scripts with clear structure." },
   42:         {
   43:           role: "user",
   44:           content: `Generate 3 video script variations for ${platform}. ${brandInfo}\n\nEach script should have:\n- Hook (first 3 seconds)\n- Body (main content)\n- CTA (call to action)\n\nReturn as JSON array: [{"text": "..."}]`,
   45:         },
   46:       ];
   47:     case "rewrite":
   48:       return [
   49:         { role: "system", content: "You are an expert editor. Improve the given text while maintaining its core message." },
   50:         {
   51:           role: "user",
   52:           content: `Improve this text for ${platform}: "${args.inputText ?? ""}"\n\n${brandInfo}\n\nReturn as JSON array with 3 variations: [{"text": "..."}]`,
   53:         },
   54:       ];
   55:     default:
   56:       return [
   57:         { role: "system", content: "You are a content strategist." },
   58:         { role: "user", content: "Provide content ideas." },
   59:       ];
   60:   }
   61: }

=== src\ai\prompts\extractStructured.ts ===
    1: import type { ChatMessage } from "../providers/types.ts";
    2: 
    3: type PromptArgs = {
    4:   input: string;
    5:   instructions?: string;
    6: };
    7: 
    8: export function buildExtractStructuredPrompt(args: PromptArgs): ChatMessage[] {
    9:   const instructions = args.instructions ? `\n\n${args.instructions}` : "";
   10:   return [
   11:     { role: "system", content: "Return only valid JSON. Do not include markdown." },
   12:     { role: "user", content: `${args.input}${instructions}` },
   13:   ];
   14: }

=== src\ai\prompts\onboardingGuide.ts ===
    1: import type { ChatMessage } from "../providers/types.ts";
    2: 
    3: type OfferArgs = {
    4:   website: string;
    5:   niche: string;
    6: };
    7: 
    8: type AudienceArgs = {
    9:   niche: string;
   10:   offers: string[];
   11: };
   12: 
   13: type DifferentiatorArgs = {
   14:   brand: string;
   15:   niche: string;
   16: };
   17: 
   18: export function buildOnboardingOffersPrompt(args: OfferArgs): ChatMessage[] {
   19:   return [
   20:     {
   21:       role: "system",
   22:       content:
   23:         "You are a marketing strategist. Generate 8 concise offer descriptions (max 6 words each) based on website/niche. Return ONLY valid JSON array: [{\"id\":\"offer1\",\"label\":\"...\"},...]. No markdown, no explanation.",
   24:     },
   25:     {
   26:       role: "user",
   27:       content: `Website: ${args.website}\nNiche: ${args.niche}\n\nGenerate 8 typical offers/services for this business.`,
   28:     },
   29:   ];
   30: }
   31: 
   32: export function buildOnboardingAudiencePrompt(args: AudienceArgs): ChatMessage[] {
   33:   return [
   34:     {
   35:       role: "system",
   36:       content:
   37:         "You are a marketing strategist. Generate 5 target audience personas (max 8 words each) based on niche/offers. Return ONLY valid JSON array: [{\"id\":\"persona1\",\"label\":\"...\"},...]. No markdown.",
   38:     },
   39:     {
   40:       role: "user",
   41:       content: `Niche: ${args.niche}\nOffers: ${args.offers.join(", ")}\n\nGenerate 5 target audience personas.`,
   42:     },
   43:   ];
   44: }
   45: 
   46: export function buildOnboardingDifferentiatorsPrompt(args: DifferentiatorArgs): ChatMessage[] {
   47:   return [
   48:     {
   49:       role: "system",
   50:       content:
   51:         "You are a marketing strategist. Generate 6 potential brand differentiators (max 10 words each) based on brand/niche. Return ONLY valid JSON array: [{\"id\":\"diff1\",\"label\":\"...\"},...]. No markdown.",
   52:     },
   53:     {
   54:       role: "user",
   55:       content: `Brand: ${args.brand}\nNiche: ${args.niche}\n\nGenerate 6 potential differentiators.`,
   56:     },
   57:   ];
   58: }

=== src\ai\prompts\strategyPlan.ts ===
    1: import type { ChatMessage } from "../providers/types.ts";
    2: 
    3: type PromptArgs = {
    4:   agencyBrain: Record<string, unknown>;
    5:   clientBrain: Record<string, unknown>;
    6:   context: string;
    7:   instruction?: string;
    8: };
    9: 
   10: export function buildStrategyPlanPrompt(args: PromptArgs): ChatMessage[] {
   11:   const systemPrompt =
   12:     "You are a strategy assistant. Use only the provided brains and context. If missing, respond UNKNOWN.";
   13:   const instruction = args.instruction?.trim()
   14:     ? `\n\nInstruction:\n${args.instruction.trim()}`
   15:     : "";
   16:   const userPrompt = `Agency Brain:\n${JSON.stringify(args.agencyBrain)}\n\nClient Brain:\n${JSON.stringify(
   17:     args.clientBrain,
   18:   )}\n\nContext:\n${args.context}${instruction}\n\nReturn STRICT JSON only with this shape:\n{\n  "modules": {\n    "positioning": { ...module schema... },\n    "pillars": { ...module schema... },\n    "campaign_plan": { ...module schema... },\n    "weekly_plan": { ...module schema... },\n    "channel_adaptations": { ...module schema... },\n    "rules_constraints": { ...module schema... }\n  },\n  "document": {\n    "markdown": "Full strategy document in markdown."\n  },\n  "decisions": [ { "module": "...", "decision_key": "...", "value": {}, "locked": false } ],\n  "tasks": [ { "module": "...", "title": "...", "description": "...", "priority": "medium" } ]\n}\n\nEach module MUST include fields:\n- facts_used: string[]\n- assumptions: string[]\n- open_questions: string[] (max 5)\n- confidence_0_100: number (0-100)\n\nEnsure decisions/tasks arrays are optional and may be omitted if none.`;
   19: 
   20:   return [
   21:     { role: "system", content: systemPrompt },
   22:     { role: "user", content: userPrompt },
   23:   ];
   24: }

=== src\ai\prompts\summarize.ts ===
    1: import type { ChatMessage } from "../providers/types.ts";
    2: 
    3: type PromptArgs = {
    4:   input: string;
    5:   systemPrompt?: string;
    6: };
    7: 
    8: export function buildSummarizePrompt(args: PromptArgs): ChatMessage[] {
    9:   return [
   10:     { role: "system", content: args.systemPrompt ?? "You are a concise summarizer. Keep the same tone and be accurate." },
   11:     { role: "user", content: args.input },
   12:   ];
   13: }

=== src\ai\prompts\toolExecution.ts ===
    1: import type { ChatMessage } from "../providers/types.ts";
    2: 
    3: type PromptArgs = {
    4:   input: string;
    5: };
    6: 
    7: export function buildToolExecutionPrompt(args: PromptArgs): ChatMessage[] {
    8:   return [
    9:     { role: "system", content: "You execute tasks by returning a plan in JSON." },
   10:     { role: "user", content: args.input },
   11:   ];
   12: }

=== src\ai\providers\__tests__\utils.test.ts ===
    1: import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
    2: import { fetchWithRetry, fetchWithTimeout } from "../utils.ts";
    3: 
    4: describe("fetchWithTimeout", () => {
    5:   beforeEach(() => {
    6:     vi.useFakeTimers();
    7:   });
    8: 
    9:   afterEach(() => {
   10:     vi.useRealTimers();
   11:     vi.restoreAllMocks();
   12:   });
   13: 
   14:   it("aborts after timeout", async () => {
   15:     const fetchMock = vi.fn((_input: RequestInfo, init?: RequestInit) =>
   16:       new Promise((_resolve, reject) => {
   17:         const signal = init?.signal;
   18:         if (signal?.aborted) {
   19:           reject(new DOMException("Aborted", "AbortError"));
   20:           return;
   21:         }
   22:         signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
   23:       })
   24:     );
   25: 
   26:     const originalFetch = globalThis.fetch;
   27:     (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock;
   28: 
   29:     const promise = fetchWithTimeout("https://example.com", {}, 50);
   30:     const expectation = expect(promise).rejects.toMatchObject({ name: "AbortError" });
   31:     await vi.advanceTimersByTimeAsync(60);
   32:     await expectation;
   33: 
   34:     (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = originalFetch;
   35:   });
   36: });
   37: 
   38: describe("fetchWithRetry", () => {
   39:   beforeEach(() => {
   40:     vi.useFakeTimers();
   41:   });
   42: 
   43:   afterEach(() => {
   44:     vi.useRealTimers();
   45:     vi.restoreAllMocks();
   46:   });
   47: 
   48:   it("retries up to 3 attempts", async () => {
   49:     const responses = [
   50:       new Response("retry", { status: 503 }),
   51:       new Response("retry", { status: 503 }),
   52:       new Response("ok", { status: 200 }),
   53:     ];
   54:     const fetchMock = vi.fn(() => Promise.resolve(responses.shift() as Response));
   55: 
   56:     const originalFetch = globalThis.fetch;
   57:     (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock;
   58: 
   59:     const promise = fetchWithRetry("https://example.com", {}, {
   60:       retries: 3,
   61:       backoffMs: [1000, 2000, 4000],
   62:       jitterMs: (base) => base,
   63:     });
   64: 
   65:     await vi.advanceTimersByTimeAsync(3000);
   66:     const response = await promise;
   67:     expect(response.status).toBe(200);
   68:     expect(fetchMock).toHaveBeenCalledTimes(3);
   69: 
   70:     (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = originalFetch;
   71:   });
   72: 
   73:   it("uses backoff 1s/2s/4s with jitter", async () => {
   74:     const fetchMock = vi.fn(() => Promise.resolve(new Response("retry", { status: 503 })));
   75:     const originalFetch = globalThis.fetch;
   76:     (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock;
   77: 
   78:     const sleepFn = vi.fn().mockResolvedValue(undefined);
   79: 
   80:     await fetchWithRetry("https://example.com", {}, {
   81:       retries: 3,
   82:       backoffMs: [1000, 2000, 4000],
   83:       jitterMs: (base) => base + 200,
   84:       sleepFn,
   85:     }).catch(() => undefined);
   86: 
   87:     expect(sleepFn).toHaveBeenCalledWith(1200);
   88:     expect(sleepFn).toHaveBeenCalledWith(2200);
   89: 
   90:     (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = originalFetch;
   91:   });
   92: 
   93:   it("retries only on timeout/429/503", async () => {
   94:     const fetchMock = vi.fn(() => Promise.resolve(new Response("bad", { status: 500 })));
   95:     const originalFetch = globalThis.fetch;
   96:     (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock;
   97: 
   98:     const response = await fetchWithRetry("https://example.com", {}, {
   99:       retries: 3,
  100:       backoffMs: [1000, 2000, 4000],
  101:       jitterMs: (base) => base,
  102:     });
  103: 
  104:     expect(response.status).toBe(500);
  105:     expect(fetchMock).toHaveBeenCalledTimes(1);
  106: 
  107:     (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = originalFetch;
  108:   });
  109: });

=== src\ai\providers\anthropic.ts ===
    1: import { getEnvVar } from "../utils.ts"
    2: import type { GenerateParams, GenerateResult } from "./types.ts"
    3: import { CircuitBreaker, fetchWithRetry, fetchWithTimeout } from "./utils.ts"
    4: 
    5: const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
    6: const DEFAULT_TIMEOUT_MS = 30_000;
    7: const RETRY_BACKOFF_MS = [1_000, 2_000, 4_000];
    8: const circuitBreaker = new CircuitBreaker();
    9: 
   10: function getApiKey() {
   11:   return getEnvVar("ANTHROPIC_API_KEY");
   12: }
   13: 
   14: function readFlag(name: string, defaultValue = false) {
   15:   const value = getEnvVar(name);
   16:   if (value === undefined) return defaultValue;
   17:   return value.toLowerCase() === "true";
   18: }
   19: 
   20: function timeoutsEnabled() {
   21:   return readFlag("AI_PROVIDER_TIMEOUTS", false);
   22: }
   23: 
   24: function retriesEnabled() {
   25:   const retriesFlag = getEnvVar("AI_PROVIDER_RETRIES");
   26:   if (retriesFlag === undefined) return timeoutsEnabled();
   27:   return retriesFlag.toLowerCase() === "true";
   28: }
   29: 
   30: function circuitBreakerEnabled() {
   31:   return readFlag("AI_CIRCUIT_BREAKER", false);
   32: }
   33: 
   34: async function fetchWithPolicy(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
   35:   if (!timeoutsEnabled()) {
   36:     return fetch(url, init);
   37:   }
   38: 
   39:   if (circuitBreakerEnabled() && !circuitBreaker.canRequest()) {
   40:     const error = new Error("AI provider circuit breaker open") as Error & { code?: string };
   41:     error.code = "CIRCUIT_OPEN";
   42:     throw error;
   43:   }
   44: 
   45:   try {
   46:     const response = retriesEnabled()
   47:       ? await fetchWithRetry(url, init, {
   48:           retries: 3,
   49:           backoffMs: RETRY_BACKOFF_MS,
   50:           timeoutMs,
   51:         })
   52:       : await fetchWithTimeout(url, init, timeoutMs);
   53: 
   54:     if (circuitBreakerEnabled()) {
   55:       if (response.ok) {
   56:         circuitBreaker.recordSuccess();
   57:       } else {
   58:         circuitBreaker.recordFailure();
   59:       }
   60:     }
   61: 
   62:     return response;
   63:   } catch (error) {
   64:     if (circuitBreakerEnabled()) {
   65:       circuitBreaker.recordFailure();
   66:     }
   67:     throw error;
   68:   }
   69: }
   70: 
   71: function toAnthropicMessages(messages: GenerateParams["messages"]) {
   72:   return messages
   73:     .filter((m) => m.role !== "system")
   74:     .map((m) => ({ role: m.role, content: m.content }));
   75: }
   76: 
   77: function extractSystemPrompt(messages: GenerateParams["messages"]) {
   78:   const system = messages.find((m) => m.role === "system");
   79:   return system?.content ?? undefined;
   80: }
   81: 
   82: export async function generate(params: GenerateParams): Promise<GenerateResult> {
   83:   const apiKey = getApiKey();
   84:   if (!apiKey) {
   85:     throw new Error("ANTHROPIC_API_KEY is not configured");
   86:   }
   87: 
   88:   const response = await fetchWithPolicy(`${ANTHROPIC_BASE_URL}/messages`, {
   89:     method: "POST",
   90:     headers: {
   91:       "x-api-key": apiKey,
   92:       "anthropic-version": "2023-06-01",
   93:       "content-type": "application/json",
   94:     },
   95:     body: JSON.stringify({
   96:       model: params.model,
   97:       system: extractSystemPrompt(params.messages),
   98:       messages: toAnthropicMessages(params.messages),
   99:       temperature: params.temperature,
  100:       max_tokens: params.max_tokens ?? 512,
  101:       top_p: params.top_p,
  102:     }),
  103:   }, params.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  104: 
  105:   const json = await response.json().catch(() => ({}));
  106:   if (!response.ok) {
  107:     throw new Error(`Anthropic error: ${json?.error?.message ?? response.statusText}`);
  108:   }
  109: 
  110:   const content = Array.isArray(json?.content) ? json.content.map((c: any) => c.text).join("") : "";
  111: 
  112:   return {
  113:     text: content,
  114:     usage: {
  115:       inputTokens: json?.usage?.input_tokens ?? undefined,
  116:       outputTokens: json?.usage?.output_tokens ?? undefined,
  117:     },
  118:     raw: json,
  119:   };
  120: }

=== src\ai\providers\gemini.ts ===
    1: import { getEnvVar } from "../utils.ts";
    2: import type { GenerateParams, GenerateResult } from "./types.ts";
    3: import { CircuitBreaker, fetchWithRetry, fetchWithTimeout } from "./utils.ts";
    4: 
    5: const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
    6: const DEFAULT_TIMEOUT_MS = 30_000;
    7: const RETRY_BACKOFF_MS = [1_000, 2_000, 4_000];
    8: const circuitBreaker = new CircuitBreaker();
    9: 
   10: function getApiKey() {
   11:   return getEnvVar("GEMINI_API_KEY");
   12: }
   13: 
   14: function readFlag(name: string, defaultValue = false) {
   15:   const value = getEnvVar(name);
   16:   if (value === undefined) return defaultValue;
   17:   return value.toLowerCase() === "true";
   18: }
   19: 
   20: function timeoutsEnabled() {
   21:   return readFlag("AI_PROVIDER_TIMEOUTS", false);
   22: }
   23: 
   24: function retriesEnabled() {
   25:   const retriesFlag = getEnvVar("AI_PROVIDER_RETRIES");
   26:   if (retriesFlag === undefined) return timeoutsEnabled();
   27:   return retriesFlag.toLowerCase() === "true";
   28: }
   29: 
   30: function circuitBreakerEnabled() {
   31:   return readFlag("AI_CIRCUIT_BREAKER", false);
   32: }
   33: 
   34: async function fetchWithPolicy(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
   35:   if (!timeoutsEnabled()) {
   36:     return fetch(url, init);
   37:   }
   38: 
   39:   if (circuitBreakerEnabled() && !circuitBreaker.canRequest()) {
   40:     const error = new Error("AI provider circuit breaker open") as Error & { code?: string };
   41:     error.code = "CIRCUIT_OPEN";
   42:     throw error;
   43:   }
   44: 
   45:   try {
   46:     const response = retriesEnabled()
   47:       ? await fetchWithRetry(url, init, {
   48:           retries: 3,
   49:           backoffMs: RETRY_BACKOFF_MS,
   50:           timeoutMs,
   51:         })
   52:       : await fetchWithTimeout(url, init, timeoutMs);
   53: 
   54:     if (circuitBreakerEnabled()) {
   55:       if (response.ok) {
   56:         circuitBreaker.recordSuccess();
   57:       } else {
   58:         circuitBreaker.recordFailure();
   59:       }
   60:     }
   61: 
   62:     return response;
   63:   } catch (error) {
   64:     if (circuitBreakerEnabled()) {
   65:       circuitBreaker.recordFailure();
   66:     }
   67:     throw error;
   68:   }
   69: }
   70: 
   71: function normalizeModelName(model: string) {
   72:   return model.startsWith("models/") ? model : `models/${model}`;
   73: }
   74: 
   75: function extractSystemPrompt(messages: GenerateParams["messages"]) {
   76:   const systemMessages = messages.filter((m) => m.role === "system").map((m) => m.content.trim()).filter(Boolean);
   77:   if (systemMessages.length === 0) return undefined;
   78:   return systemMessages.join("\n\n");
   79: }
   80: 
   81: function toGeminiContents(messages: GenerateParams["messages"]) {
   82:   return messages
   83:     .filter((m) => m.role !== "system")
   84:     .map((m) => ({
   85:       role: m.role === "assistant" ? "model" : "user",
   86:       parts: [{ text: m.content }],
   87:     }));
   88: }
   89: 
   90: function extractText(json: any) {
   91:   const parts = json?.candidates?.[0]?.content?.parts;
   92:   if (!Array.isArray(parts)) return "";
   93:   return parts.map((part: any) => (typeof part?.text === "string" ? part.text : "")).join("");
   94: }
   95: 
   96: function extractUsage(json: any): GenerateResult["usage"] {
   97:   const promptTokens = json?.usageMetadata?.promptTokenCount;
   98:   const outputTokens = json?.usageMetadata?.candidatesTokenCount;
   99:   if (typeof promptTokens !== "number" && typeof outputTokens !== "number") return undefined;
  100:   return {
  101:     inputTokens: typeof promptTokens === "number" ? promptTokens : undefined,
  102:     outputTokens: typeof outputTokens === "number" ? outputTokens : undefined,
  103:   };
  104: }
  105: 
  106: async function callGemini(params: GenerateParams, opts: { responseMimeType?: string }) {
  107:   const apiKey = getApiKey();
  108:   if (!apiKey) {
  109:     throw new Error("GEMINI_API_KEY is not configured");
  110:   }
  111: 
  112:   const systemPrompt = extractSystemPrompt(params.messages);
  113:   const contents = toGeminiContents(params.messages);
  114:   const generationConfig: Record<string, unknown> = {};
  115:   if (typeof params.temperature === "number") generationConfig.temperature = params.temperature;
  116:   if (typeof params.top_p === "number") generationConfig.topP = params.top_p;
  117:   if (typeof params.max_tokens === "number") generationConfig.maxOutputTokens = params.max_tokens;
  118:   if (opts.responseMimeType) generationConfig.response_mime_type = opts.responseMimeType;
  119: 
  120:   const body: Record<string, unknown> = {
  121:     contents,
  122:     generationConfig,
  123:   };
  124:   if (systemPrompt) {
  125:     body.systemInstruction = { role: "system", parts: [{ text: systemPrompt }] };
  126:   }
  127: 
  128:   const response = await fetchWithPolicy(
  129:     `${GEMINI_BASE_URL}/${normalizeModelName(params.model)}:generateContent?key=${apiKey}`,
  130:     {
  131:       method: "POST",
  132:       headers: { "Content-Type": "application/json" },
  133:       body: JSON.stringify(body),
  134:     },
  135:     params.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  136:   );
  137: 
  138:   const json = await response.json().catch(() => ({}));
  139:   if (!response.ok) {
  140:     const message = json?.error?.message ?? response.statusText;
  141:     throw new Error(`Gemini error: ${message}`);
  142:   }
  143: 
  144:   return json;
  145: }
  146: 
  147: export async function generateText(params: GenerateParams): Promise<GenerateResult> {
  148:   const json = await callGemini(params, {});
  149:   return {
  150:     text: extractText(json),
  151:     model: json?.model ?? params.model,
  152:     usage: extractUsage(json),
  153:     raw: json,
  154:   };
  155: }
  156: 
  157: export async function generateJson(params: GenerateParams): Promise<GenerateResult> {
  158:   const json = await callGemini(params, { responseMimeType: "application/json" });
  159:   const text = extractText(json);
  160:   try {
  161:     JSON.parse(text);
  162:   } catch (error) {
  163:     const err = new Error("Gemini JSON parse error") as Error & { code?: string };
  164:     err.code = "INVALID_JSON";
  165:     throw err;
  166:   }
  167:   return {
  168:     text,
  169:     model: json?.model ?? params.model,
  170:     usage: extractUsage(json),
  171:     raw: json,
  172:   };
  173: }
  174: 
  175: export async function generate(params: GenerateParams): Promise<GenerateResult> {
  176:   return generateText(params);
  177: }

=== src\ai\providers\index.ts ===
    1: import * as openai from "./openai.ts"
    2: import * as anthropic from "./anthropic.ts"
    3: import * as gemini from "./gemini.ts"
    4: 
    5: export const providers = {
    6:   openai,
    7:   anthropic,
    8:   gemini,
    9: };

=== src\ai\providers\openai.ts ===
    1: import { getEnvVar } from "../utils.ts"
    2: import type { EmbedParams, EmbedResult, GenerateParams, GenerateResult, GenerateStreamResult } from "./types.ts"
    3: import { CircuitBreaker, fetchWithRetry, fetchWithTimeout } from "./utils.ts"
    4: 
    5: const OPENAI_BASE_URL = "https://api.openai.com/v1";
    6: const DEFAULT_TIMEOUT_MS = 30_000;
    7: const EMBED_TIMEOUT_MS = 10_000;
    8: const RETRY_BACKOFF_MS = [1_000, 2_000, 4_000];
    9: const circuitBreaker = new CircuitBreaker();
   10: 
   11: function getApiKey() {
   12:   return getEnvVar("OPENAI_API_KEY");
   13: }
   14: 
   15: function readFlag(name: string, defaultValue = false) {
   16:   const value = getEnvVar(name);
   17:   if (value === undefined) return defaultValue;
   18:   return value.toLowerCase() === "true";
   19: }
   20: 
   21: function timeoutsEnabled() {
   22:   return readFlag("AI_PROVIDER_TIMEOUTS", false);
   23: }
   24: 
   25: function retriesEnabled() {
   26:   const retriesFlag = getEnvVar("AI_PROVIDER_RETRIES");
   27:   if (retriesFlag === undefined) return timeoutsEnabled();
   28:   return retriesFlag.toLowerCase() === "true";
   29: }
   30: 
   31: function circuitBreakerEnabled() {
   32:   return readFlag("AI_CIRCUIT_BREAKER", false);
   33: }
   34: 
   35: async function fetchWithPolicy(
   36:   url: string,
   37:   init: RequestInit,
   38:   options: { timeoutMs: number; stream?: boolean },
   39: ): Promise<Response> {
   40:   if (!timeoutsEnabled()) {
   41:     return fetch(url, init);
   42:   }
   43: 
   44:   if (circuitBreakerEnabled() && !circuitBreaker.canRequest()) {
   45:     const error = new Error("AI provider circuit breaker open") as Error & { code?: string };
   46:     error.code = "CIRCUIT_OPEN";
   47:     throw error;
   48:   }
   49: 
   50:   try {
   51:     const response = options.stream || !retriesEnabled()
   52:       ? await fetchWithTimeout(url, init, options.timeoutMs)
   53:       : await fetchWithRetry(url, init, {
   54:           retries: 3,
   55:           backoffMs: RETRY_BACKOFF_MS,
   56:           timeoutMs: options.timeoutMs,
   57:         });
   58: 
   59:     if (circuitBreakerEnabled()) {
   60:       if (response.ok) {
   61:         circuitBreaker.recordSuccess();
   62:       } else {
   63:         circuitBreaker.recordFailure();
   64:       }
   65:     }
   66: 
   67:     return response;
   68:   } catch (error) {
   69:     if (circuitBreakerEnabled()) {
   70:       circuitBreaker.recordFailure();
   71:     }
   72:     throw error;
   73:   }
   74: }
   75: 
   76: function extractTextFromChatCompletions(json: any): { text: string; model?: string } {
   77:   return { text: json?.choices?.[0]?.message?.content ?? "", model: json?.model };
   78: }
   79: 
   80: function extractUsageFromChatCompletions(json: any): { inputTokens?: number; outputTokens?: number } | undefined {
   81:   const inputTokens = json?.usage?.prompt_tokens;
   82:   const outputTokens = json?.usage?.completion_tokens;
   83:   if (typeof inputTokens !== "number" && typeof outputTokens !== "number") return undefined;
   84:   return { inputTokens, outputTokens };
   85: }
   86: 
   87: function extractTextFromResponses(json: any): string {
   88:   if (typeof json?.output_text === "string") return json.output_text;
   89: 
   90:   const output = json?.output;
   91:   if (Array.isArray(output)) {
   92:     for (const item of output) {
   93:       const content = item?.content;
   94:       if (!Array.isArray(content)) continue;
   95:       for (const part of content) {
   96:         const text = part?.text;
   97:         if (typeof text === "string" && text.length > 0) return text;
   98:       }
   99:     }
  100:   }
  101: 
  102:   return "";
  103: }
  104: 
  105: function extractUsageFromResponses(json: any): { inputTokens?: number; outputTokens?: number } | undefined {
  106:   const inputTokens = json?.usage?.input_tokens;
  107:   const outputTokens = json?.usage?.output_tokens;
  108:   if (typeof inputTokens !== "number" && typeof outputTokens !== "number") return undefined;
  109:   return { inputTokens, outputTokens };
  110: }
  111: 
  112: function isLikelyResponsesModel(model: string) {
  113:   // Heuristic: newer model families are often exposed via the Responses API.
  114:   const normalized = model.toLowerCase();
  115:   return normalized.startsWith("gpt-5") || normalized.startsWith("o1") || normalized.startsWith("o3") || normalized.startsWith("o4");
  116: }
  117: 
  118: function shouldOmitTemperature(model: string) {
  119:   const normalized = model.toLowerCase();
  120:   // Some newer models either do not support temperature or only allow the default behavior.
  121:   return normalized.startsWith("gpt-5") || normalized.startsWith("o1") || normalized.startsWith("o3") || normalized.startsWith("o4");
  122: }
  123: 
  124: function shouldOmitTopP(model: string) {
  125:   const normalized = model.toLowerCase();
  126:   return normalized.startsWith("gpt-5") || normalized.startsWith("o1") || normalized.startsWith("o3") || normalized.startsWith("o4");
  127: }
  128: 
  129: async function* streamSse(response: Response): AsyncGenerator<string> {
  130:   if (!response.body) return;
  131:   const reader = response.body.getReader();
  132:   const decoder = new TextDecoder();
  133:   let buffer = "";
  134:   while (true) {
  135:     const { value, done } = await reader.read();
  136:     if (done) break;
  137:     buffer += decoder.decode(value, { stream: true });
  138:     let idx = buffer.indexOf("\n\n");
  139:     while (idx !== -1) {
  140:       const chunk = buffer.slice(0, idx);
  141:       buffer = buffer.slice(idx + 2);
  142:       idx = buffer.indexOf("\n\n");
  143: 
  144:       for (const line of chunk.split("\n")) {
  145:         const trimmed = line.trim();
  146:         if (!trimmed.startsWith("data:")) continue;
  147:         const data = trimmed.slice(5).trim();
  148:         if (!data) continue;
  149:         if (data === "[DONE]") return;
  150:         yield data;
  151:       }
  152:     }
  153:   }
  154: }
  155: 
  156: export async function generate(params: GenerateParams): Promise<GenerateResult> {
  157:   const apiKey = getApiKey();
  158:   if (!apiKey) {
  159:     throw new Error("OPENAI_API_KEY is not configured");
  160:   }
  161: 
  162:   const tryChatCompletions = async (): Promise<GenerateResult> => {
  163:     const body: any = {
  164:       model: params.model,
  165:       messages: params.messages,
  166:       max_tokens: params.max_tokens,
  167:     };
  168: 
  169:     if (!shouldOmitTemperature(params.model) && typeof params.temperature === "number") body.temperature = params.temperature;
  170:     if (!shouldOmitTopP(params.model) && typeof params.top_p === "number") body.top_p = params.top_p;
  171: 
  172:     const response = await fetchWithPolicy(`${OPENAI_BASE_URL}/chat/completions`, {
  173:       method: "POST",
  174:       headers: {
  175:         Authorization: `Bearer ${apiKey}`,
  176:         "Content-Type": "application/json",
  177:       },
  178:       body: JSON.stringify(body),
  179:     }, { timeoutMs: params.timeoutMs ?? DEFAULT_TIMEOUT_MS });
  180: 
  181:     const json = await response.json().catch(() => ({}));
  182:     if (!response.ok) {
  183:       const message = json?.error?.message ?? response.statusText;
  184:       const error = new Error(`OpenAI chat.completions error: ${message}`) as Error & { status?: number; raw?: unknown };
  185:       error.status = response.status;
  186:       error.raw = json;
  187:       throw error;
  188:     }
  189: 
  190:     const result = extractTextFromChatCompletions(json);
  191:     return {
  192:       text: result.text,
  193:       model: result.model ?? params.model,
  194:       usage: extractUsageFromChatCompletions(json),
  195:       raw: json,
  196:     };
  197:   };
  198: 
  199:   const buildResponsesBody = (opts: { stripTemperature?: boolean; stripTopP?: boolean } = {}) => {
  200:     const body: any = {
  201:       model: params.model,
  202:       input: params.messages.map((m) => ({
  203:         role: m.role,
  204:         content: [{ type: "input_text", text: m.content }],
  205:       })),
  206:     };
  207: 
  208:     const omitTemperature = shouldOmitTemperature(params.model) || opts.stripTemperature;
  209:     const omitTopP = shouldOmitTopP(params.model) || opts.stripTopP;
  210: 
  211:     if (!omitTemperature && typeof params.temperature === "number") body.temperature = params.temperature;
  212:     if (!omitTopP && typeof params.top_p === "number") body.top_p = params.top_p;
  213:     if (typeof params.max_tokens === "number") body.max_output_tokens = params.max_tokens;
  214: 
  215:     return body;
  216:   };
  217: 
  218:   const callResponses = async (body: any): Promise<GenerateResult> => {
  219:     const response = await fetchWithPolicy(`${OPENAI_BASE_URL}/responses`, {
  220:       method: "POST",
  221:       headers: {
  222:         Authorization: `Bearer ${apiKey}`,
  223:         "Content-Type": "application/json",
  224:       },
  225:       body: JSON.stringify(body),
  226:     }, { timeoutMs: params.timeoutMs ?? DEFAULT_TIMEOUT_MS });
  227: 
  228:     const json = await response.json().catch(() => ({}));
  229:     if (!response.ok) {
  230:       const message = json?.error?.message ?? response.statusText;
  231:       const error = new Error(`OpenAI responses error: ${message}`) as Error & { status?: number; raw?: unknown };
  232:       error.status = response.status;
  233:       error.raw = json;
  234:       throw error;
  235:     }
  236: 
  237:     return {
  238:       text: extractTextFromResponses(json),
  239:       model: json?.model ?? params.model,
  240:       usage: extractUsageFromResponses(json),
  241:       raw: json,
  242:     };
  243:   };
  244: 
  245:   const tryResponses = async (): Promise<GenerateResult> => {
  246:     try {
  247:       return await callResponses(buildResponsesBody());
  248:     } catch (error: any) {
  249:       const status = typeof error?.status === "number" ? error.status : undefined;
  250:       const message = typeof error?.message === "string" ? error.message : "";
  251:       const unsupportedTemperature = message.toLowerCase().includes("unsupported parameter") && message.toLowerCase().includes("'temperature'");
  252:       const unsupportedTopP = message.toLowerCase().includes("unsupported parameter") && message.toLowerCase().includes("'top_p'");
  253: 
  254:       if (status === 400 && (unsupportedTemperature || unsupportedTopP)) {
  255:         return await callResponses(
  256:           buildResponsesBody({
  257:             stripTemperature: unsupportedTemperature,
  258:             stripTopP: unsupportedTopP,
  259:           }),
  260:         );
  261:       }
  262: 
  263:       throw error;
  264:     }
  265:   };
  266: 
  267:   if (isLikelyResponsesModel(params.model)) {
  268:     try {
  269:       return await tryResponses();
  270:     } catch (error) {
  271:       // Fallback to chat completions for accounts/models that still expose it there.
  272:       return await tryChatCompletions().catch((chatError) => {
  273:         const msg = error instanceof Error ? error.message : String(error);
  274:         const msg2 = chatError instanceof Error ? chatError.message : String(chatError);
  275:         throw new Error(`${msg}; ${msg2}`);
  276:       });
  277:     }
  278:   }
  279: 
  280:   try {
  281:     return await tryChatCompletions();
  282:   } catch (error: any) {
  283:     // If the model isn't available on chat.completions, retry via Responses once.
  284:     const status = typeof error?.status === "number" ? error.status : undefined;
  285:     const message = typeof error?.message === "string" ? error.message : "";
  286:     const unsupportedTemperatureValue =
  287:       status === 400 &&
  288:       message.toLowerCase().includes("unsupported value") &&
  289:       message.toLowerCase().includes("'temperature'");
  290: 
  291:     if (unsupportedTemperatureValue) {
  292:       // Retry once without temperature/top_p for models that only support defaults.
  293:       const retryParams: GenerateParams = {
  294:         ...params,
  295:         temperature: undefined,
  296:         top_p: undefined,
  297:       };
  298:       return await generate(retryParams);
  299:     }
  300: 
  301:     const shouldRetryResponses =
  302:       status === 404 ||
  303:       (status === 400 &&
  304:         (message.toLowerCase().includes("does not exist") ||
  305:           message.toLowerCase().includes("not found") ||
  306:           message.toLowerCase().includes("unsupported") ||
  307:           message.toLowerCase().includes("unrecognized")));
  308: 
  309:     if (!shouldRetryResponses) throw error;
  310:     return await tryResponses();
  311:   }
  312: }
  313: 
  314: export async function* generateStream(params: GenerateParams): GenerateStreamResult {
  315:   const apiKey = getApiKey();
  316:   if (!apiKey) {
  317:     throw new Error("OPENAI_API_KEY is not configured");
  318:   }
  319: 
  320:   const buildChatBody = (omitTemp = false, omitTopP = false) => {
  321:     const body: any = {
  322:       model: params.model,
  323:       messages: params.messages,
  324:       max_tokens: params.max_tokens,
  325:       stream: true,
  326:     };
  327: 
  328:     if (!omitTemp && !shouldOmitTemperature(params.model) && typeof params.temperature === "number") {
  329:       body.temperature = params.temperature;
  330:     }
  331:     if (!omitTopP && !shouldOmitTopP(params.model) && typeof params.top_p === "number") {
  332:       body.top_p = params.top_p;
  333:     }
  334: 
  335:     return body;
  336:   };
  337: 
  338:   const buildResponsesBody = (omitTemp = false, omitTopP = false) => {
  339:     const body: any = {
  340:       model: params.model,
  341:       input: params.messages.map((m) => ({
  342:         role: m.role,
  343:         content: [{ type: "input_text", text: m.content }],
  344:       })),
  345:       stream: true,
  346:     };
  347: 
  348:     if (!omitTemp && !shouldOmitTemperature(params.model) && typeof params.temperature === "number") {
  349:       body.temperature = params.temperature;
  350:     }
  351:     if (!omitTopP && !shouldOmitTopP(params.model) && typeof params.top_p === "number") {
  352:       body.top_p = params.top_p;
  353:     }
  354:     if (typeof params.max_tokens === "number") body.max_output_tokens = params.max_tokens;
  355: 
  356:     return body;
  357:   };
  358: 
  359:   const streamChatCompletions = async function* (omitTemp = false, omitTopP = false): GenerateStreamResult {
  360:     const response = await fetchWithPolicy(`${OPENAI_BASE_URL}/chat/completions`, {
  361:       method: "POST",
  362:       headers: {
  363:         Authorization: `Bearer ${apiKey}`,
  364:         "Content-Type": "application/json",
  365:       },
  366:       body: JSON.stringify(buildChatBody(omitTemp, omitTopP)),
  367:     }, { timeoutMs: params.timeoutMs ?? DEFAULT_TIMEOUT_MS, stream: true });
  368: 
  369:     const firstText = response.body ? "" : await response.text().catch(() => "");
  370:     if (!response.ok) {
  371:       const json = firstText ? {} : await response.json().catch(() => ({}));
  372:       const message = (json as any)?.error?.message ?? response.statusText;
  373:       const error = new Error(`OpenAI chat.completions error: ${message}`) as Error & { status?: number };
  374:       error.status = response.status;
  375:       throw error;
  376:     }
  377: 
  378:     for await (const data of streamSse(response)) {
  379:       let parsed: any;
  380:       try {
  381:         parsed = JSON.parse(data);
  382:       } catch {
  383:         continue;
  384:       }
  385:       const delta = parsed?.choices?.[0]?.delta?.content;
  386:       if (typeof delta === "string" && delta.length > 0) {
  387:         yield { delta };
  388:       }
  389:     }
  390:   };
  391: 
  392:   const streamResponses = async function* (omitTemp = false, omitTopP = false): GenerateStreamResult {
  393:     const response = await fetchWithPolicy(`${OPENAI_BASE_URL}/responses`, {
  394:       method: "POST",
  395:       headers: {
  396:         Authorization: `Bearer ${apiKey}`,
  397:         "Content-Type": "application/json",
  398:       },
  399:       body: JSON.stringify(buildResponsesBody(omitTemp, omitTopP)),
  400:     }, { timeoutMs: params.timeoutMs ?? DEFAULT_TIMEOUT_MS, stream: true });
  401: 
  402:     const firstText = response.body ? "" : await response.text().catch(() => "");
  403:     if (!response.ok) {
  404:       const json = firstText ? {} : await response.json().catch(() => ({}));
  405:       const message = (json as any)?.error?.message ?? response.statusText;
  406:       const error = new Error(`OpenAI responses error: ${message}`) as Error & { status?: number };
  407:       error.status = response.status;
  408:       throw error;
  409:     }
  410: 
  411:     for await (const data of streamSse(response)) {
  412:       let parsed: any;
  413:       try {
  414:         parsed = JSON.parse(data);
  415:       } catch {
  416:         continue;
  417:       }
  418: 
  419:       if (parsed?.type === "response.output_text.delta" && typeof parsed?.delta === "string") {
  420:         yield { delta: parsed.delta };
  421:         continue;
  422:       }
  423: 
  424:       const output = parsed?.output;
  425:       if (Array.isArray(output)) {
  426:         for (const item of output) {
  427:           const content = item?.content;
  428:           if (!Array.isArray(content)) continue;
  429:           for (const part of content) {
  430:             if (typeof part?.text === "string" && part.text.length > 0) {
  431:               yield { delta: part.text };
  432:             }
  433:           }
  434:         }
  435:       }
  436:     }
  437:   };
  438: 
  439:   if (isLikelyResponsesModel(params.model)) {
  440:     try {
  441:       yield* streamResponses();
  442:       return;
  443:     } catch (error: any) {
  444:       const status = typeof error?.status === "number" ? error.status : undefined;
  445:       const message = typeof error?.message === "string" ? error.message : "";
  446:       const unsupportedTemp = status === 400 && message.toLowerCase().includes("unsupported parameter") && message.toLowerCase().includes("'temperature'");
  447:       const unsupportedTopP = status === 400 && message.toLowerCase().includes("unsupported parameter") && message.toLowerCase().includes("'top_p'");
  448:       if (unsupportedTemp || unsupportedTopP) {
  449:         yield* streamResponses(unsupportedTemp, unsupportedTopP);
  450:         return;
  451:       }
  452:       yield* streamChatCompletions();
  453:       return;
  454:     }
  455:   }
  456: 
  457:   try {
  458:     yield* streamChatCompletions();
  459:   } catch (error: any) {
  460:     const status = typeof error?.status === "number" ? error.status : undefined;
  461:     const message = typeof error?.message === "string" ? error.message : "";
  462:     const unsupportedTempValue =
  463:       status === 400 && message.toLowerCase().includes("unsupported value") && message.toLowerCase().includes("'temperature'");
  464:     if (unsupportedTempValue) {
  465:       yield* streamChatCompletions(true, true);
  466:       return;
  467:     }
  468: 
  469:     const shouldRetryResponses =
  470:       status === 404 ||
  471:       (status === 400 &&
  472:         (message.toLowerCase().includes("does not exist") ||
  473:           message.toLowerCase().includes("not found") ||
  474:           message.toLowerCase().includes("unsupported") ||
  475:           message.toLowerCase().includes("unrecognized")));
  476: 
  477:     if (!shouldRetryResponses) throw error;
  478:     yield* streamResponses();
  479:   }
  480: }
  481: 
  482: export async function embed(params: EmbedParams): Promise<EmbedResult> {
  483:   const apiKey = getApiKey();
  484:   if (!apiKey) {
  485:     throw new Error("OPENAI_API_KEY is not configured");
  486:   }
  487: 
  488:   const body: Record<string, unknown> = {
  489:     model: params.model,
  490:     input: params.input,
  491:   };
  492:   if (typeof params.outputDimensionality === "number") {
  493:     body.dimensions = params.outputDimensionality;
  494:   }
  495: 
  496:   const response = await fetchWithPolicy(`${OPENAI_BASE_URL}/embeddings`, {
  497:     method: "POST",
  498:     headers: {
  499:       Authorization: `Bearer ${apiKey}`,
  500:       "Content-Type": "application/json",
  501:     },
  502:     body: JSON.stringify(body),
  503:   }, { timeoutMs: params.timeoutMs ?? EMBED_TIMEOUT_MS });
  504: 
  505:   const json = await response.json().catch(() => ({}));
  506:   if (!response.ok) {
  507:     throw new Error(`OpenAI error: ${json?.error?.message ?? response.statusText}`);
  508:   }
  509: 
  510:   return {
  511:     embedding: json?.data?.[0]?.embedding ?? [],
  512:     raw: json,
  513:   };
  514: }

=== src\ai\providers\types.ts ===
    1: export type ChatMessage = {
    2:   role: "system" | "user" | "assistant" | string;
    3:   content: string;
    4: };
    5: 
    6: export type GenerateParams = {
    7:   model: string;
    8:   messages: ChatMessage[];
    9:   temperature?: number;
   10:   max_tokens?: number;
   11:   top_p?: number;
   12:   timeoutMs?: number;
   13: };
   14: 
   15: export type GenerateResult = {
   16:   text: string;
   17:   model?: string;
   18:   usage?: { inputTokens?: number; outputTokens?: number };
   19:   raw?: unknown;
   20: };
   21: 
   22: export type GenerateStreamChunk = {
   23:   delta: string;
   24:   raw?: unknown;
   25:   usage?: { inputTokens?: number; outputTokens?: number };
   26: };
   27: 
   28: export type GenerateStreamResult = AsyncIterable<GenerateStreamChunk>;
   29: 
   30: export type EmbedParams = {
   31:   model: string;
   32:   input: string;
   33:   outputDimensionality?: number;
   34:   timeoutMs?: number;
   35: };
   36: 
   37: export type EmbedResult = {
   38:   embedding: number[];
   39:   raw?: unknown;
   40: };

=== src\ai\providers\utils.ts ===
    1: type FetchInput = Parameters<typeof fetch>[0];
    2: type FetchInit = Parameters<typeof fetch>[1];
    3: 
    4: export type RetryOptions = {
    5:   retries: number;
    6:   backoffMs: number[];
    7:   timeoutMs?: number;
    8:   shouldRetry?: (result: { response?: Response; error?: unknown }) => boolean;
    9:   jitterMs?: (baseMs: number) => number;
   10:   sleepFn?: (ms: number) => Promise<void>;
   11: };
   12: 
   13: export type CircuitBreakerOptions = {
   14:   windowMs?: number;
   15:   errorRateToOpen?: number;
   16:   halfOpenIntervalMs?: number;
   17:   now?: () => number;
   18: };
   19: 
   20: type CircuitEvent = { ts: number; success: boolean };
   21: 
   22: export async function fetchWithTimeout(input: FetchInput, init: FetchInit = {}, timeoutMs?: number): Promise<Response> {
   23:   if (!timeoutMs || timeoutMs <= 0) {
   24:     return fetch(input, init);
   25:   }
   26: 
   27:   const controller = new AbortController();
   28:   const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
   29: 
   30:   const upstreamSignal = init.signal;
   31:   if (upstreamSignal) {
   32:     if (upstreamSignal.aborted) {
   33:       controller.abort();
   34:     } else {
   35:       upstreamSignal.addEventListener("abort", () => controller.abort(), { once: true });
   36:     }
   37:   }
   38: 
   39:   try {
   40:     return await fetch(input, { ...init, signal: controller.signal });
   41:   } finally {
   42:     clearTimeout(timeoutId);
   43:   }
   44: }
   45: 
   46: export async function sleep(ms: number): Promise<void> {
   47:   await new Promise((resolve) => setTimeout(resolve, ms));
   48: }
   49: 
   50: function defaultJitter(baseMs: number) {
   51:   const jitter = Math.floor(Math.random() * 250);
   52:   return baseMs + jitter;
   53: }
   54: 
   55: function isTimeoutError(error: unknown) {
   56:   return error instanceof DOMException && error.name === "AbortError";
   57: }
   58: 
   59: export async function fetchWithRetry(input: FetchInput, init: FetchInit = {}, options: RetryOptions): Promise<Response> {
   60:   const retries = Math.max(1, options.retries);
   61:   const shouldRetry = options.shouldRetry ?? ((result: { response?: Response; error?: unknown }) => {
   62:     if (result.response) {
   63:       return result.response.status === 429 || result.response.status === 503;
   64:     }
   65:     return isTimeoutError(result.error);
   66:   });
   67:   const jitterFn = options.jitterMs ?? defaultJitter;
   68:   const sleepFn = options.sleepFn ?? sleep;
   69: 
   70:   let attempt = 0;
   71:   while (attempt < retries) {
   72:     attempt += 1;
   73:     try {
   74:       const response = await fetchWithTimeout(input, init, options.timeoutMs);
   75:       if (!shouldRetry({ response })) {
   76:         return response;
   77:       }
   78:       if (attempt >= retries) {
   79:         return response;
   80:       }
   81:     } catch (error) {
   82:       if (!shouldRetry({ error }) || attempt >= retries) {
   83:         throw error;
   84:       }
   85:     }
   86: 
   87:     const baseDelay = options.backoffMs[Math.min(attempt - 1, options.backoffMs.length - 1)] ?? 0;
   88:     const delay = jitterFn(baseDelay);
   89:     await sleepFn(delay);
   90:   }
   91: 
   92:   return fetchWithTimeout(input, init, options.timeoutMs);
   93: }
   94: 
   95: export class CircuitBreaker {
   96:   private readonly windowMs: number;
   97:   private readonly errorRateToOpen: number;
   98:   private readonly halfOpenIntervalMs: number;
   99:   private readonly now: () => number;
  100:   private events: CircuitEvent[] = [];
  101:   private state: "closed" | "open" | "half_open" = "closed";
  102:   private openedAt: number | null = null;
  103:   private lastProbeAt: number | null = null;
  104: 
  105:   constructor(options: CircuitBreakerOptions = {}) {
  106:     this.windowMs = options.windowMs ?? 5 * 60 * 1000;
  107:     this.errorRateToOpen = options.errorRateToOpen ?? 0.5;
  108:     this.halfOpenIntervalMs = options.halfOpenIntervalMs ?? 30 * 1000;
  109:     this.now = options.now ?? (() => Date.now());
  110:   }
  111: 
  112:   canRequest(): boolean {
  113:     this.prune();
  114:     const now = this.now();
  115:     if (this.state === "closed") return true;
  116: 
  117:     if (this.state === "open") {
  118:       if (this.openedAt !== null && now - this.openedAt >= this.halfOpenIntervalMs) {
  119:         this.state = "half_open";
  120:         this.lastProbeAt = now;
  121:         return true;
  122:       }
  123:       return false;
  124:     }
  125: 
  126:     if (this.lastProbeAt === null || now - this.lastProbeAt >= this.halfOpenIntervalMs) {
  127:       this.lastProbeAt = now;
  128:       return true;
  129:     }
  130: 
  131:     return false;
  132:   }
  133: 
  134:   recordSuccess(): void {
  135:     this.recordEvent(true);
  136:     if (this.state === "half_open") {
  137:       this.state = "closed";
  138:       this.openedAt = null;
  139:       this.lastProbeAt = null;
  140:     }
  141:   }
  142: 
  143:   recordFailure(): void {
  144:     this.recordEvent(false);
  145:     if (this.state === "half_open") {
  146:       this.open();
  147:       return;
  148:     }
  149:     if (this.state === "closed" && this.shouldOpen()) {
  150:       this.open();
  151:     }
  152:   }
  153: 
  154:   getState(): "closed" | "open" | "half_open" {
  155:     return this.state;
  156:   }
  157: 
  158:   private recordEvent(success: boolean) {
  159:     this.events.push({ ts: this.now(), success });
  160:     this.prune();
  161:   }
  162: 
  163:   private prune() {
  164:     const cutoff = this.now() - this.windowMs;
  165:     this.events = this.events.filter((event) => event.ts >= cutoff);
  166:   }
  167: 
  168:   private shouldOpen(): boolean {
  169:     if (this.events.length === 0) return false;
  170:     const failures = this.events.filter((event) => !event.success).length;
  171:     return failures / this.events.length >= this.errorRateToOpen;
  172:   }
  173: 
  174:   private open() {
  175:     this.state = "open";
  176:     this.openedAt = this.now();
  177:   }
  178: }

=== src\ai\ragPolicy.test.ts ===
    1: import { describe, expect, it } from "vitest";
    2: import { applyRagPolicy, getRagConfig } from "./ragPolicy.ts";
    3: import { TaskType } from "./taskTypes.ts";
    4: 
    5: describe("ragPolicy", () => {
    6:   it("returns default config for client portal QA", () => {
    7:     const config = getRagConfig(TaskType.CLIENT_PORTAL_QA);
    8:     expect(config.client_memory_top_k).toBe(6);
    9:     expect(config.agency_memory_top_k).toBe(4);
   10:     expect(config.exemplar_top_k).toBe(2);
   11:     expect(config.max_context_chars).toBe(6000);
   12:     expect(config.max_context_tokens).toBeGreaterThan(0);
   13:   });
   14: 
   15:   it("includes brain documents for strategy plan agency retrieval", () => {
   16:     const config = getRagConfig(TaskType.STRATEGY_PLAN);
   17:     expect(config.agency_doc_types).toContain("brain_document");
   18:   });
   19: 
   20:   it("selects top matches per bucket and orders by similarity", () => {
   21:     const config = getRagConfig(TaskType.STRATEGY_PLAN);
   22:     const matches = [
   23:       { doc_type: "client_guidelines", chunk_text: "c1", similarity: 0.2 },
   24:       { doc_type: "client_guidelines", chunk_text: "c2", similarity: 0.9 },
   25:       { doc_type: "agency_sop", chunk_text: "a1", similarity: 0.5 },
   26:       { doc_type: "agency_sop", chunk_text: "a2", similarity: 0.8 },
   27:       { doc_type: "agency_exemplar_strategy", chunk_text: "e1", similarity: 0.3 },
   28:       { doc_type: "agency_exemplar_strategy", chunk_text: "e2", similarity: 0.7 },
   29:     ];
   30: 
   31:     const result = applyRagPolicy(matches, { ...config, client_memory_top_k: 1, agency_memory_top_k: 1, exemplar_top_k: 1 });
   32:     expect(result.selectedMatches.map((m) => m.chunk_text)).toEqual(["c2", "a2", "e2"]);
   33:     expect(result.retrievalCount).toBe(3);
   34:   });
   35: 
   36:   it("truncates context when exceeding max chars", () => {
   37:     const config = getRagConfig(TaskType.STRATEGY_PLAN);
   38:     const matches = [
   39:       { doc_type: "client_guidelines", chunk_text: "a".repeat(50), similarity: 0.9 },
   40:     ];
   41: 
   42:     const result = applyRagPolicy(matches, { ...config, max_context_chars: 10 });
   43:     expect(result.contextTruncated).toBe(true);
   44:     expect(result.context.length).toBeGreaterThan(10);
   45:   });
   46: 
   47:   it("truncates matches when token budget is exceeded", () => {
   48:     const config = getRagConfig(TaskType.STRATEGY_PLAN);
   49:     const matches = [
   50:       { doc_type: "client_guidelines", chunk_text: "one two three four", similarity: 0.9 },
   51:       { doc_type: "client_guidelines", chunk_text: "five six seven eight", similarity: 0.8 },
   52:     ];
   53: 
   54:     const result = applyRagPolicy(matches, { ...config, max_context_tokens: 4 });
   55:     expect(result.selectedMatches.length).toBe(1);
   56:     expect(result.contextTruncated).toBe(true);
   57:   });
   58: });

=== src\ai\ragPolicy.ts ===
    1: import { TaskType } from "./taskTypes.ts";
    2: import { getEnvVar } from "./utils.ts";
    3: 
    4: export type RagConfig = {
    5:   client_memory_top_k: number;
    6:   client_doc_types: string[];
    7:   agency_memory_top_k: number;
    8:   agency_doc_types: string[];
    9:   exemplar_top_k: number;
   10:   exemplar_doc_types: string[];
   11:   min_similarity: number;
   12:   max_context_chars: number;
   13:   max_context_tokens: number;
   14: };
   15: 
   16: export type RagMatch = {
   17:   doc_type: string;
   18:   chunk_text: string;
   19:   similarity?: number;
   20:   score?: number;
   21:   doc_id?: string;
   22:   document_id?: string;
   23:   chunk_id?: string;
   24: };
   25: 
   26: export type RagPolicyResult = {
   27:   context: string;
   28:   contextTruncated: boolean;
   29:   selectedMatches: RagMatch[];
   30:   retrievalCount: number;
   31:   docTypesUsed: string[];
   32: };
   33: 
   34: const DEFAULT_RAG_CONFIG: Partial<Record<TaskType, RagConfig>> = {
   35:   [TaskType.CLIENT_PORTAL_QA]: {
   36:     client_memory_top_k: 6,
   37:     client_doc_types: ["client_memory", "onboarding_v3", "strategy_plan"],
   38:     agency_memory_top_k: 4,
   39:     agency_doc_types: ["agency_memory", "setup_progress_v1"],
   40:     exemplar_top_k: 2,
   41:     exemplar_doc_types: ["exemplar"],
   42:     min_similarity: 0.2,
   43:     max_context_chars: 6000,
   44:     max_context_tokens: 900,
   45:   },
   46:   [TaskType.STRATEGY_PLAN]: {
   47:     // Mirrors legacy ai-strategy-generate retrieval defaults.
   48:     client_memory_top_k: 6,
   49:     client_doc_types: ["client_guidelines", "client_notes", "approved_posts", "ai_artifact", "strategy_draft"],
   50:     agency_memory_top_k: 4,
   51:     agency_doc_types: ["agency_sop", "brain_document"],
   52:     exemplar_top_k: 2,
   53:     exemplar_doc_types: ["agency_exemplar_strategy"],
   54:     min_similarity: 0.2,
   55:     max_context_chars: 6000,
   56:     max_context_tokens: 1200,
   57:   },
   58: };
   59: 
   60: const FALLBACK_RAG_CONFIG: RagConfig = {
   61:   client_memory_top_k: 0,
   62:   client_doc_types: [],
   63:   agency_memory_top_k: 0,
   64:   agency_doc_types: [],
   65:   exemplar_top_k: 0,
   66:   exemplar_doc_types: [],
   67:   min_similarity: 0,
   68:   max_context_chars: 6000,
   69:   max_context_tokens: 1200,
   70: };
   71: 
   72: export function getRagConfig(taskType: TaskType): RagConfig {
   73:   return DEFAULT_RAG_CONFIG[taskType] ?? FALLBACK_RAG_CONFIG;
   74: }
   75: 
   76: function similarityScore(match: RagMatch) {
   77:   if (typeof match.similarity === "number") return match.similarity;
   78:   if (typeof match.score === "number") return match.score;
   79:   return 0;
   80: }
   81: 
   82: function selectTop(matches: RagMatch[], topK: number) {
   83:   if (topK <= 0) return [];
   84:   return [...matches]
   85:     .sort((a, b) => similarityScore(b) - similarityScore(a))
   86:     .slice(0, topK);
   87: }
   88: 
   89: function estimateTokens(text: string) {
   90:   if (!text) return 0;
   91:   return text.trim().split(/\s+/).filter(Boolean).length;
   92: }
   93: 
   94: export function applyRagPolicy(matches: RagMatch[], config: RagConfig): RagPolicyResult {
   95:   const clientMatches = matches.filter((match) => config.client_doc_types.includes(match.doc_type));
   96:   const agencyMatches = matches.filter((match) => config.agency_doc_types.includes(match.doc_type));
   97:   const exemplarMatches = matches.filter((match) => config.exemplar_doc_types.includes(match.doc_type));
   98: 
   99:   const preSelected = [
  100:     ...selectTop(clientMatches, config.client_memory_top_k),
  101:     ...selectTop(agencyMatches, config.agency_memory_top_k),
  102:     ...selectTop(exemplarMatches, config.exemplar_top_k),
  103:   ];
  104: 
  105:   let usedTokens = 0;
  106:   const selectedMatches: RagMatch[] = [];
  107:   for (const match of preSelected) {
  108:     const tokens = estimateTokens(match.chunk_text ?? "");
  109:     if (usedTokens + tokens > config.max_context_tokens) break;
  110:     selectedMatches.push(match);
  111:     usedTokens += tokens;
  112:   }
  113: 
  114:   const contextParts = selectedMatches.map((match) => `(${match.doc_type}) ${match.chunk_text}`);
  115:   const fullContext = contextParts.join("\n\n");
  116: 
  117:   if (fullContext.length <= config.max_context_chars) {
  118:     return {
  119:       context: fullContext,
  120:       contextTruncated: selectedMatches.length < preSelected.length,
  121:       selectedMatches,
  122:       retrievalCount: selectedMatches.length,
  123:       docTypesUsed: Array.from(new Set(selectedMatches.map((match) => match.doc_type))),
  124:     };
  125:   }
  126: 
  127:   return {
  128:     context: `${fullContext.slice(0, config.max_context_chars)}\n...(context truncated)`,
  129:     contextTruncated: true,
  130:     selectedMatches,
  131:     retrievalCount: selectedMatches.length,
  132:     docTypesUsed: Array.from(new Set(selectedMatches.map((match) => match.doc_type))),
  133:   };
  134: }
  135: 
  136: function hashToBucket(value: string) {
  137:   let hash = 0;
  138:   for (let i = 0; i < value.length; i += 1) {
  139:     hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  140:   }
  141:   return hash % 100;
  142: }
  143: 
  144: export function shouldUseRagPolicy(ids: { agencyId?: string | null; clientId?: string | null }) {
  145:   const raw = getEnvVar("AI_RAG_CENTRALIZED");
  146:   if (!raw) return false;
  147: 
  148:   const normalized = raw.toLowerCase();
  149:   if (normalized === "true") return true;
  150:   if (normalized === "false") return false;
  151: 
  152:   const percent = Number.parseInt(raw, 10);
  153:   if (!Number.isFinite(percent) || percent <= 0) return false;
  154:   if (percent >= 100) return true;
  155: 
  156:   const key = ids.clientId ?? ids.agencyId;
  157:   if (!key) return false;
  158:   return hashToBucket(key) < percent;
  159: }

=== src\ai\router.ts ===
    1: import { getAgencyBrainContext, getClientBrainContext } from "./brains/index.ts"
    2: import { logUsage } from "./logging.ts"
    3: import { resolveTaskModel, getTaskConfig } from "./taskRegistry.ts"
    4: import { TaskType } from "./taskTypes.ts"
    5: import { nowMs } from "./utils.ts"
    6: import { providers as defaultProviders } from "./providers/index.ts"
    7: import { createBrainResolver, type CalibrationRequirement, type ResolvedBrainContext } from "./brainResolver.ts"
    8: import type { ChatMessage, GenerateResult } from "./providers/types.ts"
    9: import type { OutputSchema } from "./schema.ts"
   10: 
   11: type MinimalSupabase = {
   12:   from: (table: string) => any;
   13: };
   14: 
   15: export type AiContext = {
   16:   agencyId?: string;
   17:   clientId?: string;
   18:   userId?: string;
   19:   role?: string;
   20:   plan?: string;
   21:   environment?: "dev" | "prod";
   22:   supabase?: MinimalSupabase | null;
   23:   skipUsageLog?: boolean;
   24: };
   25: 
   26: export type AiRunOptions = {
   27:   taskType: TaskType;
   28:   input?: string;
   29:   messages?: ChatMessage[];
   30:   context: AiContext;
   31:   metadata?: Record<string, unknown>;
   32:   outputSchema?: OutputSchema<unknown>;
   33: };
   34: 
   35: export type AiRunResult = {
   36:   text: string;
   37:   output?: unknown;
   38:   unknown?: boolean;
   39:   error?: string | null;
   40:   raw?: unknown;
   41:   rawText?: string;
   42:   schemaOk?: boolean;
   43:   usage?: GenerateResult["usage"];
   44:   meta?: {
   45:     provider: string;
   46:     model: string;
   47:   };
   48:   /** Present when on-demand calibration is needed */
   49:   calibrationNeeded?: CalibrationRequirement;
   50:   /** Resolved brain context used for the request */
   51:   resolvedContext?: ResolvedBrainContext;
   52: };
   53: 
   54: export type AiStreamChunk =
   55:   | { type: "delta"; text: string }
   56:   | { type: "done"; result: AiRunResult };
   57: 
   58: type ProviderMap = typeof defaultProviders;
   59: 
   60: type RouterDeps = {
   61:   providers?: ProviderMap;
   62:   now?: () => number;
   63:   /** Enable brain resolver for on-demand calibration */
   64:   useBrainResolver?: boolean;
   65: };
   66: 
   67: function extractJson(text: string) {
   68:   const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
   69:   const rawJson = jsonMatch ? jsonMatch[1] : text;
   70:   return JSON.parse(rawJson);
   71: }
   72: 
   73: function buildUnknownResponse(taskType: TaskType, reason: string) {
   74:   const config = getTaskConfig(taskType);
   75:   if (config?.buildUnknown) {
   76:     return config.buildUnknown({ reason });
   77:   }
   78:   return { answer: "UNKNOWN", unknown: true, questions: ["What additional context is required?"], confidence: 0 };
   79: }
   80: 
   81: function shouldReturnUnknown(contextMissing: boolean, safetyMode: "strict_unknown" | "normal") {
   82:   return contextMissing && safetyMode === "strict_unknown";
   83: }
   84: 
   85: function getTimeoutMs(taskType: TaskType) {
   86:   switch (taskType) {
   87:     case TaskType.EMBED_TEXT:
   88:       return 10_000;
   89:     case TaskType.STRATEGY_PLAN:
   90:     case TaskType.CLIENT_PORTAL_QA:
   91:       return 180_000;
   92:     case TaskType.SUMMARIZE:
   93:       return 45_000;
   94:     case TaskType.CHAT_GENERAL:
   95:     case TaskType.CONTENT_IDEAS:
   96:       return 30_000;
   97:     default:
   98:       return 30_000;
   99:   }
  100: }
  101: 
  102: async function generateWithRetry(opts: {
  103:   provider: { generate: (params: any) => Promise<GenerateResult> };
  104:   params: any;
  105:   schema?: OutputSchema<unknown>;
  106:   taskType: TaskType;
  107: }): Promise<{
  108:   text: string;
  109:   output?: unknown;
  110:   raw?: unknown;
  111:   rawText?: string;
  112:   schemaOk?: boolean;
  113:   usage?: GenerateResult["usage"];
  114:   model?: string;
  115: }> {
  116:   const providerAny = opts.provider as any;
  117:   const generateFn =
  118:     opts.schema && typeof providerAny.generateJson === "function"
  119:       ? providerAny.generateJson.bind(opts.provider)
  120:       : opts.provider.generate.bind(opts.provider);
  121:   const first = await generateFn(opts.params);
  122:   if (!opts.schema) {
  123:     return { text: first.text, raw: first.raw, rawText: first.text, schemaOk: true, usage: first.usage, model: first.model };
  124:   }
  125: 
  126:   try {
  127:     const parsed = extractJson(first.text);
  128:     const validated = opts.schema.validate(parsed);
  129:     if (validated.ok) {
  130:       return {
  131:         text: first.text,
  132:         output: validated.data,
  133:         raw: first.raw,
  134:         rawText: first.text,
  135:         schemaOk: true,
  136:         usage: first.usage,
  137:         model: first.model,
  138:       };
  139:     }
  140:   } catch {
  141:     // fall through to repair
  142:   }
  143: 
  144:   const repairMessages = [
  145:     ...opts.params.messages,
  146:     {
  147:       role: "system",
  148:       content: `Repair the response. Return only valid JSON matching schema: ${opts.schema.name}. No markdown.`,
  149:     },
  150:   ];
  151: 
  152:   const retry = await opts.provider.generate({ ...opts.params, messages: repairMessages });
  153:   try {
  154:     const parsed = extractJson(retry.text);
  155:     const validated = opts.schema.validate(parsed);
  156:     if (validated.ok) {
  157:       return {
  158:         text: retry.text,
  159:         output: validated.data,
  160:         raw: retry.raw,
  161:         rawText: retry.text,
  162:         schemaOk: true,
  163:         usage: retry.usage,
  164:         model: retry.model,
  165:       };
  166:     }
  167:   } catch {
  168:     return {
  169:       text: "UNKNOWN",
  170:       output: buildUnknownResponse(opts.taskType, "schema_repair_failed"),
  171:       raw: retry.raw,
  172:       rawText: retry.text,
  173:       schemaOk: false,
  174:       usage: retry.usage,
  175:       model: retry.model,
  176:     };
  177:   }
  178: 
  179:   return {
  180:     text: "UNKNOWN",
  181:     output: buildUnknownResponse(opts.taskType, "schema_repair_failed"),
  182:     raw: retry.raw,
  183:     rawText: retry.text,
  184:     schemaOk: false,
  185:     usage: retry.usage,
  186:     model: retry.model,
  187:   };
  188: }
  189: 
  190: export function createAiRouter(deps: RouterDeps = {}) {
  191:   const providers = deps.providers ?? defaultProviders;
  192:   const now = deps.now ?? nowMs;
  193:   const useBrainResolver = deps.useBrainResolver ?? false;
  194: 
  195:   async function run(options: AiRunOptions): Promise<AiRunResult> {
  196:     const start = now();
  197:     const taskConfig = getTaskConfig(options.taskType);
  198:     if (!taskConfig) {
  199:       return { text: "UNKNOWN", unknown: true, error: "Unknown task type" };
  200:     }
  201: 
  202:     const context = options.context ?? {};
  203:     const supabase = context.supabase ?? null;
  204:     const contextMissing = (taskConfig.requires.agency && !context.agencyId) ||
  205:       (taskConfig.requires.client && !context.clientId);
  206: 
  207:     if (shouldReturnUnknown(contextMissing, taskConfig.safetyMode)) {
  208:       const latencyMs = now() - start;
  209:       if (!context.skipUsageLog) {
  210:         await logUsage(supabase, {
  211:           taskType: options.taskType,
  212:           endpoint: taskConfig.usageEndpoint,
  213:           provider: "none",
  214:           model: "context-missing",
  215:           agencyId: context.agencyId,
  216:           clientId: context.clientId,
  217:           latencyMs,
  218:           tokensIn: 0,
  219:           tokensOut: 0,
  220:           unknown: true,
  221:           success: true,
  222:           errorCode: "context_missing",
  223:         });
  224:       }
  225:       return { text: "UNKNOWN", output: buildUnknownResponse(options.taskType, "context_missing"), unknown: true };
  226:     }
  227: 
  228:     let agencyBrain: Record<string, unknown> | null = null;
  229:     let clientBrain: Record<string, unknown> | null = null;
  230:     let resolvedContext: ResolvedBrainContext | undefined;
  231: 
  232:     // Use Brain Resolver when enabled (v2 modular documents)
  233:     if (useBrainResolver && context.agencyId && supabase) {
  234:       const resolver = createBrainResolver(supabase);
  235:       const resolveResult = await resolver.resolveContext(options.taskType, context.agencyId);
  236: 
  237:       if (resolveResult.status === "calibration_needed") {
  238:         // Return early with calibration requirement - caller handles on-demand calibration
  239:         return {
  240:           text: "",
  241:           calibrationNeeded: resolveResult.calibration,
  242:           unknown: false,
  243:         };
  244:       }
  245: 
  246:       if (resolveResult.status === "error") {
  247:         return {
  248:           text: "UNKNOWN",
  249:           output: buildUnknownResponse(options.taskType, "brain_resolver_error"),
  250:           unknown: true,
  251:           error: resolveResult.error,
  252:         };
  253:       }
  254: 
  255:       // Use resolved context
  256:       resolvedContext = resolveResult.context;
  257:       agencyBrain = resolver.flattenContext(resolveResult.context);
  258:     } else if (taskConfig.requires.agency && context.agencyId && supabase) {
  259:       // Legacy: use monolithic brain_json
  260:       const res = await getAgencyBrainContext(supabase, context.agencyId);
  261:       agencyBrain = res.data;
  262:       if (!res.data && shouldReturnUnknown(true, taskConfig.safetyMode)) {
  263:         return { text: "UNKNOWN", output: buildUnknownResponse(options.taskType, "agency_brain_missing"), unknown: true };
  264:       }
  265:     }
  266: 
  267:     if (taskConfig.requires.client && context.clientId && supabase) {
  268:       const res = await getClientBrainContext(supabase, context.clientId);
  269:       clientBrain = res.data;
  270:       if (!res.data && shouldReturnUnknown(true, taskConfig.safetyMode)) {
  271:         return { text: "UNKNOWN", output: buildUnknownResponse(options.taskType, "client_brain_missing"), unknown: true };
  272:       }
  273:     }
  274: 
  275:     const modelConfigBase = resolveTaskModel(options.taskType, context.environment);
  276:     const overrideModel = options.metadata?.modelOverride as string | undefined;
  277:     const overrideProvider = options.metadata?.providerOverride as string | undefined;
  278:     const modelConfig = overrideModel ? { ...modelConfigBase, model: overrideModel } : modelConfigBase;
  279:     const providerKey = overrideProvider ?? modelConfig.provider;
  280:     const provider = providers[providerKey];
  281:     if (!provider) {
  282:       return { text: "UNKNOWN", unknown: true, error: "Provider not available" };
  283:     }
  284: 
  285:     if (taskConfig.outputMode === "embedding") {
  286:       if (!("embed" in provider)) {
  287:         return { text: "UNKNOWN", unknown: true, error: "Embedding not supported" };
  288:       }
  289:       const embeddingResult = await (provider as any).embed({
  290:         model: modelConfig.model,
  291:         input: options.input ?? "",
  292:         outputDimensionality: options.metadata?.outputDimensionality,
  293:         timeoutMs: getTimeoutMs(options.taskType),
  294:       });
  295:       const latencyMs = now() - start;
  296:       if (!context.skipUsageLog) {
  297:         await logUsage(supabase, {
  298:           taskType: options.taskType,
  299:           endpoint: taskConfig.usageEndpoint,
  300:           provider: providerKey,
  301:           model: modelConfig.model,
  302:           agencyId: context.agencyId,
  303:           clientId: context.clientId,
  304:           latencyMs,
  305:           tokensIn: 0,
  306:           tokensOut: 0,
  307:           unknown: false,
  308:           success: true,
  309:           errorCode: null,
  310:         });
  311:       }
  312:       return {
  313:         text: "",
  314:         output: embeddingResult.embedding,
  315:         raw: embeddingResult.raw,
  316:         meta: { provider: modelConfig.provider, model: modelConfig.model },
  317:       };
  318:     }
  319: 
  320:     const promptBuilder = taskConfig.promptBuilder;
  321:     const messages = options.messages ?? (promptBuilder
  322:       ? promptBuilder({
  323:           input: options.input,
  324:           metadata: options.metadata,
  325:           brains: { agency: agencyBrain ?? undefined, client: clientBrain ?? undefined },
  326:         })
  327:       : []);
  328: 
  329:     const schema = options.outputSchema ?? taskConfig.schema;
  330:     const result = await generateWithRetry({
  331:       provider: provider as any,
  332:       params: {
  333:         model: modelConfig.model,
  334:         messages,
  335:         temperature: modelConfig.params?.temperature,
  336:         max_tokens: modelConfig.params?.max_tokens,
  337:         top_p: modelConfig.params?.top_p,
  338:         timeoutMs: getTimeoutMs(options.taskType),
  339:       },
  340:       schema,
  341:       taskType: options.taskType,
  342:     });
  343: 
  344:     const latencyMs = now() - start;
  345:     const runtimeModel = result.model ?? modelConfig.model;
  346:     if (!context.skipUsageLog) {
  347:       await logUsage(supabase, {
  348:         taskType: options.taskType,
  349:         endpoint: taskConfig.usageEndpoint,
  350:         provider: providerKey,
  351:         model: runtimeModel,
  352:         agencyId: context.agencyId,
  353:         clientId: context.clientId,
  354:         latencyMs,
  355:         tokensIn: result.usage?.inputTokens,
  356:         tokensOut: result.usage?.outputTokens,
  357:         unknown: result.text.startsWith("UNKNOWN"),
  358:         success: true,
  359:         errorCode: null,
  360:       });
  361:     }
  362: 
  363:     return {
  364:       text: result.text,
  365:       output: result.output,
  366:       raw: result.raw,
  367:       rawText: result.rawText,
  368:       schemaOk: result.schemaOk,
  369:       usage: result.usage,
  370:       unknown: result.text.startsWith("UNKNOWN"),
  371:       meta: { provider: providerKey, model: runtimeModel },
  372:       resolvedContext,
  373:     };
  374:   }
  375: 
  376:   async function* runStream(options: AiRunOptions): AsyncGenerator<AiStreamChunk> {
  377:     const start = now();
  378:     const taskConfig = getTaskConfig(options.taskType);
  379:     if (!taskConfig) {
  380:       yield { type: "done", result: { text: "UNKNOWN", unknown: true, error: "Unknown task type" } };
  381:       return;
  382:     }
  383: 
  384:     const context = options.context ?? {};
  385:     const supabase = context.supabase ?? null;
  386:     const contextMissing = (taskConfig.requires.agency && !context.agencyId) ||
  387:       (taskConfig.requires.client && !context.clientId);
  388: 
  389:     if (shouldReturnUnknown(contextMissing, taskConfig.safetyMode)) {
  390:       const latencyMs = now() - start;
  391:       if (!context.skipUsageLog) {
  392:         await logUsage(supabase, {
  393:           taskType: options.taskType,
  394:           endpoint: taskConfig.usageEndpoint,
  395:           provider: "none",
  396:           model: "context-missing",
  397:           agencyId: context.agencyId,
  398:           clientId: context.clientId,
  399:           latencyMs,
  400:           tokensIn: 0,
  401:           tokensOut: 0,
  402:           unknown: true,
  403:           success: true,
  404:           errorCode: "context_missing",
  405:         });
  406:       }
  407:       const unknownResult: AiRunResult = {
  408:         text: "UNKNOWN",
  409:         output: buildUnknownResponse(options.taskType, "context_missing"),
  410:         unknown: true,
  411:       };
  412:       yield { type: "delta", text: unknownResult.text };
  413:       yield { type: "done", result: unknownResult };
  414:       return;
  415:     }
  416: 
  417:     let agencyBrain: Record<string, unknown> | null = null;
  418:     let clientBrain: Record<string, unknown> | null = null;
  419:     if (taskConfig.requires.agency && context.agencyId && supabase) {
  420:       const res = await getAgencyBrainContext(supabase, context.agencyId);
  421:       agencyBrain = res.data;
  422:       if (!res.data && shouldReturnUnknown(true, taskConfig.safetyMode)) {
  423:         const unknownResult: AiRunResult = {
  424:           text: "UNKNOWN",
  425:           output: buildUnknownResponse(options.taskType, "agency_brain_missing"),
  426:           unknown: true,
  427:         };
  428:         yield { type: "delta", text: unknownResult.text };
  429:         yield { type: "done", result: unknownResult };
  430:         return;
  431:       }
  432:     }
  433:     if (taskConfig.requires.client && context.clientId && supabase) {
  434:       const res = await getClientBrainContext(supabase, context.clientId);
  435:       clientBrain = res.data;
  436:       if (!res.data && shouldReturnUnknown(true, taskConfig.safetyMode)) {
  437:         const unknownResult: AiRunResult = {
  438:           text: "UNKNOWN",
  439:           output: buildUnknownResponse(options.taskType, "client_brain_missing"),
  440:           unknown: true,
  441:         };
  442:         yield { type: "delta", text: unknownResult.text };
  443:         yield { type: "done", result: unknownResult };
  444:         return;
  445:       }
  446:     }
  447: 
  448:     if (taskConfig.outputMode !== "freeform") {
  449:       const result = await run(options);
  450:       yield { type: "delta", text: result.text };
  451:       yield { type: "done", result };
  452:       return;
  453:     }
  454: 
  455:     const modelConfigBase = resolveTaskModel(options.taskType, context.environment);
  456:     const overrideModel = options.metadata?.modelOverride as string | undefined;
  457:     const overrideProvider = options.metadata?.providerOverride as string | undefined;
  458:     const modelConfig = overrideModel ? { ...modelConfigBase, model: overrideModel } : modelConfigBase;
  459:     const providerKey = overrideProvider ?? modelConfig.provider;
  460:     const provider = providers[providerKey];
  461:     if (!provider || !("generateStream" in provider)) {
  462:       const result = await run(options);
  463:       yield { type: "delta", text: result.text };
  464:       yield { type: "done", result };
  465:       return;
  466:     }
  467: 
  468:     const promptBuilder = taskConfig.promptBuilder;
  469:     const messages = options.messages ?? (promptBuilder
  470:       ? promptBuilder({
  471:           input: options.input,
  472:           metadata: options.metadata,
  473:           brains: { agency: agencyBrain ?? undefined, client: clientBrain ?? undefined },
  474:         })
  475:       : []);
  476: 
  477:     const params = {
  478:       model: modelConfig.model,
  479:       messages,
  480:       temperature: modelConfig.params?.temperature,
  481:       max_tokens: modelConfig.params?.max_tokens,
  482:       top_p: modelConfig.params?.top_p,
  483:       timeoutMs: getTimeoutMs(options.taskType),
  484:     };
  485: 
  486:     let text = "";
  487:     for await (const chunk of (provider as any).generateStream(params)) {
  488:       if (chunk?.delta) {
  489:         text += chunk.delta;
  490:         yield { type: "delta", text: chunk.delta };
  491:       }
  492:     }
  493: 
  494:     const latencyMs = now() - start;
  495:     if (!context.skipUsageLog) {
  496:       await logUsage(supabase, {
  497:         taskType: options.taskType,
  498:         endpoint: taskConfig.usageEndpoint,
  499:         provider: providerKey,
  500:         model: modelConfig.model,
  501:         agencyId: context.agencyId,
  502:         clientId: context.clientId,
  503:         latencyMs,
  504:         tokensIn: 0,
  505:         tokensOut: 0,
  506:         unknown: text.startsWith("UNKNOWN"),
  507:         success: true,
  508:         errorCode: null,
  509:       });
  510:     }
  511: 
  512:     const result: AiRunResult = {
  513:       text,
  514:       output: undefined,
  515:       raw: undefined,
  516:       unknown: text.startsWith("UNKNOWN"),
  517:       meta: { provider: providerKey, model: modelConfig.model },
  518:     };
  519: 
  520:     yield { type: "done", result };
  521:   }
  522: 
  523:   return { run, runStream };
  524: }
  525: 
  526: export const ai = createAiRouter();

=== src\ai\schema.ts ===
    1: export type SchemaResult<T> = {
    2:   ok: boolean;
    3:   data?: T;
    4:   errors?: string[];
    5: };
    6: 
    7: export type OutputSchema<T> = {
    8:   name: string;
    9:   validate: (value: unknown) => SchemaResult<T>;
   10: };
   11: 
   12: export type AdminChatSchema = {
   13:   assistant_message: string;
   14:   suggestions: string[];
   15:   actions?: Array<{ type: string; payload?: unknown }>;
   16:   escalated: boolean;
   17:   unknown: boolean;
   18: };
   19: 
   20: export type AdminChatStrategicSchema = {
   21:   playbook: "core_offer" | "strategy" | "copywriting";
   22:   clarifying_questions: string[];
   23:   assumptions?: string[];
   24:   core_offer?: Record<string, unknown> | null;
   25:   strategy?: Record<string, unknown> | null;
   26:   copywriting?: Record<string, unknown> | null;
   27:   unknown?: Record<string, unknown> | null;
   28:   suggestions?: string[];
   29: };
   30: 
   31: export function arraySchema<T = unknown>(name: string): OutputSchema<T[]> {
   32:   return {
   33:     name,
   34:     validate: (value: unknown) => {
   35:       if (!Array.isArray(value)) {
   36:         return { ok: false, errors: ["Expected array"] };
   37:       }
   38:       return { ok: true, data: value as T[] };
   39:     },
   40:   };
   41: }
   42: 
   43: export function objectSchema<T = Record<string, unknown>>(name: string, requiredKeys: string[]): OutputSchema<T> {
   44:   return {
   45:     name,
   46:     validate: (value: unknown) => {
   47:       if (!value || typeof value !== "object" || Array.isArray(value)) {
   48:         return { ok: false, errors: ["Expected object"] };
   49:       }
   50:       const missing = requiredKeys.filter((key) => !(key in (value as Record<string, unknown>)));
   51:       if (missing.length > 0) {
   52:         return { ok: false, errors: missing.map((key) => `Missing key: ${key}`) };
   53:       }
   54:       return { ok: true, data: value as T };
   55:     },
   56:   };
   57: }
   58: 
   59: export function adminChatSchema(): OutputSchema<AdminChatSchema> {
   60:   return {
   61:     name: "agency_admin_general_chat",
   62:     validate: (value: unknown) => {
   63:       if (!value || typeof value !== "object" || Array.isArray(value)) {
   64:         return { ok: false, errors: ["Expected object"] };
   65:       }
   66: 
   67:       const record = value as Record<string, unknown>;
   68:       const required = ["assistant_message", "suggestions", "escalated", "unknown"];
   69:       const missing = required.filter((key) => !(key in record));
   70:       if (missing.length > 0) {
   71:         return { ok: false, errors: missing.map((key) => `Missing key: ${key}`) };
   72:       }
   73: 
   74:       if (typeof record.assistant_message !== "string" || !record.assistant_message.trim()) {
   75:         return { ok: false, errors: ["assistant_message must be a non-empty string"] };
   76:       }
   77: 
   78:       if (!Array.isArray(record.suggestions)) {
   79:         return { ok: false, errors: ["suggestions must be an array"] };
   80:       }
   81:       if (record.suggestions.length > 6) {
   82:         return { ok: false, errors: ["suggestions must have <= 6 items"] };
   83:       }
   84:       if (!record.suggestions.every((item) => typeof item === "string")) {
   85:         return { ok: false, errors: ["suggestions must be strings"] };
   86:       }
   87: 
   88:       if (typeof record.escalated !== "boolean") {
   89:         return { ok: false, errors: ["escalated must be a boolean"] };
   90:       }
   91:       if (typeof record.unknown !== "boolean") {
   92:         return { ok: false, errors: ["unknown must be a boolean"] };
   93:       }
   94: 
   95:       if (record.actions !== undefined) {
   96:         if (!Array.isArray(record.actions)) {
   97:           return { ok: false, errors: ["actions must be an array"] };
   98:         }
   99:         for (const action of record.actions) {
  100:           if (!action || typeof action !== "object" || Array.isArray(action)) {
  101:             return { ok: false, errors: ["actions entries must be objects"] };
  102:           }
  103:           if (typeof (action as Record<string, unknown>).type !== "string") {
  104:             return { ok: false, errors: ["actions.type must be a string"] };
  105:           }
  106:         }
  107:       }
  108: 
  109:       return { ok: true, data: record as AdminChatSchema };
  110:     },
  111:   };
  112: }
  113: 
  114: export function adminChatStrategicSchema(): OutputSchema<AdminChatStrategicSchema> {
  115:   return {
  116:     name: "agency_admin_chat_strategic_v1",
  117:     validate: (value: unknown) => {
  118:       if (!value || typeof value !== "object" || Array.isArray(value)) {
  119:         return { ok: false, errors: ["Expected object"] };
  120:       }
  121: 
  122:       const record = value as Record<string, unknown>;
  123:       const required = ["playbook", "clarifying_questions"];
  124:       const missing = required.filter((key) => !(key in record));
  125:       if (missing.length > 0) {
  126:         return { ok: false, errors: missing.map((key) => `Missing key: ${key}`) };
  127:       }
  128: 
  129:       if (typeof record.playbook !== "string") {
  130:         return { ok: false, errors: ["playbook must be a string"] };
  131:       }
  132:       if (!["core_offer", "strategy", "copywriting"].includes(record.playbook)) {
  133:         return { ok: false, errors: ["playbook must be core_offer, strategy, or copywriting"] };
  134:       }
  135:       if (!Array.isArray(record.clarifying_questions)) {
  136:         return { ok: false, errors: ["clarifying_questions must be an array"] };
  137:       }
  138:       if (record.clarifying_questions.length > 3) {
  139:         return { ok: false, errors: ["clarifying_questions must have <= 3 items"] };
  140:       }
  141: 
  142:       if (record.suggestions !== undefined) {
  143:         if (!Array.isArray(record.suggestions)) {
  144:           return { ok: false, errors: ["suggestions must be an array"] };
  145:         }
  146:         if (record.suggestions.length > 3) {
  147:           return { ok: false, errors: ["suggestions must have <= 3 items"] };
  148:         }
  149:       }
  150: 
  151:       if (record.unknown !== undefined && record.unknown !== null) {
  152:         if (!record.unknown || typeof record.unknown !== "object" || Array.isArray(record.unknown)) {
  153:           return { ok: false, errors: ["unknown must be an object or null"] };
  154:         }
  155:         const unknownRecord = record.unknown as Record<string, unknown>;
  156:         if (!Array.isArray(unknownRecord.missing) || typeof unknownRecord.question !== "string") {
  157:           return { ok: false, errors: ["unknown must include missing[] and question"] };
  158:         }
  159:       }
  160: 
  161:       const payloads = {
  162:         core_offer: record.core_offer,
  163:         strategy: record.strategy,
  164:         copywriting: record.copywriting,
  165:       };
  166: 
  167:       const payloadPresent = Object.entries(payloads)
  168:         .filter(([, value]) => value !== undefined && value !== null)
  169:         .map(([key]) => key);
  170: 
  171:       if (record.unknown && payloadPresent.length > 0) {
  172:         return { ok: false, errors: ["unknown responses cannot include playbook payloads"] };
  173:       }
  174: 
  175:       if (!record.unknown) {
  176:         const expected = record.playbook;
  177:         if (payloadPresent.length !== 1 || payloadPresent[0] !== expected) {
  178:           return { ok: false, errors: ["exactly one playbook payload must be present for the selected playbook"] };
  179:         }
  180:       }
  181: 
  182:       return { ok: true, data: record as AdminChatStrategicSchema };
  183:     },
  184:   };
  185: }

=== src\ai\taskRegistry.ts ===
    1: import { buildAdminSetupGuidedPrompt } from "./prompts/adminSetupGuided.ts"
    2: import { buildAdminGeneralChatPrompt } from "./prompts/adminGeneralChat.ts"
    3: import { buildAdminSetupExtractPrompt } from "./prompts/adminSetupExtract.ts"
    4: import { buildChatGeneralPrompt } from "./prompts/chatGeneral.ts"
    5: import { buildClassifyIntentPrompt } from "./prompts/classifyIntent.ts"
    6: import { buildClientPortalQaPrompt } from "./prompts/clientPortalQa.ts"
    7: import { buildContentIdeasPrompt } from "./prompts/contentIdeas.ts"
    8: import { buildExtractStructuredPrompt } from "./prompts/extractStructured.ts"
    9: import { buildOnboardingAudiencePrompt, buildOnboardingDifferentiatorsPrompt, buildOnboardingOffersPrompt } from "./prompts/onboardingGuide.ts"
   10: import { buildStrategyPlanPrompt } from "./prompts/strategyPlan.ts"
   11: import { buildSummarizePrompt } from "./prompts/summarize.ts"
   12: import { buildToolExecutionPrompt } from "./prompts/toolExecution.ts"
   13: import { resolveModelPolicy } from "./modelPolicy.ts"
   14: import { adminChatSchema, adminChatStrategicSchema, arraySchema, objectSchema, OutputSchema } from "./schema.ts"
   15: import { TaskType } from "./taskTypes.ts"
   16: import type { ChatMessage } from "./providers/types.ts"
   17: 
   18: export type SafetyMode = "strict_unknown" | "normal";
   19: export type OutputMode = "freeform" | "json_schema" | "embedding";
   20: 
   21: export type BrainRequirements = {
   22:   agency: boolean;
   23:   client: boolean;
   24: };
   25: 
   26: export type PromptBuilderArgs = {
   27:   input?: string;
   28:   metadata?: Record<string, unknown>;
   29:   brains?: {
   30:     agency?: Record<string, unknown> | null;
   31:     client?: Record<string, unknown> | null;
   32:   };
   33: };
   34: 
   35: type TaskConfigBase = {
   36:   taskType: TaskType;
   37:   outputMode: OutputMode;
   38:   safetyMode: SafetyMode;
   39:   promptBuilder?: (args: PromptBuilderArgs) => ChatMessage[];
   40:   requires: BrainRequirements;
   41:   usageEndpoint: string;
   42:   buildUnknown?: (args: { reason: string }) => unknown;
   43: };
   44: 
   45: type FreeformTaskConfig = TaskConfigBase & {
   46:   outputMode: "freeform";
   47:   freeformReason: string;
   48:   schema?: undefined;
   49: };
   50: 
   51: type JsonSchemaTaskConfig = TaskConfigBase & {
   52:   outputMode: "json_schema";
   53:   schema: OutputSchema<unknown>;
   54:   freeformReason?: undefined;
   55: };
   56: 
   57: type EmbeddingTaskConfig = TaskConfigBase & {
   58:   outputMode: "embedding";
   59:   schema?: undefined;
   60:   freeformReason?: undefined;
   61: };
   62: 
   63: export type TaskConfig = FreeformTaskConfig | JsonSchemaTaskConfig | EmbeddingTaskConfig;
   64: 
   65: const DEFAULT_UNKNOWN_RESPONSE = { answer: "UNKNOWN", unknown: true, questions: ["What additional context is required?"], confidence: 0 };
   66: 
   67: function readEnvFlag(name: string) {
   68:   if (typeof Deno !== "undefined" && typeof (Deno as any)?.env?.get === "function") {
   69:     return (Deno as any).env.get(name) as string | undefined;
   70:   }
   71:   if (typeof process !== "undefined") {
   72:     return process.env[name];
   73:   }
   74:   return undefined;
   75: }
   76: 
   77: function isAdminChatSchemaEnabled() {
   78:   return readEnvFlag("AI_ADMIN_CHAT_SCHEMA") === "true";
   79: }
   80: 
   81: function isAdminChatStrategicEnabled() {
   82:   return readEnvFlag("AI_ADMIN_CHAT_STRATEGIC") === "true";
   83: }
   84: 
   85: const ADMIN_CHAT_SCHEMA_CONFIG: TaskConfig = {
   86:   taskType: TaskType.AGENCY_ADMIN_GENERAL_CHAT,
   87:   outputMode: "json_schema",
   88:   safetyMode: "strict_unknown",
   89:   promptBuilder: (args) =>
   90:     buildAdminGeneralChatPrompt({
   91:       contextSnapshot: (args.metadata?.contextSnapshot as Record<string, unknown>) ?? {},
   92:       conversation: (args.metadata?.conversation as string) ?? "",
   93:       latestUserMessage: (args.metadata?.latestUserMessage as string) ?? "",
   94:       outputMode: "schema",
   95:     }),
   96:   requires: { agency: true, client: false },
   97:   usageEndpoint: "ai-agency-admin-chat",
   98:   schema: adminChatSchema(),
   99:   buildUnknown: () => ({
  100:     assistant_message: "UNKNOWN. I need more details to answer. What should I help with first?",
  101:     suggestions: [],
  102:     actions: [],
  103:     escalated: false,
  104:     unknown: true,
  105:   }),
  106: };
  107: 
  108: const ADMIN_CHAT_STRATEGIC_CONFIG: TaskConfig = {
  109:   taskType: TaskType.AGENCY_ADMIN_GENERAL_CHAT,
  110:   outputMode: "json_schema",
  111:   safetyMode: "strict_unknown",
  112:   promptBuilder: (args) =>
  113:     buildAdminGeneralChatPrompt({
  114:       contextSnapshot: (args.metadata?.contextSnapshot as Record<string, unknown>) ?? {},
  115:       conversation: (args.metadata?.conversation as string) ?? "",
  116:       latestUserMessage: (args.metadata?.latestUserMessage as string) ?? "",
  117:       outputMode: "strategic",
  118:       ragContext: (args.metadata?.ragContext as string | undefined) ?? undefined,
  119:       contextBlob: (args.metadata?.contextBlob as Record<string, unknown> | undefined) ?? undefined,
  120:       playbook: (args.metadata?.playbook as any) ?? undefined,
  121:     }),
  122:   requires: { agency: true, client: false },
  123:   usageEndpoint: "ai-agency-admin-chat",
  124:   schema: adminChatStrategicSchema(),
  125:   buildUnknown: () => ({
  126:     playbook: "core_offer",
  127:     clarifying_questions: [],
  128:     assumptions: [],
  129:     core_offer: null,
  130:     strategy: null,
  131:     copywriting: null,
  132:     unknown: { missing: ["context"], question: "What should I help with first?" },
  133:     suggestions: [],
  134:   }),
  135: };
  136: 
  137: export const TASK_REGISTRY: Record<TaskType, TaskConfig> = {
  138:   [TaskType.CHAT_GENERAL]: {
  139:     taskType: TaskType.CHAT_GENERAL,
  140:     outputMode: "freeform",
  141:     freeformReason: "General chat returns conversational text without a rigid schema.",
  142:     safetyMode: "normal",
  143:     promptBuilder: (args) => buildChatGeneralPrompt({ input: args.input ?? "" }),
  144:     requires: { agency: false, client: false },
  145:     usageEndpoint: "ai-router",
  146:   },
  147:   [TaskType.CHAT_ADMIN_ONBOARDING]: {
  148:     taskType: TaskType.CHAT_ADMIN_ONBOARDING,
  149:     outputMode: "freeform",
  150:     freeformReason: "Admin onboarding chat uses conversational replies for guided setup.",
  151:     safetyMode: "strict_unknown",
  152:     promptBuilder: (args) => buildChatGeneralPrompt({ input: args.input ?? "" }),
  153:     requires: { agency: true, client: false },
  154:     usageEndpoint: "ai-agency-admin-chat",
  155:   },
  156:   [TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2]: {
  157:     taskType: TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2,
  158:     outputMode: "json_schema",
  159:     safetyMode: "strict_unknown",
  160:     promptBuilder: (args) =>
  161:       buildAdminSetupGuidedPrompt({
  162:         agencyBrain: args.brains?.agency ?? {},
  163:         conversation: (args.metadata?.conversation as string) ?? "",
  164:         latestUserMessage: (args.metadata?.latestUserMessage as string) ?? "",
  165:         contextSnapshot: (args.metadata?.contextSnapshot as Record<string, unknown>) ?? {},
  166:       }),
  167:     requires: { agency: true, client: false },
  168:     usageEndpoint: "ai-agency-admin-chat",
  169:     schema: objectSchema("agency_admin_setup_guided_v2", [
  170:       "assistant_message",
  171:       "expects",
  172:       "choices",
  173:       "suggestions",
  174:       "progress_percent",
  175:       "done",
  176:       "memory_patch",
  177:       "state",
  178:     ]),
  179:     buildUnknown: () => ({
  180:       assistant_message: "What detail should we start with for your agency setup?",
  181:       expects: "text",
  182:       choices: [],
  183:       suggestions: [],
  184:       progress_percent: 0,
  185:       done: false,
  186:       memory_patch: {},
  187:       state: {
  188:         intent: "CLARIFICATION_REQUEST",
  189:         pending_question_key: null,
  190:         pending_question_text: null,
  191:       },
  192:     }),
  193:   },
  194:   [TaskType.AGENCY_ADMIN_GENERAL_CHAT]: {
  195:     taskType: TaskType.AGENCY_ADMIN_GENERAL_CHAT,
  196:     outputMode: "freeform",
  197:     freeformReason: "Admin chat uses conversational output with suggestion parsing.",
  198:     safetyMode: "strict_unknown",
  199:     promptBuilder: (args) =>
  200:       buildAdminGeneralChatPrompt({
  201:         contextSnapshot: (args.metadata?.contextSnapshot as Record<string, unknown>) ?? {},
  202:         conversation: (args.metadata?.conversation as string) ?? "",
  203:         latestUserMessage: (args.metadata?.latestUserMessage as string) ?? "",
  204:         outputMode: "legacy",
  205:       }),
  206:     requires: { agency: true, client: false },
  207:     usageEndpoint: "ai-agency-admin-chat",
  208:     buildUnknown: () => ({
  209:       assistant_message: "UNKNOWN. I need more details to answer. What should I help with first?",
  210:       suggestions: [],
  211:     }),
  212:   },
  213:   [TaskType.AGENCY_ADMIN_SETUP_EXTRACT]: {
  214:     taskType: TaskType.AGENCY_ADMIN_SETUP_EXTRACT,
  215:     outputMode: "json_schema",
  216:     safetyMode: "normal",
  217:     promptBuilder: (args) =>
  218:       buildAdminSetupExtractPrompt({
  219:         questionKey: (args.metadata?.questionKey as string) ?? "",
  220:         questionText: (args.metadata?.questionText as string) ?? "",
  221:         targetPath: (args.metadata?.targetPath as string) ?? "",
  222:         answer: args.input ?? "",
  223:         contextSnapshot: (args.metadata?.contextSnapshot as Record<string, unknown>) ?? {},
  224:       }),
  225:     requires: { agency: true, client: false },
  226:     usageEndpoint: "ai-agency-admin-chat",
  227:     schema: objectSchema("agency_admin_setup_extract", ["value"]),
  228:     buildUnknown: () => ({ value: null }),
  229:   },
  230:   [TaskType.CLIENT_PORTAL_QA]: {
  231:     taskType: TaskType.CLIENT_PORTAL_QA,
  232:     outputMode: "json_schema",
  233:     safetyMode: "strict_unknown",
  234:     promptBuilder: (args) =>
  235:       buildClientPortalQaPrompt({
  236:         question: args.input ?? "",
  237:         context: (args.metadata?.context as string) ?? "",
  238:       }),
  239:     requires: { agency: false, client: false },
  240:     usageEndpoint: "ai-ask",
  241:     schema: objectSchema("client_portal_qa", ["answer", "unknown", "questions", "confidence"]),
  242:     buildUnknown: () => DEFAULT_UNKNOWN_RESPONSE,
  243:   },
  244:   [TaskType.SUMMARIZE]: {
  245:     taskType: TaskType.SUMMARIZE,
  246:     outputMode: "freeform",
  247:     freeformReason: "Report summarization produces narrative text for email/PDF rendering.",
  248:     safetyMode: "normal",
  249:     promptBuilder: (args) =>
  250:       buildSummarizePrompt({
  251:         input: args.input ?? "",
  252:         systemPrompt: (args.metadata?.systemPrompt as string) ?? undefined,
  253:       }),
  254:     requires: { agency: false, client: false },
  255:     usageEndpoint: "generate-monthly-report",
  256:   },
  257:   [TaskType.EXTRACT_STRUCTURED]: {
  258:     taskType: TaskType.EXTRACT_STRUCTURED,
  259:     outputMode: "json_schema",
  260:     safetyMode: "strict_unknown",
  261:     promptBuilder: (args) =>
  262:       buildExtractStructuredPrompt({
  263:         input: args.input ?? "",
  264:         instructions: (args.metadata?.instructions as string) ?? undefined,
  265:       }),
  266:     requires: { agency: false, client: false },
  267:     usageEndpoint: "ai-router",
  268:     schema: arraySchema("extract_structured"),
  269:     buildUnknown: () => DEFAULT_UNKNOWN_RESPONSE,
  270:   },
  271:   [TaskType.CLASSIFY_INTENT]: {
  272:     taskType: TaskType.CLASSIFY_INTENT,
  273:     outputMode: "json_schema",
  274:     safetyMode: "normal",
  275:     promptBuilder: (args) => buildClassifyIntentPrompt({ input: args.input ?? "" }),
  276:     requires: { agency: false, client: false },
  277:     usageEndpoint: "ai-router",
  278:     schema: objectSchema("classify_intent", ["intent"]),
  279:   },
  280:   [TaskType.STRATEGY_PLAN]: {
  281:     taskType: TaskType.STRATEGY_PLAN,
  282:     outputMode: "json_schema",
  283:     safetyMode: "strict_unknown",
  284:     promptBuilder: (args) =>
  285:       buildStrategyPlanPrompt({
  286:         agencyBrain: args.brains?.agency ?? {},
  287:         clientBrain: (args.metadata?.client_brain as any) ?? args.brains?.client ?? {},
  288:         context: (args.metadata?.context as string) ?? "",
  289:         instruction: (args.metadata?.instruction as string | undefined) ?? undefined,
  290:       }),
  291:     requires: { agency: false, client: false },
  292:     usageEndpoint: "ai-strategy-generate",
  293:     schema: objectSchema("strategy_plan", ["summary", "sections"]),
  294:     buildUnknown: () => ({ unknown: true, missing_fields: [], questions: ["What additional context is required?"], escalation: false }),
  295:   },
  296:   [TaskType.CONTENT_IDEAS]: {
  297:     taskType: TaskType.CONTENT_IDEAS,
  298:     outputMode: "json_schema",
  299:     safetyMode: "normal",
  300:     promptBuilder: (args) =>
  301:       buildContentIdeasPrompt({
  302:         mode: (args.metadata?.mode as any) ?? "ideas",
  303:         platform: (args.metadata?.platform as string) ?? undefined,
  304:         brandContext: (args.metadata?.brand_context as string) ?? undefined,
  305:         inputText: (args.metadata?.input_text as string) ?? undefined,
  306:       }),
  307:     requires: { agency: false, client: false },
  308:     usageEndpoint: "generate-ai-content",
  309:     schema: arraySchema("content_ideas"),
  310:   },
  311:   [TaskType.SCRIPT_WRITING]: {
  312:     taskType: TaskType.SCRIPT_WRITING,
  313:     outputMode: "json_schema",
  314:     safetyMode: "normal",
  315:     promptBuilder: (args) =>
  316:       buildContentIdeasPrompt({
  317:         mode: "script",
  318:         platform: (args.metadata?.platform as string) ?? undefined,
  319:         brandContext: (args.metadata?.brand_context as string) ?? undefined,
  320:         inputText: (args.metadata?.input_text as string) ?? undefined,
  321:       }),
  322:     requires: { agency: false, client: false },
  323:     usageEndpoint: "generate-ai-content",
  324:     schema: arraySchema("script_writing"),
  325:   },
  326:   [TaskType.TOOL_EXECUTION]: {
  327:     taskType: TaskType.TOOL_EXECUTION,
  328:     outputMode: "json_schema",
  329:     safetyMode: "normal",
  330:     promptBuilder: (args) => buildToolExecutionPrompt({ input: args.input ?? "" }),
  331:     requires: { agency: false, client: false },
  332:     usageEndpoint: "ai-router",
  333:     schema: objectSchema("tool_execution", []),
  334:   },
  335:   [TaskType.EMBED_TEXT]: {
  336:     taskType: TaskType.EMBED_TEXT,
  337:     outputMode: "embedding",
  338:     safetyMode: "normal",
  339:     requires: { agency: false, client: false },
  340:     usageEndpoint: "ai-embeddings",
  341:   },
  342: };
  343: 
  344: export function getTaskConfig(taskType: TaskType): TaskConfig {
  345:   if (taskType === TaskType.AGENCY_ADMIN_GENERAL_CHAT && isAdminChatStrategicEnabled()) {
  346:     return ADMIN_CHAT_STRATEGIC_CONFIG;
  347:   }
  348:   if (taskType === TaskType.AGENCY_ADMIN_GENERAL_CHAT && isAdminChatSchemaEnabled()) {
  349:     return ADMIN_CHAT_SCHEMA_CONFIG;
  350:   }
  351:   return TASK_REGISTRY[taskType];
  352: }
  353: 
  354: export function resolveTaskModel(taskType: TaskType, env?: "dev" | "prod") {
  355:   return resolveModelPolicy({ taskType, environment: env });
  356: }

=== src\ai\taskToModuleMap.ts ===
    1: /**
    2:  * Task to Brain Module Mapping
    3:  *
    4:  * Maps AI task types to the brain modules they require.
    5:  * Used by the Brain Resolver to load the correct context
    6:  * and detect missing required fields.
    7:  */
    8: 
    9: import { TaskType } from "./taskTypes.ts";
   10: import type { BrainModule } from "@/lib/ai/brainModules";
   11: 
   12: /**
   13:  * Module requirement for a task
   14:  */
   15: export interface ModuleRequirement {
   16:   /** The brain module */
   17:   module: BrainModule;
   18:   /** Whether this module is required (vs optional enhancement) */
   19:   required: boolean;
   20:   /** Specific field paths that must be populated (empty = module must exist) */
   21:   fieldPaths: string[];
   22: }
   23: 
   24: /**
   25:  * Task module mapping entry
   26:  */
   27: export interface TaskModuleMapping {
   28:   taskType: TaskType;
   29:   modules: ModuleRequirement[];
   30:   /** Description of what this task does */
   31:   description?: string;
   32: }
   33: 
   34: /**
   35:  * Task to brain module requirements mapping
   36:  *
   37:  * Each task specifies which brain modules it needs and which
   38:  * fields within those modules are required for the task to execute.
   39:  */
   40: export const TASK_MODULE_MAP: Record<TaskType, ModuleRequirement[]> = {
   41:   // General chat doesn't need brain context
   42:   [TaskType.CHAT_GENERAL]: [],
   43: 
   44:   // Admin onboarding - needs bootstrap for context
   45:   [TaskType.CHAT_ADMIN_ONBOARDING]: [
   46:     {
   47:       module: "bootstrap",
   48:       required: true,
   49:       fieldPaths: ["agency_name"],
   50:     },
   51:   ],
   52: 
   53:   // Guided setup V2 - needs bootstrap foundation
   54:   [TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2]: [
   55:     {
   56:       module: "bootstrap",
   57:       required: true,
   58:       fieldPaths: ["agency_name", "services"],
   59:     },
   60:   ],
   61: 
   62:   // Admin general chat - needs multiple modules for full context
   63:   [TaskType.AGENCY_ADMIN_GENERAL_CHAT]: [
   64:     {
   65:       module: "bootstrap",
   66:       required: true,
   67:       fieldPaths: ["agency_name", "services"],
   68:     },
   69:     {
   70:       module: "tone_voice",
   71:       required: false,
   72:       fieldPaths: [],
   73:     },
   74:     {
   75:       module: "rep_policy",
   76:       required: false,
   77:       fieldPaths: [],
   78:     },
   79:   ],
   80: 
   81:   // Setup extraction - minimal context needed
   82:   [TaskType.AGENCY_ADMIN_SETUP_EXTRACT]: [
   83:     {
   84:       module: "bootstrap",
   85:       required: false,
   86:       fieldPaths: [],
   87:     },
   88:   ],
   89: 
   90:   // Client portal QA - needs FAQ and policy
   91:   [TaskType.CLIENT_PORTAL_QA]: [
   92:     {
   93:       module: "faq_objections",
   94:       required: true,
   95:       fieldPaths: ["faqs"],
   96:     },
   97:     {
   98:       module: "rep_policy",
   99:       required: true,
  100:       fieldPaths: ["boundaries"],
  101:     },
  102:   ],
  103: 
  104:   // Summarize - no brain needed
  105:   [TaskType.SUMMARIZE]: [],
  106: 
  107:   // Extract structured - no brain needed
  108:   [TaskType.EXTRACT_STRUCTURED]: [],
  109: 
  110:   // Classify intent - no brain needed
  111:   [TaskType.CLASSIFY_INTENT]: [],
  112: 
  113:   // Strategy plan - needs full context
  114:   [TaskType.STRATEGY_PLAN]: [
  115:     {
  116:       module: "bootstrap",
  117:       required: true,
  118:       fieldPaths: ["agency_name", "services", "target_industries"],
  119:     },
  120:     {
  121:       module: "tone_voice",
  122:       required: true,
  123:       fieldPaths: ["voice_attributes"],
  124:     },
  125:     {
  126:       module: "sop_strategy",
  127:       required: true,
  128:       fieldPaths: ["content_pillars"],
  129:     },
  130:     {
  131:       module: "offer_stack",
  132:       required: false,
  133:       fieldPaths: [],
  134:     },
  135:   ],
  136: 
  137:   // Content ideas - needs voice and strategy
  138:   [TaskType.CONTENT_IDEAS]: [
  139:     {
  140:       module: "bootstrap",
  141:       required: true,
  142:       fieldPaths: ["services"],
  143:     },
  144:     {
  145:       module: "tone_voice",
  146:       required: true,
  147:       fieldPaths: ["voice_attributes"],
  148:     },
  149:     {
  150:       module: "sop_strategy",
  151:       required: false,
  152:       fieldPaths: ["content_pillars"],
  153:     },
  154:   ],
  155: 
  156:   // Script writing - needs detailed voice guidance
  157:   [TaskType.SCRIPT_WRITING]: [
  158:     {
  159:       module: "tone_voice",
  160:       required: true,
  161:       fieldPaths: ["voice_attributes", "vocabulary_preferences"],
  162:     },
  163:     {
  164:       module: "sop_scripting",
  165:       required: true,
  166:       fieldPaths: ["script_structures"],
  167:     },
  168:     {
  169:       module: "bootstrap",
  170:       required: false,
  171:       fieldPaths: [],
  172:     },
  173:   ],
  174: 
  175:   // Tool execution - minimal context
  176:   [TaskType.TOOL_EXECUTION]: [],
  177: 
  178:   // Embedding - no brain needed
  179:   [TaskType.EMBED_TEXT]: [],
  180: };
  181: 
  182: /**
  183:  * Get the required modules for a task type
  184:  */
  185: export function getTaskModules(taskType: TaskType): ModuleRequirement[] {
  186:   return TASK_MODULE_MAP[taskType] ?? [];
  187: }
  188: 
  189: /**
  190:  * Get only the required (non-optional) modules for a task
  191:  */
  192: export function getRequiredModules(taskType: TaskType): ModuleRequirement[] {
  193:   return getTaskModules(taskType).filter((m) => m.required);
  194: }
  195: 
  196: /**
  197:  * Check if a task requires any brain context
  198:  */
  199: export function taskRequiresBrain(taskType: TaskType): boolean {
  200:   const modules = getTaskModules(taskType);
  201:   return modules.some((m) => m.required);
  202: }
  203: 
  204: /**
  205:  * Get all unique modules required across multiple tasks
  206:  */
  207: export function getModulesForTasks(taskTypes: TaskType[]): BrainModule[] {
  208:   const moduleSet = new Set<BrainModule>();
  209:   for (const taskType of taskTypes) {
  210:     for (const req of getTaskModules(taskType)) {
  211:       moduleSet.add(req.module);
  212:     }
  213:   }
  214:   return Array.from(moduleSet);
  215: }
  216: 
  217: /**
  218:  * Get field paths required for a specific module and task
  219:  */
  220: export function getRequiredFieldPaths(
  221:   taskType: TaskType,
  222:   module: BrainModule
  223: ): string[] {
  224:   const moduleReq = getTaskModules(taskType).find((m) => m.module === module);
  225:   return moduleReq?.fieldPaths ?? [];
  226: }

=== src\ai\taskTypes.ts ===
    1: export enum TaskType {
    2:   CHAT_GENERAL = "CHAT_GENERAL",
    3:   CHAT_ADMIN_ONBOARDING = "CHAT_ADMIN_ONBOARDING",
    4:   AGENCY_ADMIN_SETUP_GUIDED_V2 = "AGENCY_ADMIN_SETUP_GUIDED_V2",
    5:   AGENCY_ADMIN_GENERAL_CHAT = "AGENCY_ADMIN_GENERAL_CHAT",
    6:   AGENCY_ADMIN_SETUP_EXTRACT = "AGENCY_ADMIN_SETUP_EXTRACT",
    7:   CLIENT_PORTAL_QA = "CLIENT_PORTAL_QA",
    8:   SUMMARIZE = "SUMMARIZE",
    9:   EXTRACT_STRUCTURED = "EXTRACT_STRUCTURED",
   10:   CLASSIFY_INTENT = "CLASSIFY_INTENT",
   11:   STRATEGY_PLAN = "STRATEGY_PLAN",
   12:   CONTENT_IDEAS = "CONTENT_IDEAS",
   13:   SCRIPT_WRITING = "SCRIPT_WRITING",
   14:   TOOL_EXECUTION = "TOOL_EXECUTION",
   15:   EMBED_TEXT = "EMBED_TEXT",
   16: }
   17: 
   18: export type TaskTypeKey = `${TaskType}`;

=== src\ai\toolSchemas.ts ===
    1: export enum ToolType {
    2:   CREATE_CLIENT = "create_client",
    3:   DRAFT_OFFER = "draft_offer",
    4:   UPDATE_BRAIN = "update_brain",
    5:   SCHEDULE_TASK = "schedule_task",
    6:   CREATE_PROJECT = "create_project",
    7:   UPDATE_PROJECT_STATUS = "update_project_status",
    8:   ASSIGN_PROJECT_ASSET = "assign_project_asset",
    9:   SCHEDULE_POST = "schedule_post",
   10:   UPDATE_TASK_STATUS = "update_task_status",
   11:   UPDATE_TASK_PRIORITY = "update_task_priority",
   12:   REQUEST_APPROVAL = "request_approval",
   13:   SEND_MESSAGE = "send_message",
   14: }
   15: 
   16: export type ToolSchema = {
   17:   type: ToolType;
   18:   description: string;
   19:   parameters: Record<string, { type: string; description: string; required: boolean }>;
   20:   returns?: string;
   21: };
   22: 
   23: export const TOOL_REGISTRY: Record<ToolType, ToolSchema> = {
   24:   [ToolType.CREATE_CLIENT]: {
   25:     type: ToolType.CREATE_CLIENT,
   26:     description: "Create a new client record in the CRM",
   27:     parameters: {
   28:       name: { type: "string", description: "Client company name", required: true },
   29:       website: { type: "string", description: "Client website URL", required: false },
   30:       niche: { type: "string", description: "Client industry/niche", required: false },
   31:     },
   32:     returns: "client_id",
   33:   },
   34:   [ToolType.DRAFT_OFFER]: {
   35:     type: ToolType.DRAFT_OFFER,
   36:     description: "Generate a service offer draft",
   37:     parameters: {
   38:       service_type: { type: "string", description: "Type of service", required: true },
   39:       pricing_range: { type: "string", description: "Price range", required: false },
   40:     },
   41:     returns: "offer_text",
   42:   },
   43:   [ToolType.UPDATE_BRAIN]: {
   44:     type: ToolType.UPDATE_BRAIN,
   45:     description: "Update a field in the agency brain",
   46:     parameters: {
   47:       field: { type: "string", description: "Dot path to update (e.g., setup_profile_v1.agency.niche)", required: true },
   48:       value: { type: "string", description: "New value to store", required: true },
   49:     },
   50:     returns: "brain_id",
   51:   },
   52:   [ToolType.SCHEDULE_TASK]: {
   53:     type: ToolType.SCHEDULE_TASK,
   54:     description: "Create a task reminder",
   55:     parameters: {
   56:       title: { type: "string", description: "Task title", required: true },
   57:       due_date: { type: "string", description: "Due date (ISO 8601)", required: true },
   58:       notes: { type: "string", description: "Additional notes", required: false },
   59:       client_id: { type: "string", description: "Client ID (defaults to most recent if omitted)", required: false },
   60:     },
   61:     returns: "task_id",
   62:   },
   63:   [ToolType.CREATE_PROJECT]: {
   64:     type: ToolType.CREATE_PROJECT,
   65:     description: "Create a new content project for a client",
   66:     parameters: {
   67:       title: { type: "string", description: "Project title", required: true },
   68:       client_id: { type: "string", description: "Client ID (UUID)", required: true },
   69:       description: { type: "string", description: "Project description", required: false },
   70:       platforms: { type: "string", description: "Comma-separated platforms (instagram,facebook,linkedin,tiktok,youtube)", required: false },
   71:     },
   72:     returns: "project_id",
   73:   },
   74:   [ToolType.UPDATE_PROJECT_STATUS]: {
   75:     type: ToolType.UPDATE_PROJECT_STATUS,
   76:     description: "Update project pipeline status",
   77:     parameters: {
   78:       project_id: { type: "string", description: "Project ID (UUID)", required: true },
   79:       status: { type: "string", description: "New status (idea|scripting|production|internal_review|client_review|approved|scheduled|published)", required: true },
   80:     },
   81:     returns: "project_id",
   82:   },
   83:   [ToolType.ASSIGN_PROJECT_ASSET]: {
   84:     type: ToolType.ASSIGN_PROJECT_ASSET,
   85:     description: "Link an asset to a project",
   86:     parameters: {
   87:       project_id: { type: "string", description: "Project ID (UUID)", required: true },
   88:       asset_id: { type: "string", description: "Asset ID (UUID)", required: true },
   89:       is_final_content: { type: "string", description: "Mark as final content (true/false)", required: false },
   90:     },
   91:     returns: "project_asset_id",
   92:   },
   93:   [ToolType.SCHEDULE_POST]: {
   94:     type: ToolType.SCHEDULE_POST,
   95:     description: "Schedule a project for publishing to a platform",
   96:     parameters: {
   97:       project_id: { type: "string", description: "Project ID (UUID)", required: true },
   98:       platform: { type: "string", description: "Platform (instagram|facebook|linkedin|tiktok|youtube)", required: true },
   99:       scheduled_for: { type: "string", description: "Scheduled datetime (ISO 8601)", required: true },
  100:       caption: { type: "string", description: "Post caption", required: false },
  101:       hashtags: { type: "string", description: "Hashtags (space-separated)", required: false },
  102:     },
  103:     returns: "scheduled_post_id",
  104:   },
  105:   [ToolType.UPDATE_TASK_STATUS]: {
  106:     type: ToolType.UPDATE_TASK_STATUS,
  107:     description: "Update task status",
  108:     parameters: {
  109:       task_id: { type: "string", description: "Task ID (UUID)", required: true },
  110:       status: { type: "string", description: "New status (todo|in_progress|completed|cancelled)", required: true },
  111:     },
  112:     returns: "task_id",
  113:   },
  114:   [ToolType.UPDATE_TASK_PRIORITY]: {
  115:     type: ToolType.UPDATE_TASK_PRIORITY,
  116:     description: "Update task priority level",
  117:     parameters: {
  118:       task_id: { type: "string", description: "Task ID (UUID)", required: true },
  119:       priority: { type: "string", description: "Priority (low|medium|high|urgent)", required: true },
  120:     },
  121:     returns: "task_id",
  122:   },
  123:   [ToolType.REQUEST_APPROVAL]: {
  124:     type: ToolType.REQUEST_APPROVAL,
  125:     description: "Create an approval request for an asset version",
  126:     parameters: {
  127:       asset_version_id: { type: "string", description: "Asset version ID (UUID)", required: true },
  128:       approver_id: { type: "string", description: "User ID of approver (UUID)", required: true },
  129:       comments: { type: "string", description: "Optional comment", required: false },
  130:     },
  131:     returns: "approval_task_id",
  132:   },
  133:   [ToolType.SEND_MESSAGE]: {
  134:     type: ToolType.SEND_MESSAGE,
  135:     description: "Send a message in a conversation",
  136:     parameters: {
  137:       conversation_id: { type: "string", description: "Conversation ID (UUID)", required: true },
  138:       body: { type: "string", description: "Message body", required: true },
  139:       related_project_id: { type: "string", description: "Related project ID (UUID)", required: false },
  140:     },
  141:     returns: "message_id",
  142:   },
  143: };

=== src\ai\utils.ts ===
    1: export function getEnvVar(key: string): string | undefined {
    2:   if (typeof Deno !== "undefined" && typeof Deno.env?.get === "function") {
    3:     return Deno.env.get(key) ?? undefined;
    4:   }
    5:   if (typeof process !== "undefined" && process.env) {
    6:     return process.env[key];
    7:   }
    8:   return undefined;
    9: }
   10: 
   11: export function nowMs() {
   12:   return Date.now();
   13: }

```

## Verification SQL/Commands
```bash
# Usage sites
rg -n "ai\\.run\\(" --type ts

# Task registry entry sanity check
rg -n "\\[TaskType\\.STRATEGY_PLAN\\]" src/ai/taskRegistry.ts -n

# Timeout configured for strategy
rg -n "case TaskType\\.STRATEGY_PLAN" -n src/ai/router.ts
```

## Problems Found
1. Router and edge functions can both write usage logs; without explicit `skipUsageLog`, some endpoints may double-log `ai_usage_logs` (cost/latency analytics noise).
2. Timeouts are task-type based, not endpoint based; long-running tasks share the same value unless a new task type is introduced or timeout mapping is updated.
3. `useBrainResolver` is present but not enabled by default; if the intended architecture is calibration-driven brain resolution, this is currently opt-in and not in effect for the default `ai` singleton.

## Recommendations
1. Standardize per-endpoint logging: decide whether router owns `ai_usage_logs` and edge functions own `ai_runs`, and consistently set `skipUsageLog` from edge functions to avoid duplicates.
2. Add a documented timeout policy per task type and confirm STRATEGY_PLAN is the only 180s task (or extend as needed).
3. If the brain resolver is intended for production, add an explicit env flag and enable `useBrainResolver` on the default `ai` instance under that flag, with audits/tests covering its behavior.

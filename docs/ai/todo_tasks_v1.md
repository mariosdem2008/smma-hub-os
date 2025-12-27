# AI Employee Task Backlog v1 (Codex-Ready)

## Task Format

Each task follows this structure:
- **TASK-ID**: AI-XXX (sequential)
- **Title**: Imperative verb + specific scope
- **Phase**: 1 (Days 1-3), 2 (Days 3-7), or 3 (Days 7-14)
- **Priority**: P0 (blocking), P1 (high), P2 (medium), P3 (nice-to-have)
- **Scope**: Tight, well-defined change
- **Files**: Expected files to modify/create
- **Steps**: Numbered implementation steps
- **Acceptance Criteria**: Numbered, testable outcomes
- **Risk Notes**: Key risks to watch during implementation
- **Rollback Notes**: How to undo if issues arise

---

## Phase 1: Logging Unification + Budget Correctness (Days 1-3)

### AI-001: Create Atomic Budget Operations Module
**Phase**: 1
**Priority**: P0
**Scope**: Create centralized budget enforcement helpers with atomic operations

**Files**:
- CREATE: `src/ai/budgets.ts`
- CREATE: `src/ai/budgets.test.ts`
- CREATE: `src/ai/pricing.ts`

**Steps**:
1. Create `src/ai/pricing.ts` with cost-per-token rates for all models:
   ```typescript
   export const PRICING = {
     'gpt-5-nano': { inputPerToken: 0.0000015, outputPerToken: 0.000006 },
     'gpt-5-mini': { inputPerToken: 0.0000025, outputPerToken: 0.00001 },
     'text-embedding-3-small': { inputPerToken: 0.00000002, outputPerToken: 0 }
   }
   ```

2. Create `src/ai/budgets.ts` with:
   - `checkBudget(supabase, agencyId, monthKey): Promise<BudgetCheckResult>`
     - SELECT FOR UPDATE to lock budget row
     - Return { allowed: boolean, budgetRow, remaining }
   - `incrementBudget(supabase, budgetId, costUsd): Promise<void>`
     - Atomic UPDATE: `SET spent_usd = spent_usd + $1`
   - `calculateCost(provider, model, tokensIn, tokensOut): number`
     - Lookup pricing from PRICING map
     - Return cost in USD

3. Add unit tests in `src/ai/budgets.test.ts`:
   - Test calculateCost for all model types
   - Test checkBudget with hard_stop enforcement
   - Test incrementBudget atomicity (mock concurrent calls)

**Acceptance Criteria**:
1. ✅ calculateCost returns accurate cost for gpt-5-nano, gpt-5-mini, text-embedding-3-small
2. ✅ checkBudget locks budget row with SELECT FOR UPDATE
3. ✅ checkBudget returns allowed=false when spent_usd >= budget_usd and hard_stop=true
4. ✅ incrementBudget uses atomic UPDATE (spent_usd = spent_usd + $1 pattern)
5. ✅ Unit tests pass with 100% coverage for budgets.ts

**Risk Notes**:
- PRICING rates must match actual OpenAI pricing (verify against docs)
- FOR UPDATE lock could cause contention under high load (monitor latency)

**Rollback Notes**:
- Delete budgets.ts module
- Revert to legacy budget checking (read-only)

---

### AI-002: Fix Budget Increment Bug in ai-ask
**Phase**: 1
**Priority**: P0
**Scope**: Replace broken budget increment with atomic incrementBudget call

**Files**:
- MODIFY: `supabase/functions/ai-ask/index.ts` (lines 450-460)
- MODIFY: `supabase/functions/_shared/budgets.ts` (create Deno-compatible version)

**Steps**:
1. Create `supabase/functions/_shared/budgets.ts` (Deno version of src/ai/budgets.ts):
   - Copy calculateCost and incrementBudget functions
   - Adapt imports for Deno (use npm: prefix for supabase-js)

2. In `supabase/functions/ai-ask/index.ts`, replace lines 450-460:
   ```typescript
   // REMOVE (broken):
   .update({ spent_usd: (budgetRow?.spent_usd ?? 0) })

   // ADD (atomic):
   import { incrementBudget, calculateCost } from '../_shared/budgets.ts'

   // After ai.run completes (line 395)
   const costUsd = calculateCost('openai', runtimeModel, tokensIn, tokensOut)

   // Increment budget atomically
   await incrementBudget(supabase, budgetRow.id, costUsd)
   ```

3. Update ai_runs insert to include cost_usd (line 153):
   ```typescript
   await supabase.from('ai_runs').insert({
     // ... existing fields
     cost_usd: costUsd, // ADD
   })
   ```

**Acceptance Criteria**:
1. ✅ Budget increment uses atomic UPDATE (verify SQL generated)
2. ✅ cost_usd calculated from actual token counts (not estimates)
3. ✅ ai_runs.cost_usd populated for all calls
4. ✅ Manual test: make 3 AI calls, verify spent_usd increases by sum of costs
5. ✅ No regression: existing ai-ask e2e tests pass

**Risk Notes**:
- Budget increment failure could block AI calls (add try/catch, log error but don't fail request)
- Cost calculation must handle missing token counts (fallback to conservative estimate)

**Rollback Notes**:
- Revert lines 450-460 to original code
- Keep budgets.ts for future use

---

### AI-003: Add Budget Enforcement Integration Test
**Phase**: 1
**Priority**: P1
**Scope**: Create integration test that verifies budget increment correctness

**Files**:
- CREATE: `tests/integration/ai/budget-enforcement.test.ts`

**Steps**:
1. Create test file with setup/teardown:
   - Create test agency with $10 budget
   - Seed test client and user

2. Add test cases:
   ```typescript
   test('ai-ask increments spent_usd correctly', async () => {
     const before = await getBudget(agencyId, monthKey)
     const response = await invokeAiAsk({ question: 'test query', agencyId, clientId })
     const after = await getBudget(agencyId, monthKey)

     expect(response.success).toBe(true)
     expect(after.spent_usd).toBeGreaterThan(before.spent_usd)
     expect(after.spent_usd - before.spent_usd).toBeCloseTo(expectedCost, 2) // within $0.01
   })

   test('ai-ask blocks calls when budget exceeded', async () => {
     // Set budget to $0.01, make expensive call
     await updateBudget(agencyId, { budget_usd: 0.01, hard_stop: true })
     const response = await invokeAiAsk({ question: 'very long question...', agencyId, clientId })

     expect(response.success).toBe(false)
     expect(response.error).toContain('budget')
   })

   test('concurrent calls do not bypass budget', async () => {
     // Make 10 parallel calls, verify total spent <= budget
     await updateBudget(agencyId, { budget_usd: 0.10, spent_usd: 0, hard_stop: true })

     const results = await Promise.allSettled([
       ...Array(10).fill(0).map(() => invokeAiAsk({ question: 'test', agencyId, clientId }))
     ])

     const after = await getBudget(agencyId, monthKey)
     expect(after.spent_usd).toBeLessThanOrEqual(0.10) // no overage
   })
   ```

**Acceptance Criteria**:
1. ✅ Budget increment test passes (delta matches expected cost)
2. ✅ Budget enforcement test passes (hard_stop blocks calls)
3. ✅ Concurrency test passes (no race condition allows overage)
4. ✅ Tests run in <30s total
5. ✅ Tests clean up resources (delete test agency/client/user)

**Risk Notes**:
- Concurrency test may be flaky (retry 3× if fails)
- Test API key costs real money (use test provider or mock)

**Rollback Notes**:
- Delete test file (no production impact)

---

### AI-004: Migrate generate-ai-content to Canonical Logging
**Phase**: 1
**Priority**: P1
**Scope**: Add ai_usage_logs and ai_runs writes to generate-ai-content (dual-write with legacy)

**Files**:
- MODIFY: `supabase/functions/generate-ai-content/index.ts` (lines 178-240)

**Steps**:
1. Import logging helpers at top of file:
   ```typescript
   import { logUsage } from '../../../src/ai/logging.ts'
   import { incrementBudget, calculateCost } from '../_shared/budgets.ts'
   ```

2. After ai.run completes (line 178), add canonical logging:
   ```typescript
   // Get runtime model from ai.run result
   const runtimeModel = result.meta?.model ?? 'gpt-5-mini'
   const tokensIn = result.usage?.inputTokens ?? Math.ceil(input_text.length / 3)
   const tokensOut = result.usage?.outputTokens ?? Math.ceil(JSON.stringify(result.output).length / 3)
   const costUsd = calculateCost('openai', runtimeModel, tokensIn, tokensOut)

   // Log to canonical tables
   await logUsage(supabase, {
     taskType: TaskType.CONTENT_IDEAS,
     endpoint: 'generate-ai-content',
     provider: 'openai',
     model: runtimeModel,
     agencyId: agency_id,
     clientId: client_id,
     latencyMs: Date.now() - startTime,
     tokensIn,
     tokensOut,
     unknown: false,
     success: true,
     errorCode: null
   })

   await supabase.from('ai_runs').insert({
     agency_id,
     client_id,
     user_id: user.id,
     model: runtimeModel,
     tokens_in: tokensIn,
     tokens_out: tokensOut,
     cost_usd: costUsd,
     latency_ms: Date.now() - startTime,
     success: true,
     unknown: false
   })

   // KEEP legacy writes during Phase 1 (lines 217, 233 - unchanged)
   ```

3. Add budget increment if budgets table exists for content gen:
   ```typescript
   // Optional: increment budget for content generation
   const monthKey = new Date().toISOString().slice(0, 7) // YYYY-MM
   const { data: budgetRow } = await supabase.from('ai_budgets')
     .select('id')
     .eq('agency_id', agency_id)
     .eq('month_yyyy_mm', monthKey)
     .maybeSingle()

   if (budgetRow) {
     await incrementBudget(supabase, budgetRow.id, costUsd)
   }
   ```

**Acceptance Criteria**:
1. ✅ generate-ai-content writes to ai_usage_logs with runtime model
2. ✅ generate-ai-content writes to ai_runs with cost_usd
3. ✅ Legacy tables (ai_history, ai_generation_usage) still receive writes
4. ✅ Manual test: generate content, verify dual logging in both table sets
5. ✅ Existing content generation e2e tests pass

**Risk Notes**:
- Dual logging doubles write load (monitor DB performance)
- If budget row doesn't exist, skip increment (don't block content gen)

**Rollback Notes**:
- Remove canonical logging writes (lines added in step 2)
- Keep legacy writes unchanged

---

### AI-005: Log Runtime Model in Router
**Phase**: 1
**Priority**: P2
**Scope**: Update router to log actual model from provider response (not policy default)

**Files**:
- MODIFY: `src/ai/router.ts` (lines 246, 384)
- MODIFY: `src/ai/providers/openai.ts` (lines 80-125, 280-315)

**Steps**:
1. Update OpenAI provider generate() to return model in metadata:
   ```typescript
   // In extractTextFromChatCompletions (line 10-12):
   function extractTextFromChatCompletions(json: any): { text: string, model?: string } {
     return {
       text: json?.choices?.[0]?.message?.content ?? "",
       model: json?.model // ADD: include model from response
     }
   }

   // In generate() (line 106):
   const result = extractTextFromChatCompletions(json)
   return {
     text: result.text,
     raw: json,
     usage: extractUsageFromChatCompletions(json),
     model: result.model ?? params.model // ADD: return actual model
   }
   ```

2. Update router run() to log runtime model:
   ```typescript
   // Line 246 (in logUsage call):
   model: result.meta?.model ?? modelConfig.model, // runtime model, fallback to policy
   ```

3. Update router runStream() to log runtime model:
   ```typescript
   // Line 384 (in logUsage call):
   model: result.meta?.model ?? modelConfig.model, // runtime model, fallback to policy
   ```

**Acceptance Criteria**:
1. ✅ OpenAI provider returns model in response metadata
2. ✅ Router logs runtime model to ai_usage_logs
3. ✅ Unit test: verify model matches OpenAI response (not policy default)
4. ✅ Manual test: call ai.run, verify logged model matches actual model used
5. ✅ No regression: all router tests pass

**Risk Notes**:
- Some providers may not return model in response (fallback to policy default)
- Model name may differ from policy model (e.g., gpt-5-mini-2025-01-01 vs gpt-5-mini)

**Rollback Notes**:
- Revert provider changes (remove model from extractText result)
- Revert router logging to use modelConfig.model

---

## Phase 2: Provider Timeouts/Retries + Embedding Hardening (Days 3-7)

### AI-006: Create Provider Timeout/Retry Utilities
**Phase**: 2
**Priority**: P0
**Scope**: Build fetchWithTimeout and fetchWithRetry utilities for provider reliability

**Files**:
- CREATE: `src/ai/providers/utils.ts`
- CREATE: `src/ai/providers/utils.test.ts`

**Steps**:
1. Create `src/ai/providers/utils.ts` with:
   ```typescript
   export async function fetchWithTimeout(
     url: string,
     options: RequestInit,
     timeout: number = 30000
   ): Promise<Response> {
     const controller = new AbortController()
     const timeoutId = setTimeout(() => controller.abort(), timeout)

     try {
       const response = await fetch(url, { ...options, signal: controller.signal })
       clearTimeout(timeoutId)
       return response
     } catch (err) {
       clearTimeout(timeoutId)
       if (err.name === 'AbortError') {
         throw new Error(`Request timed out after ${timeout}ms`)
       }
       throw err
     }
   }

   export async function fetchWithRetry(
     url: string,
     options: RequestInit,
     config: {
       retries: number,
       backoff: number[], // ms delays between retries
       timeout: number,
       shouldRetry?: (err: any) => boolean
     }
   ): Promise<Response> {
     let lastError: any

     for (let attempt = 0; attempt <= config.retries; attempt++) {
       try {
         return await fetchWithTimeout(url, options, config.timeout)
       } catch (err) {
         lastError = err
         if (attempt < config.retries && (!config.shouldRetry || config.shouldRetry(err))) {
           const delay = config.backoff[attempt] ?? config.backoff[config.backoff.length - 1]
           await new Promise(resolve => setTimeout(resolve, delay))
           continue
         }
         break
       }
     }

     throw lastError
   }
   ```

2. Add unit tests:
   - Test fetchWithTimeout aborts after timeout
   - Test fetchWithRetry retries 3 times on failure
   - Test fetchWithRetry exponential backoff delays
   - Test fetchWithRetry respects shouldRetry predicate

**Acceptance Criteria**:
1. ✅ fetchWithTimeout aborts request after specified timeout
2. ✅ fetchWithRetry retries correct number of times
3. ✅ fetchWithRetry waits correct delays between retries
4. ✅ fetchWithRetry throws after max retries exhausted
5. ✅ Unit tests pass with 100% coverage

**Risk Notes**:
- AbortController may not be supported in all environments (check polyfill)
- Retry backoff must include jitter to avoid thundering herd

**Rollback Notes**:
- Delete utils.ts module
- Revert to direct fetch calls

---

### AI-007: Add Timeouts/Retries to OpenAI Provider
**Phase**: 2
**Priority**: P0
**Scope**: Wrap OpenAI fetch calls in timeout/retry utilities

**Files**:
- MODIFY: `src/ai/providers/openai.ts` (lines 106, 147, 283, 316, 411)

**Steps**:
1. Import utilities at top of file:
   ```typescript
   import { fetchWithTimeout, fetchWithRetry } from './utils.ts'
   ```

2. Replace fetch in chat.completions (non-stream) with retry wrapper (line 106):
   ```typescript
   const response = await fetchWithRetry(url, {
     method: 'POST',
     headers,
     body: JSON.stringify(body)
   }, {
     retries: 3,
     backoff: [1000, 2000, 4000],
     timeout: 30000,
     shouldRetry: (err) => {
       // Retry on timeout, 503, or 429
       return err.message.includes('timed out') ||
              err.status === 503 ||
              err.status === 429
     }
   })
   ```

3. Replace fetch in responses (non-stream) with retry wrapper (line 147) - same pattern

4. Replace fetch in chat.completions (stream) with timeout only (line 283):
   ```typescript
   // Streaming: timeout but no retry
   const response = await fetchWithTimeout(url, {
     method: 'POST',
     headers,
     body: JSON.stringify(body)
   }, 30000)
   ```

5. Replace fetch in responses (stream) with timeout only (line 316) - same pattern

6. Replace fetch in embeddings with retry wrapper (line 411) - same as step 2

**Acceptance Criteria**:
1. ✅ All non-stream calls use fetchWithRetry
2. ✅ All stream calls use fetchWithTimeout
3. ✅ Retry config: 3 attempts, backoff [1s, 2s, 4s]
4. ✅ Timeout: 30s for all calls
5. ✅ Manual test: mock slow provider, verify timeout triggers
6. ✅ Manual test: mock 503 error, verify 3 retries happen
7. ✅ No regression: provider integration tests pass

**Risk Notes**:
- 30s timeout may be too short for complex prompts (make configurable per task in Phase 3)
- Retry on 429 (rate limit) may amplify costs (consider exponential backoff with jitter)

**Rollback Notes**:
- Revert fetch calls to original direct fetch()
- Remove utils.ts import

---

### AI-008: Add Timeouts/Retries to Anthropic Provider
**Phase**: 2
**Priority**: P2
**Scope**: Same timeout/retry pattern for Anthropic provider (unused but available)

**Files**:
- MODIFY: `src/ai/providers/anthropic.ts` (similar lines to OpenAI)

**Steps**:
1. Import utilities
2. Wrap all fetch calls in fetchWithRetry (non-stream) or fetchWithTimeout (stream)
3. Use same retry config as OpenAI (3 attempts, [1s, 2s, 4s])

**Acceptance Criteria**:
1. ✅ Anthropic provider follows same timeout/retry pattern as OpenAI
2. ✅ Integration tests pass (if any exist)

**Risk Notes**:
- Low risk (provider unused in production)

**Rollback Notes**:
- Revert fetch calls

---

### AI-009: Remove Zero-Vector Embedding Fallback
**Phase**: 2
**Priority**: P1
**Scope**: Fail hard when embedding API key missing or embedding fails

**Files**:
- MODIFY: `supabase/functions/ai-documents-ingest/index.ts` (lines 136-170)
- MODIFY: `supabase/functions/ai-brain-ingest/index.ts` (lines 239-280)
- MODIFY: `supabase/functions/ai-strategy-generate/index.ts` (lines 260-290)

**Steps**:
1. In `ai-documents-ingest/index.ts`, remove zero-vector fallback (line 136):
   ```typescript
   // REMOVE:
   const zeroVector = Array(DEFAULT_EMBEDDING_DIM).fill(0);
   const embeddingVector = embeddingApiKey
     ? await embedText(chunk.text, embeddingApiKey, embeddingModel)
     : zeroVector;

   // REPLACE WITH:
   if (!embeddingApiKey) {
     return jsonResponse({
       error: 'Document ingestion requires OPENAI_API_KEY environment variable to be configured',
       code: 'MISSING_API_KEY'
     }, 500, corsHeaders(req))
   }

   // This will throw if embedding fails
   const embeddingVector = await embedText(chunk.text, embeddingApiKey, embeddingModel)

   // Remove embedding_fallback from metadata (line 169)
   metadata: {
     similarity: "cosine",
     embedding_dim: DEFAULT_EMBEDDING_DIM,
     // embedding_fallback removed
   }
   ```

2. Apply same pattern to `ai-brain-ingest/index.ts` (line 239)

3. Apply same pattern to `ai-strategy-generate/index.ts` (line 260)

**Acceptance Criteria**:
1. ✅ Document ingestion returns 500 if OPENAI_API_KEY missing
2. ✅ Brain ingestion returns 500 if OPENAI_API_KEY missing
3. ✅ Strategy generation returns 500 if OPENAI_API_KEY missing
4. ✅ Manual test: unset API key, verify ingestion fails with clear error
5. ✅ Manual test: set API key, verify ingestion succeeds
6. ✅ Zero-vector embeddings count = 0 in staging after deployment

**Risk Notes**:
- Ingestion will fail on transient API errors (mitigated by retry logic in provider)
- Existing zero-vector embeddings need cleanup (see migration script in plan_v1.md)

**Rollback Notes**:
- Restore zero-vector fallback code
- Add back embedding_fallback metadata flag

---

### AI-010: Add Provider Reliability Integration Tests
**Phase**: 2
**Priority**: P1
**Scope**: Test timeout, retry, and embedding failure scenarios

**Files**:
- CREATE: `tests/integration/ai/provider-reliability.test.ts`

**Steps**:
1. Create test file with mock provider setup:
   ```typescript
   // Mock slow provider
   function mockSlowProvider(delay: number) {
     global.fetch = jest.fn(() =>
       new Promise(resolve => setTimeout(() => resolve(mockResponse), delay))
     )
   }

   // Mock error provider
   function mockErrorProvider(status: number, times: number) {
     let callCount = 0
     global.fetch = jest.fn(() => {
       callCount++
       if (callCount <= times) {
         return Promise.resolve({ status, ok: false })
       }
       return Promise.resolve(mockSuccessResponse)
     })
   }
   ```

2. Add test cases:
   ```typescript
   test('provider fetch times out after 30s', async () => {
     mockSlowProvider(35000)
     await expect(ai.run({ taskType: TaskType.CHAT_GENERAL, input: 'test' }))
       .rejects.toThrow('timed out after 30s')
   })

   test('provider retries 3 times on 503', async () => {
     mockErrorProvider(503, 2)
     const result = await ai.run({ taskType: TaskType.CHAT_GENERAL, input: 'test' })
     expect(global.fetch).toHaveBeenCalledTimes(3)
     expect(result.text).toBeTruthy()
   })

   test('provider fails after max retries', async () => {
     mockErrorProvider(503, 5)
     await expect(ai.run({ taskType: TaskType.CHAT_GENERAL, input: 'test' }))
       .rejects.toThrow()
     expect(global.fetch).toHaveBeenCalledTimes(4) // initial + 3 retries
   })

   test('embedding ingestion fails without API key', async () => {
     delete process.env.OPENAI_API_KEY
     await expect(invokeDocumentIngest({ file: testDoc }))
       .rejects.toThrow('requires OPENAI_API_KEY')
   })
   ```

**Acceptance Criteria**:
1. ✅ Timeout test passes (request aborted after 30s)
2. ✅ Retry test passes (3 attempts, then success)
3. ✅ Max retry test passes (fails after 4 total attempts)
4. ✅ Embedding failure test passes (500 error with clear message)
5. ✅ Tests run in <60s total

**Risk Notes**:
- Timeout test may take 30s to run (consider shorter timeout for test)
- Mock fetch may not match real fetch behavior (validate in staging)

**Rollback Notes**:
- Delete test file

---

## Phase 3: RAG Standardization + Citation Enforcement (Days 7-14)

### AI-011: Create RAG Policy Module
**Phase**: 3
**Priority**: P1
**Scope**: Centralize RAG retrieval config (top_k, doc_types, context limits)

**Files**:
- CREATE: `src/ai/ragPolicy.ts`
- CREATE: `src/ai/ragPolicy.test.ts`

**Steps**:
1. Create `src/ai/ragPolicy.ts` with:
   ```typescript
   import { TaskType } from './taskTypes.ts'

   export type RagConfig = {
     client_memory_top_k: number
     client_doc_types: string[]
     agency_memory_top_k: number
     agency_doc_types: string[]
     exemplar_top_k: number
     exemplar_doc_types: string[]
     max_context_chars: number
   }

   const DEFAULT_RAG_CONFIG: Record<TaskType, RagConfig> = {
     [TaskType.CLIENT_PORTAL_QA]: {
       client_memory_top_k: 6,
       client_doc_types: ['client_memory', 'onboarding_v3', 'strategy_plan'],
       agency_memory_top_k: 4,
       agency_doc_types: ['agency_memory', 'setup_progress_v1'],
       exemplar_top_k: 2,
       exemplar_doc_types: ['exemplar'],
       max_context_chars: 6000
     },
     [TaskType.STRATEGY_PLAN]: {
       client_memory_top_k: 8,
       client_doc_types: ['client_memory', 'onboarding_v3'],
       agency_memory_top_k: 6,
       agency_doc_types: ['agency_memory', 'exemplar'],
       exemplar_top_k: 0,
       exemplar_doc_types: [],
       max_context_chars: 8000
     },
     // ... other tasks
   }

   export function getRagConfig(taskType: TaskType): RagConfig {
     return DEFAULT_RAG_CONFIG[taskType] ?? {
       client_memory_top_k: 0,
       client_doc_types: [],
       agency_memory_top_k: 0,
       agency_doc_types: [],
       exemplar_top_k: 0,
       exemplar_doc_types: [],
       max_context_chars: 6000
     }
   }

   export function buildRagContext(
     matches: Array<{ chunk_text: string, similarity: number }>,
     config: RagConfig
   ): string {
     const chunks = matches
       .sort((a, b) => b.similarity - a.similarity)
       .map(m => m.chunk_text)
       .join('\n\n')

     if (chunks.length <= config.max_context_chars) {
       return chunks
     }

     return chunks.slice(0, config.max_context_chars) + '\n...(context truncated)'
   }
   ```

2. Add unit tests:
   - Test getRagConfig for each task type
   - Test buildRagContext truncation logic
   - Test buildRagContext sorting by similarity

**Acceptance Criteria**:
1. ✅ getRagConfig returns config for all supported task types
2. ✅ buildRagContext truncates to max_context_chars
3. ✅ buildRagContext sorts by similarity (highest first)
4. ✅ Unit tests pass with 100% coverage

**Risk Notes**:
- Config changes may affect answer quality (A/B test before deploying)
- max_context_chars must account for prompt overhead (leave room for instructions)

**Rollback Notes**:
- Delete ragPolicy.ts module
- Revert to hardcoded top_k values

---

### AI-012: Migrate ai-ask to Use RAG Policy
**Phase**: 3
**Priority**: P1
**Scope**: Replace hardcoded top_k and doc_types with centralized config

**Files**:
- MODIFY: `supabase/functions/ai-ask/index.ts` (lines 310-395)

**Steps**:
1. Import ragPolicy at top of file:
   ```typescript
   import { getRagConfig, buildRagContext } from '../../../src/ai/ragPolicy.ts'
   ```

2. Replace hardcoded constants (lines 12-14) with dynamic config:
   ```typescript
   // REMOVE:
   const CLIENT_MEMORY_TOP_K = 6;
   const AGENCY_MEMORY_TOP_K = 4;
   const EXEMPLAR_TOP_K = 2;

   // ADD (in request handler, line 310):
   const ragConfig = getRagConfig(TaskType.CLIENT_PORTAL_QA)
   ```

3. Update match_ai_embeddings calls to use config (lines 316-340):
   ```typescript
   const clientMatches = await supabase.rpc('match_ai_embeddings', {
     p_agency_id: agencyId,
     p_query_embedding: queryEmbedding,
     p_client_id: clientId,
     p_match_count: ragConfig.client_memory_top_k,
     p_doc_types: ragConfig.client_doc_types
   })

   const agencyMatches = await supabase.rpc('match_ai_embeddings', {
     p_agency_id: agencyId,
     p_query_embedding: queryEmbedding,
     p_client_id: null,
     p_match_count: ragConfig.agency_memory_top_k,
     p_doc_types: ragConfig.agency_doc_types
   })

   const exemplarMatches = await supabase.rpc('match_ai_embeddings', {
     p_agency_id: agencyId,
     p_query_embedding: queryEmbedding,
     p_client_id: null,
     p_match_count: ragConfig.exemplar_top_k,
     p_doc_types: ragConfig.exemplar_doc_types
   })
   ```

4. Use buildRagContext for context assembly (line 360):
   ```typescript
   const allMatches = [...clientMatches, ...agencyMatches, ...exemplarMatches]
   const context = buildRagContext(allMatches, ragConfig)
   ```

**Acceptance Criteria**:
1. ✅ ai-ask uses ragPolicy config (no hardcoded top_k)
2. ✅ Retrieved document count matches config
3. ✅ Context truncated to max_context_chars
4. ✅ Manual test: verify same answer quality as before migration
5. ✅ Integration test: verify retrieval count matches config

**Risk Notes**:
- Config mismatch could degrade answer quality (validate in staging first)
- Context truncation may cut off important information (monitor unknown rate)

**Rollback Notes**:
- Revert to hardcoded constants
- Remove ragPolicy import

---

### AI-013: Migrate ai-strategy-generate to Use RAG Policy
**Phase**: 3
**Priority**: P1
**Scope**: Same pattern as AI-012 for strategy generation endpoint

**Files**:
- MODIFY: `supabase/functions/ai-strategy-generate/index.ts` (lines 145-225)

**Steps**:
1. Same steps as AI-012, but for STRATEGY_PLAN task type

**Acceptance Criteria**:
1. ✅ ai-strategy-generate uses ragPolicy config
2. ✅ Manual test: verify strategy quality unchanged
3. ✅ Integration test: verify retrieval count matches config

**Risk Notes**:
- Strategy generation is high-value, high-risk change (A/B test)

**Rollback Notes**:
- Revert to hardcoded values

---

### AI-014: Add Explicit Freeform Flags to Task Registry
**Phase**: 3
**Priority**: P2
**Scope**: Mark SUMMARIZE and other legitimately freeform tasks with reason

**Files**:
- MODIFY: `src/ai/taskRegistry.ts` (lines 151-162)
- MODIFY: `src/ai/taskTypes.ts` (add freeformReason type)

**Steps**:
1. Add freeformReason field to TaskConfig type:
   ```typescript
   export type TaskConfig = {
     // ... existing fields
     freeformReason?: string // why this task uses freeform output
   }
   ```

2. Update SUMMARIZE task to include reason:
   ```typescript
   [TaskType.SUMMARIZE]: {
     taskType: TaskType.SUMMARIZE,
     outputMode: "freeform",
     freeformReason: "Report summarization produces narrative text for email/PDF rendering",
     // ... rest of config
   }
   ```

3. Update AGENCY_ADMIN_GENERAL_CHAT if staying freeform:
   ```typescript
   [TaskType.AGENCY_ADMIN_GENERAL_CHAT]: {
     taskType: TaskType.AGENCY_ADMIN_GENERAL_CHAT,
     outputMode: "freeform",
     freeformReason: "Admin chat uses conversational output with suggestion parsing",
     // ... rest of config
   }
   ```

**Acceptance Criteria**:
1. ✅ All freeform tasks have freeformReason field
2. ✅ Type safety: TaskConfig requires freeformReason when outputMode="freeform"
3. ✅ Lint rule: warn if freeform task missing reason
4. ✅ No regression: existing freeform tasks work unchanged

**Risk Notes**:
- Low risk (metadata change only)

**Rollback Notes**:
- Remove freeformReason field from TaskConfig

---

### AI-015: Migrate Admin Chat to Schema Output (Optional)
**Phase**: 3
**Priority**: P3
**Scope**: Convert admin chat from freeform to JSON schema (if UX testing passes)

**Files**:
- MODIFY: `supabase/functions/_shared/agency-admin-general-ai.ts` (lines 81-140)
- MODIFY: `src/ai/taskRegistry.ts` (lines 103-119)
- MODIFY: `src/ai/prompts/adminGeneralChat.ts`

**Steps**:
1. Update task registry to use schema:
   ```typescript
   [TaskType.AGENCY_ADMIN_GENERAL_CHAT]: {
     taskType: TaskType.AGENCY_ADMIN_GENERAL_CHAT,
     outputMode: "json_schema",
     safetyMode: "strict_unknown",
     schema: objectSchema("agency_admin_general_chat", [
       "assistant_message",
       "suggestions"
     ]),
     // ... rest of config
   }
   ```

2. Update prompt to request JSON output (add to system message):
   ```typescript
   Return JSON with:
   {
     "assistant_message": "your response here",
     "suggestions": ["suggestion 1", "suggestion 2"]
   }
   ```

3. Remove manual parsing in agency-admin-general-ai.ts:
   ```typescript
   // REMOVE:
   const lines = result.text.split('\n')
   const assistantMessage = lines.find(l => l.startsWith('ASSISTANT_MESSAGE:'))?.slice(18).trim()

   // REPLACE WITH:
   const { assistant_message, suggestions } = result.output
   ```

**Acceptance Criteria**:
1. ✅ Admin chat returns JSON schema output
2. ✅ UI parses output correctly
3. ✅ A/B test: schema vs freeform, no quality degradation
4. ✅ Manual test: complete agency setup with schema output
5. ✅ Rollout: 10% → 25% → 50% → 100% over 7 days

**Risk Notes**:
- High risk: UX change, test thoroughly before rollout
- Fallback: keep freeform parser as backup

**Rollback Notes**:
- Revert to freeform outputMode
- Restore manual parsing

---

### AI-016: Add RAG Correctness Integration Tests
**Phase**: 3
**Priority**: P1
**Scope**: Test RAG retrieval with centralized config

**Files**:
- CREATE: `tests/integration/ai/rag-correctness.test.ts`

**Steps**:
1. Create test file with sample data:
   - Seed test agency with agency_brain
   - Seed test client with client_brain
   - Seed ai_documents + ai_embeddings with known content

2. Add test cases:
   ```typescript
   test('ai-ask retrieves correct document count', async () => {
     const ragConfig = getRagConfig(TaskType.CLIENT_PORTAL_QA)
     const result = await invokeAiAsk({ question: 'test', agencyId, clientId })

     expect(result.sources.memory_citations.length).toBeLessThanOrEqual(
       ragConfig.client_memory_top_k + ragConfig.agency_memory_top_k + ragConfig.exemplar_top_k
     )
   })

   test('ai-ask includes citations in response', async () => {
     const result = await invokeAiAsk({ question: 'what is our brand name?', agencyId, clientId })

     expect(result.sources.client_brain_fields.length).toBeGreaterThan(0)
     expect(result.sources.memory_citations.length).toBeGreaterThan(0)
   })

   test('ai-ask truncates context to max_context_chars', async () => {
     // Seed large documents
     await seedLargeDocuments(agencyId, clientId, 20) // 20 large docs

     const result = await invokeAiAsk({ question: 'summarize everything', agencyId, clientId })
     const ragConfig = getRagConfig(TaskType.CLIENT_PORTAL_QA)

     // Verify context was truncated (check prompt size in logs)
     const contextSize = result.meta?.context_chars ?? 0
     expect(contextSize).toBeLessThanOrEqual(ragConfig.max_context_chars)
   })
   ```

**Acceptance Criteria**:
1. ✅ Retrieval count test passes
2. ✅ Citation test passes
3. ✅ Context truncation test passes
4. ✅ Tests run in <90s total

**Risk Notes**:
- Seeding embeddings is slow (consider cached test data)

**Rollback Notes**:
- Delete test file

---

### AI-017: Create RAG Observability Dashboard
**Phase**: 3
**Priority**: P2
**Scope**: Deploy Grafana/Superset dashboard for RAG quality metrics

**Files**:
- CREATE: `docs/ai/observability/dashboards/rag-quality.json`

**Steps**:
1. Create dashboard JSON with panels:
   - Average retrieval count per query
   - Top doc_types retrieved
   - Context truncation rate
   - Citation coverage rate (% of answers with citations)
   - Unknown response rate
   - Escalation rate

2. Add SQL queries for each panel:
   ```sql
   -- Average retrieval count
   SELECT
     DATE(created_at) as day,
     AVG((metadata->>'retrieval_count')::int) as avg_retrieval_count
   FROM ai_runs
   WHERE created_at > now() - interval '30 days'
     AND metadata->>'retrieval_count' IS NOT NULL
   GROUP BY DATE(created_at);

   -- Citation coverage
   SELECT
     DATE(created_at) as day,
     COUNT(*) as total_runs,
     COUNT(CASE WHEN citations IS NOT NULL AND jsonb_array_length(citations) > 0 THEN 1 END) as with_citations,
     (COUNT(CASE WHEN citations IS NOT NULL AND jsonb_array_length(citations) > 0 THEN 1 END)::float / COUNT(*) * 100) as coverage_pct
   FROM ai_runs
   WHERE created_at > now() - interval '30 days'
   GROUP BY DATE(created_at);
   ```

3. Deploy dashboard to Grafana/Superset

**Acceptance Criteria**:
1. ✅ Dashboard deployed and accessible
2. ✅ All panels render data
3. ✅ Queries run in <5s
4. ✅ Auto-refresh every 5min

**Risk Notes**:
- Dashboard queries may be slow on large datasets (add indexes if needed)

**Rollback Notes**:
- Delete dashboard

---

## Summary: 17 Tasks Across 3 Phases

### Phase 1 (Days 1-3): 5 tasks
- AI-001: Budget operations module (P0)
- AI-002: Fix budget bug in ai-ask (P0)
- AI-003: Budget integration tests (P1)
- AI-004: Migrate generate-ai-content logging (P1)
- AI-005: Log runtime model in router (P2)

### Phase 2 (Days 3-7): 5 tasks
- AI-006: Provider timeout/retry utilities (P0)
- AI-007: Add timeouts to OpenAI provider (P0)
- AI-008: Add timeouts to Anthropic provider (P2)
- AI-009: Remove zero-vector fallback (P1)
- AI-010: Provider reliability tests (P1)

### Phase 3 (Days 7-14): 7 tasks
- AI-011: RAG policy module (P1)
- AI-012: Migrate ai-ask to RAG policy (P1)
- AI-013: Migrate ai-strategy-generate to RAG policy (P1)
- AI-014: Add freeform flags to task registry (P2)
- AI-015: Migrate admin chat to schema (P3, optional)
- AI-016: RAG correctness integration tests (P1)
- AI-017: RAG observability dashboard (P2)

---

## Execution Order (Dependency-Aware)

### Day 1
1. AI-001 (budget module) ← blocking for AI-002
2. AI-002 (fix budget bug) ← depends on AI-001
3. AI-003 (budget tests) ← depends on AI-002

### Day 2
4. AI-004 (migrate generate-ai-content logging)
5. AI-005 (log runtime model)

### Day 3
6. AI-006 (timeout/retry utilities) ← blocking for AI-007/AI-008

### Day 4
7. AI-007 (OpenAI timeouts) ← depends on AI-006
8. AI-008 (Anthropic timeouts) ← depends on AI-006

### Day 5
9. AI-009 (remove zero-vector fallback) ← depends on AI-007 (retry mitigates transient errors)
10. AI-010 (provider reliability tests)

### Day 7
11. AI-011 (RAG policy module) ← blocking for AI-012/AI-013

### Day 9
12. AI-012 (ai-ask RAG migration) ← depends on AI-011
13. AI-013 (ai-strategy-generate RAG migration) ← depends on AI-011

### Day 11
14. AI-014 (freeform flags)
15. AI-016 (RAG tests) ← depends on AI-012/AI-013

### Day 13
16. AI-017 (RAG dashboard)
17. AI-015 (admin chat schema, optional) ← can run in parallel with dashboard

---

*Generated: 2025-12-26*
*Task backlog for AI Employee v1 Sprint 2*

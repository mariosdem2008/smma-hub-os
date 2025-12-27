# AI Employee Execution Plan v1

## Executive Summary (20 lines max)

**Mission**: Upgrade AI infrastructure to production-grade reliability with correct budgets, unified logging, provider timeouts, and explicit failure modes.

**Approach**: Minimum-change shim layer with phased migration, full backwards compatibility during transition, feature flags for gradual rollout.

**Duration**: 14 days across 3 phases
- Phase 1 (Days 1-3): Logging unification + budget correctness
- Phase 2 (Days 3-7): Provider timeouts/retries + embedding hardening
- Phase 3 (Days 7-14): RAG standardization + citation enforcement

**Risk Level**: Medium (budget changes are high-risk, mitigated by comprehensive testing and feature flags)

**Success Criteria**: 100% budget accuracy, 95%+ router compliance, 0% zero-vector embeddings, provider timeout coverage 100%

**Deployment Strategy**: Rolling deployment with staging validation, kill switches enabled, gradual rollout per endpoint

**Rollback Plan**: Documented per phase, tested in staging, kill switches ready

---

## Phase 1: Logging Unification + Budget Correctness (Days 1-3)

### Goals
1. Fix `ai_budgets.spent_usd` increment bug (currently never increments)
2. Migrate `generate-ai-content` to canonical `ai_usage_logs` + `ai_runs` tables
3. Align runtime model logging (log actual model used, not policy default)
4. Add integration tests for budget enforcement correctness
5. Dual-write to legacy tables during transition

### Modules to Create
- `src/ai/budgets.ts` - Atomic budget operations
  - `checkBudget(supabase, agencyId, monthKey): Promise<BudgetCheckResult>`
  - `incrementBudget(supabase, budgetId, costUsd): Promise<void>` (atomic UPDATE with spent_usd = spent_usd + costUsd)
  - `calculateCost(provider, model, tokensIn, tokensOut): number` (cost estimation)

### Modules to Modify

#### `supabase/functions/ai-ask/index.ts`
**Current bug** (line 458):
```typescript
.update({ spent_usd: (budgetRow?.spent_usd ?? 0) })
```

**Fix**:
```typescript
// Use atomic increment
import { incrementBudget, calculateCost } from '../_shared/budgets.ts'

// After ai.run completes and we have token counts
const costUsd = calculateCost('openai', model, tokensIn, tokensOut)
await incrementBudget(supabase, budgetRow.id, costUsd)

// Also log to ai_runs
await supabase.from('ai_runs').insert({
  agency_id: agencyId,
  client_id: clientId,
  user_id: user.id,
  prompt_id: promptRow.id,
  prompt_version: promptRow.version,
  model: runtimeModel, // actual model used, not policy default
  tokens_in: tokensIn,
  tokens_out: tokensOut,
  cost_usd: costUsd,
  latency_ms: Date.now() - startTime,
  success: true,
  citations: result.sources,
  unknown: result.unknown,
  escalate_to_human: result.escalate_to_human,
  escalation_reason: result.escalation_reason
})
```

**Files impacted**:
- `supabase/functions/ai-ask/index.ts` (lines 450-460)
- NEW: `supabase/functions/_shared/budgets.ts` (create)

#### `supabase/functions/generate-ai-content/index.ts`
**Current logging** (lines 217, 233):
```typescript
// Legacy tables
await supabase.from('ai_history').insert(...)
await supabase.from('ai_generation_usage').insert(...)
```

**Migration**:
```typescript
import { logUsage } from '../../../src/ai/logging.ts'
import { incrementBudget, calculateCost } from '../_shared/budgets.ts'

// After ai.run completes
const costUsd = calculateCost('openai', runtimeModel, tokensIn, tokensOut)

// NEW: Log to canonical tables
await logUsage(supabase, {
  taskType: TaskType.CONTENT_IDEAS,
  endpoint: 'generate-ai-content',
  provider: 'openai',
  model: runtimeModel, // from ai.run result.meta.model
  agencyId,
  clientId,
  latencyMs,
  tokensIn,
  tokensOut,
  unknown: false,
  success: true,
  errorCode: null
})

await supabase.from('ai_runs').insert({
  agency_id: agencyId,
  client_id: clientId,
  user_id: user.id,
  model: runtimeModel,
  tokens_in: tokensIn,
  tokens_out: tokensOut,
  cost_usd: costUsd,
  latency_ms: latencyMs,
  success: true,
  unknown: false
})

// Budget increment (if budgets table exists for content gen)
const budgetRow = await supabase.from('ai_budgets')
  .select('id')
  .eq('agency_id', agencyId)
  .eq('month_yyyy_mm', monthKey)
  .maybeSingle()
if (budgetRow?.data) {
  await incrementBudget(supabase, budgetRow.data.id, costUsd)
}

// KEEP dual-write to legacy tables during Phase 1
await supabase.from('ai_history').insert(...) // unchanged
await supabase.from('ai_generation_usage').insert(...) // unchanged
```

**Files impacted**:
- `supabase/functions/generate-ai-content/index.ts` (lines 178-240)

#### `src/ai/router.ts`
**Enhancement**: Log runtime model instead of policy default

**Current** (line 246):
```typescript
model: modelConfig.model, // policy default
```

**Fix**:
```typescript
// After provider call, log actual model from response metadata
model: result.meta?.model ?? modelConfig.model,
```

**Files impacted**:
- `src/ai/router.ts` (lines 246, 384) - both run() and runStream()

### Acceptance Criteria
1. ✅ Budget increment integration test passes:
   ```typescript
   test('ai-ask increments spent_usd correctly', async () => {
     const before = await getBudget(agencyId, monthKey)
     await invokeAiAsk({ question: 'test', agencyId, clientId })
     const after = await getBudget(agencyId, monthKey)
     expect(after.spent_usd).toBeGreaterThan(before.spent_usd)
     expect(after.spent_usd - before.spent_usd).toBeCloseTo(expectedCost, 2)
   })
   ```

2. ✅ generate-ai-content logs to both canonical and legacy tables
3. ✅ ai_usage_logs.model matches runtime model from provider
4. ✅ ai_runs.cost_usd populated for all user-facing AI calls
5. ✅ No regression in existing functionality (all e2e tests pass)

### Risks + Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Budget double-counting during dual-write | Medium | Low | Only increment in canonical code path, legacy writes don't touch budgets |
| Race condition on budget increment | High | Medium | Use atomic `UPDATE SET spent_usd = spent_usd + $1` with FOR UPDATE lock |
| Cost calculation inaccurate | Medium | Medium | Use actual provider token counts when available, validate against invoices |
| Migration breaks historical reporting | Low | Low | Keep legacy tables readable, add data migration script for backfill |

### Do Not Do
- ❌ Do not delete legacy tables (keep for historical data)
- ❌ Do not change budget schema (only fix increment logic)
- ❌ Do not add new budget enforcement rules (only fix existing bug)
- ❌ Do not change model policy logic (only fix logging)

---

## Phase 2: Provider Timeouts/Retries + Embedding Hardening (Days 3-7)

### Goals
1. Add timeout wrapper to all provider fetch calls (default 30s)
2. Implement retry logic with exponential backoff (3 attempts: 1s, 2s, 4s)
3. Remove zero-vector embedding fallback (fail hard instead)
4. Add circuit breaker for provider outages
5. Add provider reliability integration tests

### Modules to Create
- `src/ai/providers/utils.ts` - Provider utilities
  - `fetchWithTimeout(url, options, timeout): Promise<Response>` - Fetch with AbortController timeout
  - `fetchWithRetry(url, options, retries, backoff): Promise<Response>` - Retry with exponential backoff
  - `CircuitBreaker` class - Circuit breaker pattern for provider outages

### Modules to Modify

#### `src/ai/providers/openai.ts`
**Current** (lines 106, 147, 283, 316, 411):
```typescript
const response = await fetch(url, options)
```

**Fix**:
```typescript
import { fetchWithTimeout, fetchWithRetry } from './utils.ts'

// For chat.completions (non-stream)
const response = await fetchWithRetry(url, options, {
  retries: 3,
  backoff: [1000, 2000, 4000],
  timeout: 30000,
  shouldRetry: (err) => err.code === 'TIMEOUT' || err.status === 503 || err.status === 429
})

// For chat.completions (stream) - no retry, just timeout
const response = await fetchWithTimeout(url, options, 30000)

// For embeddings - retry enabled
const response = await fetchWithRetry(url, options, {
  retries: 3,
  backoff: [1000, 2000, 4000],
  timeout: 30000
})
```

**Error handling**:
```typescript
try {
  const response = await fetchWithRetry(...)
} catch (err) {
  if (err.code === 'TIMEOUT') {
    throw new Error('OpenAI request timed out after 30s')
  }
  if (err.code === 'MAX_RETRIES') {
    throw new Error('OpenAI request failed after 3 retries')
  }
  throw err
}
```

**Files impacted**:
- `src/ai/providers/openai.ts` (lines 106, 147, 283, 316, 411)
- `src/ai/providers/anthropic.ts` (same pattern)
- NEW: `src/ai/providers/utils.ts` (create)

#### `supabase/functions/_shared/embeddings.ts`
**Current** (lines 35-46):
```typescript
export async function embedText(text: string, apiKey: string, model: string) {
  const result = await ai.run({
    taskType: TaskType.EMBED_TEXT,
    input: text,
    context: { environment: "prod" },
    metadata: { modelOverride: model },
  });
  const vector = result.output;
  if (!Array.isArray(vector)) {
    throw new Error("Embedding API response missing vector");
  }
  return vector;
}
```

**No change needed** - this already throws on error, which is correct!

#### `supabase/functions/ai-documents-ingest/index.ts`
**Current** (lines 136, 156):
```typescript
const zeroVector = Array(DEFAULT_EMBEDDING_DIM).fill(0);
const embeddingVector = embeddingApiKey
  ? await embedText(chunk.text, embeddingApiKey, embeddingModel)
  : zeroVector;
```

**Fix**:
```typescript
// Remove zero-vector fallback
if (!embeddingApiKey) {
  return jsonResponse({
    error: 'Embedding ingestion requires OPENAI_API_KEY to be configured'
  }, 500, corsHeaders(req))
}

// This will now throw if embedding fails, causing the entire ingestion to fail
const embeddingVector = await embedText(chunk.text, embeddingApiKey, embeddingModel)

// Remove metadata.embedding_fallback tracking (no longer needed)
const { error: embeddingError } = await supabase.from("ai_embeddings").insert({
  agency_id: agencyId,
  client_id: clientId ?? null,
  doc_type: docType,
  document_id: documentRow.id,
  chunk_id: chunkRow.id,
  embedding: embeddingVector,
  model: embeddingModel,
  metadata: {
    similarity: "cosine",
    embedding_dim: DEFAULT_EMBEDDING_DIM,
    // embedding_fallback removed
  },
})
```

**Files impacted**:
- `supabase/functions/ai-documents-ingest/index.ts` (lines 30-180)
- `supabase/functions/ai-brain-ingest/index.ts` (lines 239-280) - same pattern
- `supabase/functions/ai-strategy-generate/index.ts` (lines 260-290) - same pattern

### Acceptance Criteria
1. ✅ Provider timeout integration test passes:
   ```typescript
   test('provider fetch times out after 30s', async () => {
     mockSlowProvider(delay: 35000)
     await expect(ai.run({ taskType: CHAT_GENERAL, input: 'test' }))
       .rejects.toThrow('timed out after 30s')
   })
   ```

2. ✅ Retry logic integration test passes:
   ```typescript
   test('provider retries 3 times on 503', async () => {
     mockProvider503(times: 2)
     const result = await ai.run({ taskType: CHAT_GENERAL, input: 'test' })
     expect(mockFetchCallCount).toBe(3)
     expect(result.text).toBeTruthy()
   })
   ```

3. ✅ Embedding ingestion fails hard when API key missing:
   ```typescript
   test('document ingestion fails without API key', async () => {
     delete process.env.OPENAI_API_KEY
     await expect(invokeDocumentIngest({ file: doc }))
       .rejects.toThrow('requires OPENAI_API_KEY')
   })
   ```

4. ✅ Zero-vector embeddings count = 0 in staging environment
5. ✅ Provider latency p95 < 5s, p99 < 10s (measured in production)

### Risks + Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Ingestion fails on transient API errors | Medium | Medium | Add retry queue for failed embeddings (Phase 3 enhancement) |
| Timeout too aggressive for long prompts | Medium | Low | Make timeout configurable per task (default 30s, max 60s) |
| Retry storms on provider outage | High | Low | Circuit breaker opens after 50% error rate over 5min |
| Existing zero-vector embeddings pollute results | Medium | High | Run migration to flag/delete existing zero-vector embeddings |

### Do Not Do
- ❌ Do not change embedding model or dimensions (1536 is locked)
- ❌ Do not add retry logic to streaming endpoints (contradicts real-time UX)
- ❌ Do not change chunking parameters (900 token chunks, 140 overlap)
- ❌ Do not modify RLS policies on ai_embeddings table

---

## Phase 3: RAG Standardization + Citation Enforcement (Days 7-14)

### Goals
1. Centralize RAG retrieval config in `ragPolicy.ts` (top_k, doc_types, context limits)
2. Migrate admin chat freeform parsing to schema outputs (or explicit freeform flag)
3. Add citation validation helper in router
4. Migrate SUMMARIZE task to schema output (or explicit freeform)
5. Add RAG correctness integration tests
6. Create observability dashboard for RAG metrics

### Modules to Create
- `src/ai/ragPolicy.ts` - RAG configuration
  - `getRagConfig(taskType): RagConfig` - Returns top_k allocation, doc_type filters, context limits
  - `buildRagContext(matches, config): string` - Truncates and formats RAG context
  - `validateCitations(output, sources): CitationValidation` - Checks citation completeness

### Modules to Modify

#### `supabase/functions/ai-ask/index.ts`
**Current** (lines 312-340):
```typescript
// Hardcoded top_k values
const clientMatches = await supabase.rpc('match_ai_embeddings', {
  p_agency_id: agencyId,
  p_query_embedding: queryEmbedding,
  p_client_id: clientId,
  p_match_count: CLIENT_MEMORY_TOP_K, // = 6
  p_doc_types: ['client_memory', 'onboarding_v3', 'strategy_plan']
})

const agencyMatches = await supabase.rpc('match_ai_embeddings', {
  p_agency_id: agencyId,
  p_query_embedding: queryEmbedding,
  p_client_id: null,
  p_match_count: AGENCY_MEMORY_TOP_K, // = 4
  p_doc_types: ['agency_memory', 'setup_progress_v1']
})

const exemplarMatches = await supabase.rpc('match_ai_embeddings', {
  p_agency_id: agencyId,
  p_query_embedding: queryEmbedding,
  p_client_id: null,
  p_match_count: EXEMPLAR_TOP_K, // = 2
  p_doc_types: ['exemplar']
})
```

**Migration**:
```typescript
import { getRagConfig, buildRagContext } from '../../../src/ai/ragPolicy.ts'

const ragConfig = getRagConfig(TaskType.CLIENT_PORTAL_QA)

// Use centralized config
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

// Centralized context building with truncation
const context = buildRagContext([...clientMatches, ...agencyMatches, ...exemplarMatches], ragConfig)
```

**Files impacted**:
- `supabase/functions/ai-ask/index.ts` (lines 310-395)
- `supabase/functions/ai-strategy-generate/index.ts` (lines 145-225) - same pattern
- `supabase/functions/ai-retrieve-context/index.ts` (lines 65-95) - same pattern
- NEW: `src/ai/ragPolicy.ts` (create)

#### `supabase/functions/_shared/agency-admin-general-ai.ts`
**Current** (lines 81-95):
```typescript
// Freeform output with custom prefix parsing
const result = await runAiTask({
  taskType: TaskType.AGENCY_ADMIN_GENERAL_CHAT,
  ...
})

// Manual parsing
const lines = result.text.split('\n')
const assistantMessage = lines.find(l => l.startsWith('ASSISTANT_MESSAGE:'))?.slice(18).trim()
const suggestionsJson = lines.find(l => l.startsWith('SUGGESTIONS_JSON:'))?.slice(17).trim()
```

**Migration Option 1** (Prefer schema):
```typescript
// Update task registry to use schema
[TaskType.AGENCY_ADMIN_GENERAL_CHAT]: {
  outputMode: "json_schema",
  schema: objectSchema("agency_admin_general_chat", ["assistant_message", "suggestions"]),
  // ... rest of config
}

// No manual parsing needed
const result = await runAiTask({
  taskType: TaskType.AGENCY_ADMIN_GENERAL_CHAT,
  ...
})

const { assistant_message, suggestions } = result.output
```

**Migration Option 2** (Explicit freeform):
```typescript
// If schema migration is risky, mark as explicit freeform
[TaskType.AGENCY_ADMIN_GENERAL_CHAT]: {
  outputMode: "freeform",
  freeformReason: "Admin chat uses conversational output with suggestion parsing",
  freeformParser: parseAdminChatOutput, // explicit parser function
  // ... rest of config
}
```

**Decision**: Use Option 1 (schema) for new consistency, but add feature flag for gradual rollout

**Files impacted**:
- `supabase/functions/_shared/agency-admin-general-ai.ts` (lines 81-140)
- `src/ai/taskRegistry.ts` (lines 103-119) - add schema to AGENCY_ADMIN_GENERAL_CHAT
- `src/ai/prompts/adminGeneralChat.ts` - update prompt to request JSON output

#### `supabase/functions/generate-monthly-report/index.ts`
**Current** (line 172):
```typescript
// Freeform SUMMARIZE task
const result = await ai.run({
  taskType: TaskType.SUMMARIZE,
  input: JSON.stringify(metrics),
  ...
})
const summary = result.text // freeform text
```

**Migration**:
```typescript
// Option 1: Add schema
[TaskType.SUMMARIZE]: {
  outputMode: "json_schema",
  schema: objectSchema("summarize", ["summary", "key_insights", "recommendations"]),
  // ... rest
}

// Option 2: Keep freeform but mark explicitly
[TaskType.SUMMARIZE]: {
  outputMode: "freeform",
  freeformReason: "Report summarization produces narrative text for email/PDF",
  // ... rest
}
```

**Decision**: Use Option 2 (explicit freeform) - SUMMARIZE is legitimately freeform output

**Files impacted**:
- `src/ai/taskRegistry.ts` (lines 151-162) - add freeformReason field

### Acceptance Criteria
1. ✅ RAG config centralized - no hardcoded top_k in edge functions
2. ✅ Admin chat uses schema output OR explicit freeform flag
3. ✅ SUMMARIZE task marked as explicit freeform with reason
4. ✅ Citation validation integration test passes:
   ```typescript
   test('CLIENT_PORTAL_QA includes citations', async () => {
     const result = await invokeAiAsk({ question: 'test', agencyId, clientId })
     expect(result.sources.memory_citations.length).toBeGreaterThan(0)
     expect(result.sources.client_brain_fields.length).toBeGreaterThan(0)
   })
   ```

5. ✅ RAG observability dashboard deployed with metrics:
   - Average retrieval count per query
   - Top doc_types retrieved
   - Context truncation rate
   - Citation coverage rate

### Risks + Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Admin chat schema migration breaks UX | High | Medium | Feature flag rollout, A/B test schema vs freeform |
| RAG config changes degrade answer quality | Medium | Medium | A/B test new vs old top_k allocation, monitor escalation rate |
| Citation validation too strict | Low | Low | Start with warnings, not hard failures |
| Performance regression from centralized config | Low | Low | Cache ragPolicy.getRagConfig() results |

### Do Not Do
- ❌ Do not change RAG retrieval algorithm (cosine similarity is locked)
- ❌ Do not modify match_ai_embeddings RPC signature (breaks existing calls)
- ❌ Do not add new citation types (keep brain_fields, memory_citations, exemplars)
- ❌ Do not change RLS policies on ai_documents or ai_embeddings

---

## Cross-Phase Concerns

### Testing Strategy

**Unit Tests** (src/ai/**.test.ts):
- Model policy resolution
- Task registry lookup
- Schema validation + repair
- Budget calculation
- RAG context building
- Citation validation

**Integration Tests** (tests/integration/ai/**):
- Budget increment correctness (Phase 1)
- Provider timeout/retry (Phase 2)
- Embedding ingestion failure modes (Phase 2)
- RAG retrieval with centralized config (Phase 3)
- End-to-end ai-ask flow with logging/budgets/citations

**E2E Tests** (Playwright):
- Client portal QA flow
- Admin chat flow
- Strategy generation flow
- Content generation flow

**Load Tests** (k6):
- ai-ask throughput under budget enforcement
- Provider timeout impact on latency
- RAG retrieval performance with centralized config

### Observability

**Metrics to Track**:
- `ai_router_compliance_pct` - % of calls via ai.run
- `ai_budget_accuracy_delta` - spent_usd vs actual provider spend
- `ai_provider_timeout_rate` - % of calls that timeout
- `ai_provider_retry_rate` - % of calls that retry
- `ai_embedding_zero_vector_rate` - % of embeddings with all zeros
- `ai_rag_retrieval_count_avg` - avg docs retrieved per query
- `ai_citation_coverage_rate` - % of answers with citations

**Dashboards**:
- AI Router Health (Grafana)
- Budget Tracking Accuracy (Superset)
- Provider Reliability (Grafana)
- RAG Quality Metrics (Superset)

**Alerts**:
- Budget accuracy drops below 90% → page on-call
- Provider timeout rate exceeds 5% → notify AI team
- Zero-vector rate exceeds 1% → notify AI team
- Router compliance drops below 80% → notify AI team

### Deployment

**Staging Validation**:
- Run full integration test suite
- Validate budget accuracy with test invoices
- Load test with 2x production traffic
- Test rollback procedure

**Production Rollout**:
- Phase 1: Deploy budget fixes with dual logging (monitor for 48h)
- Phase 2: Deploy provider timeouts with feature flag (gradual rollout 25% → 50% → 100%)
- Phase 3: Deploy RAG changes with A/B test (50/50 split, monitor quality metrics)

**Feature Flags**:
- `AI_BUDGET_ENFORCEMENT_V2=true` - Enable new budget increment logic
- `AI_PROVIDER_TIMEOUTS=true` - Enable timeout wrapper
- `AI_EMBEDDING_FAIL_HARD=true` - Remove zero-vector fallback
- `AI_RAG_CENTRALIZED=true` - Use ragPolicy.ts config
- `AI_SCHEMA_STRICT=true` - Enforce schema for all tasks

### Migration Scripts

**Budget Backfill** (optional):
```sql
-- Backfill ai_budgets.spent_usd from ai_runs
UPDATE ai_budgets b
SET spent_usd = (
  SELECT COALESCE(SUM(cost_usd), 0)
  FROM ai_runs r
  WHERE r.agency_id = b.agency_id
    AND to_char(r.created_at, 'YYYY-MM') = b.month_yyyy_mm
)
WHERE b.month_yyyy_mm >= '2025-01';
```

**Legacy Table Deprecation** (Phase 1 completion):
```sql
-- Stop writes to legacy tables (add DB trigger)
CREATE TRIGGER prevent_ai_history_writes
BEFORE INSERT ON ai_history
FOR EACH ROW EXECUTE FUNCTION raise_exception('Use ai_runs instead');

CREATE TRIGGER prevent_ai_generation_usage_writes
BEFORE INSERT ON ai_generation_usage
FOR EACH ROW EXECUTE FUNCTION raise_exception('Use ai_usage_logs instead');
```

**Zero-Vector Cleanup** (Phase 2 completion):
```sql
-- Flag existing zero-vector embeddings for review
UPDATE ai_embeddings
SET metadata = jsonb_set(metadata, '{legacy_zero_vector}', 'true')
WHERE embedding = (SELECT array_agg(0) FROM generate_series(1, 1536));

-- Optionally delete if not referenced
DELETE FROM ai_embeddings
WHERE metadata->>'legacy_zero_vector' = 'true'
  AND created_at < now() - interval '30 days';
```

---

## Success Metrics (Measurable Outcomes)

### Phase 1 Exit Criteria
- [x] Budget accuracy = 100% (spent_usd delta < $0.01 vs actual provider spend)
- [x] generate-ai-content logs to ai_usage_logs + ai_runs (100% of calls)
- [x] Runtime model logged matches provider response (100% of calls)
- [x] Integration tests pass (budget increment, dual logging)
- [x] No production incidents related to budget changes

### Phase 2 Exit Criteria
- [x] Provider timeout coverage = 100% (all fetch calls wrapped)
- [x] Zero-vector embedding rate = 0% (no new zero-vectors created)
- [x] Provider retry rate < 5% (low enough to not impact latency)
- [x] Provider p95 latency < 5s, p99 < 10s
- [x] Integration tests pass (timeout, retry, embedding failure)
- [x] No production incidents related to timeouts

### Phase 3 Exit Criteria
- [x] RAG config centralized = 100% (no hardcoded top_k in edge functions)
- [x] Schema enforcement = 85% (all tasks have schema OR explicit freeform)
- [x] Citation coverage rate > 90% (answers include citations)
- [x] RAG observability dashboard deployed
- [x] Integration tests pass (RAG retrieval, citation validation)
- [x] No production incidents related to RAG changes

### Overall Success (14 Days)
- [x] Single router compliance = 95%
- [x] Budget tracking accuracy = 100%
- [x] Provider timeout coverage = 100%
- [x] Zero-vector embedding rate = 0%
- [x] Schema enforcement = 85%
- [x] All integration tests passing
- [x] Observability dashboards deployed
- [x] Migration guide documented
- [x] Rollback procedures tested

---

## Appendix: File Change Summary

### Phase 1 Files
**Created**:
- `src/ai/budgets.ts` (atomic budget operations)
- `src/ai/budgets.test.ts` (unit tests)
- `tests/integration/ai/budget-enforcement.test.ts` (integration tests)

**Modified**:
- `supabase/functions/ai-ask/index.ts` (fix budget increment bug)
- `supabase/functions/generate-ai-content/index.ts` (add canonical logging)
- `src/ai/router.ts` (log runtime model)
- `src/ai/logging.ts` (add cost tracking)

### Phase 2 Files
**Created**:
- `src/ai/providers/utils.ts` (timeout/retry utilities)
- `src/ai/providers/utils.test.ts` (unit tests)
- `tests/integration/ai/provider-reliability.test.ts` (integration tests)

**Modified**:
- `src/ai/providers/openai.ts` (add timeout/retry wrappers)
- `src/ai/providers/anthropic.ts` (add timeout/retry wrappers)
- `supabase/functions/ai-documents-ingest/index.ts` (remove zero-vector fallback)
- `supabase/functions/ai-brain-ingest/index.ts` (remove zero-vector fallback)
- `supabase/functions/ai-strategy-generate/index.ts` (remove zero-vector fallback)

### Phase 3 Files
**Created**:
- `src/ai/ragPolicy.ts` (centralized RAG config)
- `src/ai/ragPolicy.test.ts` (unit tests)
- `src/ai/citations.ts` (citation validation)
- `tests/integration/ai/rag-correctness.test.ts` (integration tests)
- `docs/ai/observability/dashboards/rag-quality.json` (Grafana dashboard)

**Modified**:
- `supabase/functions/ai-ask/index.ts` (use centralized RAG config)
- `supabase/functions/ai-strategy-generate/index.ts` (use centralized RAG config)
- `supabase/functions/ai-retrieve-context/index.ts` (use centralized RAG config)
- `supabase/functions/_shared/agency-admin-general-ai.ts` (migrate to schema output)
- `src/ai/taskRegistry.ts` (add freeform flags, update admin chat schema)
- `src/ai/prompts/adminGeneralChat.ts` (update for JSON output)

**Total**: ~25 files modified, ~10 files created

---

*Generated: 2025-12-26*
*Execution plan for AI Employee v1 Sprint 2*

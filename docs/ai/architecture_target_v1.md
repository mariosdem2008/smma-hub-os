# AI Employee Architecture Target v1

## Executive Summary

**Current State**: 85% router compliance, dual logging systems, budget enforcement broken, silent embedding fallbacks
**Target State**: 95%+ router compliance, canonical logging, correct budget tracking, explicit failure modes
**Migration Strategy**: Minimum-change, backwards-compatible shim layer with phased deprecation

---

## The ONE TRUE PATH

Every AI interaction MUST flow through this pipeline:

```
UI Component
  ↓
Edge Function (entry point)
  ↓
ai.run() / ai.runStream() [src/ai/router.ts]
  ↓
Task Registry [src/ai/taskRegistry.ts]
  ↓
Model Policy [src/ai/modelPolicy.ts]
  ↓
Provider Adapter [src/ai/providers/*]
  ↓
Provider Fetch (with timeout/retry wrapper)
  ↓
Parse & Validate Response
  ↓
Log to ai_usage_logs + ai_runs
  ↓
Persist to DB (brains/documents/embeddings)
  ↓
Return Response
```

---

## Invariants (MUST be true post-migration)

### I1: Single Router Entrypoint
- ✅ All LLM calls use `ai.run()` or `ai.runStream()`
- ✅ No direct provider SDK usage outside `src/ai/providers/*`
- ✅ No manual model string construction in edge functions
- ✅ Model selection derived from Task Registry + Model Policy

**Enforcement**: Lint rule + code review checklist

### I2: Canonical Logging
- ✅ ALL AI operations log to `ai_usage_logs` (usage metrics)
- ✅ ALL user-facing AI operations log to `ai_runs` (audit trail with citations)
- ✅ Runtime model logged matches actual provider model used
- ✅ `spent_usd` correctly increments on every billable call

**Enforcement**: Integration tests + budget reconciliation queries

### I3: Explicit Output Contracts
- ✅ Every task defines output schema (Zod) OR explicitly marked "freeform" with documented reason
- ✅ Freeform outputs include parsing strategy in task config
- ✅ Schema validation failures trigger repair attempt, then UNKNOWN response

**Enforcement**: Task registry validation + type safety

### I4: Centralized Timeouts & Retries
- ✅ All provider fetch calls wrapped in timeout utility (default: 30s)
- ✅ Retry logic centralized in provider adapter layer
- ✅ Retry strategy: 3 attempts with exponential backoff (1s, 2s, 4s)
- ✅ Circuit breaker pattern for provider outages

**Enforcement**: Provider adapter tests + observability alerts

### I5: Budget Enforcement Correctness
- ✅ `ai_budgets.spent_usd` increments atomically on every call
- ✅ Budget checks use `SELECT FOR UPDATE` to prevent race conditions
- ✅ Cost calculation uses actual token counts from provider response
- ✅ Fallback cost estimate if provider doesn't return token counts

**Enforcement**: Unit tests + monthly reconciliation with provider invoices

### I6: RAG Retrieval Consistency
- ✅ All RAG queries use centralized `ragPolicy.ts` config
- ✅ top_k allocation: 6 client_memory, 4 agency_memory, 2 exemplars (configurable per task)
- ✅ Doc type filters explicit per task (no wildcards)
- ✅ Context truncation limits enforced (6000 chars default)

**Enforcement**: RAG integration tests + observability dashboards

### I7: Embedding Failure Handling
- ✅ Embedding ingestion FAILS HARD if provider returns error
- ✅ Zero-vector fallback REMOVED (or explicit opt-in per task with logging)
- ✅ Missing API key = ingestion endpoint returns 500 with clear error
- ✅ Retry queue for failed embeddings (optional Phase 3)

**Enforcement**: Integration tests + ingestion error monitoring

---

## Data Flow Diagrams

### Flow 1: Client Portal QA (RAG)
```
Client asks question in portal
  ↓
ui: AiRepChatTab invokes ai-rep-chat edge function
  ↓
edge: Check rate limits (ai_rate_limits)
  ↓
edge: Check budget (ai_budgets with FOR UPDATE)
  ↓
edge: Embed question → ai.run(EMBED_TEXT)
  ↓
edge: Retrieve context → match_ai_embeddings RPC
  ↓
edge: Generate answer → ai.run(CLIENT_PORTAL_QA)
  ↓
router: Resolve model via modelPolicy
  ↓
router: Build prompt with brains + RAG context
  ↓
provider: Call OpenAI with timeout wrapper
  ↓
router: Validate schema (client_portal_qa)
  ↓
router: Log to ai_usage_logs (tokens + latency)
  ↓
edge: Log to ai_runs (citations + cost)
  ↓
edge: Increment ai_budgets.spent_usd (atomic UPDATE)
  ↓
edge: Increment ai_rate_limits.used_count
  ↓
edge: Return answer + citations
```

**Critical Files**:
- Entry: `supabase/functions/ai-rep-chat/index.ts`
- Router: `src/ai/router.ts:131` (run method)
- Task: `src/ai/taskRegistry.ts:137` (CLIENT_PORTAL_QA)
- Provider: `src/ai/providers/openai.ts:90` (generate)
- Logging: `src/ai/logging.ts:22` (logUsage)
- RPC: `supabase/migrations/.../match_ai_embeddings`

### Flow 2: Document Ingestion (Embedding)
```
User uploads document
  ↓
edge: ai-documents-ingest
  ↓
edge: Extract text + metadata
  ↓
edge: Chunk document (900 token chunks, 140 overlap)
  ↓
edge: Insert ai_documents record
  ↓
FOR EACH chunk:
  edge: Insert ai_document_chunks record
  edge: Embed chunk → ai.run(EMBED_TEXT)
  router: Model policy resolves to text-embedding-3-small
  provider: Call OpenAI embeddings API (with timeout)
  provider: IF error → THROW (no zero-vector fallback)
  edge: Insert ai_embeddings record with vector
  edge: Log to ai_usage_logs
  ↓
edge: Return success
```

**Critical Files**:
- Entry: `supabase/functions/ai-documents-ingest/index.ts`
- Embedding: `supabase/functions/_shared/embeddings.ts:35` (embedText)
- Router: `src/ai/router.ts:187` (embedding path)
- Provider: `src/ai/providers/openai.ts:411` (embed)

### Flow 3: Strategy Generation (Multi-step AI)
```
Client requests strategy
  ↓
edge: ai-strategy-generate
  ↓
edge: Check client_brains.usable = true (gate)
  ↓
edge: Read agency_brains + client_brains
  ↓
edge: Embed query → ai.run(EMBED_TEXT)
  ↓
edge: Retrieve client context → match_ai_embeddings (client_memory, top_k=6)
  ↓
edge: Retrieve agency context → match_ai_embeddings (agency_memory, top_k=4)
  ↓
edge: Generate strategy → ai.run(STRATEGY_PLAN)
  router: Validate schema (strategy_plan)
  ↓
edge: Insert ai_documents (doc_type: strategy_plan)
  ↓
edge: Chunk strategy sections
  ↓
FOR EACH chunk:
  edge: Embed chunk → ai.run(EMBED_TEXT)
  edge: Insert ai_embeddings
  ↓
edge: Log to ai_usage_logs
  ↓
edge: Return strategy JSON
```

**Critical Files**:
- Entry: `supabase/functions/ai-strategy-generate/index.ts`
- Schema: `src/ai/taskRegistry.ts:186` (STRATEGY_PLAN)
- Brains: `src/ai/brains/agency.ts`, `src/ai/brains/client.ts`

---

## Module Ownership Map

| Module | Responsibility | Owned By | Critical Path |
|--------|---------------|----------|---------------|
| `src/ai/router.ts` | Central AI routing, context loading, logging orchestration | AI Core | YES |
| `src/ai/taskRegistry.ts` | Task configs, prompt builders, schemas | AI Core | YES |
| `src/ai/modelPolicy.ts` | Model selection by task/env/plan | AI Core | YES |
| `src/ai/providers/openai.ts` | OpenAI API adapter with timeout/retry | AI Providers | YES |
| `src/ai/providers/anthropic.ts` | Anthropic API adapter (unused but ready) | AI Providers | NO |
| `src/ai/logging.ts` | Canonical usage logging helper | AI Core | YES |
| `src/ai/brains/agency.ts` | Agency brain context loader | AI Brains | YES |
| `src/ai/brains/client.ts` | Client brain context loader | AI Brains | YES |
| `supabase/functions/_shared/embeddings.ts` | Chunking + embedding helper | Edge Shared | YES |
| `supabase/functions/_shared/ai-router.ts` | Edge function wrapper for ai.run | Edge Shared | YES |
| `supabase/functions/ai-ask/index.ts` | Client portal QA endpoint | Edge Functions | YES |
| `supabase/functions/ai-strategy-generate/index.ts` | Strategy generation endpoint | Edge Functions | YES |
| `supabase/functions/generate-ai-content/index.ts` | Content ideas endpoint (LEGACY) | Edge Functions | MIGRATE |

---

## Database Schema (AI-relevant tables)

### Brains & Memory
- `agency_brains` - Versioned agency brain JSON (RLS: agency_id)
- `client_brains` - Versioned client brain JSON with usable flag (RLS: agency_id + client_id)
- `ai_memory_items` - Lightweight memory items derived from brains (RLS: agency_id + client_id)

### Documents & RAG
- `ai_documents` - Source docs + generated artifacts (RLS: agency_id + client_id)
- `ai_document_chunks` - Chunked slices for vector search (RLS: via document_id FK)
- `ai_embeddings` - Vector embeddings (RLS: agency_id + client_id)
- **RPC**: `match_ai_embeddings(p_agency_id, p_query_embedding, p_client_id, p_match_count, p_doc_types)` - Similarity search

### Logging & Observability
- `ai_usage_logs` - **CANONICAL** usage logs (tokens, latency, endpoint, model)
- `ai_runs` - **CANONICAL** audit trail (prompt_id, cost_usd, citations, escalations)
- `ai_prompt_registry` - Prompt catalog with model pointers

### Budgets & Limits
- `ai_budgets` - Monthly AI budget tracking (spent_usd, budget_usd, hard_stop)
- `ai_rate_limits` - Daily per-user rate limiting (used_count, limit_per_day)
- `ai_escalations` - Escalations for failed/blocked AI requests

### Legacy (to be migrated)
- `ai_history` - Legacy audit log for generate-ai-content (→ migrate to ai_runs)
- `ai_generation_usage` - Legacy monthly usage counting (→ migrate to ai_usage_logs aggregates)

---

## Migration Strategy

### Phase 1: Logging & Attribution (Days 1-3)
**Goal**: Unify logging behind canonical tables, fix budget enforcement

**Changes**:
1. Fix `ai_budgets.spent_usd` increment bug in ai-ask
2. Add atomic budget increment helper in `src/ai/budgets.ts`
3. Migrate `generate-ai-content` to log to `ai_usage_logs` + `ai_runs`
4. Add runtime model logging to router (log actual model used, not policy default)
5. Add integration test for budget correctness

**Backwards Compatibility**:
- Keep writing to legacy tables during Phase 1
- Add migration script to backfill historical data (optional)

### Phase 2: Timeouts & Reliability (Days 3-7)
**Goal**: Harden provider calls, remove embedding zero-vector fallback

**Changes**:
1. Create `src/ai/providers/utils.ts` with `fetchWithTimeout(url, options, timeout=30000)`
2. Wrap all provider fetch calls in timeout utility
3. Add retry logic with exponential backoff
4. Remove zero-vector fallback in embeddings.ts (fail hard instead)
5. Add circuit breaker pattern for provider outages
6. Add provider timeout/retry integration tests

**Backwards Compatibility**:
- Graceful degradation: return UNKNOWN if provider times out
- Log timeout events to ai_usage_logs with error_code

### Phase 3: RAG & Citations (Days 7-14)
**Goal**: Standardize RAG retrieval, enforce citations, improve output contracts

**Changes**:
1. Create `src/ai/ragPolicy.ts` with centralized top_k/doc_type configs
2. Migrate admin chat freeform parsing to schema outputs (or explicit freeform flag)
3. Add citation validation helper in router
4. Migrate SUMMARIZE task to schema output (or explicit freeform)
5. Add RAG correctness integration tests
6. Create observability dashboard for RAG retrieval stats

**Backwards Compatibility**:
- Schema migration uses feature flag per task
- Old freeform parsing kept as fallback during transition

---

## Compliance Targets

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Single router compliance | 85% | 95% | % of LLM calls via ai.run |
| Canonical logging coverage | 70% | 100% | % of calls logging to ai_usage_logs |
| Budget tracking accuracy | 0% | 100% | spent_usd delta = actual provider spend |
| Provider timeout coverage | 0% | 100% | % of fetch calls with timeout wrapper |
| Schema enforcement | 60% | 85% | % of tasks with explicit schema or freeform flag |
| Zero-vector embedding rate | ~5% | 0% | % of embeddings with all-zero vectors |

**How to measure**:
```sql
-- Router compliance
SELECT
  endpoint,
  COUNT(*) as total_calls,
  COUNT(CASE WHEN model != 'manual' THEN 1 END) as router_calls,
  (COUNT(CASE WHEN model != 'manual' THEN 1 END)::float / COUNT(*)::float * 100) as compliance_pct
FROM ai_usage_logs
WHERE created_at > now() - interval '7 days'
GROUP BY endpoint;

-- Budget accuracy
SELECT
  month_yyyy_mm,
  spent_usd as tracked_spend,
  (SELECT SUM(cost_usd) FROM ai_runs WHERE date_trunc('month', created_at)::text = month_yyyy_mm) as actual_spend,
  ABS(spent_usd - (SELECT SUM(cost_usd) FROM ai_runs WHERE date_trunc('month', created_at)::text = month_yyyy_mm)) as delta
FROM ai_budgets
WHERE month_yyyy_mm = to_char(now(), 'YYYY-MM');

-- Zero-vector embeddings
SELECT
  doc_type,
  COUNT(*) as total_embeddings,
  COUNT(CASE WHEN metadata->>'embedding_fallback' = 'true' THEN 1 END) as zero_vectors,
  (COUNT(CASE WHEN metadata->>'embedding_fallback' = 'true' THEN 1 END)::float / COUNT(*)::float * 100) as fallback_pct
FROM ai_embeddings
WHERE created_at > now() - interval '30 days'
GROUP BY doc_type;
```

---

## Definition of Done (Minimum 12 items)

1. ✅ All LLM calls route through `ai.run()` or `ai.runStream()` (95%+ compliance)
2. ✅ `ai_budgets.spent_usd` increments correctly on every billable call (100% accuracy)
3. ✅ All AI operations log to `ai_usage_logs` with runtime model (100% coverage)
4. ✅ User-facing AI operations log to `ai_runs` with citations (100% coverage)
5. ✅ Legacy `ai_history` and `ai_generation_usage` tables deprecated (writes stopped)
6. ✅ All provider fetch calls wrapped in 30s timeout (100% coverage)
7. ✅ Retry logic with exponential backoff in all provider adapters (3 attempts max)
8. ✅ Zero-vector embedding fallback removed (fail hard on missing API key)
9. ✅ RAG retrieval uses centralized `ragPolicy.ts` config (100% compliance)
10. ✅ All tasks have explicit schema OR freeform flag with reason (85%+ compliance)
11. ✅ Integration tests pass for: budget enforcement, RAG retrieval, schema validation, provider timeouts
12. ✅ Observability dashboard deployed with: router compliance, budget accuracy, zero-vector rate, provider latency p50/p95/p99
13. ✅ Migration guide documented in `docs/ai/MIGRATION.md`
14. ✅ Rollback procedure tested and documented in risk register

---

## Rollback Plan

### Trigger Conditions
- Budget accuracy drops below 90%
- Router compliance drops below 80%
- Provider timeout rate exceeds 5%
- User-reported escalations increase 2x

### Rollback Steps
1. **Phase 1 Rollback**: Revert budget increment changes, continue dual logging
2. **Phase 2 Rollback**: Remove timeout wrapper, restore direct fetch calls
3. **Phase 3 Rollback**: Restore freeform parsing, disable schema enforcement

### Kill Switches
- `AI_ROUTER_BYPASS=true` env var to skip router validation
- `AI_BUDGET_ENFORCEMENT=false` env var to disable budget checks
- `AI_SCHEMA_STRICT=false` env var to allow freeform outputs without schema

**Testing**: All kill switches tested in staging before Phase 1 begins

---

## Open Questions / TODOs

1. **Cost estimation fallback**: If provider doesn't return token counts, use what formula? (chars/4 is crude)
2. **Retry strategy per provider**: Should Anthropic use same retry policy as OpenAI? (probably yes)
3. **Circuit breaker thresholds**: What % error rate triggers circuit open? (recommend 50% over 5min window)
4. **RAG doc_type wildcards**: Allow `["client_memory", "strategy_*"]` glob patterns? (Phase 3 decision)
5. **Prompt registry integration**: Should router check `ai_prompt_registry.model` vs `modelPolicy`? (conflict resolution needed)

**Action**: Add these to `docs/ai/spec_gaps.md` if not resolvable in planning phase

---

*Generated: 2025-12-26*
*Target architecture for AI Employee v1 Sprint 2*

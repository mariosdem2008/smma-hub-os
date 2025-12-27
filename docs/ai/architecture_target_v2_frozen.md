# AI Infrastructure Target Architecture v2 (FROZEN)

**Status**: FROZEN as of 2025-12-27
**Phase 1 Complete**: Atomic budgets + canonical logging + runtime model tracking
**Compatibility**: Minimum-change, backward-compatible migration to Phases 2/3

---

## 12 Non-Negotiable Invariants

### I1: Single Router Entrypoint (Router Supremacy)
**What**: All LLM/embedding calls MUST flow through `src/ai/router.ts` via `ai.run()` or `ai.runStream()`

**Why**: Centralized observability, model policy enforcement, cost tracking, safety checks

**How Enforced**:
- No direct provider SDK imports outside `src/ai/providers/*`
- Lint rule: `no-restricted-imports` for `openai`, `@anthropic-ai/sdk`
- Code review checklist item
- Integration tests verify all edge functions use router

**Phase 1 Status**: ✅ Implemented (85% compliance measured, target 95%+)

---

### I2: Atomic Budget Enforcement via RPC
**What**: Budget checks and increments MUST use `ai_budget_apply_delta` RPC with pre-reservation + post-reconciliation

**Why**: Prevents race conditions, ensures budget accuracy, enables cost estimation before execution

**How Enforced**:
- Pre-call: Reserve estimated cost via RPC with `reserve_only=true`
- Post-call: Reconcile to actual cost via RPC with `reserve_only=false`
- RPC uses `SELECT FOR UPDATE` lock to prevent concurrent violations
- Integration tests verify concurrency safety

**Phase 1 Status**: ✅ Implemented (ai-ask uses atomic RPC, migration 20251227090000)

**Contract**:
```sql
CREATE OR REPLACE FUNCTION ai_budget_apply_delta(
  p_agency_id uuid,
  p_month_key text,
  p_delta_usd numeric,
  p_reserve_only boolean DEFAULT false
) RETURNS jsonb
```

---

### I3: Canonical Logging (ai_usage_logs + ai_runs)
**What**: ALL AI operations MUST log to canonical tables, NOT legacy tables

**Why**: Single source of truth for observability, cost tracking, audit trail

**How Enforced**:
- `ai_usage_logs`: Technical metrics (tokens, latency, endpoint, model, error_code)
- `ai_runs`: Business audit trail (prompt_id, cost_usd, citations, escalations, runtime model)
- Dual-write during Phase 1 transition (legacy tables deprecated in Phase 2)
- Migration triggers prevent new writes to `ai_history`/`ai_generation_usage` after cutover

**Phase 1 Status**: ✅ Partially implemented (ai-ask logs to canonical, generate-ai-content dual-writes)

**Schema Requirements**:
- `ai_usage_logs.model` = runtime model from provider (NOT policy default)
- `ai_runs.cost_usd` = actual cost from token counts × pricing table
- `ai_runs.tokens_in/tokens_out` = provider-reported OR estimated with indicator
- Both tables require `agency_id` + `client_id` (nullable) for RLS

---

### I4: Runtime Model Attribution
**What**: Logged model MUST match actual provider-reported model, NOT policy default

**Why**: Accurate cost tracking, model drift detection, compliance with provider usage policies

**How Enforced**:
- Providers return `meta.model` in response (e.g., `gpt-5-mini-2025-01-01` not just `gpt-5-mini`)
- Router logs `result.meta?.model ?? modelConfig.model` with fallback
- Monthly reconciliation compares logged models with provider invoices
- Alert if model mismatch rate >5%

**Phase 1 Status**: ✅ Implemented (OpenAI provider returns runtime model, router logs it)

---

### I5: Cost Calculation from Actual Tokens
**What**: Cost MUST be calculated from provider-reported token counts when available

**Why**: Budget accuracy, avoid estimation drift, reconcile with provider invoices

**How Enforced**:
- Primary: Use `usage.inputTokens` + `usage.outputTokens` from provider response
- Fallback: Conservative estimate (`chars / 3`) with `cost_estimation_method` indicator
- Pricing table in `src/ai/pricing.ts` (NOT hardcoded)
- Monthly reconciliation query checks budget delta vs provider invoice

**Phase 1 Status**: ✅ Implemented (ai-ask uses actual tokens, pricing.ts created)

**Pricing Contract**:
```typescript
export const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-5-nano': { input: 0.0000015, output: 0.000006 },
  'gpt-5-mini': { input: 0.0000025, output: 0.00001 },
  'text-embedding-3-small': { input: 0.00000002, output: 0 }
}
```

---

### I6: Explicit Output Contracts (Schema OR Freeform Reason)
**What**: Every task MUST define Zod schema OR explicit `freeformReason` in task registry

**Why**: Type safety, validation consistency, prevents silent failures

**How Enforced**:
- Task registry type requires `schema` XOR `freeformReason`
- Schema tasks use `outputMode: "json_schema"` with Zod validation + repair
- Freeform tasks document parsing strategy in `freeformReason`
- Lint rule: error if task has neither schema nor freeform reason

**Phase 1 Status**: 🔲 Not implemented (target for Phase 3)

**Allowed Freeform Tasks** (exhaustive list):
- `SUMMARIZE`: "Narrative text for email/PDF rendering"
- `AGENCY_ADMIN_GENERAL_CHAT`: "Conversational output with suggestion parsing" (migrate to schema in Phase 3)

---

### I7: Provider Timeout Coverage (100%)
**What**: ALL provider fetch calls MUST use timeout wrapper (default 30s, configurable per task)

**Why**: Prevent hung requests, ensure predictable latency, graceful degradation

**How Enforced**:
- `fetchWithTimeout(url, options, timeout)` utility in `src/ai/providers/utils.ts`
- Non-stream calls: `fetchWithRetry` (3 attempts, exponential backoff)
- Stream calls: `fetchWithTimeout` only (no retry on streams)
- Integration tests verify timeout triggers at expected threshold

**Phase 1 Status**: 🔲 Not implemented (target for Phase 2)

**Timeout Policy**:
- EMBED_TEXT: 10s (fast)
- CHAT_GENERAL, CONTENT_IDEAS: 30s (default)
- STRATEGY_PLAN, CLIENT_PORTAL_QA: 60s (complex RAG)
- SUMMARIZE: 45s (moderate)

---

### I8: Retry Logic with Circuit Breaker
**What**: Retries MUST use exponential backoff + circuit breaker to prevent retry storms

**Why**: Graceful handling of transient errors, prevent cascading failures during provider outages

**How Enforced**:
- Retry strategy: 3 attempts, backoff `[1000ms, 2000ms, 4000ms]` with jitter
- Retry conditions: timeout, 503 (Service Unavailable), 429 (Rate Limit)
- Circuit breaker: open after 50% error rate over 5min, half-open test every 30s
- Alerts trigger when circuit opens

**Phase 1 Status**: 🔲 Not implemented (target for Phase 2)

**Circuit Breaker States**:
- Closed: Normal operation, allow all requests
- Open: Fail fast, return UNKNOWN without calling provider
- Half-Open: Allow 1 test request every 30s, close on success

---

### I9: Embedding Failure Hardening (No Zero-Vectors)
**What**: Embedding ingestion MUST fail hard on API errors, NEVER insert zero-vector fallbacks

**Why**: Zero-vectors pollute retrieval results, degrade RAG quality, silent failures hide infrastructure issues

**How Enforced**:
- Remove zero-vector fallback from ingestion endpoints
- Return HTTP 500 with clear error if `OPENAI_API_KEY` missing
- Retry logic (I8) mitigates transient errors
- Optional Phase 3: retry queue for failed chunks (async worker)

**Phase 1 Status**: 🔲 Not implemented (target for Phase 2)

**Migration Plan**:
- Delete existing zero-vector embeddings (flagged via metadata)
- Add DB constraint (optional): `CHECK (NOT (embedding = array_fill(0, ARRAY[1536])))`

---

### I10: RAG Retrieval Consistency (Centralized Policy)
**What**: RAG queries MUST use centralized `ragPolicy.ts` for top_k, doc_types, context limits

**Why**: Consistent retrieval behavior, easy tuning, A/B test config changes

**How Enforced**:
- All RAG endpoints import `getRagConfig(taskType)` and `buildRagContext(matches, config)`
- No hardcoded top_k or doc_type arrays in edge functions
- Config changes require A/B test validation before deployment
- Integration tests verify retrieval count matches policy

**Phase 1 Status**: 🔲 Not implemented (target for Phase 3)

**RAG Policy Contract**:
```typescript
type RagConfig = {
  client_memory_top_k: number
  client_doc_types: string[]
  agency_memory_top_k: number
  agency_doc_types: string[]
  exemplar_top_k: number
  exemplar_doc_types: string[]
  max_context_chars: number
}
```

**Default Allocation** (CLIENT_PORTAL_QA):
- Client memory: 6 docs (`['client_memory', 'onboarding_v3', 'strategy_plan']`)
- Agency memory: 4 docs (`['agency_memory', 'setup_progress_v1']`)
- Exemplars: 2 docs (`['exemplar']`)
- Max context: 6000 chars

---

### I11: Citation Requirements (Brain Fields + Memory Sources)
**What**: RAG answers MUST include citations with brain field provenance + memory chunk IDs

**Why**: Transparency, trust, compliance, debugging answer quality issues

**How Enforced**:
- Schema tasks require `sources` field in output schema
- `sources.client_brain_fields`: array of brain keys used (e.g., `["brand_name", "target_audience"]`)
- `sources.memory_citations`: array of `{ doc_id, chunk_id, doc_type, similarity }` from RAG retrieval
- Citation coverage metric: >90% of RAG answers include citations
- Alert if coverage drops below 80%

**Phase 1 Status**: ✅ Partially implemented (ai-ask schema includes sources, not enforced)

**Contract** (in output schema):
```typescript
sources: {
  client_brain_fields: string[]
  agency_brain_fields: string[]
  memory_citations: Array<{
    doc_id: string
    chunk_id: string
    doc_type: string
    similarity: number
  }>
  unknown: boolean
  escalate_to_human: boolean
  escalation_reason?: string
}
```

---

### I12: Brain Versioning (Immutable Snapshots)
**What**: Brain edits after initial lock MUST create new version, preserving full snapshot + diff

**Why**: Audit trail, rollback capability, memory coherence for concurrent sessions

**How Enforced**:
- `agency_brains.version` and `client_brains.version` increment on edits
- `agency_brains.usable` gates AI features (false = incomplete, true = locked)
- Edits to locked brain create v2 draft with `prev_version` reference
- Full brain JSON stored in `brain_data` (no diff reconstruction required)
- Optional: `brain_diff` JSONB column for compact storage

**Phase 1 Status**: ✅ Implemented (migrations 20251223150000)

**Versioning Rules**:
1. v1 creation: `usable=false`, editable
2. v1 lock: `usable=true`, edits blocked
3. v2 creation: copy v1 → v2 draft, `usable=false`, link to v1
4. v2 lock: `usable=true`, v1 remains readable

---

## Module Boundaries and Folder Layout

### Core Router Layer (`src/ai/`)
```
src/ai/
├── router.ts              # Central entrypoint: ai.run(), ai.runStream(), ai.embed()
├── taskRegistry.ts        # Task configs: prompts, schemas, model classes
├── modelPolicy.ts         # Model selection by task type + environment + plan tier
├── logging.ts             # Canonical logging helpers (ai_usage_logs writer)
├── budgets.ts             # Budget operations: checkBudget(), incrementBudget(), calculateCost()
├── pricing.ts             # Cost-per-token rates for all models
├── ragPolicy.ts           # RAG retrieval configs: top_k, doc_types, context limits (Phase 3)
├── citations.ts           # Citation validation helpers (Phase 3)
└── types.ts               # Shared types: TaskType, ModelClass, SafetyMode
```

**Responsibilities**:
- Router: context assembly, provider dispatch, validation, logging orchestration
- Task registry: prompt templates, output schemas, safety policies
- Model policy: environment-aware model selection (dev vs prod, plan-based gating)
- Budgets: atomic operations, cost estimation, reconciliation
- RAG policy: centralized retrieval configuration
- Citations: validation, provenance tracking

---

### Task Definitions (`src/ai/tasks/`)
```
src/ai/tasks/
├── clientPortalQA.ts      # CLIENT_PORTAL_QA task config + prompt builder
├── strategyPlan.ts        # STRATEGY_PLAN task config + prompt builder
├── contentIdeas.ts        # CONTENT_IDEAS task config + prompt builder
├── adminChat.ts           # AGENCY_ADMIN_GENERAL_CHAT task config
├── onboardingExtract.ts   # EXTRACT_STRUCTURED task config
└── summarize.ts           # SUMMARIZE task config (freeform)
```

**Responsibilities**:
- Task-specific prompt building logic
- Schema definitions (Zod)
- Context requirements (brain fields, RAG docs, metadata)
- Safety policy overrides

**Migration Note**: Phase 2/3 will extract task configs from monolithic `taskRegistry.ts` into individual task modules for maintainability.

---

### Provider Adapters (`src/ai/providers/`)
```
src/ai/providers/
├── types.ts               # Provider contracts: GenerateParams, GenerateResult, EmbedParams
├── utils.ts               # fetchWithTimeout(), fetchWithRetry(), CircuitBreaker (Phase 2)
├── openai.ts              # OpenAI adapter: generate(), generateStream(), embed()
└── anthropic.ts           # Anthropic adapter (available, unused by default)
```

**Responsibilities**:
- Translate router requests to provider API calls
- Handle streaming vs non-streaming responses
- Extract usage metadata (tokens, model, latency)
- Timeout/retry wrapping (Phase 2)
- Circuit breaker integration (Phase 2)

**Provider Contract**:
```typescript
interface Provider {
  generate(params: GenerateParams): Promise<GenerateResult>
  generateStream(params: GenerateParams): Promise<AsyncIterable<string>>
  embed(params: EmbedParams): Promise<number[]>
}

type GenerateResult = {
  text: string
  raw: any
  usage?: { inputTokens: number; outputTokens: number }
  model?: string  // runtime model from provider
}
```

---

### Logging Layer (`src/ai/logging/`)
```
src/ai/logging/
└── canonical.ts           # logUsage(), logRun() helpers for ai_usage_logs + ai_runs
```

**Responsibilities**:
- Write to `ai_usage_logs` with technical metrics
- Write to `ai_runs` with business audit trail
- Ensure runtime model attribution (I4)
- Ensure cost accuracy (I5)

**Contract**:
```typescript
async function logUsage(supabase: SupabaseClient, params: {
  taskType: TaskType
  endpoint: string
  provider: string
  model: string           // runtime model from provider
  agencyId: string
  clientId?: string
  latencyMs: number
  tokensIn: number
  tokensOut: number
  unknown: boolean
  success: boolean
  errorCode?: string
}): Promise<void>

async function logRun(supabase: SupabaseClient, params: {
  agencyId: string
  clientId?: string
  userId: string
  promptId?: string
  promptVersion?: number
  model: string           // runtime model
  tokensIn: number
  tokensOut: number
  costUsd: number
  latencyMs: number
  success: boolean
  citations?: any
  unknown: boolean
  escalateToHuman: boolean
  escalationReason?: string
}): Promise<void>
```

---

### Budget Layer (`src/ai/budgets/`)
```
src/ai/budgets/
└── operations.ts          # checkBudget(), incrementBudget(), calculateCost() (Phase 1)
```

**Responsibilities**:
- Pre-call budget reservation (estimate)
- Post-call budget reconciliation (actual)
- Atomic RPC invocation (`ai_budget_apply_delta`)
- Cost calculation from pricing table

**Contract**:
```typescript
async function checkBudget(
  supabase: SupabaseClient,
  agencyId: string,
  monthKey: string
): Promise<{ allowed: boolean; budgetRow: any; remaining: number }>

async function incrementBudget(
  supabase: SupabaseClient,
  budgetId: string,
  costUsd: number
): Promise<void>

function calculateCost(
  provider: string,
  model: string,
  tokensIn: number,
  tokensOut: number
): number
```

---

### Brain Context Loaders (`src/ai/brains/`)
```
src/ai/brains/
├── agency.ts              # loadAgencyBrain(), assembleAgencyContext()
└── client.ts              # loadClientBrain(), assembleClientContext()
```

**Responsibilities**:
- Load latest usable brain version
- Assemble context string for prompts
- Field selection (exclude internal notes for client portal)
- Memory limit enforcement (max 2000 chars per brain)

**Contract**:
```typescript
async function loadAgencyBrain(
  supabase: SupabaseClient,
  agencyId: string
): Promise<AgencyBrain | null>

function assembleAgencyContext(brain: AgencyBrain): string

async function loadClientBrain(
  supabase: SupabaseClient,
  agencyId: string,
  clientId: string
): Promise<ClientBrain | null>

function assembleClientContext(
  brain: ClientBrain,
  safetyMode: 'client_portal' | 'admin'
): string
```

---

### RAG Layer (`src/ai/rag/`)
```
src/ai/rag/
├── policy.ts              # getRagConfig(), buildRagContext() (Phase 3)
├── retrieval.ts           # retrieveContext() helper (Phase 3)
└── citations.ts           # extractCitations(), validateCitations() (Phase 3)
```

**Responsibilities**:
- Centralized RAG configuration
- Context assembly with truncation
- Citation extraction from retrieval results
- Citation validation against schema requirements

**Contract** (Phase 3):
```typescript
function getRagConfig(taskType: TaskType): RagConfig

function buildRagContext(
  matches: Array<{ chunk_text: string; similarity: number }>,
  config: RagConfig
): string

async function retrieveContext(
  supabase: SupabaseClient,
  agencyId: string,
  clientId: string | null,
  queryEmbedding: number[],
  config: RagConfig
): Promise<RagRetrievalResult>
```

---

### Edge Functions (`supabase/functions/`)
```
supabase/functions/
├── _shared/
│   ├── ai-router.ts       # runAiTask(), runAiTaskStream() wrappers
│   ├── budgets.ts         # Deno-compatible budget helpers
│   ├── embeddings.ts      # embedText() helper
│   └── ai-context.ts      # Agency snapshot builder for admin chat
├── ai-ask/                # Client portal QA (RAG + brains)
├── ai-strategy-generate/  # Strategy generation (RAG + brains + embedding output)
├── generate-ai-content/   # Content ideas (legacy, migrate in Phase 2)
├── ai-agency-admin-chat/  # Admin chat + guided setup
├── ai-brain-ingest/       # Embed brain summaries
├── ai-documents-ingest/   # Chunk + embed documents
├── ai-onboarding-guide/   # Onboarding option generation (EXTRACT_STRUCTURED)
├── ai-rep-chat/           # Client rep chat (RAG retrieval only)
└── generate-monthly-report/ # Monthly analytics summary
```

**Integration Points**:
- All edge functions use `runAiTask()` from `_shared/ai-router.ts`
- All edge functions use `embedText()` from `_shared/embeddings.ts`
- Budget enforcement in `ai-ask` (atomic RPC via `_shared/budgets.ts`)
- Canonical logging in all endpoints (via `src/ai/logging.ts` imported in Deno)

---

## One True Path Dataflows

### Flow 1: Admin Chat (Agency Admin → AI Assistant)
```
User types message in AgencyAiAdmin.tsx
  ↓
UI invokes supabase/functions/ai-agency-admin-chat
  ↓
Edge: Load thread history from agency_ai_chat_threads
  ↓
Edge: Build agency snapshot (brains + progress + stats) via ai-context.ts
  ↓
Edge: Call runAiTask(AGENCY_ADMIN_GENERAL_CHAT, { message, snapshot })
  ↓
_shared/ai-router.ts: Invoke src/ai/router.ts ai.run()
  ↓
Router: Load task config from taskRegistry (AGENCY_ADMIN_GENERAL_CHAT)
  ↓
Router: Load agency brain via src/ai/brains/agency.ts
  ↓
Router: Build prompt with brain context + snapshot + message
  ↓
Router: Resolve model via modelPolicy (gpt-5-nano dev, gpt-5-mini prod)
  ↓
Router: Call provider (OpenAI via src/ai/providers/openai.ts)
  ↓
Provider: fetch with timeout wrapper (Phase 2: 30s timeout + 3 retries)
  ↓
Provider: Return { text, usage: { inputTokens, outputTokens }, model: 'gpt-5-mini-2025-01-01' }
  ↓
Router: Validate output (freeform parsing for ASSISTANT_MESSAGE/SUGGESTIONS_JSON)
  ↓
Router: Calculate cost via src/ai/budgets.ts calculateCost()
  ↓
Router: Log to ai_usage_logs (model=runtime, tokens, latency, success=true)
  ↓
Edge: Log to ai_runs (model, cost_usd, prompt_id, citations=null, unknown=false)
  ↓
Edge: Insert agency_ai_chat_messages (thread_id, role='assistant', content)
  ↓
Edge: Return { assistant_message, suggestions } to UI
  ↓
UI: Render assistant response + suggestion chips
```

**Critical Paths**:
- [supabase/functions/ai-agency-admin-chat/index.ts](supabase/functions/ai-agency-admin-chat/index.ts)
- [supabase/functions/_shared/ai-router.ts](supabase/functions/_shared/ai-router.ts)
- [src/ai/router.ts:80](src/ai/router.ts#L80) (ai.run entry)
- [src/ai/taskRegistry.ts:103](src/ai/taskRegistry.ts#L103) (AGENCY_ADMIN_GENERAL_CHAT config)
- [src/ai/providers/openai.ts:106](src/ai/providers/openai.ts#L106) (generate call)

---

### Flow 2: Client Portal Assistant (RAG + Budget + Citations)
```
Client asks question in portal
  ↓
UI invokes supabase/functions/ai-ask
  ↓
Edge: Check rate limit (ai_rate_limits, daily per-user limit)
  ↓
Edge: Check budget via _shared/budgets.ts checkBudget()
  ↓
Budgets: Call ai_budget_apply_delta RPC (p_reserve_only=true, estimate=$0.02)
  ↓
RPC: SELECT FOR UPDATE ai_budgets, check spent_usd + $0.02 <= budget_usd
  ↓
RPC: Return { allowed: true, remaining: $48.00 }
  ↓
Edge: Embed question via embedText() → ai.run(EMBED_TEXT)
  ↓
Router: Call OpenAI embeddings API (text-embedding-3-small)
  ↓
Provider: Return vector[1536]
  ↓
Edge: Retrieve context via match_ai_embeddings RPC (3 calls: client, agency, exemplar)
  ↓
RPC (client): Cosine similarity search, top_k=6, filter by client_id + doc_types
  ↓
RPC (agency): Cosine similarity search, top_k=4, filter by agency_id + doc_types
  ↓
RPC (exemplar): Cosine similarity search, top_k=2, filter by doc_type='exemplar'
  ↓
Edge: Load client brain via loadClientBrain() (usable=true required)
  ↓
Edge: Load agency brain via loadAgencyBrain()
  ↓
Edge: Assemble prompt with brains + RAG context + question
  ↓
Edge: Call ai.run(CLIENT_PORTAL_QA, { question, context, brains })
  ↓
Router: Resolve model via modelPolicy (gpt-5-mini prod)
  ↓
Router: Call OpenAI with schema validation (client_portal_qa schema)
  ↓
Provider: Return { output: { answer, sources, unknown, escalate_to_human }, usage, model }
  ↓
Router: Validate schema, repair if needed
  ↓
Router: Calculate actual cost (tokensIn=1200, tokensOut=300, cost=$0.006)
  ↓
Router: Log to ai_usage_logs (model=runtime, tokens, cost, success=true)
  ↓
Edge: Log to ai_runs (prompt_id, cost_usd, citations, unknown, escalate_to_human)
  ↓
Edge: Reconcile budget via ai_budget_apply_delta RPC (p_reserve_only=false, actual=$0.006)
  ↓
RPC: UPDATE ai_budgets SET spent_usd = spent_usd + $0.006 WHERE ...
  ↓
Edge: Increment rate limit (ai_rate_limits.used_count += 1)
  ↓
Edge: Return { answer, sources, unknown, escalate_to_human } to UI
  ↓
UI: Render answer with citations
```

**Critical Paths**:
- [supabase/functions/ai-ask/index.ts](supabase/functions/ai-ask/index.ts)
- [supabase/functions/_shared/budgets.ts](supabase/functions/_shared/budgets.ts) (checkBudget, incrementBudget)
- [supabase/migrations/20251227090000_ai_budget_atomic_ops.sql](supabase/migrations/20251227090000_ai_budget_atomic_ops.sql) (RPC)
- [src/ai/router.ts:131](src/ai/router.ts#L131) (ai.run)
- [src/ai/taskRegistry.ts:137](src/ai/taskRegistry.ts#L137) (CLIENT_PORTAL_QA schema)

---

### Flow 3: RAG Retrieval + Answer Generation (Strategy Plan)
```
Client requests strategy in portal
  ↓
UI invokes supabase/functions/ai-strategy-generate
  ↓
Edge: Check client_brains.usable = true (gate: block if brain incomplete)
  ↓
Edge: Load client brain + agency brain
  ↓
Edge: Embed query "strategy plan context" via embedText()
  ↓
Edge: Retrieve client context via match_ai_embeddings (top_k=8, client_memory + onboarding_v3)
  ↓
Edge: Retrieve agency context via match_ai_embeddings (top_k=6, agency_memory + exemplars)
  ↓
Edge: Assemble prompt with brains + RAG context + strategy template
  ↓
Edge: Call ai.run(STRATEGY_PLAN, { context, brains })
  ↓
Router: Validate schema (strategy_plan: { sections: [], tactics: [] })
  ↓
Provider: Return strategy JSON
  ↓
Edge: Insert ai_documents (doc_type='strategy_plan', content=JSON)
  ↓
Edge: Chunk strategy sections (900 token chunks, 140 overlap)
  ↓
FOR EACH chunk:
  Edge: Insert ai_document_chunks
  Edge: Embed chunk via embedText()
  Edge: Insert ai_embeddings (vector, doc_id, chunk_id)
  ↓
Edge: Log to ai_usage_logs (multiple: 1 generation + N embeddings)
  ↓
Edge: Return strategy JSON to UI
  ↓
UI: Render strategy plan
```

**Critical Paths**:
- [supabase/functions/ai-strategy-generate/index.ts](supabase/functions/ai-strategy-generate/index.ts)
- [src/ai/taskRegistry.ts:186](src/ai/taskRegistry.ts#L186) (STRATEGY_PLAN schema)
- [supabase/functions/_shared/embeddings.ts](supabase/functions/_shared/embeddings.ts) (chunking + embedding loop)

---

## Contracts (Schemas)

### Router Request/Response Contract
```typescript
// ai.run() request
type RunRequest = {
  taskType: TaskType
  input: string | any
  context: {
    agencyId: string
    clientId?: string
    userId?: string
    environment: 'dev' | 'prod'
  }
  metadata?: {
    modelOverride?: string
    timeoutMs?: number
  }
}

// ai.run() response
type RunResponse = {
  output: any              // Parsed output (JSON schema OR freeform text)
  text: string             // Raw text response
  usage?: {
    inputTokens: number
    outputTokens: number
  }
  meta?: {
    model: string          // Runtime model from provider
    latencyMs: number
    cost: number
  }
}

// ai.runStream() response
type RunStreamResponse = AsyncIterable<string>
```

---

### Task Definition Contract
```typescript
type TaskConfig = {
  taskType: TaskType
  outputMode: 'json_schema' | 'freeform'
  schema?: z.ZodSchema      // Required if outputMode='json_schema'
  freeformReason?: string   // Required if outputMode='freeform'
  safetyMode: 'strict_unknown' | 'permissive' | 'creative'
  modelClass: 'cheap' | 'strong' | 'embedding'
  contextRequirements: {
    requireAgencyBrain: boolean
    requireClientBrain: boolean
    requireRagRetrieval: boolean
  }
  promptBuilder: (input: any, context: any) => string
}

// Example: CLIENT_PORTAL_QA
const CLIENT_PORTAL_QA: TaskConfig = {
  taskType: TaskType.CLIENT_PORTAL_QA,
  outputMode: 'json_schema',
  schema: clientPortalQaSchema,  // Zod schema
  safetyMode: 'strict_unknown',
  modelClass: 'strong',
  contextRequirements: {
    requireAgencyBrain: true,
    requireClientBrain: true,
    requireRagRetrieval: true
  },
  promptBuilder: buildClientPortalQaPrompt
}
```

---

### Log Event Shapes

#### ai_usage_logs (Technical Metrics)
```sql
CREATE TABLE ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  agency_id uuid NOT NULL REFERENCES agencies(id),
  client_id uuid REFERENCES clients(id),
  endpoint text NOT NULL,             -- 'ai-ask', 'ai-strategy-generate', etc.
  provider text NOT NULL,             -- 'openai', 'anthropic'
  model text NOT NULL,                -- Runtime model from provider
  task_type text,                     -- TaskType enum value
  latency_ms integer,
  tokens_in integer,
  tokens_out integer,
  cost_usd numeric(10,6),
  unknown boolean DEFAULT false,
  success boolean DEFAULT true,
  error_code text,                    -- 'TIMEOUT', 'RATE_LIMIT', 'BUDGET_EXCEEDED', etc.
  CONSTRAINT ai_usage_logs_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id),
  CONSTRAINT ai_usage_logs_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE INDEX ai_usage_logs_agency_id_idx ON ai_usage_logs(agency_id);
CREATE INDEX ai_usage_logs_created_at_idx ON ai_usage_logs(created_at);
CREATE INDEX ai_usage_logs_endpoint_idx ON ai_usage_logs(endpoint);
```

**Key Fields**:
- `model`: Runtime model from provider (NOT policy default)
- `tokens_in/tokens_out`: Provider-reported (NOT estimated, unless no usage returned)
- `cost_usd`: Calculated from pricing table (actual tokens × rates)
- `error_code`: Standardized error codes for observability

---

#### ai_runs (Business Audit Trail)
```sql
CREATE TABLE ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  agency_id uuid NOT NULL REFERENCES agencies(id),
  client_id uuid REFERENCES clients(id),
  user_id uuid REFERENCES auth.users(id),
  prompt_id uuid REFERENCES ai_prompt_registry(id),
  prompt_version integer,
  model text NOT NULL,                -- Runtime model
  tokens_in integer,
  tokens_out integer,
  cost_usd numeric(10,6),
  latency_ms integer,
  success boolean DEFAULT true,
  citations jsonb,                    -- { client_brain_fields, memory_citations, agency_brain_fields }
  unknown boolean DEFAULT false,
  escalate_to_human boolean DEFAULT false,
  escalation_reason text,
  metadata jsonb,                     -- Extensible for future fields
  CONSTRAINT ai_runs_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id),
  CONSTRAINT ai_runs_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT ai_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE INDEX ai_runs_agency_id_idx ON ai_runs(agency_id);
CREATE INDEX ai_runs_client_id_idx ON ai_runs(client_id);
CREATE INDEX ai_runs_created_at_idx ON ai_runs(created_at);
CREATE INDEX ai_runs_escalate_to_human_idx ON ai_runs(escalate_to_human) WHERE escalate_to_human = true;
```

**Key Fields**:
- `model`: Runtime model (matches ai_usage_logs.model)
- `citations`: Provenance tracking (brain fields + memory chunk IDs)
- `unknown`: AI explicitly returned "I don't know" response
- `escalate_to_human`: AI flagged for human review
- `metadata`: Extensible JSONB for cost estimation method, retrieval count, etc.

**Phase 1 Gap**: `metadata` field not yet added - cost estimation method indicator pending schema decision (spec_gaps.md #18)

---

### Budget Operations Contract
```sql
-- RPC for atomic budget check + increment
CREATE OR REPLACE FUNCTION ai_budget_apply_delta(
  p_agency_id uuid,
  p_month_key text,          -- 'YYYY-MM'
  p_delta_usd numeric,
  p_reserve_only boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_budget_row ai_budgets;
  v_allowed boolean;
BEGIN
  -- Lock budget row
  SELECT * INTO v_budget_row
  FROM ai_budgets
  WHERE agency_id = p_agency_id
    AND month_yyyy_mm = p_month_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'budget_not_found'
    );
  END IF;

  -- Check if budget allows delta
  v_allowed := (v_budget_row.spent_usd + p_delta_usd) <= v_budget_row.budget_usd
                OR NOT v_budget_row.hard_stop;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'budget_exceeded',
      'spent_usd', v_budget_row.spent_usd,
      'budget_usd', v_budget_row.budget_usd
    );
  END IF;

  -- If not reserve-only, apply increment
  IF NOT p_reserve_only THEN
    UPDATE ai_budgets
    SET spent_usd = spent_usd + p_delta_usd
    WHERE id = v_budget_row.id;
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'spent_usd', v_budget_row.spent_usd + (CASE WHEN p_reserve_only THEN 0 ELSE p_delta_usd END),
    'budget_usd', v_budget_row.budget_usd,
    'remaining', v_budget_row.budget_usd - (v_budget_row.spent_usd + p_delta_usd)
  );
END;
$$;
```

**Usage Pattern**:
1. Pre-call: `ai_budget_apply_delta(agency_id, '2025-12', 0.02, true)` → reserve estimate
2. Post-call: `ai_budget_apply_delta(agency_id, '2025-12', 0.006, false)` → reconcile to actual

---

## Brain Model

### Agency Brain Artifacts
**Schema** (`agency_brains.brain_data`):
```typescript
type AgencyBrain = {
  version: number
  usable: boolean
  created_at: string
  updated_at: string

  // Core identity
  brand_name: string
  brand_voice: string
  brand_values: string[]

  // Target market
  target_industries: string[]
  target_company_sizes: string[]
  ideal_client_profile: string

  // Service offering
  service_categories: string[]
  pricing_model: string
  typical_engagement_length: string

  // Internal notes (exclude from client portal)
  internal_notes?: string
  team_structure?: string

  // Setup progress (setup_progress_v1)
  setup_progress: {
    completed_steps: string[]
    missing_fields: string[]
    progress_percent: number
  }

  // Rep policy (rep_policy_v1)
  rep_policy: {
    response_tone: string
    approved_topics: string[]
    restricted_topics: string[]
    escalation_triggers: string[]
  }

  // FAQ (faq_v1)
  faqs: Array<{
    question: string
    answer: string
    category: string
  }>
}
```

**Memory Assembly**:
```typescript
function assembleAgencyContext(brain: AgencyBrain, safetyMode: 'admin' | 'client_portal'): string {
  const fields = [
    `Brand: ${brain.brand_name}`,
    `Voice: ${brain.brand_voice}`,
    `Values: ${brain.brand_values.join(', ')}`,
    `Industries: ${brain.target_industries.join(', ')}`,
    `Services: ${brain.service_categories.join(', ')}`,
  ]

  if (safetyMode === 'admin') {
    // Include internal notes for admin
    if (brain.internal_notes) fields.push(`Internal Notes: ${brain.internal_notes}`)
  }

  // Add FAQs (top 5 most relevant, max 500 chars)
  const faqText = brain.faqs.slice(0, 5)
    .map(faq => `Q: ${faq.question}\nA: ${faq.answer}`)
    .join('\n\n')
  fields.push(`FAQs:\n${faqText}`)

  const context = fields.join('\n')

  // Limit to 2000 chars
  return context.length > 2000 ? context.slice(0, 2000) + '...(truncated)' : context
}
```

---

### Client Brain Artifacts
**Schema** (`client_brains.brain_data`):
```typescript
type ClientBrain = {
  version: number
  usable: boolean
  created_at: string
  updated_at: string

  // Client identity
  client_name: string
  industry: string
  company_size: string
  website?: string

  // Goals & audience
  primary_goals: string[]
  target_audience: string
  key_differentiators: string[]

  // Brand
  brand_voice?: string
  brand_colors?: string[]
  logo_url?: string

  // Platforms (TODO: dedicated field per spec_gaps.md #4)
  platforms?: string[]

  // Onboarding v3 data
  onboarding_answers: Record<string, any>

  // Internal notes (exclude from client portal)
  internal_notes?: string
  account_health?: string
}
```

**Memory Assembly**:
```typescript
function assembleClientContext(brain: ClientBrain, safetyMode: 'admin' | 'client_portal'): string {
  const fields = [
    `Client: ${brain.client_name}`,
    `Industry: ${brain.industry}`,
    `Goals: ${brain.primary_goals.join(', ')}`,
    `Audience: ${brain.target_audience}`,
    `Differentiators: ${brain.key_differentiators.join(', ')}`,
  ]

  if (brain.brand_voice) fields.push(`Voice: ${brain.brand_voice}`)

  if (safetyMode === 'admin') {
    // Include internal notes for admin
    if (brain.internal_notes) fields.push(`Internal Notes: ${brain.internal_notes}`)
    if (brain.account_health) fields.push(`Account Health: ${brain.account_health}`)
  }

  const context = fields.join('\n')

  // Limit to 2000 chars
  return context.length > 2000 ? context.slice(0, 2000) + '...(truncated)' : context
}
```

---

### Memory Assembly Order + Limits
**Priority Order** (for context assembly):
1. **Brain fields** (agency + client): 2000 chars each (4000 total)
2. **RAG memory citations** (retrieved docs): 6000 chars (configurable via ragPolicy)
3. **Current conversation** (recent messages): Remaining context budget

**Total Context Limit** (model-dependent):
- gpt-5-nano: 128k tokens (~384k chars) → budget 12k chars for context
- gpt-5-mini: 128k tokens (~384k chars) → budget 12k chars for context
- text-embedding-3-small: 8k tokens → budget 24k chars for input

**Assembly Logic**:
```typescript
function assemblePromptContext(params: {
  taskConfig: TaskConfig
  agencyBrain: AgencyBrain | null
  clientBrain: ClientBrain | null
  ragMatches: RagMatch[]
  conversationHistory: Message[]
  safetyMode: 'admin' | 'client_portal'
}): string {
  const parts: string[] = []

  // 1. Agency brain (if required, 2000 char limit)
  if (params.taskConfig.contextRequirements.requireAgencyBrain && params.agencyBrain) {
    parts.push(assembleAgencyContext(params.agencyBrain, params.safetyMode))
  }

  // 2. Client brain (if required, 2000 char limit)
  if (params.taskConfig.contextRequirements.requireClientBrain && params.clientBrain) {
    parts.push(assembleClientContext(params.clientBrain, params.safetyMode))
  }

  // 3. RAG retrieval (if required, configurable limit via ragPolicy)
  if (params.taskConfig.contextRequirements.requireRagRetrieval && params.ragMatches.length > 0) {
    const ragConfig = getRagConfig(params.taskConfig.taskType)
    parts.push(buildRagContext(params.ragMatches, ragConfig))
  }

  // 4. Conversation history (remaining budget, max 2000 chars)
  const conversationText = params.conversationHistory
    .map(msg => `${msg.role}: ${msg.content}`)
    .join('\n')
  if (conversationText.length > 0) {
    parts.push(conversationText.slice(0, 2000))
  }

  return parts.join('\n\n---\n\n')
}
```

---

### Citations Requirement
**Rule**: RAG answers MUST cite sources

**Schema Enforcement**:
```typescript
const clientPortalQaSchema = z.object({
  answer: z.string(),
  sources: z.object({
    client_brain_fields: z.array(z.string()),  // ['brand_name', 'target_audience']
    agency_brain_fields: z.array(z.string()),  // ['rep_policy', 'faq_v1']
    memory_citations: z.array(z.object({
      doc_id: z.string(),
      chunk_id: z.string(),
      doc_type: z.string(),              // 'client_memory', 'strategy_plan', etc.
      similarity: z.number()
    })),
    unknown: z.boolean(),
    escalate_to_human: z.boolean(),
    escalation_reason: z.string().optional()
  })
})
```

**Validation** (Phase 3):
```typescript
function validateCitations(output: any, ragMatches: RagMatch[]): CitationValidation {
  const errors: string[] = []

  // Rule 1: Factual answers require >= 1 memory citation OR brain fields
  if (!output.sources.unknown) {
    const hasCitations = output.sources.memory_citations.length > 0
    const hasBrainFields = output.sources.client_brain_fields.length > 0 ||
                           output.sources.agency_brain_fields.length > 0
    if (!hasCitations && !hasBrainFields) {
      errors.push('Factual answer missing citations')
    }
  }

  // Rule 2: Policy/compliance answers require >= 2 citations
  if (output.answer.match(/policy|compliance|rules|regulations/i)) {
    if (output.sources.memory_citations.length < 2) {
      errors.push('Policy answer requires >= 2 memory citations')
    }
  }

  // Rule 3: All cited docs must exist in retrieval results
  const retrievedDocIds = new Set(ragMatches.map(m => m.doc_id))
  for (const citation of output.sources.memory_citations) {
    if (!retrievedDocIds.has(citation.doc_id)) {
      errors.push(`Cited doc ${citation.doc_id} not in retrieval results (hallucination risk)`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    coverage: output.sources.memory_citations.length / ragMatches.length
  }
}
```

**Metrics**:
- **Citation coverage**: % of RAG answers with >= 1 citation (target: >90%)
- **Hallucination rate**: % of cited docs not in retrieval results (target: <2%)
- **Unknown rate**: % of answers with `unknown=true` (target: <10%)

---

## Compliance Targets (Post-Phase 3)

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Router compliance | 85% | 95% | % of LLM calls via ai.run() |
| Canonical logging | 60% | 100% | % logging to ai_usage_logs + ai_runs |
| Budget accuracy | ~50% (broken) | 100% | spent_usd delta vs actual provider cost |
| Runtime model attribution | 80% | 100% | % logged model matches provider response |
| Timeout coverage | 0% | 100% | % fetch calls with timeout wrapper |
| Schema enforcement | 60% | 85% | % tasks with schema OR freeformReason |
| Zero-vector rate | ~5% | 0% | % embeddings with all-zero vectors |
| Citation coverage | Unknown | 90% | % RAG answers with >= 1 citation |

---

## Phase Status Summary

### Phase 1: Logging + Budget (COMPLETED ✅)
**Duration**: Days 1-3
**Status**: Merged to main branch

**Completed**:
- ✅ AI-001: Atomic budget operations module (src/ai/budgets.ts, src/ai/pricing.ts)
- ✅ AI-002: ai-ask budget enforcement fix (atomic RPC integration)
- ✅ AI-003: Budget enforcement integration tests (concurrency-safe)
- ✅ AI-004: generate-ai-content canonical logging (dual-write to ai_usage_logs + ai_runs)
- ✅ AI-005: Runtime model logging (provider metadata → router → logs)

**Outcomes**:
- Budget increment bug fixed (spent_usd now increments correctly)
- Canonical logging tables in use (ai_usage_logs, ai_runs)
- Runtime model attribution implemented (OpenAI provider returns actual model)
- Integration tests validate atomicity and concurrency safety
- Migration `20251227090000_ai_budget_atomic_ops.sql` deployed

---

### Phase 2: Timeouts/Retries + Embedding Hardening (PLANNED 🔲)
**Duration**: Days 3-7
**Status**: Not started

**Planned**:
- 🔲 AI-006: Provider timeout/retry utilities (fetchWithTimeout, fetchWithRetry)
- 🔲 AI-007: OpenAI provider timeouts (30s default, 3 retries)
- 🔲 AI-008: Anthropic provider timeouts (same pattern)
- 🔲 AI-009: Remove zero-vector embedding fallback (fail hard)
- 🔲 AI-010: Provider reliability integration tests

**Risks**:
- Timeout too aggressive for complex prompts (mitigate: configurable per task)
- Ingestion fails on transient errors (mitigate: retry logic + optional queue)
- Circuit breaker false positives (mitigate: tuned thresholds + monitoring)

---

### Phase 3: RAG + Citations (PLANNED 🔲)
**Duration**: Days 7-14
**Status**: Not started

**Planned**:
- 🔲 AI-011: RAG policy module (centralized top_k + doc_types)
- 🔲 AI-012: ai-ask RAG migration (use ragPolicy.ts)
- 🔲 AI-013: ai-strategy-generate RAG migration
- 🔲 AI-014: Freeform flags in task registry
- 🔲 AI-015: Admin chat schema migration (optional)
- 🔲 AI-016: RAG correctness integration tests
- 🔲 AI-017: RAG observability dashboard

**Risks**:
- RAG config changes degrade quality (mitigate: A/B test before rollout)
- Admin chat schema breaks UX (mitigate: gradual rollout 10%→100%)
- Citation validation too strict (mitigate: warnings first, not hard failures)

---

## Migration Compatibility

### Backward Compatibility Rules
1. **No breaking schema changes** during Phases 2/3 (additive only)
2. **Dual-write period** for legacy tables (Phase 1 complete, deprecate in Phase 2)
3. **Feature flags** for all major changes (timeouts, RAG policy, schema enforcement)
4. **Rollback procedures** tested in staging before each phase deployment
5. **Kill switches** ready for emergency rollback

### API Stability
- **Edge function signatures**: NO changes to existing endpoints
- **Task registry**: Additive only (new tasks, new fields)
- **Database schema**: Migrations use `ALTER TABLE ... ADD COLUMN` (never DROP)
- **RLS policies**: Hardened, never relaxed

### Data Migration Strategy
- **Budget backfill**: Optional SQL script to backfill ai_budgets.spent_usd from ai_runs
- **Legacy table deprecation**: DB triggers prevent new writes after Phase 1 cutover
- **Zero-vector cleanup**: Flagged via metadata, deleted after 30 days if unreferenced
- **Citation backfill**: Not required (citations only in new ai_runs rows)

---

## Open Questions (Refer to spec_gaps.md)

### Resolved in Phase 1
- ✅ Canonical logging tables (ai_usage_logs + ai_runs)
- ✅ Runtime model attribution (provider metadata → logs)
- ✅ Budget atomicity (RPC with FOR UPDATE lock)

### Pending for Phase 2
- 🔲 Cost estimation fallback formula (chars/3 vs chars/4) - spec_gaps.md #17
- 🔲 Cost estimation method indicator in logs (metadata column vs dedicated field) - spec_gaps.md #18
- 🔲 Timeout values per task type (configurable, default 30s) - spec_gaps.md #23

### Pending for Phase 3
- 🔲 RAG doc_type wildcard patterns (globs like "strategy_*") - spec_gaps.md #21
- 🔲 Prompt registry vs model policy conflict resolution - spec_gaps.md #22
- 🔲 Retry queue for failed embeddings (async worker) - spec_gaps.md #24

### Deferred (Not Critical for v1)
- Circuit breaker thresholds (50% error rate over 5min) - spec_gaps.md #20
- Anthropic retry policy (same as OpenAI pending testing) - spec_gaps.md #19
- Internal notes exposure policy (conservative default) - spec_gaps.md #10

---

**Document Status**: FROZEN
**Last Updated**: 2025-12-27
**Phase 1 Completion**: ✅ Confirmed
**Next Phase**: Phase 2 (Provider Timeouts + Embedding Hardening)

---

*This architecture is the source of truth for SMMAHUB AI infrastructure. Any deviations require explicit amendment to this document with Phase/Risk annotation.*

# AI Spine Contract (Invariants + Interfaces)

**Generated:** 2025-12-24
**Scope:** Immutable contracts for AI Employee spine v1

---

## 1. Core Invariants (Non-Negotiable Rules)

### 1.1 No brain_json Exposure to Client

**RULE:** Full `brain_json` from `agency_brains` and `client_brains` MUST NEVER be readable by authenticated web app users.

**Enforcement:**
- RLS SELECT policies: `auth.role() = 'service_role'` only
- Evidence: supabase/migrations/20251224103000_strategy_docs_and_embeddings.sql:65-73

**Rationale:** brain_json contains raw onboarding responses, inference metadata, and potentially sensitive agency IP (strategy defaults, safety policies).

**Allowed Exceptions:**
- Edge functions running as service_role can read brain_json
- Tenant-safe derived surfaces (RPCs) can expose COMPUTED fields, NOT raw brain_json

---

### 1.2 Derived Status Surface for UI

**RULE:** UI MUST use tenant-safe, security-definer RPCs to read brain status, NOT direct table access.

**Canonical Surface:**
```sql
public.get_client_brain_status(p_client_id uuid) RETURNS TABLE (
  client_id uuid,
  usable boolean,
  missing_fields_count integer,
  missing_fields text[],
  status text,
  locked boolean,
  version integer,
  updated_at timestamptz
)
```

**Contract Guarantees:**
1. Caller must be authenticated (JWT)
2. Caller must be in client's agency (validated via agency_members join)
3. Returns ONLY derived/safe fields (no raw brain_json)
4. missing_fields computed server-side from canonical brain schema
5. If no brain row exists, return empty (UI interprets as unusable)

**Evidence:** supabase/migrations/20251224121500_get_client_brain_status_rpc.sql:1-134

**UI Call Pattern:**
```typescript
const { data, error } = await db.rpc("get_client_brain_status", { p_client_id: clientId });
```

Evidence: src/data/index.ts:187

---

### 1.3 Edge Function Boundaries

**RULE:** All brain create/update/lock operations MUST go through edge functions with service_role DB access.

**Allowed Edge Function Actions:**
- `ai-brains-agency`: create | update | lock agency_brains
- `ai-brains-client`: create | update | lock client_brains
- `ai-brain-ingest`: map raw -> canonical + compute usable

**Forbidden Patterns:**
- Client-side `.from("agency_brains").insert(...)` [blocked by RLS]
- Client-side `.from("client_brains").update(...)` [blocked by RLS]

**Safe Return Fields (Edge Function Responses):**
Edge functions MUST return ONLY:
```typescript
{
  success: boolean,
  brain: {
    id: string,
    agency_id: string,
    client_id?: string,
    version: number,
    status: string,
    locked: boolean
  }
}
```

Do NOT return `brain_json` in edge function responses.

Evidence: supabase/functions/ai-brains-client/index.ts:90-97, :124-131

---

### 1.4 Usable Computation Server-Side Only

**RULE:** `client_brains.usable` flag MUST be computed server-side using canonical brain field validation logic.

**Required Fields (6):**
1. `brand_basics.name` (non-empty string)
2. `offer_details.products_services` (array, length >= 1)
3. `audience.problems` (array, length >= 1)
4. `pillars` (array, length >= 1)
5. `goals` (array, length >= 1)
6. `constraints.banned_claims` OR `constraints.taboo_topics` (at least one array, length >= 1)

**Computation Logic:**
```typescript
export function evaluateClientBrainForStrategy(brain: Record<string, any>): UnknownGateResult {
  const missing = REQUIRED_FIELDS.filter((path) => !isFilled(getPathValue(brain, path)));
  REQUIRED_GROUPS.forEach((group) => {
    const groupFilled = group.paths.some((path) => isFilled(getPathValue(brain, path)));
    if (!groupFilled) missing.push(group.key);
  });
  return {
    usable: missing.length === 0,
    missing_fields: missing,
    questions: missing.map((field) => QUESTION_MAP[field]).filter(Boolean).slice(0, 3),
  };
}
```

Evidence: supabase/functions/_shared/brain-quality.ts:7-57

**Enforcement Points:**
- ai-brain-ingest sets `client_brains.usable` after mapping raw -> canonical
  Evidence: supabase/functions/ai-brain-ingest/index.ts:246-251
- get_client_brain_status RPC computes missing_fields from brain_json
  Evidence: supabase/migrations/20251224121500_get_client_brain_status_rpc.sql:57-114
- ai-strategy-generate gates on usable before generation
  Evidence: supabase/functions/ai-strategy-generate/index.ts:95-97

---

### 1.5 UNKNOWN Safety Policy

**RULE:** If information is missing or out of scope, AI endpoints MUST return `UNKNOWN` with 1-3 clarifying questions, NOT fabricated content.

**Response Contract:**
```typescript
{
  answer: "UNKNOWN",
  unknown: true,
  questions: string[], // 1-3 clarifying questions
  confidence: 0,
  sources: {
    agency_brain_fields: [],
    client_brain_fields: [],
    memory_citations: []
  },
  escalate_to_human: boolean,
  escalation_reason: string | null
}
```

**Trigger Conditions:**
1. `client_brains.usable === false` (missing required fields)
2. RAG retrieval returns zero matches
3. Context insufficient to answer question (model outputs UNKNOWN in response)
4. Out of scope (client portal question unrelated to agency services)
5. Budget/rate limit exceeded

**Evidence:**
- Policy doc: docs/ai/safety_unknown_policy.md:1-15
- ai-ask implementation: supabase/functions/ai-ask/index.ts:42-52, :387
- ai-strategy-generate gate: supabase/functions/ai-strategy-generate/index.ts:97

**Acceptance Criteria:**
- >= 95% of missing-info prompts return UNKNOWN (manual test set)
  Evidence: docs/ai/spec_v1.md:141

---

### 1.6 Vector Search Tenant Isolation

**RULE:** `match_ai_embeddings` RPC MUST filter by `agency_id` AND optional `client_id`; EXECUTE permission restricted to service_role only.

**Function Signature:**
```sql
match_ai_embeddings(
  p_agency_id uuid,
  p_query_embedding vector(1536),
  p_client_id uuid DEFAULT NULL,
  p_match_count int DEFAULT 8,
  p_doc_types text[] DEFAULT NULL
) RETURNS TABLE (...)
```

**Tenant Filter (WHERE clause):**
```sql
WHERE d.agency_id = p_agency_id
  AND (p_client_id IS NULL OR d.client_id = p_client_id)
  AND (p_doc_types IS NULL OR e.doc_type = ANY(p_doc_types))
```

Evidence: supabase/migrations/20251224090000_brain_spine_v1.sql:58-60, 90-92

**Execution Privileges:**
```sql
REVOKE ALL ON FUNCTION public.match_ai_embeddings(...) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.match_ai_embeddings(...) TO service_role;
```

Evidence: supabase/migrations/20251224133000_harden_match_ai_embeddings_exec.sql:3-27

**Rationale:** Prevents client-side vector search access that could leak cross-tenant embeddings or bypass UNKNOWN safety policy.

---

## 2. Interface Contracts

### 2.1 Edge Function: ai-brains-client

**Endpoint:** POST /functions/v1/ai-brains-client

**Auth:** Bearer JWT (authenticated user, agency membership validated)

**Request Body:**
```typescript
{
  action: "create" | "update" | "lock",
  agency_id: string,     // required
  client_id: string,     // required
  brain_id?: string,     // required for update/lock
  brain_json?: object,   // optional for create/update (default {})
  json_diff?: object,    // optional
  confidence?: number,   // optional
  status?: string        // optional for update only
}
```

**Response (Success):**
```typescript
{
  success: true,
  brain: {
    id: string,
    agency_id: string,
    client_id: string,
    version: number,
    status: "draft" | "usable" | "complete" | "locked",
    locked: boolean
  },
  existing?: boolean  // only for create action if brain already exists
}
```

**Response (Error):**
```typescript
{
  error: string
}
```

**Status Codes:**
- 200: Success
- 400: Invalid action/parameters or DB error
- 401: Missing/invalid Authorization header
- 403: User not in agency
- 405: Method not POST

**Evidence:** supabase/functions/ai-brains-client/index.ts:1-149

---

### 2.2 Edge Function: ai-brain-ingest

**Endpoint:** POST /functions/v1/ai-brain-ingest

**Auth:** Bearer JWT (authenticated user, agency membership validated)

**Request Body:**
```typescript
{
  scope: "agency" | "client",
  agency_id: string,
  client_id?: string,            // required if scope=client
  raw_responses?: object,        // optional override
  followup_responses?: object    // optional override
}
```

**Response (Success):**
```typescript
{
  ok: true,
  scope: "agency" | "client",
  usable: boolean,               // client scope only
  missing_fields: string[],      // client scope only
  updated_at: string | null
}
```

**Logic:**
1. Fetch existing brain_json from agency_brains or client_brains (service_role)
2. Map raw_responses -> canonical brain fields (agency or client schema)
3. For client brains: compute usable flag using brain-quality.ts
4. Update brain_json in table
5. Optionally embed brain summary into ai_embeddings

**Evidence:** supabase/functions/ai-brain-ingest/index.ts:111-343

---

### 2.3 Edge Function: ai-ask

**Endpoint:** POST /functions/v1/ai-ask

**Auth:** Bearer JWT (authenticated user, agency membership validated)

**Request Body:**
```typescript
{
  agency_id: string,
  client_id?: string,
  question: string
}
```

**Response (Success):**
```typescript
{
  answer: string,
  unknown: boolean,
  questions: string[],
  confidence: number,
  sources: {
    agency_brain_fields: string[],
    client_brain_fields: string[],
    memory_citations: Array<{
      doc_id: string,
      chunk_id: string,
      doc_type: string,
      title: string,
      source_url?: string,
      excerpt: string
    }>
  },
  escalate_to_human: boolean,
  escalation_reason: string | null
}
```

**Budget/Rate Limit Enforcement:**
- Per-user rate limit: 20 requests/day (default)
- Per-agency monthly budget: $50 USD (default)
- Per-run token cap: 6000 tokens
- Returns UNKNOWN if limit exceeded

**RAG Retrieval Hierarchy:**
1. Client memory (doc_types: client_guidelines, client_notes, approved_posts), top_k=6
2. Agency memory (doc_types: agency_sop, agency_exemplar_strategy), top_k=4
3. Exemplars (doc_type: agency_exemplar_strategy), top_k=2

**Evidence:** supabase/functions/ai-ask/index.ts:7-14, :314-334

---

### 2.4 Edge Function: ai-strategy-generate

**Endpoint:** POST /functions/v1/ai-strategy-generate

**Auth:** Bearer JWT (authenticated user, agency membership validated)

**Request Body:**
```typescript
{
  agency_id: string,
  client_id: string
}
```

**Response (Success with usable brain):**
```typescript
{
  strategy_draft: string,
  citations: Array<{
    doc_id: string,
    title: string,
    doc_type: string,
    source_url?: string,
    excerpt: string
  }>,
  missing_fields: string[],  // empty if usable=true
  usable: true
}
```

**Response (UNKNOWN - unusable brain):**
```typescript
{
  answer: "UNKNOWN",
  unknown: true,
  questions: string[],       // 1-3 questions about missing fields
  confidence: 0,
  sources: {...},
  missing_fields: string[],  // non-empty
  usable: false
}
```

**Behavior:**
1. Fetch client_brains + agency_brains (service_role)
2. Evaluate brain quality (usable flag)
3. If unusable, return UNKNOWN with questions
4. If usable, perform RAG retrieval + generate draft
5. Store draft as ai_documents with doc_type=strategy_draft
6. Embed draft for future retrieval

**Evidence:** supabase/functions/ai-strategy-generate/index.ts:55-312

---

### 2.5 RPC: get_client_brain_status

**Function:** public.get_client_brain_status(p_client_id uuid)

**Caller:** authenticated users (EXECUTE granted to authenticated role)

**Security:** SECURITY DEFINER (runs with elevated privilege, validates agency membership internally)

**Returns:**
```sql
TABLE (
  client_id uuid,
  usable boolean,
  missing_fields_count integer,
  missing_fields text[],
  status text,
  locked boolean,
  version integer,
  updated_at timestamptz
)
```

**Behavior:**
1. Check auth.uid() is not null (else raise exception)
2. Validate caller is in client's agency via agency_members join (else raise exception)
3. Fetch latest client_brains row (highest version)
4. Compute missing_fields from brain_json using canonical field checks
5. Return derived fields (NO brain_json)

**Error Handling:**
- Raises exception '28000' if not authenticated
- Raises exception '42501' if forbidden (not in agency)
- Returns empty set if no brain row exists (UI interprets as unusable)

**Evidence:** supabase/migrations/20251224121500_get_client_brain_status_rpc.sql:1-134

---

### 2.6 RPC: match_ai_embeddings

**Function:** public.match_ai_embeddings(p_agency_id, p_query_embedding, p_client_id, p_match_count, p_doc_types)

**Caller:** service_role ONLY (EXECUTE revoked from public/authenticated)

**Returns:**
```sql
TABLE (
  document_id uuid,
  chunk_id uuid,
  doc_type text,
  chunk_text text,
  score float8,
  title text,
  source jsonb,
  source_url text
)
```

**Filter Logic:**
```sql
WHERE d.agency_id = p_agency_id
  AND (p_client_id IS NULL OR d.client_id = p_client_id)
  AND (p_doc_types IS NULL OR e.doc_type = ANY(p_doc_types))
ORDER BY e.embedding <=> p_query_embedding
LIMIT p_match_count
```

**Similarity Metric:** Cosine distance (operator `<=>` for vector type)
**Score Computation:** `1 - (embedding <=> query)` (higher = more similar)

**Evidence:** supabase/migrations/20251224090000_brain_spine_v1.sql:64-95, supabase/migrations/20251224103000_strategy_docs_and_embeddings.sql:26-63

---

## 3. Brain State Transitions

### 3.1 Client Brain Lifecycle

```
[not exists]
   |
   | ai-brains-client action=create
   v
[draft, locked=false, usable=false, brain_json={raw_responses:{}}]
   |
   | ai-brains-client action=update (multiple times)
   v
[draft, locked=false, usable=false, brain_json={raw_responses:{...}}]
   |
   | ai-brains-client action=lock
   v
[locked, locked=true, usable=false, brain_json={...}]
   |
   | ai-brain-ingest (maps raw -> canonical, computes usable)
   v
[usable|draft, locked=true, usable=true|false, brain_json={brand_basics:{...}, ...}]
```

**Terminal States:**
- `locked=true, usable=true`: Client detail accessible, strategy generation allowed
- `locked=true, usable=false`: Locked but missing fields, requires re-onboarding for v2

**Status Values:**
- `draft`: Onboarding in progress or incomplete after ingest
- `usable`: All required fields present (computed)
- `complete`: (future) All optional fields present
- `locked`: v1 locked, no edits allowed (future: create v2 draft)

**Evidence:** supabase/functions/ai-brains-client/index.ts:84, :114, :136, supabase/functions/ai-brain-ingest/index.ts:247-251

---

### 3.2 Agency Brain Lifecycle

Similar to client brain, but NO `usable` flag (agency brain is always usable once locked).

```
[not exists] -> [draft] -> [locked] -> [locked (v2 draft if edited)]
```

**Evidence:** supabase/functions/ai-brains-agency/index.ts:83, :104, :116

---

## 4. Embedding + Document Contracts

### 4.1 Document Types (Enum)

```sql
doc_type IN (
  'agency_exemplar_strategy',
  'agency_sop',
  'client_guidelines',
  'client_notes',
  'approved_posts',
  'ai_artifact',
  'strategy_draft'
)
```

**Usage:**
- `agency_exemplar_strategy`: Agency gold examples (used in RAG retrieval for style)
- `agency_sop`: Agency standard operating procedures
- `client_guidelines`: Client brand guidelines, voice docs
- `client_notes`: Ad-hoc notes about client
- `approved_posts`: Historical approved content (future)
- `ai_artifact`: AI-generated locked outputs (future)
- `strategy_draft`: Output of ai-strategy-generate

**Evidence:** supabase/migrations/20251224103000_strategy_docs_and_embeddings.sql:3-16

---

### 4.2 Chunking Defaults

```typescript
{
  chunk_size_tokens: 900,
  overlap_tokens: 140,
  max_chunks_per_doc: 120
}
```

**Evidence:** docs/ai/spec_v1.md:82

---

### 4.3 Embedding Model

**Model:** `text-embedding-ada-002` (OpenAI)
**Dimensions:** 1536
**Similarity:** Cosine (PostgreSQL `<=>` operator for vector type)

**Fallback Behavior:** If OPENAI_API_KEY missing, insert zero vector `[0,0,...,0]` (1536 dims)
**Evidence:** supabase/functions/ai-documents-ingest/index.ts:134-170

---

## 5. Cost + Rate Limit Contracts

### 5.1 Per-Run Token Cap

**Hard Limit:** 6000 tokens per ai-ask or ai-strategy-generate run
**Evidence:** supabase/functions/ai-ask/index.ts:7

---

### 5.2 Per-User Rate Limit

**Default:** 20 requests/day/user
**Reset:** 00:00 UTC daily
**Storage:** `ai_rate_limits` table (day_yyyy_mm_dd, used_count)
**Enforcement:** ai-ask checks rate before processing
**Evidence:** supabase/functions/ai-ask/index.ts:8, :118-193

---

### 5.3 Per-Agency Monthly Budget

**Default:** $50 USD/month/agency
**Reset:** Day 1 of month, 00:00 UTC
**Storage:** `ai_budgets` table (month_yyyy_mm, budget_usd, spent_usd)
**Enforcement:** ai-ask checks budget before processing
**Evidence:** supabase/functions/ai-ask/index.ts:9, :173-193

---

## 6. Observability Contracts

### 6.1 ai_usage_logs (Canonical Logging)

**Required Fields:**
```typescript
{
  agency_id: string,
  client_id: string | null,
  endpoint: "ai-ask" | "ai-strategy-generate" | "ai-documents-ingest" | "ai-brain-ingest",
  model: string,
  tokens_estimate: number,
  latency_ms: number,
  unknown: boolean,
  cost_usd: number,
  created_at: timestamp
}
```

**Every AI run MUST log:** endpoint, model, tokens, cost, latency, unknown flag
**Evidence:** supabase/functions/ai-ask/index.ts:461-470, docs/ai/spec_v1.md:112-119

---

### 6.2 Citations Requirement

**RULE:** Factual claims MUST include >= 1 citation OR explicit brain_fields list.

**Citation Schema:**
```typescript
{
  doc_id: string,
  chunk_id: string,
  doc_type: string,
  title: string,
  source_url?: string,
  excerpt: string
}
```

**Evidence:** docs/ai/spec_v1.md:91-95, supabase/functions/ai-ask/index.ts:422-431

---

## Summary

**This contract defines:**
1. Immutable security boundaries (no brain_json exposure, service_role only access)
2. Derived status surfaces (get_client_brain_status RPC)
3. Edge function interfaces (ai-brains-*, ai-ask, ai-strategy-generate)
4. Brain state transitions (draft -> locked -> usable)
5. UNKNOWN safety policy (missing info -> questions, not fabrication)
6. Vector search tenant isolation (match_ai_embeddings with agency_id filter)
7. Cost controls (6000 token cap, 20/day rate limit, $50/month budget)
8. Observability guarantees (ai_usage_logs, citations)

**Any code that violates these contracts is a BUG and must be fixed before production.**

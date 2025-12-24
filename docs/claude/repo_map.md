# SMMAHUB Repo Map + AI Employee Architecture

**Generated:** 2025-12-24
**Branch:** feat/ai-employee-v1-sprint1-2025-12-23
**Scope:** Read-only evidence-based analysis

---

## A) Product Vision (AI Employee)

### What is SMMAHUB?

SMMAHUB is a React + Supabase SaaS platform for social media marketing agencies to manage clients, content, and workflows.
**Evidence:** README.md:1-120, src/App.tsx:100-197

### What is the "AI Employee"?

The AI Employee is a 2-level personalization system that generates grounded, citation-backed content for agencies:

1. **Agency Brain**: Canonical identity, voice, strategy defaults, and policies for an agency
   - Stored: `public.agency_brains` table with versioned JSONB
   - Fields: identity, ICP, voice/tone, strategy defaults, safety policy, FAQ, gold examples
   - Evidence: docs/ai/spec_v1.md:59-67, docs/ai/brain_spine_v1_contract.md:3-51

2. **Client Brain**: Per-client brand profile tuning outputs for each client
   - Stored: `public.client_brains` table with versioned JSONB
   - Fields: brand basics, offers, audience, competitors, constraints, pillars, FAQ, assets
   - Evidence: docs/ai/spec_v1.md:69-78, docs/ai/brain_spine_v1_contract.md:53-102

3. **Memory (RAG)**: Document store + embeddings for grounded retrieval
   - Documents: `ai_documents` (PDF, MD, TXT, URLs) chunked into `ai_document_chunks`
   - Embeddings: `ai_embeddings` with vector(1536) for cosine similarity search
   - Evidence: docs/ai/spec_v1.md:79-88, supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:34-82

### What does "usable" mean?

`client_brains.usable` is a boolean flag computed server-side indicating whether a client brain has ALL required fields for safe strategy generation:

**Required fields** (6):
1. `brand_basics.name`
2. `offer_details.products_services` (array, >= 1)
3. `audience.problems` (array, >= 1)
4. `pillars` (array, >= 1)
5. `goals` (array, >= 1)
6. `constraints.banned_claims` OR `constraints.taboo_topics` (at least one non-empty)

**Evidence:**
- Migration: supabase/migrations/20251224090000_brain_spine_v1.sql:3-4
- Computation logic: supabase/functions/_shared/brain-quality.ts:7-57
- RPC validation: supabase/migrations/20251224121500_get_client_brain_status_rpc.sql:57-114

**Safety guarantee:** If `usable = false`, AI endpoints (ai-ask, ai-strategy-generate) return `UNKNOWN` with 1-3 questions instead of fabricating content.

---

## B) Data Model Map

### Core Tenancy Tables

```
agencies (id, name, ...)
  |
  +-- agency_members (agency_id, user_id, role) [RLS: user sees own memberships]
  |
  +-- clients (id, agency_id, name, ...) [RLS: agency members only]
```

Evidence: supabase/migrations/20251123055929_*.sql:56-71

### AI Employee Tables (2-level brains)

```
agency_brains
  id, agency_id, version, status, locked, brain_json, json_diff, confidence, created/updated_at
  RLS: service_role SELECT only (as of 20251224103000)

client_brains
  id, agency_id, client_id, version, status, locked, usable, brain_json, json_diff, confidence, created/updated_at
  RLS: service_role SELECT only (as of 20251224103000)
```

**Status values:** draft | usable | complete | locked
**Evidence:** supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:7-32

### Memory + RAG Tables

```
ai_documents
  id, agency_id, client_id, doc_type, title, content, extracted_text, source, source_url, file_ref, metadata, created/updated_at
  doc_types: agency_exemplar_strategy, agency_sop, client_guidelines, client_notes, approved_posts, ai_artifact, strategy_draft
  RLS: agency_members can select/insert/update/delete

ai_document_chunks
  id, document_id, chunk_index, chunk_text, token_count, chunk_meta, created_at
  RLS: inherits via document_id join

ai_embeddings
  id, agency_id, client_id, doc_type, document_id, chunk_id, embedding vector(1536), model, metadata, created_at
  RLS: service_role SELECT only (as of 20251224103000)
```

**Evidence:** supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:34-82, supabase/migrations/20251224103000_strategy_docs_and_embeddings.sql:3-16, :75-78

### AI Observability Tables

```
ai_usage_logs
  id, agency_id, client_id, endpoint, model, tokens_estimate, latency_ms, unknown, cost_usd, created_at
  RLS: agency_members can select/insert/update

ai_runs
  id, agency_id, client_id, user_id, prompt_id, prompt_version, model, tokens_in, tokens_out, cost_usd, latency_ms, success, citations, unknown, escalate_to_human, escalation_reason, created_at
  RLS: agency_members can select

ai_prompt_registry
  id, name, version, status, task_type, model, max_tokens, template, notes, created_at
  task_types: answer_quality_check, rag_ask
  RLS: agency_members can select

ai_rate_limits
  id, agency_id, user_id, day_yyyy_mm_dd, limit_per_day, used_count, reset_time_utc, reset_timezone, created/updated_at
  RLS: agency_members can select/insert/update

ai_budgets
  id, agency_id, month_yyyy_mm, budget_usd, spent_usd, hard_stop, reset_day, reset_time_utc, reset_timezone, created/updated_at
  RLS: agency_members can select/insert/update

ai_escalations
  id, agency_id, client_id, user_id, question, reason, status, assignee_role, created/updated_at
  RLS: agency_members can select/insert/update
```

**Evidence:** supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:84-155, supabase/migrations/20251224110000_expand_ai_usage_logs.sql:2-5

### Key Relationships

```
agency_brains.agency_id -> agencies.id (cascade)
client_brains.agency_id -> agencies.id (cascade)
client_brains.client_id -> clients.id (cascade)
ai_documents.agency_id -> agencies.id (cascade)
ai_documents.client_id -> clients.id (set null)
ai_embeddings.document_id -> ai_documents.id (cascade)
ai_embeddings.chunk_id -> ai_document_chunks.id (cascade)
```

---

## C) AI Services Map

### Edge Functions (Deno + service_role access)

All edge functions verify JWT token and enforce agency membership before performing actions.
**Evidence:** supabase/functions/ai-ask/index.ts:77-103, supabase/functions/ai-brains-client/index.ts:54-63

#### Brain Management

**ai-brains-agency** (POST)
- Actions: create | update | lock
- Creates/updates/locks `agency_brains` rows with versioned brain_json
- Returns: brain ID + status
- Evidence: supabase/functions/ai-brains-agency/index.ts:1-149

**ai-brains-client** (POST)
- Actions: create | update | lock
- Creates/updates/locks `client_brains` rows with versioned brain_json
- Returns: brain ID + status
- Evidence: supabase/functions/ai-brains-client/index.ts:1-149

**ai-brain-ingest** (POST)
- Maps raw onboarding responses -> canonical brain JSON
- Computes `usable` flag for client brains using brain-quality.ts logic
- Updates brain_json in agency_brains or client_brains
- Optionally embeds brain summary into ai_embeddings
- Evidence: supabase/functions/ai-brain-ingest/index.ts:111-343

#### Document + Memory Management

**ai-documents-ingest** (POST)
- Accepts: PDF, DOCX, TXT, MD, URL
- Chunks document (900 token chunks, 140 overlap, max 120 chunks)
- Embeds chunks using OpenAI text-embedding-ada-002 (or zero vector if no key)
- Inserts into ai_documents + ai_document_chunks + ai_embeddings
- Logs to ai_usage_logs
- Evidence: supabase/functions/ai-documents-ingest/index.ts:1-181

#### RAG + Generation

**ai-retrieve-context** (POST)
- Embeds query
- Calls match_ai_embeddings RPC with filters (agency_id, client_id, doc_types)
- Returns top-k chunks with metadata
- Evidence: supabase/functions/ai-retrieve-context/index.ts:70

**ai-ask** (POST)
- Budget gates: rate limit (20/day/user), monthly budget ($50/agency), token cap (6000/run)
- Retrieval hierarchy: 6 client memory + 4 agency memory + 2 exemplars
- Uses match_ai_embeddings RPC 3 times (client, agency, exemplar doc types)
- Generates answer via OpenAI with UNKNOWN policy
- Returns: {answer, unknown, questions, confidence, sources, escalate_to_human}
- Logs to ai_usage_logs
- Evidence: supabase/functions/ai-ask/index.ts:1-464

**ai-strategy-generate** (POST)
- Gates on client_brains.usable (returns UNKNOWN if false)
- Retrieves client + agency brains (service_role access)
- Evaluates brain quality with brain-quality.ts
- Performs RAG retrieval (same 3-phase match as ai-ask)
- Generates strategy draft with citations
- Stores draft as doc_type=strategy_draft in ai_documents
- Returns: {strategy_draft, citations, missing_fields, usable}
- Evidence: supabase/functions/ai-strategy-generate/index.ts:55-312

**ai-answer-quality-check** (POST)
- Takes an answer + 1-3 follow-up prompts
- Uses cheap model to validate quality
- Returns: {quality_score, follow_ups}
- Evidence: supabase/functions/ai-answer-quality-check/index.ts (exists in file list)

### RPC Functions (Postgres)

**public.get_client_brain_status(p_client_id uuid)** [authenticated, security definer]
- Tenant-safe derived status surface for UI
- Verifies caller is in client's agency via agency_members RLS check
- Reads client_brains.brain_json and computes missing_fields server-side
- Returns: {client_id, usable, missing_fields_count, missing_fields[], status, locked, version, updated_at}
- Does NOT expose full brain_json to caller
- Evidence: supabase/migrations/20251224121500_get_client_brain_status_rpc.sql:1-134

**public.match_ai_embeddings(p_agency_id, p_query_embedding, p_client_id, p_match_count, p_doc_types)** [hardened to service_role EXECUTE only as of 20251224133000]
- Vector similarity search with tenant + doc_type filters
- Returns top-k chunks ordered by cosine similarity (1 - embedding <=> query)
- Returns: {document_id, chunk_id, doc_type, chunk_text, score, title, source, source_url}
- Evidence: supabase/migrations/20251224090000_brain_spine_v1.sql:64-95, supabase/migrations/20251224133000_harden_match_ai_embeddings_exec.sql:1-27

---

## D) Security Boundaries (RLS + EXECUTE)

### Service-Role Only Tables (SELECT)

As of migration 20251224103000_strategy_docs_and_embeddings.sql:

**agency_brains** - SELECT policy: `auth.role() = 'service_role'`
- Authenticated users CANNOT read brain_json directly
- UI must use edge functions or RPCs
- Evidence: supabase/migrations/20251224103000_strategy_docs_and_embeddings.sql:65-68

**client_brains** - SELECT policy: `auth.role() = 'service_role'`
- Authenticated users CANNOT read brain_json or usable directly
- UI must use get_client_brain_status RPC for gating
- Evidence: supabase/migrations/20251224103000_strategy_docs_and_embeddings.sql:70-73

**ai_embeddings** - SELECT policy: `auth.role() = 'service_role'`
- Prevents direct vector search access from client
- UI must use edge functions that call match_ai_embeddings
- Evidence: supabase/migrations/20251224103000_strategy_docs_and_embeddings.sql:75-78

### Service-Role Only Functions (EXECUTE)

**match_ai_embeddings** - EXECUTE revoked from public/authenticated, granted only to service_role
- Edge functions call this with service_role credentials
- UI cannot call directly
- Evidence: supabase/migrations/20251224133000_harden_match_ai_embeddings_exec.sql:3-27

### Tenant-Readable Surfaces (Derived + Safe)

**get_client_brain_status RPC** - EXECUTE granted to authenticated
- Security definer: runs with elevated privilege
- Validates agency membership before returning data
- Exposes ONLY: usable flag + missing_fields count/array + status/locked/version
- Does NOT expose full brain_json
- Evidence: supabase/migrations/20251224121500_get_client_brain_status_rpc.sql:16, :25-37, :131-134

**ai_documents, ai_usage_logs, ai_runs, etc.** - RLS policies allow agency_members to select/insert/update
- Tenant-scoped via agency_id filter in RLS
- Safe because no sensitive brain_json stored here
- Evidence: supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:163-172

### How Gating and Onboarding Should Safely Read Status

**CORRECT (current as of 20251224):**
- UI calls `db.rpc("get_client_brain_status", {p_client_id})`
- RPC validates membership and returns safe derived fields
- Evidence: src/data/index.ts:187, src/pages/ClientDetail.tsx:159

**INCORRECT (blocked by RLS as of 20251224103000):**
- UI calls `db.from("client_brains").select("usable, brain_json")`
- This now fails with RLS permission error
- Evidence: docs/ai/baseline_audit.md:86-91

### Onboarding Brain Access Pattern

**CORRECT:**
- UI calls `supabase.functions.invoke("ai-brains-client", {action: "create"|"update"|"lock"})`
- Edge function has service_role access to read/write client_brains
- Edge function returns only safe fields (id, status, locked, version)
- Evidence: supabase/functions/ai-brains-client/index.ts:66-97, src/components/ai/AiOnboardingV2Chat.tsx:164-210

**FRAGILITY (potential legacy code path):**
- If onboarding UI still attempts direct `.from("client_brains").select(...)` for resume flow
- This will fail with RLS error
- Evidence: docs/ai/baseline_audit.md:90-91 (flagged as FAIL)

---

## E) Core User Flows (Numbered Steps)

### Flow 1: Client Access Gating

**Goal:** Block access to Client Detail page until client brain is usable.

**Steps:**
1. User navigates to `/clients/:clientId` route
   Evidence: src/App.tsx:100-197
2. ClientDetail page calls `fetchGateStatus()` on mount
   Evidence: src/pages/ClientDetail.tsx:151-178
3. `getClientBrainStatus(clientId)` calls `db.rpc("get_client_brain_status", {p_client_id})`
   Evidence: src/data/index.ts:187
4. RPC validates user is in client's agency via `agency_members` join
   Evidence: supabase/migrations/20251224121500_get_client_brain_status_rpc.sql:29-37
5. RPC computes missing_fields from brain_json server-side
   Evidence: supabase/migrations/20251224121500_get_client_brain_status_rpc.sql:57-114
6. RPC returns `{usable, missing_fields_count, missing_fields[], status, locked, version, updated_at}`
   Evidence: supabase/migrations/20251224121500_get_client_brain_status_rpc.sql:116-125
7. If `usable === false`, show full-page gate with CTA to AI onboarding
   Evidence: src/pages/ClientDetail.tsx:288-309
8. If `usable === true`, render normal client detail tabs
   Evidence: src/pages/ClientDetail.tsx:288, 310+

**Acceptance Test:**
- Unusable client (missing fields) blocks access with onboarding CTA
- Usable client (all fields present) allows normal detail view
- Evidence: src/pages/__tests__/ClientDetailGate.test.tsx:118-136

### Flow 2: Onboarding Create/Update/Lock

**Goal:** Capture raw onboarding answers, map to canonical brain, compute usable, and lock v1.

**Steps:**
1. User clicks "Start AI Onboarding" from gate or Clients list
2. AiOnboardingV2Chat loads agency/client onboarding questions
   Evidence: src/components/ai/AiOnboardingV2Chat.tsx:1-403
3. On first load, invoke `ai-brains-client` with `action=create` to init draft brain
   Evidence: src/components/ai/AiOnboardingV2Chat.tsx:164-175
4. Edge function creates `client_brains` row with `status=draft, locked=false, brain_json={raw_responses:{}}`
   Evidence: supabase/functions/ai-brains-client/index.ts:78-91
5. User answers questions; UI saves each answer to local state
6. On "Save Draft", invoke `ai-brains-client` with `action=update` + brain_json containing raw_responses
   Evidence: src/components/ai/AiOnboardingV2Chat.tsx:195-210
7. On "Lock v1", invoke `ai-brains-client` with `action=lock`
   Evidence: src/components/ai/AiOnboardingV2Chat.tsx:304-334, :403
8. Edge function sets `status=locked, locked=true`
   Evidence: supabase/functions/ai-brains-client/index.ts:134-147
9. Background: separate `ai-brain-ingest` function (or post-lock webhook) maps raw_responses -> canonical brain_json fields and sets `usable` flag
   Evidence: supabase/functions/ai-brain-ingest/index.ts:111-251
10. After lock, user is redirected back to Client Detail (with returnTo query param)
    Evidence: src/components/ai/AiOnboardingV2Chat.tsx (implicit via navigation context)

**Acceptance Test:**
- Create draft brain -> update with answers -> lock v1 -> client detail accessible
- Evidence: docs/ai/how_to_test_brain_spine.md:14-21

### Flow 3: Ask/Strategy Generation Path (RAG)

**Goal:** Generate grounded, citation-backed content using brain + memory hierarchy.

**Steps (ai-ask endpoint):**
1. UI invokes `supabase.functions.invoke("ai-ask", {agency_id, client_id, question})`
   Evidence: supabase/functions/ai-ask/index.ts:85-88
2. Edge function verifies JWT + agency membership
   Evidence: supabase/functions/ai-ask/index.ts:77-103
3. Check rate limit (20/day/user) and budget ($50/month/agency)
   Evidence: supabase/functions/ai-ask/index.ts:118-193
4. Embed question using OpenAI text-embedding-ada-002
   Evidence: supabase/functions/ai-ask/index.ts (calls embedText from _shared/embeddings.ts)
5. Call match_ai_embeddings 3 times:
   - Client memory (doc_types: client_guidelines, client_notes, approved_posts), top_k=6
   - Agency memory (doc_types: agency_sop, agency_exemplar_strategy), top_k=4
   - Exemplars (doc_type: agency_exemplar_strategy), top_k=2
   Evidence: supabase/functions/ai-ask/index.ts:314-334
6. Truncate context to MAX_CONTEXT_CHARS (6000)
   Evidence: supabase/functions/ai-ask/index.ts:13
7. Generate answer with OpenAI using prompt: "Answer strictly using provided context. If insufficient, respond UNKNOWN."
   Evidence: supabase/functions/ai-ask/index.ts:387
8. Parse response, extract answer + confidence + questions
   Evidence: supabase/functions/ai-ask/index.ts:418
9. Build memory_citations array from match results
   Evidence: supabase/functions/ai-ask/index.ts:422-431
10. Return {answer, unknown, questions, confidence, sources:{agency_brain_fields, client_brain_fields, memory_citations}, escalate_to_human}
    Evidence: supabase/functions/ai-ask/index.ts:418-431
11. Log run to ai_usage_logs
    Evidence: supabase/functions/ai-ask/index.ts:461-470

**Steps (ai-strategy-generate endpoint):**
1. UI invokes `supabase.functions.invoke("ai-strategy-generate", {agency_id, client_id})`
   Evidence: supabase/functions/ai-strategy-generate/index.ts:55-80
2. Edge function verifies JWT + agency membership
   Evidence: supabase/functions/ai-strategy-generate/index.ts:55-80
3. Fetch client_brains and agency_brains rows (service_role access)
   Evidence: supabase/functions/ai-strategy-generate/index.ts:83-114
4. Evaluate brain quality using brain-quality.ts
   Evidence: supabase/functions/ai-strategy-generate/index.ts:95-97
5. If `!gate.usable` OR `!brainRow.usable`, return UNKNOWN with questions
   Evidence: supabase/functions/ai-strategy-generate/index.ts:97
6. Perform RAG retrieval (same 3-phase match as ai-ask)
   Evidence: supabase/functions/ai-strategy-generate/index.ts:146-164
7. Build prompt with client brain + agency brain + retrieved chunks
   Evidence: supabase/functions/ai-strategy-generate/index.ts:198-226
8. Generate strategy draft with OpenAI
   Evidence: supabase/functions/ai-strategy-generate/index.ts:207-226
9. Store draft as ai_documents with doc_type=strategy_draft
   Evidence: supabase/functions/ai-strategy-generate/index.ts:261-285
10. Embed draft into ai_embeddings for future retrieval
    Evidence: supabase/functions/ai-strategy-generate/index.ts:312
11. Return {strategy_draft, citations, missing_fields, usable}
    Evidence: supabase/functions/ai-strategy-generate/index.ts:261+

**UNKNOWN Safety Policy:**
- If missing info, return `{answer: "UNKNOWN", unknown: true, questions: [1-3 clarifying questions]}`
- If out of scope, return `{answer: "UNKNOWN", unknown: true, escalate_to_human: true, escalation_reason}`
- Evidence: docs/ai/safety_unknown_policy.md:1-15, supabase/functions/ai-ask/index.ts:42-52

---

## F) Top 10 Fragilities (Severity 1-5)

### 1. RLS Policy Mismatch Creates Hard Block on Client Detail Gate [Severity 5]

**Issue:** Migration 20251224103000 changed client_brains SELECT policy to service_role only, but UI may still attempt direct reads for gate status.

**Evidence:**
- Policy change: supabase/migrations/20251224103000_strategy_docs_and_embeddings.sql:70-73
- Audit finding: docs/ai/baseline_audit.md:86-91, :127-129
- Current correct pattern: src/data/index.ts:187 (uses RPC)

**Impact:** If any code path still attempts `.from("client_brains").select(...)`, RLS will reject with permission error, blocking all client workspace access.

**Mitigation Status:** RESOLVED as of 20251224121500 migration with get_client_brain_status RPC. UI now calls RPC correctly.

**Verification:** src/pages/__tests__/ClientDetailGate.test.tsx:118-136, src/data/__tests__/clientBrainStatus.test.ts:21-74

---

### 2. Onboarding Resume Flow May Fail with RLS Error [Severity 5]

**Issue:** AiOnboardingV2Chat may attempt to load existing brain for resume via direct `.from("client_brains").select(...)`.

**Evidence:**
- Flagged in audit: docs/ai/baseline_audit.md:90-91, :132-134
- Onboarding code: src/components/ai/AiOnboardingV2Chat.tsx:167-175 (comment suggests legacy direct read)

**Impact:** Onboarding cannot resume or read prior answers; users cannot "Lock v1" existing drafts.

**Mitigation Status:** PARTIAL - onboarding uses edge functions for create/update/lock, but may still have legacy resume read path.

**Required Action:** Verify all onboarding read paths use edge functions with service_role access, NOT direct client-side table reads.

---

### 3. No Tenant-Safe Derived Status Surface Existed Until 20251224121500 [Severity 5 -> RESOLVED]

**Issue:** Client detail gate and onboarding status UX depend on reading `usable` + `missing_fields`, but direct access to client_brains is blocked.

**Evidence:**
- Audit finding: docs/ai/baseline_audit.md:136-139, :169-173
- Resolution: supabase/migrations/20251224121500_get_client_brain_status_rpc.sql

**Impact:** Gate always fails or shows incorrect status without safe derived surface.

**Mitigation Status:** RESOLVED - get_client_brain_status RPC provides tenant-safe, derived status surface.

**Verification:** src/data/__tests__/clientBrainStatus.test.ts:21-74, src/pages/__tests__/ClientDetailGate.test.tsx:118-136

---

### 4. Multiple AI Logging Systems Create Inconsistent Analytics [Severity 3]

**Issue:** Legacy `ai_history` and `ai_generation_usage` tables exist alongside new `ai_usage_logs` and `ai_runs`.

**Evidence:**
- Legacy tables: supabase/migrations/20251124133649_*.sql (ai_generation_usage), 20251201192305_*.sql (ai_history)
- New logging: supabase/migrations/20251224090000_brain_spine_v1.sql:16-24, :97-115
- Audit finding: docs/ai/baseline_audit.md:140-143

**Impact:** Double-counting usage, unclear which source is canonical for tier enforcement and billing.

**Required Action:** Document mapping between legacy and new logging; choose one canonical source for tier enforcement.

---

### 5. match_ai_embeddings Execution Privileges Not Explicit Until 20251224133000 [Severity 3 -> RESOLVED]

**Issue:** Original match_ai_embeddings RPC created without explicit REVOKE/GRANT EXECUTE, risking future exposure.

**Evidence:**
- Original creation: supabase/migrations/20251224090000_brain_spine_v1.sql:64-95 (no explicit grants)
- Resolution: supabase/migrations/20251224133000_harden_match_ai_embeddings_exec.sql:1-27

**Impact:** Client-side calls to match_ai_embeddings could leak vector search capabilities, bypassing UNKNOWN safety policy.

**Mitigation Status:** RESOLVED - EXECUTE revoked from public/authenticated, granted only to service_role.

**Verification:** Authenticated users calling RPC from client should receive permission error.

---

### 6. Embeddings Silently Degrade to Zero Vectors Without OPENAI_API_KEY [Severity 3]

**Issue:** ai-documents-ingest and ai-brain-ingest fall back to zero vector if OPENAI_API_KEY is missing.

**Evidence:**
- ai-documents-ingest fallback: supabase/functions/ai-documents-ingest/index.ts:134-170
- ai-brain-ingest fallback: supabase/functions/ai-brain-ingest/index.ts:285-321
- Audit finding: docs/ai/baseline_audit.md:148-150

**Impact:** Retrieval becomes effectively random (all vectors equal), UNKNOWN policy helps but UX feels broken.

**Required Action:** Log warning or error when embedding fails; consider blocking ingestion if embeddings required.

---

### 7. Strategy Generation Uses Confusing API Key Variable Name [Severity 2]

**Issue:** ai-strategy-generate uses variable named `embeddingApiKey` for chat completions, not just embeddings.

**Evidence:** supabase/functions/ai-strategy-generate/index.ts:120-226

**Impact:** Operational confusion during deployment; may lead to missing OPENAI_API_KEY errors.

**Required Action:** Rename variable to `openaiApiKey` or split embedding vs completion keys if needed.

---

### 8. Legacy generate-ai-content Does Not Follow UNKNOWN Policy [Severity 3]

**Issue:** Legacy `generate-ai-content` function predates UNKNOWN+citation constraints.

**Evidence:**
- Legacy function: supabase/functions/generate-ai-content/index.ts:173-219
- Audit finding: docs/ai/baseline_audit.md:155-156

**Impact:** Inconsistent safety guarantees; users may receive fabricated content from legacy endpoints.

**Required Action:** Deprecate generate-ai-content or refactor to use UNKNOWN policy + citations.

---

### 9. Local Audit Cannot Verify Actual DB/RLS State [Severity 2]

**Issue:** `supabase status` and `supabase db diff` fail due to Docker not running locally.

**Evidence:** docs/ai/baseline_audit.md:215-228

**Impact:** Cannot verify that migrations applied cleanly or RLS policies match expectations without production/remote DB access.

**Required Action:** Test migrations on local Supabase instance or remote staging DB before production deploy.

---

### 10. Gate Depends on brain_json.missing_fields (Mixed Concerns) [Severity 2]

**Issue:** UI gate previously read `(brain_json)?.missing_fields`, which is runtime evaluation output, not canonical brain contract.

**Evidence:**
- Old pattern: src/data/index.ts:192-194 (commented out or replaced)
- Canonical contract: docs/ai/brain_spine_v1_contract.md:105-113 (no missing_fields in schema)
- Audit finding: docs/ai/baseline_audit.md:161-163

**Impact:** Mixing storage schema with runtime computation; fragile if ingestion logic changes.

**Mitigation Status:** RESOLVED - get_client_brain_status RPC computes missing_fields server-side from canonical brain_json fields.

**Verification:** src/data/index.ts:200-209 now uses RPC output, not direct brain_json read.

---

## Summary

**UNDERSTOOD: YES**

**3 Biggest Risks (Must Handle Before Big Features):**

1. **Onboarding Resume Flow RLS Alignment [Severity 5]**
   Verify all AiOnboardingV2Chat code paths use edge functions with service_role access for brain reads, NOT direct client-side `.from("client_brains").select(...)`. Test resume flow with existing draft brain.

2. **Embedding Fallback Silent Failure [Severity 3]**
   Add explicit error logging and optional hard-fail when OPENAI_API_KEY missing, preventing zero-vector embeddings that break retrieval quality.

3. **AI Logging Consolidation [Severity 3]**
   Document canonical usage source (prefer ai_usage_logs) and deprecate/migrate legacy ai_history + ai_generation_usage to prevent double-counting and inconsistent tier enforcement.

---

**Repo Status:** GO with caution - critical RLS + RPC plumbing is in place as of 20251224, but onboarding resume flow and embedding fallback behavior need verification before production load.

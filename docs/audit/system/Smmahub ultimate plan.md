# SMMAHUB Strategy Generation V1: Implementation Plan

**Document Version:** 1.0  
**Date:** January 18, 2026  
**Purpose:** Implementation-grade specification for stabilizing the "Generate Strategy" pipeline

---

## SECTION 1 — Truth Snapshot

### What Exists Today

1. **Agency Brain (JSON):** Monolithic `public.agency_brains.brain_json` storing agency-level context; used by onboarding flows and loaded by `ai-strategy-generate` (Evidence: `10_AGENCY_BRAIN_CURRENT_AND_TARGET.md:23-24`, `12_GENERATE_STRATEGY_END_TO_END_AUDIT.md:81`)

2. **Agency Brain Modules (brain_documents):** Modular, versioned docs in `public.brain_documents` with approval workflow; edited in `/agency/ai-setup`; ingested into RAG as `doc_type='brain_document'` (Evidence: `10_AGENCY_BRAIN_CURRENT_AND_TARGET.md:26-27`)

3. **Client Brain (JSON):** `public.client_brains.brain_json` with `usable` boolean gate; strategy generation requires `usable=true` (Evidence: `11_CLIENT_BRAIN_CURRENT_AND_TARGET.md:14-17`)

4. **RAG Tables:** `ai_documents` → `ai_document_chunks` → `ai_embeddings` with `match_ai_embeddings(...)` RPC for vector retrieval (Evidence: `05_INGESTION_CHUNKING_EMBEDDINGS_RAG.md:17-21`)

5. **Strategy Pipeline:** `ai-strategy-generate` edge function with `verify_jwt=false`, manual membership check, loads client brain gate, retrieves RAG matches, runs AI task, persists via `create_strategy_snapshot` RPC (Evidence: `12_GENERATE_STRATEGY_END_TO_END_AUDIT.md:29-50`)

6. **Strategy Output Tables:** `strategy_documents`, `strategy_modules`, `strategy_decisions`, `strategy_tasks` written atomically via RPC (Evidence: `07_CLIENT_ONBOARDING_STRATEGY_GENERATION_PIPELINE.md:30-33`)

7. **Two Onboarding Versions:** V4 (`OnboardingWizard`) and V5 (`OnboardingV5Wizard`) both call `ai-brains-client` and `ai-brain-ingest` but with different raw response contracts (Evidence: `11_CLIENT_BRAIN_CURRENT_AND_TARGET.md:40-48`)

8. **Default Brain Pack v1:** Auto-seeds 3 core modules (`bootstrap`, `rep_policy`, `quality_bar`) on agency creation; ingests them into RAG (Evidence: `04_DEFAULT_BRAIN_PACK_SEED_REPAIR_FLOW.md:4-8`)

9. **UI Entry Points:** Strategy tab at `/clients/:clientId?tab=strategy` renders `StrategyKnowledgeCenter` which calls `ai-strategy-generate` (Evidence: `12_GENERATE_STRATEGY_END_TO_END_AUDIT.md:17-20`)

10. **Usability Gate Logic:** `evaluateClientBrainForStrategy()` in `brain-quality.ts` requires brand name, offer list, audience problems, pillars, goals, and at least one of banned claims/taboo topics (Evidence: `11_CLIENT_BRAIN_CURRENT_AND_TARGET.md:50-54`)

### What "Generate Strategy" Currently Does

1. User clicks generate in Strategy Knowledge Center
2. UI calls `ai-strategy-generate` with `client_id`
3. Server resolves `agency_id` from `clients` table
4. Server validates JWT + membership (or cron secret)
5. Server loads latest `client_brains` row
6. Server evaluates `usable` gate via `evaluateClientBrainForStrategy()`
7. **If gate fails:** Returns `unknown=true` + `missing_fields` + `questions`
8. **If OPENAI_API_KEY missing:** Returns 500 with `code=MISSING_API_KEY`
9. Server loads `agency_brains.brain_json`, `client_onboarding_profiles`, existing `strategy_modules`
10. Server embeds query and calls `match_ai_embeddings` for client, agency, and exemplar matches
11. Server builds prompt context from onboarding profile, structured strategy, RAG context, references
12. Server runs AI task `TaskType.STRATEGY_PLAN`
13. Server persists via `create_strategy_snapshot` RPC
14. Server logs to `ai_runs` and `ai_usage_logs`

### Where It Breaks

- **Silent failures:** UI does not always surface `unknown=true` responses or API errors
- **Missing references:** If brain_documents not ingested, strategy has 0 agency brain references
- **Onboarding disconnect:** V5 wizard completes but client brain may not be marked `usable=true`
- **No RAG matches:** Returns `unknown=true` asking user to "Upload client guidelines" even when client brain exists

### Top 5 Hard Blockers

| # | Blocker | Impact | Risk | Effort |
|---|---------|--------|------|--------|
| 1 | **Client brain `usable` gate not set after V5 onboarding completes** | 5 | 5 | 2 |
| 2 | **UI swallows `unknown=true` response, user sees "nothing happened"** | 5 | 4 | 2 |
| 3 | **`OPENAI_API_KEY` missing returns 500 but UI doesn't explain** | 4 | 4 | 1 |
| 4 | **No agency brain_documents ingested → 0 agency references** | 4 | 3 | 3 |
| 5 | **`match_ai_embeddings` privilege drift after migrations** | 3 | 5 | 2 |

---

## SECTION 2 — Target System Spec (The Contract)

### 2.1 Agency Brain Contract

**Authoritative Source:** `brain_documents` (modular, versioned, approved)

**Required Modules (5 minimum for V1):**

| Module Key | Required | Description |
|------------|----------|-------------|
| `bootstrap` | Yes | Agency identity, name, positioning |
| `rep_policy` | Yes | Representation policies, what AI should/shouldn't say |
| `quality_bar` | Yes | Quality standards for deliverables |
| `voice_tone` | No | Voice and tone guidelines |
| `icp_profile` | No | Ideal client profile |

**"Active/Usable" Definition:**
- At least 3 core modules (`bootstrap`, `rep_policy`, `quality_bar`) exist with `status='approved'`
- AND corresponding `ai_documents` rows exist with `doc_type='brain_document'` and matching module metadata
- AND those documents have at least 1 chunk with `embedding_status='ok'`

**Contract Fields (per module):**

```typescript
interface BrainDocument {
  id: uuid;
  agency_id: uuid;
  module: 'bootstrap' | 'rep_policy' | 'quality_bar' | 'voice_tone' | 'icp_profile';
  status: 'draft' | 'pending_approval' | 'approved' | 'archived';
  content_json: Record<string, unknown>;
  version: number;
  approved_at: timestamp | null;
  approved_by: uuid | null;
}
```

### 2.2 Client Brain Contract

**Authoritative Source:** `client_brains.brain_json` (canonical shape)

**Required Fields (8 minimum for usability):**

| Field Path | Required | Type |
|------------|----------|------|
| `brand.name` | Yes | string |
| `brand.positioning` | No | string |
| `offer.primary_offer` | Yes | string |
| `offer.offer_list` | Yes | string[] |
| `audience.primary_problem` | Yes | string |
| `audience.problems` | Yes | string[] |
| `messaging.pillars` | Yes | string[] |
| `goals.primary_goal` | Yes | string |
| `constraints.banned_claims` OR `constraints.taboo_topics` | Yes (either) | string[] |

**"Usable" Definition:**
- `client_brains.usable = true` 
- Derived automatically by `evaluateClientBrainForStrategy()` 
- NEVER manually toggled in UI or DB
- Computed on every `ai-brain-ingest scope='client'` call

**Contract Shape:**

```typescript
interface ClientBrain {
  brand: {
    name: string;
    positioning?: string;
    tagline?: string;
  };
  offer: {
    primary_offer: string;
    offer_list: string[];
    pricing_model?: string;
  };
  audience: {
    primary_problem: string;
    problems: string[];
    demographics?: string;
  };
  messaging: {
    pillars: string[];
    value_props?: string[];
  };
  goals: {
    primary_goal: string;
    secondary_goals?: string[];
  };
  constraints: {
    banned_claims?: string[];
    taboo_topics?: string[];
    compliance_notes?: string;
  };
  proof?: {
    testimonials?: string[];
    case_studies?: string[];
  };
}
```

### 2.3 Strategy Artifact Contract

**Output Modules (6 fixed modules):**

| Module | Description |
|--------|-------------|
| `positioning` | Brand positioning statement |
| `messaging_pillars` | Core messaging pillars with rationale |
| `content_themes` | Content theme recommendations |
| `audience_segments` | Target audience segments |
| `channel_strategy` | Platform/channel recommendations |
| `kpis` | Key performance indicators |

**Storage Expectations:**
- `strategy_documents`: Single active document per client (`is_active=true`)
- `strategy_modules`: 6 rows per strategy, one per module key
- Versioning: `strategies.version_int` increments on each generation

**Required References/Citations Rules:**
- Every strategy MUST reference at least 1 agency brain document chunk
- Every strategy MUST reference at least 1 client context source (client brain summary or onboarding data)
- References stored in `ai_runs.citations.memory_citations`
- References rendered in document as "References:" section

**Strategy Document Shape:**

```typescript
interface StrategyDocument {
  id: uuid;
  client_id: uuid;
  agency_id: uuid;
  content_html: string;
  content_markdown: string;
  source: 'ai_generated' | 'template' | 'manual';
  is_active: boolean;
  model: string;
  generation_instruction?: string;
  derived_from_hash?: string;
}
```

### 2.4 Error Contract

| # | Failure Case | HTTP Status | Error Code | User-Visible Message |
|---|--------------|-------------|------------|----------------------|
| 1 | Missing `client_id` | 400 | `MISSING_CLIENT_ID` | "Client ID is required to generate strategy." |
| 2 | Client not found | 404 | `CLIENT_NOT_FOUND` | "Client not found. Please check the client ID." |
| 3 | User not member of agency | 403 | `FORBIDDEN` | "You don't have access to this client's agency." |
| 4 | Client brain missing | 400 | `CLIENT_BRAIN_MISSING` | "Complete client onboarding before generating strategy." |
| 5 | Client brain not usable (missing fields) | 200 | `BRAIN_INCOMPLETE` | "Client profile is incomplete. Missing: {fields}. [Complete Profile →]" |
| 6 | Agency brain not ready (0 approved modules) | 200 | `AGENCY_BRAIN_INCOMPLETE` | "Agency AI setup incomplete. [Complete AI Setup →]" |
| 7 | `OPENAI_API_KEY` missing | 500 | `MISSING_API_KEY` | "AI service not configured. Contact your administrator." |
| 8 | Embedding/retrieval failure | 500 | `RAG_FAILURE` | "Failed to retrieve context. Please try again." |
| 9 | AI generation timeout | 504 | `GENERATION_TIMEOUT` | "Strategy generation timed out. Please try again." |
| 10 | AI generation error | 500 | `GENERATION_ERROR` | "Failed to generate strategy. Please try again." |
| 11 | Snapshot persistence failure | 500 | `PERSISTENCE_ERROR` | "Failed to save strategy. Please try again." |
| 12 | Rate limit exceeded | 429 | `RATE_LIMIT_EXCEEDED` | "Too many requests. Please wait and try again." |

**Response Shape (for gated/incomplete cases):**

```typescript
interface StrategyGatedResponse {
  unknown: true;
  code: 'BRAIN_INCOMPLETE' | 'AGENCY_BRAIN_INCOMPLETE';
  missing_fields?: string[];
  questions?: string[];
  deep_link?: string; // URL to complete the missing step
}
```

---

## SECTION 3 — Architecture Decision: 1 Source of Truth

### The Problem: Two Competing Agency Brain Systems

The audits reveal two parallel systems:

1. **System A: `agency_brains.brain_json`** (monolithic JSON)
   - Written by onboarding wizard and admin chat
   - Loaded by `ai-strategy-generate` as structured context
   - Evidence: `10_AGENCY_BRAIN_CURRENT_AND_TARGET.md:52-54`

2. **System B: `brain_documents`** (modular, versioned, approved)
   - Edited in `/agency/ai-setup`
   - Ingested to RAG as `doc_type='brain_document'`
   - Retrieved via `match_ai_embeddings` during strategy generation
   - Evidence: `10_AGENCY_BRAIN_CURRENT_AND_TARGET.md:39-41`

### Decision: `brain_documents` is Authoritative for Phase 1

**For strategy generation, `brain_documents` (ingested to RAG) is the authoritative Agency Brain source.**

**Rationale:**

1. **Already wired:** Strategy generation already retrieves `brain_document` chunks via RAG (Evidence: `12_GENERATE_STRATEGY_END_TO_END_AUDIT.md:57`)

2. **Versioned and auditable:** `brain_documents` has approval workflow, version history, and status tracking

3. **Modular:** Allows incremental editing without breaking the whole brain

4. **Explainable:** Citations can reference specific modules and chunks

**What becomes secondary/deprecated:**

- `agency_brains.brain_json` becomes a **legacy profile record** for:
  - Onboarding state tracking
  - Admin setup chat context
  - UI display in non-strategy contexts

- `agency_brains.brain_json` is **NOT** used as primary input for strategy generation context

**Why this minimizes risk now:**

1. No schema migration needed — RAG tables already exist
2. No UI rewrite needed — AI Setup UI already manages `brain_documents`
3. Strategy pipeline already calls `match_ai_embeddings` — just needs validation that it returns agency references
4. Default Brain Pack v1 already seeds and ingests core modules

---

## SECTION 4 — Phase Plan

### PHASE 1: Stabilize the Strategy Flow (15 items)

**Goal: Make "Generate Strategy" work end-to-end with 0 silent failures**

| # | Item | Goal | Evidence | Impact | Risk | Effort | Dependencies | Acceptance Criteria |
|---|------|------|----------|--------|------|--------|--------------|---------------------|
| 1.1 | **Fix client brain usable gate after V5 onboarding** | Ensure `ai-brain-ingest` always sets `usable=true` when required fields present | `11_CLIENT_BRAIN_CURRENT_AND_TARGET.md:26-34` | 5 | 5 | 2 | None | 1) V5 onboarding completes → `client_brains.usable=true`; 2) SQL query confirms usable; 3) Generate strategy succeeds |
| 1.2 | **Surface `unknown=true` response in UI with actionable message** | UI must show error toast with deep-link when backend returns gated response | `12_GENERATE_STRATEGY_END_TO_END_AUDIT.md:63-73` | 5 | 4 | 2 | None | 1) `unknown=true` → toast with message; 2) toast includes link to fix; 3) no "nothing happened" state |
| 1.3 | **Handle MISSING_API_KEY in UI** | Show clear admin-actionable error when OpenAI key missing | `09_INFRASTRUCTURE_ENV_SECRETS_DEPLOYMENT.md:108-110` | 4 | 4 | 1 | None | 1) 500 + `code=MISSING_API_KEY` → "AI service not configured" toast; 2) message suggests contacting admin |
| 1.4 | **Validate agency brain has at least 1 ingested module before generation** | Add server-side check for at least 1 `ai_documents(doc_type='brain_document')` | `10_AGENCY_BRAIN_CURRENT_AND_TARGET.md:92-96` | 4 | 3 | 2 | 1.1 | 1) If 0 agency brain docs → return `AGENCY_BRAIN_INCOMPLETE` code; 2) UI shows deep-link to AI Setup |
| 1.5 | **Harden `match_ai_embeddings` privileges** | Verify/apply migration restricting EXECUTE to service_role only | `02_DB_SCHEMA_RLS_MIGRATIONS.md:159-161` | 3 | 5 | 2 | None | 1) `has_function_privilege('authenticated', ...)` returns false; 2) `has_function_privilege('service_role', ...)` returns true |
| 1.6 | **Add deterministic module structure to strategy output** | Ensure every strategy has exactly 6 module rows | `07_CLIENT_ONBOARDING_STRATEGY_GENERATION_PIPELINE.md:30-33` | 4 | 3 | 3 | None | 1) `strategy_modules` has 6 rows per strategy; 2) modules match contract (positioning, messaging_pillars, etc.) |
| 1.7 | **Enforce at least 1 agency reference in strategy** | Strategy generation fails if 0 agency brain_document chunks retrieved | `12_GENERATE_STRATEGY_END_TO_END_AUDIT.md:52-59` | 4 | 3 | 2 | 1.4 | 1) Strategy includes References section with ≥1 agency ref; 2) `ai_runs.citations` populated |
| 1.8 | **Enforce at least 1 client reference in strategy** | Strategy generation fails if 0 client context sources available | `07_CLIENT_ONBOARDING_STRATEGY_GENERATION_PIPELINE.md:85-87` | 4 | 3 | 2 | 1.1 | 1) Strategy includes client brain data; 2) citation logged |
| 1.9 | **Write automated test: happy path strategy generation** | Integration test covering full pipeline | All audits | 4 | 2 | 3 | 1.1, 1.4 | 1) Test creates agency + client + brain docs; 2) generates strategy; 3) asserts document + modules created |
| 1.10 | **Write automated test: cross-tenant isolation** | Test proving agency A cannot retrieve agency B's embeddings | `05_INGESTION_CHUNKING_EMBEDDINGS_RAG.md:177-180` | 4 | 5 | 3 | 1.5 | 1) Agency A creates brain doc; 2) Agency B calls retrieval; 3) Assert 0 matches from A |
| 1.11 | **Write automated test: gated response when brain incomplete** | Test proving UI receives actionable error | `11_CLIENT_BRAIN_CURRENT_AND_TARGET.md:64-67` | 4 | 3 | 2 | 1.2 | 1) Client brain missing `pillars`; 2) Call generate; 3) Assert `unknown=true` + `missing_fields` |
| 1.12 | **Add `ai_runs` row for every strategy generation attempt** | Observability: every attempt logged regardless of success | `12_GENERATE_STRATEGY_END_TO_END_AUDIT.md:89-93` | 3 | 2 | 2 | None | 1) Successful run → `ai_runs` with `success=true`; 2) Gated run → `ai_runs` with `unknown=true` |
| 1.13 | **Implement generation timeout with clear error** | 3-minute timeout with user-facing message | N/A (best practice) | 3 | 3 | 2 | None | 1) Generation >3min → 504 + `GENERATION_TIMEOUT`; 2) UI shows retry message |
| 1.14 | **Verify V4 and V5 onboarding both produce usable brain** | Confirm both paths call `ai-brain-ingest` correctly | `07_CLIENT_ONBOARDING_STRATEGY_GENERATION_PIPELINE.md:56-59` | 4 | 3 | 2 | 1.1 | 1) V4 completion → `usable=true`; 2) V5 completion → `usable=true`; 3) Both trigger strategy successfully |
| 1.15 | **Document deployment checklist** | Ensure all env vars and migrations applied | `09_INFRASTRUCTURE_ENV_SECRETS_DEPLOYMENT.md:86-96` | 3 | 4 | 1 | None | 1) Checklist includes `OPENAI_API_KEY`; 2) Includes migration verification SQL; 3) Includes function deploy |

---

### PHASE 2: Make Brains Consistent + Expand Value (12 items)

**Goal: Unify brain systems and improve quality/reliability**

| # | Item | Goal | Evidence | Impact | Risk | Effort | Dependencies | Acceptance Criteria |
|---|------|------|----------|--------|------|--------|--------------|---------------------|
| 2.1 | **Unify V4/V5 onboarding raw response contract** | Single mapping function for both flows | `11_CLIENT_BRAIN_CURRENT_AND_TARGET.md:69-70` | 4 | 3 | 4 | Phase 1 | 1) Single `mapRawResponsesToClientBrain()` function; 2) Both V4/V5 use it; 3) Output shape identical |
| 2.2 | **Deprecate `agency_brains.brain_json` in strategy generation** | Remove loading of monolithic brain from strategy pipeline | `10_AGENCY_BRAIN_CURRENT_AND_TARGET.md:67-70` | 3 | 3 | 3 | Phase 1 | 1) `ai-strategy-generate` no longer queries `agency_brains`; 2) All agency context from RAG |
| 2.3 | **Implement agency brain readiness gate** | Add `isAgencyBrainReady()` helper checking 3 core modules | `10_AGENCY_BRAIN_CURRENT_AND_TARGET.md:76-77` | 4 | 3 | 2 | 1.4 | 1) Function returns boolean; 2) Used by UI and backend; 3) Checks ingestion health |
| 2.4 | **Add "complete profile" deep-links in error responses** | `deep_link` field in all gated responses | `11_CLIENT_BRAIN_CURRENT_AND_TARGET.md:66-67` | 3 | 2 | 2 | 1.2 | 1) `BRAIN_INCOMPLETE` includes link to onboarding; 2) `AGENCY_BRAIN_INCOMPLETE` links to AI Setup |
| 2.5 | **Implement strategy regeneration with instruction** | Support `instruction` param for guided regeneration | `12_GENERATE_STRATEGY_END_TO_END_AUDIT.md:26` | 3 | 2 | 3 | Phase 1 | 1) Pass instruction → strategy reflects it; 2) Original context preserved |
| 2.6 | **Add strategy diff/comparison view** | Show what changed between strategy versions | N/A | 2 | 2 | 4 | Phase 1 | 1) UI shows version history; 2) Diff highlights changes |
| 2.7 | **Implement brain document upload analysis** | Replace placeholder in `ai-brain-analyze` | `01_UI_UX_AGENCY_AI_SETUP.md:79-80` | 3 | 3 | 5 | Phase 1 | 1) Upload PDF/DOCX → AI extracts content; 2) Populates draft brain doc |
| 2.8 | **Add progress indicator during generation** | Real-time feedback during 1-3 minute generation | N/A | 3 | 2 | 3 | Phase 1 | 1) UI shows "Analyzing..." → "Generating..." → "Saving..."; 2) Progress bar or spinner |
| 2.9 | **Implement citation validation in output** | Verify AI output references match actual sources | `05_INGESTION_CHUNKING_EMBEDDINGS_RAG.md:155-157` | 3 | 3 | 3 | 1.7 | 1) Citations validated against `ai_runs.citations`; 2) Invalid citations logged |
| 2.10 | **Add brain module templates for non-default modules** | Provide starting templates for voice_tone, icp_profile | `10_AGENCY_BRAIN_CURRENT_AND_TARGET.md:49` | 2 | 2 | 3 | Phase 1 | 1) Template content for each module; 2) UI offers "Start from template" |
| 2.11 | **Implement guided onboarding → AI Setup bridge** | Connect admin chat completion to brain docs | `06_AGENCY_ONBOARDING_TO_AGENCY_BRAIN.md:98-103` | 3 | 3 | 4 | Phase 1 | 1) Chat completion triggers brain doc creation; 2) User sees modules in AI Setup |
| 2.12 | **Add admin dashboard for AI health monitoring** | Show brain readiness, ingestion status across clients | N/A | 2 | 2 | 4 | Phase 1 | 1) Dashboard shows agency/client brain status; 2) Lists clients needing attention |

---

### PHASE 3: Premium/Proactive Features (10 items)

**Goal: Add proactive AI features and premium capabilities**

| # | Item | Goal | Evidence | Impact | Risk | Effort | Dependencies | Acceptance Criteria |
|---|------|------|----------|--------|------|--------|--------------|---------------------|
| 3.1 | **Implement strategy auto-generation after onboarding** | Automatically generate strategy when client onboarding completes | `07_CLIENT_ONBOARDING_STRATEGY_GENERATION_PIPELINE.md:74` | 4 | 3 | 3 | Phase 2 | 1) Onboarding complete → strategy auto-generated; 2) User notified |
| 3.2 | **Add scheduled strategy refresh recommendations** | Proactively suggest strategy updates based on time or events | N/A | 3 | 2 | 4 | Phase 2 | 1) 30-day old strategy → notification; 2) User can trigger refresh |
| 3.3 | **Implement content generation from strategy** | Generate content pieces based on strategy modules | `08_AI_PROMPTS_CONTEXT_ASSEMBLY_AND_MEMORY.md:28` | 4 | 3 | 5 | Phase 2 | 1) Select module → generate post/email; 2) Content references strategy |
| 3.4 | **Add multi-client batch strategy generation** | Agency admin generates strategies for multiple clients | N/A | 3 | 3 | 4 | Phase 2 | 1) Select clients → batch generate; 2) Progress shown per client |
| 3.5 | **Implement strategy approval workflow** | Require approval before strategy is "active" | N/A | 2 | 2 | 4 | Phase 2 | 1) Generated → pending → approved; 2) Approver can comment |
| 3.6 | **Add competitor analysis module** | New strategy module analyzing competitor positioning | N/A | 3 | 3 | 5 | Phase 2 | 1) User inputs competitor info; 2) Strategy includes differentiation |
| 3.7 | **Implement brain document suggestions** | AI suggests updates to brain docs based on client performance | N/A | 3 | 4 | 5 | Phase 2 | 1) Performance data → suggestions; 2) User can accept/reject |
| 3.8 | **Add strategy export (PDF/PPTX)** | Export strategy document to shareable formats | N/A | 3 | 2 | 4 | Phase 2 | 1) Export button in UI; 2) Branded PDF/PPTX generated |
| 3.9 | **Implement client-facing strategy portal** | Client can view their strategy without agency login | N/A | 3 | 4 | 5 | Phase 2 | 1) Shareable link to strategy; 2) Read-only view; 3) Agency branded |
| 3.10 | **Add usage analytics dashboard** | Track AI usage, costs, and performance per agency | `08_AI_PROMPTS_CONTEXT_ASSEMBLY_AND_MEMORY.md:118-129` | 2 | 2 | 4 | Phase 2 | 1) Dashboard shows token usage; 2) Cost per client; 3) Success rates |

---

## SECTION 5 — Codex Implementation Prompt

```markdown
# SMMAHUB Phase 1: Strategy Generation Stabilization

## Mission
Implement Phase 1 items to make "Generate Strategy" work end-to-end with 0 silent failures.

## Pre-Implementation Requirements

### STEP 1: Run Baseline Tests and Document Results
Before making any changes, run all verification commands and log results:

```bash
# Create results log
mkdir -p /home/claude/audit_results
echo "# SMMAHUB Baseline Audit - $(date)" > /home/claude/audit_results/baseline.md

# Run repo commands
npm test 2>&1 | tee -a /home/claude/audit_results/baseline.md
npm run lint 2>&1 | tee -a /home/claude/audit_results/baseline.md
npx tsc -p tsconfig.json --noEmit 2>&1 | tee -a /home/claude/audit_results/baseline.md
npm run build 2>&1 | tee -a /home/claude/audit_results/baseline.md
```

Log any failures. Do NOT proceed if baseline fails.

### STEP 2: Verify Referenced Paths Exist
For each file path referenced in this prompt, verify existence:

```bash
# Verify critical paths (STOP if any missing)
test -f supabase/functions/ai-strategy-generate/index.ts || echo "MISSING: ai-strategy-generate"
test -f supabase/functions/ai-brain-ingest/index.ts || echo "MISSING: ai-brain-ingest"
test -f supabase/functions/_shared/brain-quality.ts || echo "MISSING: brain-quality.ts"
test -f src/hooks/useStrategyDocuments.ts || echo "MISSING: useStrategyDocuments.ts"
test -f src/components/strategy-os/StrategyKnowledgeCenter.tsx || echo "MISSING: StrategyKnowledgeCenter"
```

If any path is MISSING, search the repo and report findings. Do NOT guess.

## Implementation Order

### Phase 1.1: Fix Client Brain Usable Gate
**File:** `supabase/functions/ai-brain-ingest/index.ts`

1. Locate `evaluateClientBrainForStrategy` call
2. Verify it sets `client_brains.usable = true` when all required fields present
3. Add logging to confirm gate evaluation result
4. Create test case in `src/__tests__/client-brain-usable.test.ts`

**Acceptance Test:**
```sql
-- After V5 onboarding completes for test client
SELECT usable, status FROM client_brains WHERE client_id = :test_client_id;
-- Expected: usable=true, status='usable'
```

### Phase 1.2: Surface Unknown Response in UI
**File:** `src/hooks/useStrategyDocuments.ts` and `src/components/strategy-os/StrategyKnowledgeCenter.tsx`

1. Locate where `ai-strategy-generate` response is handled
2. Check for `response.unknown === true`
3. If unknown, throw error with message from `response.questions` or `response.missing_fields`
4. In `StrategyKnowledgeCenter`, catch error and show toast with action button

**Required UI Behavior:**
```typescript
if (data.unknown) {
  const message = data.code === 'BRAIN_INCOMPLETE' 
    ? `Complete client profile. Missing: ${data.missing_fields?.join(', ')}`
    : data.questions?.[0] || 'Unable to generate strategy';
  throw new Error(message);
}
```

### Phase 1.3: Handle MISSING_API_KEY in UI
**File:** `src/hooks/useStrategyDocuments.ts`

1. Check for response status 500 with `code: 'MISSING_API_KEY'`
2. Show specific toast: "AI service not configured. Contact your administrator."

### Phase 1.4: Validate Agency Brain Has Ingested Modules
**File:** `supabase/functions/ai-strategy-generate/index.ts`

1. Before RAG retrieval, query:
```sql
SELECT COUNT(*) FROM ai_documents 
WHERE agency_id = $agencyId 
AND doc_type = 'brain_document'
AND metadata->>'status' = 'approved';
```
2. If count = 0, return `{ unknown: true, code: 'AGENCY_BRAIN_INCOMPLETE', deep_link: '/agency/ai-setup' }`

### Phase 1.5: Harden match_ai_embeddings Privileges
**Migration:** `supabase/migrations/[timestamp]_harden_match_ai_embeddings_final.sql`

```sql
-- Revoke from all roles
REVOKE ALL ON FUNCTION public.match_ai_embeddings FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_ai_embeddings FROM anon;
REVOKE ALL ON FUNCTION public.match_ai_embeddings FROM authenticated;

-- Grant only to service_role
GRANT EXECUTE ON FUNCTION public.match_ai_embeddings TO service_role;
```

**Verification:**
```sql
SELECT 
  has_function_privilege('service_role', 'public.match_ai_embeddings(uuid, vector(1536), uuid, int, text[], text[], float8)', 'execute') AS service_ok,
  has_function_privilege('authenticated', 'public.match_ai_embeddings(uuid, vector(1536), uuid, int, text[], text[], float8)', 'execute') AS auth_blocked;
-- Expected: service_ok=true, auth_blocked=false
```

### Phase 1.6-1.8: Reference Enforcement
**File:** `supabase/functions/ai-strategy-generate/index.ts`

1. After retrieval, check `agencyMatches.length >= 1`
2. Check `clientMatches.length >= 1 || clientBrain exists`
3. If either fails, return gated response with appropriate code
4. Log references to `ai_runs.citations`

### Phase 1.9-1.11: Automated Tests
**Files:** `src/__tests__/strategy-generation.integration.test.ts`

```typescript
describe('Strategy Generation', () => {
  test('happy path: generates strategy with references', async () => {
    // Setup: create agency with brain docs, client with usable brain
    // Act: call ai-strategy-generate
    // Assert: strategy_documents created, strategy_modules has 6 rows
    // Assert: at least 1 agency reference, at least 1 client reference
  });

  test('cross-tenant isolation: agency B cannot see agency A embeddings', async () => {
    // Setup: agency A creates brain doc with unique content
    // Act: agency B calls retrieval with same query
    // Assert: 0 matches containing agency A content
  });

  test('gated response when client brain incomplete', async () => {
    // Setup: create client with incomplete brain (missing pillars)
    // Act: call ai-strategy-generate
    // Assert: response has unknown=true, missing_fields includes 'pillars'
  });
});
```

### Phase 1.12: Log All Attempts to ai_runs
**File:** `supabase/functions/ai-strategy-generate/index.ts`

Ensure `ai_runs` insert happens BEFORE returning, including for gated/error cases:
```typescript
await supabase.from('ai_runs').insert({
  agency_id: agencyId,
  client_id: clientId,
  endpoint: 'ai-strategy-generate',
  success: !unknown && !error,
  unknown: unknown ?? false,
  metadata: { code, missing_fields, error_message }
});
```

## STOP IF UNCERTAIN Rule

If you cannot find a referenced file path, table name, or function:
1. Run `find . -name "filename" -o -name "*partial*"`
2. Run `rg -l "function_name" --type ts`
3. Report what you found instead of guessing
4. Do NOT create files or modify code based on assumptions

## Definition of Done Checklist

Before marking Phase 1 complete, verify ALL of the following:

- [ ] `npm test` passes (no regressions)
- [ ] `npm run lint` passes
- [ ] `npx tsc -p tsconfig.json --noEmit` passes
- [ ] `npm run build` succeeds
- [ ] New tests in `src/__tests__/strategy-generation.integration.test.ts` pass
- [ ] Manual test: V5 onboarding → client brain usable → strategy generates
- [ ] Manual test: Incomplete client brain → UI shows actionable error
- [ ] Manual test: No agency brain docs → UI shows "Complete AI Setup" link
- [ ] SQL verification: `has_function_privilege('authenticated', 'match_ai_embeddings...')` = false
- [ ] SQL verification: Generated strategy has References section with ≥1 agency ref
- [ ] `ai_runs` row exists for every generation attempt (success and failure)

## Enforcement Rules

1. **0 silent failures:** Every error must result in user-visible message
2. **0 cross-tenant risk:** `match_ai_embeddings` callable only by service_role
3. **Deterministic structure:** Every strategy has exactly 6 module rows

---

Copy to /home/claude/audit_results/implementation_log.md after each implementation step.
```

---

## SECTION 6 — Risk Register

| # | Risk Statement | Likelihood | Impact | Mitigation |
|---|----------------|------------|--------|------------|
| 1 | **SECURITY:** `match_ai_embeddings` callable by `authenticated` role allows cross-tenant RAG retrieval | 4 | 5 | Apply privilege hardening migration and verify with `has_function_privilege` before deploying |
| 2 | **SECURITY:** Edge functions with `verify_jwt=false` could be exploited if membership check has bugs | 3 | 5 | Audit all `verify_jwt=false` functions; add integration tests for membership enforcement |
| 3 | **SECURITY:** Service role key exposed in client-side code would bypass all RLS | 2 | 5 | Verify `SUPABASE_SERVICE_ROLE_KEY` only used in edge functions, never in frontend |
| 4 | **RELIABILITY:** `OPENAI_API_KEY` missing in production causes 500 errors with no user recourse | 4 | 4 | Add deployment checklist verification; implement admin notification system |
| 5 | **RELIABILITY:** V5 onboarding completes but `ai-brain-ingest` fails silently, leaving brain unusable | 4 | 5 | Add explicit error handling and retry mechanism; verify gate before navigation |
| 6 | **RELIABILITY:** Strategy generation timeout (>3min) leaves user waiting indefinitely | 3 | 4 | Implement server-side timeout with graceful error response |
| 7 | **UX:** UI swallows backend errors, user sees "nothing happened" | 4 | 4 | Audit all API call sites; ensure every response path shows user feedback |
| 8 | **UX:** Missing deep-links in error messages force user to manually navigate | 3 | 3 | Add `deep_link` field to all gated responses; implement link handling in UI |
| 9 | **DATA:** Privilege drift after migration updates breaks production retrieval | 3 | 5 | Run `has_function_privilege` checks in deployment verification; add to CI |
| 10 | **DATA:** Embedding dimension mismatch between model versions corrupts RAG | 2 | 4 | Pin embedding model version; validate dimension on write |

---

## SECTION 7 — Open Questions (Max 7)

1. **V4 vs V5 Onboarding:** Should V4 be deprecated in Phase 1, or must both flows work? (Recommendation: Keep both working but prioritize V5 fixes)

2. **Agency Brain Minimum Modules:** Is 3 core modules (`bootstrap`, `rep_policy`, `quality_bar`) truly the minimum, or should we require all 5? (Recommendation: Require 3 for V1, make 5 a soft recommendation)

3. **Strategy Module Count:** The contract specifies 6 modules. Is this fixed, or should it be configurable per agency? (Recommendation: Fixed at 6 for V1, configurability in Phase 3)

4. **Reference Validation Strictness:** If AI generates a citation that doesn't match `ai_runs.citations`, should we fail the generation or just log a warning? (Recommendation: Log warning for V1, fail in V2)

5. **Rate Limit Scope:** Current rate limits are per (agency, user, day). Should strategy generation have a separate, higher limit? (Recommendation: Yes, separate limit of 50/day for strategy)

6. **Timeout Duration:** Is 3 minutes an acceptable timeout for strategy generation, or should it be shorter/longer? (Recommendation: 3 minutes, with progress feedback after 30 seconds)

7. **OPENAI_API_KEY Fallback:** If the API key is missing, should we have a fallback template-based strategy, or always fail? (Recommendation: Always fail with clear error; templates are misleading)
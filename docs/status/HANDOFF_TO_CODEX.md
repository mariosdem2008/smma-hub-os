# HANDOFF TO GPT CODEX 5.2
*Copy-paste this entire file into GPT Codex to continue development*

## Context: SMMAHUB AI-Powered Social Media Management Platform

You're working on **SMMAHUB**, a multi-tenant SaaS for social media agencies to manage clients with AI assistance. The AI "employee" helps with content strategy, generation, and client communication.

**Current Branch:** `feat/onboarding-v3-ai-guided-2025-12-24`
**Status:** AI Onboarding V3 is DONE but uncommitted (8 files modified/deleted)
**Build Health:** ✅ 14/14 tests passing, ✅ TypeScript clean

---

## 20 Key Facts (Evidence-Based)

1. **AI Onboarding V3 is the ONLY onboarding system** - V1 and V2 were deleted in this branch
   - Component: `src/components/ai/AiOnboardingV3Guided.tsx`
   - Edge function: `supabase/functions/ai-onboarding-guide/index.ts`
   - Tests: 8 passing tests prove typewriter effect, skip logic, back navigation work

2. **Onboarding session state persists in database** - cross-device resume works
   - Table: `client_onboarding_sessions` (migration `20251224150000`)
   - Stores: `answers_json`, `step_id`, `completed_required`, `brain_id`
   - RLS policies ensure agency-scoped access

3. **Brain validation gates client access** - 6 required fields checked
   - RPC: `get_client_brain_status` (migration `20251224121500`)
   - Validates: brand_basics.name, offer_details.products_services, audience.problems, pillars, goals, constraints
   - Returns: `usable` (bool), `missing_fields` (array), `missing_fields_count` (int)
   - ClientDetail.tsx blocks access if `!gateStatus.usable`

4. **V3 onboarding has 9 required + 6 optional steps**
   - Required: brand_basics, niche, offers, audience, differentiators, tone_voice, platforms, goals_kpis, constraints_approvals
   - Optional: competitors, pillars, cta_styles, assets, pricing, timeline
   - Skip button ONLY shown for optional steps (line 1054, AiOnboardingV3Guided.tsx)

5. **Brain ingest transforms V3 answers into brain_json schema**
   - Edge function: `ai-brain-ingest/index.ts`
   - Mapping is V3-ONLY (lines 195-251) - no V2 fallback exists anymore
   - Example: `answers.platforms` → `brain_json.brand_basics.socials`
   - Adds default constraint if none selected: "No specific content restrictions"

6. **Embeddings use pgvector with 1536-dim OpenAI embeddings**
   - Table: `ai_embeddings` (vector(1536) column)
   - Model: `text-embedding-3-small` (hardcoded in `_shared/embeddings.ts`)
   - Search: `match_ai_embeddings` RPC uses cosine similarity (`<=>`)
   - Chunks: 900 tokens with 140-token overlap, max 12 per document

7. **41 edge functions exist** - most are operational
   - AI core: `ai-ask`, `ai-strategy-generate`, `ai-brain-ingest`, `ai-onboarding-guide`, `ai-retrieve-context`
   - Client portal auth: `client-auth-login`, `client-auth-signup`, `client-auth-forgot-password`
   - Social: `social-oauth`, `refresh-meta-tokens`, `sync-social-metrics`
   - Content: `generate-ai-content`, `publish-scheduled-posts`
   - Billing: `create-checkout`, `stripe-webhook`, `customer-portal`

8. **Client portal is separate auth system** - NOT using Supabase Auth
   - Table: `client_portal_users`
   - Functions: `client-auth-*` handle custom JWT auth
   - UI pages: PortalApprovals, PortalContentCalendar, PortalPerformance, etc.

9. **No AI safety filters in production endpoints** - HIGH RISK
   - `ai-ask/index.ts` and `ai-strategy-generate/index.ts` have no content moderation
   - `ai_usage_logs.unknown` field exists but not populated
   - `docs/ai/safety_unknown_policy.md` exists but not implemented

10. **Usage logging exists but no tier enforcement** - FREE USERS COULD DRAIN CREDITS
    - Table: `ai_usage_logs` has columns for tokens, model, endpoint
    - No quota checks in code
    - No rate limiting
    - No billing integration with usage

11. **Meta (Facebook/Instagram) integration is wired**
    - OAuth: `social-oauth` + `social-oauth-callback`
    - Token refresh: `refresh-meta-tokens`
    - Metrics sync: `sync-social-metrics`
    - Ads sync: `sync-meta-ads`

12. **Stripe billing is operational**
    - Tables: `subscriptions`, `subscription_tiers`
    - Webhook: `stripe-webhook/index.ts`
    - Checkout: `create-checkout/index.ts`
    - Customer portal: `customer-portal/index.ts`

13. **Team invites are hardened** - multi-step email verification
    - Table: `team_invites`
    - Migration: `20251221131145_team_invite_hardening.sql`
    - Logs: `invite_email_logs` (migration `20251221140000`)

14. **Agency brain onboarding UI was removed** - no replacement yet
    - Route `/ai/onboarding/agency` deleted from App.tsx
    - File `AiOnboardingAgency.tsx` deleted
    - Agency brains can still be created via `ai-brains-agency` function, just no UI

15. **Content calendar + approvals UIs exist** - backend workflow unclear
    - Pages: PortalContentCalendar, PortalApprovals
    - Edge functions: `send-approval-notification`, `generate-approval-reminders`
    - TODO: Verify full approval workflow (submit → notify → approve → publish)

16. **RLS policies are comprehensive** - multi-tenant ready
    - All major tables have RLS enabled
    - Policies check `agency_members` for user authorization
    - Recent hardening: `20251222090000_restore_client_member_access.sql`

17. **Asset management is operational**
    - Table: `assets`
    - View: `client_asset_counts_view` (migration `20251224124500`)
    - Upload: `upload-file/index.ts`

18. **AI memory items store context snippets** - searchable
    - Table: `ai_memory_items`
    - Columns: type, content, metadata (jsonb)
    - Used for: client_brain_summary, conversation history, etc.

19. **Scheduled posts use cron** - Edge function runs periodically
    - Function: `publish-scheduled-posts/index.ts`
    - See: `supabase/functions/CRON_SETUP.md` for schedule config

20. **React Router v7 warnings present** - not blocking but should be addressed
    - Tests show deprecation warnings
    - Future flags not enabled: `v7_startTransition`, `v7_relativeSplatPath`

---

## Critical Flow 1: Client Onboarding → Brain Lock

```
User Action:
1. Navigate to /onboarding/ai/client/:clientId

Frontend (AiOnboardingV3Guided.tsx):
2. useEffect on mount:
   - Check if session exists: SELECT * FROM client_onboarding_sessions WHERE client_id = ?
   - If exists: resume from session.step_id, session.answers_json
   - If not: create brain + session

3. Create brain (if new):
   POST /ai-brains-client
   Body: { action: "create", agency_id, client_id }
   Returns: brain_id, version, status: "draft"

4. Create session (if new):
   INSERT INTO client_onboarding_sessions
   (agency_id, client_id, user_id, brain_id, step_id: "brand_basics", answers_json: {})

5. Load first step:
   POST /ai-onboarding-guide
   Body: { agency_id, client_id, brain_id, step_id: null, answers: {} }
   Returns: StepSpec {
     step_id: "brand_basics",
     assistant_message: "Let's start with basics...",
     input_type: "short_text",
     constraints: { required: true, min: 2 },
     progress_percent: 11,
     can_lock: false
   }

6. User fills inputs, clicks "Next":
   - Frontend validates (canProceed() checks constraints)
   - Builds userInput object based on step_id:
     * brand_basics: { brand, website }
     * tone_voice: { tone: [...], tone_example: "..." }
     * platforms: { platforms: [...], primary_platform: "..." }
     * goals_kpis: { goals: [...], kpis: [...] }
     etc.
   - Updates answers: setAnswers({ ...answers, ...userInput })
   - Saves to session: UPDATE client_onboarding_sessions SET answers_json = ?
   - Updates brain: POST /ai-brains-client { action: "update", brain_json: { raw_responses: answers } }

7. Loads next step:
   POST /ai-onboarding-guide
   Body: { step_id: current, answers: updatedAnswers, user_input: userInput }
   Backend logic (getNextStepId):
   - If in REQUIRED_STEPS: return next required step
   - If last required: return "review_required"
   - If in OPTIONAL_STEPS: return next optional step
   - If skipped steps exist: return skippedSteps[0]
   - Else: return "final_review"

8. User reaches "Lock & Finish" (can_lock = true):
   - Check if skipped steps exist (line 473):
     * If yes: setIsReaskingSkipped(true), load first skipped step
     * User must answer all skipped steps
     * After all answered: resume to final_review

9. User clicks "Lock & Finish":
   POST /ai-brains-client { action: "lock", brain_id }
   → Sets brain.status = "locked"

   POST /ai-brain-ingest { raw_responses: answers }
   → Transforms answers to brain_json schema
   → Validates with evaluateClientBrainForStrategy()
   → Sets brain.usable = true/false
   → Creates ai_memory_items entry (client_brain_summary)
   → Creates ai_documents + ai_document_chunks
   → Generates embeddings
   → Inserts ai_embeddings

10. Redirect to /clients/:clientId
    - ClientDetail.tsx calls get_client_brain_status RPC
    - If usable = false: shows gate UI with missing fields
    - If usable = true: allows access to client workspace
```

**Evidence:**
- Lines 240-334: Initialization logic (AiOnboardingV3Guided.tsx)
- Lines 462-616: handleNext() logic
- Lines 618-658: handleLock() logic
- Lines 96-126: getNextStepId() logic (ai-onboarding-guide/index.ts)
- Lines 195-251: Brain mapping (ai-brain-ingest/index.ts)

---

## Critical Flow 2: Client Portal Approvals
**Status: PARTIAL - UI exists, backend workflow needs verification**

```
Expected Flow (TODO: Verify):
1. Agency creates content → status = "pending_approval"
2. Client logs into portal → sees pending items in PortalApprovals.tsx
3. Client clicks approve/reject
4. Notification sent to agency (send-approval-notification/index.ts)
5. If approved: content ready for scheduling
6. If rejected: agency edits and resubmits
7. Reminders sent via cron (generate-approval-reminders/index.ts)
```

**Files to Check:**
- `src/pages/client-portal/PortalApprovals.tsx`
- `supabase/functions/send-approval-notification/index.ts`
- `supabase/functions/generate-approval-reminders/index.ts`
- Look for: content approval tables, workflow state machine

---

## Critical Flow 3: AI Ask (Q&A)
**Status: DONE but NO SAFETY FILTERS**

```
1. User asks question in UI
2. POST /ai-ask
   Body: { query: "...", agency_id, client_id?, conversation_id? }

3. Backend (ai-ask/index.ts):
   - Embed query: OpenAI text-embedding-3-small
   - Retrieve context: match_ai_embeddings(agency_id, embedding, client_id, 8)
   - Build prompt: system + context + query
   - Call OpenAI chat completion
   - Log usage: INSERT ai_usage_logs
   - Return: { answer, sources, usage }

4. Frontend displays answer
```

**Security Gap:**
- No content filtering on query or answer
- No prompt injection detection
- No PII redaction

---

## Data Model (Key Tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `agencies` | Multi-tenant org | id, name, website, niche |
| `agency_members` | User memberships | agency_id, user_id, role |
| `clients` | Client profiles | id, agency_id, name, logo_url, website |
| `client_brains` | AI context per client | id, client_id, brain_json, status, usable, version |
| `agency_brains` | Agency-wide context | id, agency_id, brain_json, status, version |
| `client_onboarding_sessions` | V3 onboarding state | id, client_id, brain_id, step_id, answers_json, completed_required |
| `ai_documents` | Uploaded docs | id, agency_id, client_id, doc_type, title, extracted_text |
| `ai_document_chunks` | Chunked text | id, document_id, chunk_index, chunk_text, token_count |
| `ai_embeddings` | Vector store | id, agency_id, client_id, embedding (vector 1536), doc_type |
| `ai_memory_items` | Context snippets | id, agency_id, client_id, type, content, metadata |
| `ai_usage_logs` | AI call tracking | id, agency_id, endpoint, model, tokens_estimate |
| `client_portal_users` | Portal auth | id, client_id, email, password_hash |
| `subscriptions` | Stripe billing | id, agency_id, stripe_customer_id, status |
| `assets` | File uploads | id, agency_id, client_id, name, url, type |

**View:**
- `client_asset_counts_view` - Aggregates asset counts per client

---

## Where to Start

### Entry Points (Frontend)
1. **App.tsx** - Main routing (`src/App.tsx`)
2. **AiOnboardingV3Guided.tsx** - Onboarding UI (`src/components/ai/AiOnboardingV3Guided.tsx`)
3. **ClientDetail.tsx** - Client workspace + gate (`src/pages/ClientDetail.tsx`)
4. **Dashboard.tsx** - Agency dashboard (`src/pages/Dashboard.tsx`)

### Entry Points (Backend)
1. **ai-onboarding-guide** - Onboarding step logic (`supabase/functions/ai-onboarding-guide/index.ts`)
2. **ai-brain-ingest** - Brain transformation (`supabase/functions/ai-brain-ingest/index.ts`)
3. **ai-brains-client** - Brain CRUD (`supabase/functions/ai-brains-client/index.ts`)
4. **ai-ask** - Q&A endpoint (`supabase/functions/ai-ask/index.ts`)

### Shared Utilities
1. **_shared/embeddings.ts** - Chunking + embedding logic
2. **_shared/brain-quality.ts** - Brain validation gate
3. **_shared/cors.ts** - CORS config (ALLOWED_ORIGINS)
4. **_shared/env.ts** - Environment detection (local vs prod)

### Key Migrations (Latest)
1. `20251224150000_client_onboarding_sessions.sql` - Onboarding state
2. `20251224121500_get_client_brain_status_rpc.sql` - Brain validation
3. `20251224090000_brain_spine_v1.sql` - Core AI tables
4. `20251224103000_strategy_docs_and_embeddings.sql` - Vector store

### Documentation
1. **docs/status/CURRENT_STATE.md** - This reality check (READ FIRST)
2. **docs/status/NEXT_TASKS.md** - Prioritized task list
3. **docs/ai/spec_v1.md** - Original AI employee spec (vision, may differ from reality)
4. **docs/ai/onboarding_v3.md** - V3 onboarding design doc

---

## DO NOT CHANGE

1. **Vision/Architecture Docs** - Keep as-is, add NOTE if reality differs
   - `docs/ai/*.md` (spec files)
   - `docs/claude/*.md` (context files)

2. **Migration Files** - NEVER edit existing migrations
   - Create NEW migrations for schema changes
   - Migrations are immutable once deployed

3. **RLS Policies** - Don't weaken security
   - All tables must have RLS enabled
   - Agency membership must be validated

4. **Test Files** - Don't delete passing tests
   - 14/14 tests currently passing
   - Add new tests for new features

5. **Edge Function Signatures** - Breaking changes affect clients
   - Maintain backward compatibility
   - Version endpoints if changing contracts

---

## Next Tasks (Top 10)

See `docs/status/NEXT_TASKS.md` for detailed acceptance criteria.

**Quick Summary:**
1. **[P0] Commit & merge V3 onboarding** - 8 uncommitted files risk conflicts
2. **[P1] Add AI safety filters** - Content moderation for ai-ask, ai-strategy-generate
3. **[P1] Implement usage tier enforcement** - Quota limits per subscription tier
4. **[P1] Add embedding model fallback** - Handle OpenAI outages gracefully
5. **[P2] Build agency brain onboarding UI** - Replacement for deleted route
6. **[P2] Verify approval workflow** - End-to-end test of client portal approvals
7. **[P2] Enable React Router v7 flags** - Remove deprecation warnings
8. **[P2] Add brain edit UI** - Allow editing locked brains (new version)
9. **[P2] Add onboarding analytics** - Track step completion rates, drop-offs
10. **[P2] Optimize vector search** - Index tuning, caching for common queries

---

## Common Commands

```bash
# Development
npm run dev              # Start Vite dev server
npm test                 # Run vitest tests
npm run lint             # Run ESLint
npx tsc --noEmit         # TypeScript check

# Database
npx supabase migration new <name>    # Create migration
npx supabase db reset                # Reset local DB
npx supabase gen types typescript    # Generate types

# Deployment
npm run build            # Build for production
npx supabase functions deploy <name> # Deploy edge function
npx supabase db push     # Push migrations to remote
```

---

## Critical Constraints

1. **Multi-Tenant Isolation** - Every query MUST filter by agency_id
2. **RLS Enforcement** - Never bypass RLS with service_role in user-facing endpoints
3. **OpenAI Rate Limits** - No burst protection, add exponential backoff
4. **Embedding Dimensions** - MUST be 1536 (text-embedding-3-small), changing breaks existing vectors
5. **Brain Versioning** - New brain versions on every update, don't mutate locked brains
6. **Onboarding Session** - Max 1 per client (unique constraint), safe for concurrent edits

---

## Gotchas

1. **Skip button logic** - Only shows for optional steps (line 1054), don't break this
2. **Brain gate** - ClientDetail blocks if usable=false, ensure ingest sets this correctly
3. **CORS origins** - Hardcoded in `_shared/cors.ts`, add new domains there
4. **Supabase types** - Regenerate after migrations: `npx supabase gen types typescript`
5. **Edge function OPENAI_API_KEY** - Set in Supabase dashboard secrets, not .env
6. **Client portal auth** - Separate from Supabase Auth, uses custom JWT in `client_portal_users`

---

*End of Handoff - You now have full context to continue development*

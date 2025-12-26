# CURRENT STATE - SMMAHUB Reality Check
*Generated: 2025-12-25*
*Source: feat/onboarding-v3-ai-guided-2025-12-24 branch*

## Repo Snapshot

### Branch & Commits
```
Branch: feat/onboarding-v3-ai-guided-2025-12-24
Status: DIRTY (uncommitted changes to onboarding v3)

Last 5 commits:
4bec81c Deploy Push
33110e3 docs: record rebase base and gate evidence
28d42af fix: add client picker dialog component
a9695f8 docs: add client detail gate verification
069ac95 test(client-detail): run vitest in CI mode
```

### Uncommitted Changes
```
Modified:
- src/App.tsx (removed V2 onboarding routes)
- src/components/ai/AiOnboardingV3Guided.tsx (V3 improvements)
- src/integrations/supabase/types.ts (index signatures)
- supabase/functions/ai-brain-ingest/index.ts (V3-only mapping)
- supabase/functions/ai-onboarding-guide/index.ts (V3 step logic)

Deleted:
- src/components/ai/AiOnboardingChat.tsx (V1)
- src/components/ai/AiOnboardingV2Chat.tsx (V2)
- src/pages/ai/AiOnboardingAgency.tsx (V1-based agency onboarding)
```

### Build Health
```
✅ Tests: 14/14 passed (3 test files)
   - src/data/__tests__/clientBrainStatus.test.ts (3 tests)
   - src/pages/__tests__/ClientDetailGate.test.tsx (3 tests)
   - src/components/ai/__tests__/AiOnboardingV3Guided.test.tsx (8 tests)

✅ TypeScript: No errors (tsc --noEmit --skipLibCheck)

⚠️  React Router warnings: v7 future flags not enabled
```

---

## Feature Inventory

## Bootstrap + Agency Creation (Current)

### Post-auth Bootstrap Routing
- Default post-login route is `/bootstrap` (`src/lib/auth.tsx`, `src/pages/Auth.tsx`).
- Bootstrap pages:
  - `/bootstrap` (runs bootstrap checks, auto-accepts pending invites, routes) — `src/pages/Bootstrap.tsx`
  - `/welcome` (join-or-create) — `src/pages/Welcome.tsx`
  - `/select-agency` (picker for multi-agency) — `src/pages/SelectAgency.tsx`
  - `/create-agency` (static agency onboarding + creation) — `src/pages/CreateAgencyStub.tsx`
- Guard behavior:
  - `ProtectedRoute` requires `localStorage.activeAgencyId` for protected app pages and sends users to `/bootstrap` when missing (`src/components/ProtectedRoute.tsx`).
  - Legacy `/onboarding` is no longer the default entry point for new users.

### DB / RPCs (Bootstrap + Create Agency)
- Bootstrap + invite auto-accept RPCs:
  - `public.get_user_agency_bootstrap()` (memberships + pending_invites)
  - `public.accept_pending_agency_invites()` (accepts pending invites for `auth.users.email`)
  - Migration: `supabase/migrations/20251225201500_bootstrap_rpcs.sql`
- Create agency (secure):
  - `public.create_agency_with_admin(_name, _website)` returns `agency_id`, inserts `agency_members` with `role='admin'` for `auth.uid()`
  - Migration: `supabase/migrations/20251225210000_agency_onboarding_and_create_agency_rpc.sql`
- Agency onboarding persistence:
  - Table: `public.agency_onboarding_sessions`
  - Grant migration: `supabase/migrations/20251225210100_grant_agency_onboarding_sessions.sql`

| Area | Feature | Status | Evidence | Notes |
|------|---------|--------|----------|-------|
| **ONBOARDING** |
| | AI Onboarding V3 Guided | **DONE** | `src/components/ai/AiOnboardingV3Guided.tsx`<br>`supabase/functions/ai-onboarding-guide/index.ts`<br>Route: `/onboarding/ai/client/:clientId`<br>Tests: 8 passing | ✅ Typewriter effect<br>✅ Animated options<br>✅ Skip optional steps<br>✅ Back navigation<br>✅ Re-ask skipped before lock<br>✅ Only V3 supported (V1/V2 deleted) |
| | Onboarding Session Persistence | **DONE** | Table: `client_onboarding_sessions`<br>Migration: `20251224150000_client_onboarding_sessions.sql`<br>Grants: `20251224160000_grant_client_onboarding_sessions.sql` | ✅ Cross-device resume<br>✅ RLS policies active<br>✅ Auto-updated timestamp |
| | Onboarding V1 (Chat) | **DELETED** | ❌ File removed: `AiOnboardingChat.tsx` | Completely removed |
| | Onboarding V2 (Chat) | **DELETED** | ❌ File removed: `AiOnboardingV2Chat.tsx` | Completely removed |
| | Agency AI Onboarding | **TODO** | ❌ Route removed: `/ai/onboarding/agency`<br>❌ File deleted: `AiOnboardingAgency.tsx` | Currently no agency brain onboarding UI |
| **AI BRAINS** |
| | Client Brain Create/Update | **DONE** | Edge function: `ai-brains-client/index.ts`<br>Table: `client_brains` (from `20251224090000_brain_spine_v1.sql`)<br>RPC: `get_client_brain_status` | ✅ CRUD operations<br>✅ Versioning<br>✅ Status tracking (draft/usable)<br>✅ Lock mechanism |
| | Agency Brain Create/Update | **DONE** | Edge function: `ai-brains-agency/index.ts`<br>Table: `agency_brains` | ✅ CRUD operations<br>✅ Versioning |
| | Brain Ingest (V3 Only) | **DONE** | Edge function: `ai-brain-ingest/index.ts`<br>Maps V3 answers → brain_json schema | ✅ V3-only mapping<br>✅ Default constraints fallback<br>✅ Quality gate validation<br>❌ V2 support removed |
| | Brain Status Validation | **DONE** | RPC: `get_client_brain_status`<br>Migration: `20251224121500_get_client_brain_status_rpc.sql`<br>Test: `clientBrainStatus.test.ts` (3 passing) | ✅ Validates 6 required fields<br>✅ Returns missing fields list<br>✅ Gates client access |
| **AI INFRASTRUCTURE** |
| | Memory Items | **DONE** | Table: `ai_memory_items`<br>Migration: `20251224090000_brain_spine_v1.sql` | ✅ Stores context snippets<br>✅ Agency + client scoped<br>✅ RLS enabled |
| | Document Ingestion | **DONE** | Edge function: `ai-documents-ingest/index.ts`<br>Table: `ai_documents`, `ai_document_chunks` | ✅ Chunking pipeline<br>✅ Token counting |
| | Embeddings & Vector Store | **DONE** | Table: `ai_embeddings` (pgvector)<br>RPC: `match_ai_embeddings`<br>Migration: `20251224103000_strategy_docs_and_embeddings.sql`<br>Hardening: `20251224133000_harden_match_ai_embeddings_exec.sql` | ✅ 1536-dim vectors<br>✅ Cosine similarity search<br>✅ RLS enforced<br>⚠️ Embedding model: text-embedding-3-small (hardcoded) |
| | AI Usage Logging | **PARTIAL** | Table: `ai_usage_logs`<br>Columns: endpoint, model, tokens_estimate<br>Migration: `20251224110000_expand_ai_usage_logs.sql` | ✅ Basic logging structure<br>❌ No tier enforcement<br>❌ No quota limits<br>❌ No billing integration |
| | AI Ask (Q&A) | **DONE** | Edge function: `ai-ask/index.ts` | ✅ Context retrieval<br>✅ OpenAI integration<br>⚠️ No safety filter documented |
| | AI Strategy Generation | **DONE** | Edge function: `ai-strategy-generate/index.ts` | ✅ Content generation<br>⚠️ No safety filter documented |
| | Answer Quality Check | **DONE** | Edge function: `ai-answer-quality-check/index.ts` | ✅ Quality validation |
| | Context Retrieval | **DONE** | Edge function: `ai-retrieve-context/index.ts` | ✅ Vector search wrapper |
| **CLIENT PORTAL** |
| | Portal Access Control | **DONE** | Table: `client_portal_users`<br>Auth functions: `client-auth-*`<br>RLS policies active | ✅ Separate auth system<br>✅ Invite flow<br>✅ Password reset |
| | Portal Approvals | **DONE** | Page: `PortalApprovals.tsx`<br>Route: `/client/portal/approvals` | ✅ UI exists<br>❓ Backend workflow unclear |
| | Portal Content Calendar | **DONE** | Page: `PortalContentCalendar.tsx` | ✅ UI exists |
| | Portal Performance | **DONE** | Page: `PortalPerformance.tsx` | ✅ UI exists |
| | Portal Branding | **DONE** | Page: `PortalBranding.tsx` | ✅ UI exists |
| | Portal Social Profiles | **DONE** | Page: `PortalSocialProfiles.tsx` | ✅ UI exists |
| | Portal Messages | **DONE** | Page: `PortalMessages.tsx`<br>Edge functions: `create-conversation`, `send-message` | ✅ Real-time messaging |
| **CONTENT PIPELINE** |
| | Content Generation | **PARTIAL** | Edge function: `generate-ai-content/index.ts` | ✅ Function exists<br>❓ Integration with calendar unclear |
| | Approval Workflow | **PARTIAL** | Edge function: `send-approval-notification/index.ts`<br>Reminders: `generate-approval-reminders/index.ts` | ✅ Notification system<br>❓ Full workflow status unclear |
| | Scheduled Publishing | **DONE** | Edge function: `publish-scheduled-posts/index.ts` | ✅ Cron-based publishing |
| **SOCIAL INTEGRATIONS** |
| | Meta OAuth | **DONE** | Edge functions: `social-oauth/index.ts`, `social-oauth-callback/index.ts`<br>Token refresh: `refresh-meta-tokens/index.ts` | ✅ OAuth flow<br>✅ Token management |
| | Meta Ads Sync | **DONE** | Edge function: `sync-meta-ads/index.ts` | ✅ Ad data sync |
| | Social Metrics Sync | **DONE** | Edge function: `sync-social-metrics/index.ts` | ✅ Metrics collection |
| **BILLING & SUBSCRIPTIONS** |
| | Stripe Integration | **DONE** | Edge functions: `create-checkout`, `customer-portal`, `stripe-webhook`<br>Table: `subscriptions`<br>RLS: `20251216170000_fix_subscriptions_rls.sql` | ✅ Checkout flow<br>✅ Portal access<br>✅ Webhook handling |
| | Subscription Checks | **DONE** | Edge function: `check-subscription/index.ts` | ✅ Access validation |
| **AUTH & TEAM** |
| | User Authentication | **DONE** | Supabase Auth<br>Pages: `Auth.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx` | ✅ Email/password<br>✅ Reset flow |
| | Team Invites | **DONE** | Edge function: `send-team-invite/index.ts`<br>Table: `team_invites`<br>Migration: `20251221131145_team_invite_hardening.sql` | ✅ Invite system<br>✅ RLS hardened |
| | Client Member Access | **DONE** | Table: `client_members`<br>Migration: `20251222090000_restore_client_member_access.sql` | ✅ Multi-user per client |
| **DATA MODEL** |
| | Agencies & Members | **DONE** | Tables: `agencies`, `agency_members` | ✅ Multi-tenant ready |
| | Clients | **DONE** | Table: `clients`<br>View: `client_asset_counts_view` (Migration: `20251224124500`) | ✅ Full CRUD<br>✅ Asset counting |
| | Assets | **DONE** | Table: `assets`<br>Edge function: `upload-file/index.ts` | ✅ File management |

---

## AI Employee Infrastructure Reality

### Client Brain Lifecycle (V3 ONLY)
**Status: FULLY OPERATIONAL (V3)**

```
Flow:
1. User starts onboarding → GET /ai/onboarding/client/:clientId
2. Component: AiOnboardingV3Guided.tsx loads
3. Creates brain + session:
   - POST ai-brains-client (action: create)
   - INSERT client_onboarding_sessions
4. User progresses through steps:
   - POST ai-onboarding-guide (step_id, answers, user_input)
   - Returns: next step spec (assistant_message, options, constraints)
   - Frontend validates + saves to session.answers_json
5. User clicks "Lock & Finish":
   - POST ai-brains-client (action: lock) → sets status=locked
   - POST ai-brain-ingest (raw_responses: answers) → transforms to brain_json
   - brain_json validated by evaluateClientBrainForStrategy()
   - Sets usable=true/false based on gate
6. Brain used for:
   - Context retrieval (ai-retrieve-context)
   - Q&A (ai-ask)
   - Strategy generation (ai-strategy-generate)
```

**Evidence:**
- Edge functions: `ai-brains-client`, `ai-onboarding-guide`, `ai-brain-ingest`
- Tables: `client_brains`, `client_onboarding_sessions`
- RPC: `get_client_brain_status` validates 6 required fields
- Tests: 8 passing tests in `AiOnboardingV3Guided.test.tsx`

### Onboarding V3 Step Flow
**Status: DONE**

```typescript
REQUIRED_STEPS = [
  "brand_basics",    // brand name + website (text inputs)
  "niche",           // industry selection (single select)
  "offers",          // products/services (AI-generated multi-select)
  "audience",        // target audience (AI-generated multi-select)
  "differentiators", // brand differentiators (AI-generated multi-select)
  "tone_voice",      // tone traits + style example (combined chips)
  "platforms",       // social platforms + primary (chips + selector)
  "goals_kpis",      // goals + KPIs (combined chips with divider)
  "constraints_approvals" // constraints + approval cadence (combined chips)
]

OPTIONAL_STEPS = [
  "competitors",  // competitor list (AI-generated)
  "pillars",      // content pillars (AI-generated)
  "cta_styles",   // CTA preferences (AI-generated)
  "assets",       // asset links (text)
  "pricing",      // pricing info (text)
  "timeline"      // campaign timeline (text)
]

REVIEW_STEPS = [
  "review_required",  // After required steps, choice: lock or enhance
  "final_review"      // Final lock point after optional steps
]
```

**Skip Logic:**
- Skip button ONLY shown for OPTIONAL steps (line 1054, AiOnboardingV3Guided.tsx)
- Required steps CANNOT be skipped
- Skipped optional steps re-asked before final lock (line 473-484)
- Backend supports skipped_steps array (ai-onboarding-guide line 120-123)

### Ingest & Indexing
**Status: DONE (Brain Ingest) / DONE (Document Ingest)**

**Brain Ingest (V3 Only):**
- Function: `ai-brain-ingest/index.ts`
- Mapping (lines 195-251):
  ```
  V3 Field → Brain Schema:
  brand → brand_basics.name
  website → brand_basics.website
  platforms → brand_basics.socials
  tone (array) → brand_basics.tone (joined)
  offers → offer_details.products_services
  cta_styles → offer_details.usps
  audience → audience.problems
  constraints → constraints.banned_claims (with "No restrictions" fallback)
  pillars → pillars (mapped to {name, examples: []})
  goals → goals
  kpis → metrics
  approval_cadence → approvals
  ```
- Source tag: `onboarding_v3`
- Quality gate: `evaluateClientBrainForStrategy()` from `_shared/brain-quality.ts`

**Document Ingest:**
- Function: `ai-documents-ingest/index.ts`
- Chunks documents into 900-token segments with 140-token overlap
- Max 12 chunks per document
- Creates embeddings via OpenAI text-embedding-3-small
- Stores in `ai_embeddings` table with pgvector

### Embeddings & Vector Store
**Status: DONE**

**Tables:**
- `ai_documents` - Document metadata
- `ai_document_chunks` - Text chunks with token counts
- `ai_embeddings` - 1536-dim vectors (pgvector extension)

**Search:**
- RPC: `match_ai_embeddings(agency_id, query_embedding, client_id, match_count, doc_types)`
- Uses cosine similarity (`<=>` operator)
- Returns: document_id, chunk_id, doc_type, chunk_text, score
- Security: RLS enforced, agency membership validated
- Hardened: Migration `20251224133000_harden_match_ai_embeddings_exec.sql`

**Model:**
- Embedding: `text-embedding-3-small` (1536 dimensions)
- Dimension: DEFAULT_EMBEDDING_DIM = 1536 (from `_shared/embeddings.ts`)

### Model Routing
**Status: PARTIAL**

**OpenAI:**
- Used in: `ai-ask`, `ai-strategy-generate`, `ai-onboarding-guide`
- API key: `Deno.env.get("OPENAI_API_KEY")`
- Models: UNKNOWN (not explicitly specified in code reviewed)

**Claude:**
- Evidence: NONE FOUND in edge functions
- Note: No Anthropic SDK imports or Claude API calls detected

### Usage Logging
**Status: PARTIAL**

**What Exists:**
- Table: `ai_usage_logs` (agency_id, client_id, endpoint, model, tokens_estimate, tokens_in, tokens_out, latency_ms, unknown)
- Migration: `20251224110000_expand_ai_usage_logs.sql`
- Logging: Basic insert in `ai-brain-ingest` (line 327-337)

**What's Missing:**
- ❌ No tier enforcement (free/pro/enterprise)
- ❌ No quota limits
- ❌ No billing integration
- ❌ No rate limiting
- ❌ No cost tracking

### Safety & UNKNOWN Behavior
**Status: PARTIAL**

**What Exists:**
- Document: `docs/ai/safety_unknown_policy.md` (policy exists)
- Field: `ai_usage_logs.unknown` (boolean column)

**What's Missing:**
- ❌ No content filtering in `ai-ask` or `ai-strategy-generate`
- ❌ No prompt injection detection
- ❌ No toxic content blocking
- ❌ No PII redaction
- ❌ No audit trail for unsafe requests

**TODO:** Verify if safety checks exist in `_shared` utilities

---

## Known Issues / Risks

### P0 (Critical - Blocks Core Functionality)
**NONE IDENTIFIED** - Core onboarding flow is operational

### P1 (High - Security/Data Risk)
1. **No AI safety filters in production endpoints**
   - Impact: Potential for harmful content generation
   - Evidence: No filtering code in `ai-ask/index.ts`, `ai-strategy-generate/index.ts`
   - Mitigation: Add content moderation layer

2. **No usage tier enforcement**
   - Impact: Free users could exhaust OpenAI credits
   - Evidence: No quota checks in `ai-usage-logs` consumers
   - Mitigation: Add subscription-based rate limiting

3. **No embedding model fallback**
   - Impact: Hardcoded to text-embedding-3-small, no graceful degradation
   - Evidence: `_shared/embeddings.ts` has single model path
   - Mitigation: Add model routing + fallback logic

### P2 (Medium - UX/Performance)
1. **React Router v7 migration pending**
   - Impact: Deprecation warnings in tests
   - Evidence: Test stderr warnings about v7 future flags
   - Mitigation: Enable future flags or upgrade

2. **No agency brain onboarding UI**
   - Impact: Agency brains must be created manually
   - Evidence: Route `/ai/onboarding/agency` removed, no replacement
   - Mitigation: Build agency onboarding flow or admin tool

3. **Uncommitted V3 onboarding work**
   - Impact: Feature branch diverged from main, risk of conflicts
   - Evidence: Git status shows 8 uncommitted files
   - Mitigation: Commit + merge to main

4. **Optional steps may be under-utilized**
   - Impact: Users skip competitors, pillars → lower brain quality
   - Evidence: Skip button allows bypassing optional steps
   - Mitigation: Add incentives or required minimums

---

## Next Steps (Priority Order)

See `docs/status/NEXT_TASKS.md` for detailed task breakdown.

**Top 3:**
1. Commit & merge V3 onboarding work to main
2. Add AI safety filters to production endpoints
3. Implement usage tier enforcement

---

## Recent Updates (Brief v1 + AI Rep)

- Canonical brief: `client_brains.brain_json.client_brief_v1` built deterministically in `supabase/functions/_shared/client-brief-v1.ts` and written by `supabase/functions/_shared/client-brain-mapping.ts`.
- AI Rep chat endpoint: `supabase/functions/ai-rep-chat/index.ts` (returns `UNKNOWN` + exactly 1 clarification if brief lacks required info; retrieval via `match_ai_embeddings` is optional and non-fatal).
- Client portal UI entrypoint: `src/pages/client-portal/PortalAiAssistant.tsx` at `/client/portal/:portalSlug/ai-assistant` (also `/client/portal/ai-assistant`).
- Agency UI: ClientDetail no longer contains an AI Rep tab; admin-only stub page exists at `/ai/admin` (`src/pages/ai/AgencyAiAdmin.tsx`) and is hidden/blocked for non-admin via `src/hooks/useRole.ts` role check.

## Documentation Status

**Vision Docs (DO NOT CHANGE):**
- `docs/ai/*.md` - Specs and schemas (kept as-is)
- `docs/claude/*.md` - Historical context (kept as-is)

**Reality Docs (THIS FILE):**
- `docs/status/CURRENT_STATE.md` - ✅ Created
- `docs/status/HANDOFF_TO_CODEX.md` - ✅ Created
- `docs/status/NEXT_TASKS.md` - ✅ Created

---

*End of CURRENT_STATE.md*

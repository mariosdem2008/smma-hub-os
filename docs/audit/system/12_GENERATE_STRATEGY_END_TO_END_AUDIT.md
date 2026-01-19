# 12 — Generate Strategy: End-to-End Audit (UI + Backend + Schema)

## Why this file exists
“Generate Strategy” currently spans multiple systems:
- Client Brain gate (`client_brains.usable`)
- Agency memory (RAG + brain documents)
- Strategy OS (modules) + Strategy Documents
- Edge functions + RPC persistence

This audit describes the current working pipeline and the intended target behavior.

---

## Current truth (what happens today)

### UI entry points
- Client Detail → Strategy tab:
  - Route: `/clients/:clientId?tab=strategy` (`src/pages/ClientDetail.tsx`)
  - Renders: `src/components/client-tabs/StrategyHubTab.tsx`
  - Which renders: `src/components/strategy-os/StrategyKnowledgeCenter.tsx`

Inside Strategy Knowledge Center there are two related actions:
1) **Strategy Builder** (when no doc exists):
   - Calls `ai-strategy-generate` to create a strategy snapshot + document.
2) **Regenerate** (when a doc exists):
   - Calls `ai-strategy-generate` with an optional `instruction` and rewrites the snapshot/document.

### Backend “generate strategy” endpoint
- Edge function: `supabase/functions/ai-strategy-generate/index.ts`
  - Auth:
    - `verify_jwt=false` at `supabase/functions/ai-strategy-generate/config.toml`
    - Handler validates membership by:
      - verifying JWT via `supabase.auth.getUser(token)`
      - checking `agency_members` for the client’s `agency_id`
  - Inputs:
    - `client_id` (required)
    - `instruction` (optional)
  - Gate:
    - requires `client_brains.usable=true` and `evaluateClientBrainForStrategy(...)` to pass
    - otherwise returns `unknown=true` + `missing_fields` + `questions`
  - Requirements:
    - requires `OPENAI_API_KEY` (now returns `500` with `code=MISSING_API_KEY` if absent)

### Strategy persistence (DB writes)
- The edge function persists results via RPC:
  - `public.create_strategy_snapshot(...)` in `supabase/migrations/20260108143000_strategy_snapshot_rpc.sql`
- That RPC writes:
  - `public.strategy_documents` (the markdown/html doc shown in Strategy Knowledge Center)
  - `public.strategy_modules` (structured module payloads for Strategy OS)
  - `public.strategy_decisions` + `public.strategy_tasks` (if present)

### RAG retrieval used during generation
- Retrieval primitive:
  - `public.match_ai_embeddings(...)` (see `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql`)
- Strategy-specific retrieval policy:
  - `src/ai/ragPolicy.ts` (`TaskType.STRATEGY_PLAN`)
  - Includes `doc_type='brain_document'` as an allowed agency doc type for strategy generation.
- Brain documents referenced:
  - `supabase/functions/_shared/strategy-references.ts` is used to build “brain document references” from retrieved chunks.

---

## Why “Generate Strategy” can look like “nothing happens”
Even when the button is wired, the backend can refuse to generate:
- Client brain not usable → returns `unknown=true` with questions.
- `OPENAI_API_KEY` missing → returns `500` with `code=MISSING_API_KEY`.
- Membership/auth issues → returns `401/403`.

If the UI doesn’t surface these responses, the user perceives “nothing happened”.

Status as of this audit:
- `src/components/strategy-os/StrategyKnowledgeCenter.tsx` now catches failures and shows toasts.
- `src/hooks/useStrategyDocuments.ts` now throws on `unknown=true` / missing document so UI can handle it consistently.

---

## Target design (what we want)

### One user-facing concept: “Generate Strategy”
Regardless of where the user clicks (Onboarding review, Strategy tab, Dashboard CTA), the action should:
1) Validate client brain readiness (and show missing fields with deep-links).
2) Ensure agency brain modules are usable:
   - approved where required
   - ingested into RAG (or show explicit “needs processing”)
3) Generate the strategy snapshot:
   - modules + document + tasks
4) Show clear progress and final success state.

### Observability requirements (non-negotiable)
- Every run must create an `ai_runs` row with:
  - latency, success, token usage, and citations that map to retrieved chunks.
- Every “unknown/gated” run should still log:
  - missing fields and user-visible questions.

### Product decisions still needed
- Do we keep Strategy OS module generation and document generation as the same action (recommended), or separate them?
- How do we position guided onboarding (`/ai/admin?mode=guided_onboarding`) relative to AI Setup and Strategy generation?

---

## Quick debugging checklist (developer)
- Confirm client brain gate:
  - `select usable, status, version from public.client_brains where client_id = :client_id order by version desc limit 1;`
- Confirm strategy doc exists:
  - `select id, is_active, updated_at from public.strategy_documents where client_id = :client_id order by updated_at desc;`
- Confirm RAG has brain documents:
  - `select id, metadata->>'module' from public.ai_documents where agency_id = :agency_id and doc_type='brain_document';`
- Check Supabase logs for `ai-strategy-generate` errors (MISSING_API_KEY, Forbidden, etc.).


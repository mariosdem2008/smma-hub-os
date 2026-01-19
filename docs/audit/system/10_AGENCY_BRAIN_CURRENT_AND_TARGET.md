# 10 — Agency Brain: Current Truth + Target Design

## Why this file exists
This audit explains:
- How “Agency Brain” works today (DB + backend + UI entry points).
- What the brain is currently used for (and what it is not used for).
- What we want “Agency Brain” to become so strategy/content generation is predictable.

This is written as “current truth” first, then “target design”.

---

## Terminology (current code)
- **Agency Brain (JSON)**: a monolithic `brain_json` stored in `public.agency_brains`.
- **Agency AI Setup modules**: modular, versioned docs in `public.brain_documents` (+ `public.brain_document_versions`), edited/approved in `/agency/ai-setup`.
- **Agency Brain in RAG**: ingested content stored in `public.ai_documents` + `public.ai_document_chunks` + `public.ai_embeddings` and retrieved via `public.match_ai_embeddings(...)`.

---

## Current truth (how it works today)

### Data model (what exists)
- `public.agency_brains` created in `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql`.
  - Stores: `agency_id`, `version`, `status`, `locked`, `brain_json`, `json_diff`, `confidence`.
  - Has `calibration_state` added by `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql`.
- `public.brain_documents` + `public.brain_document_versions` created in `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql`.
  - RLS is explicit here: member read; owner/admin write; owner delete; and approval RPC is role-gated.
- RAG tables (`public.ai_documents`, `public.ai_document_chunks`, `public.ai_embeddings`) created in `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql`.

### Backend entry points (edge functions)
- `supabase/functions/ai-brains-agency/index.ts`
  - `action=create|update|lock` against `public.agency_brains`.
  - Uses service role + validates JWT + enforces membership in `agency_members`.
- `supabase/functions/ai-brain-ingest/index.ts` with `scope=agency`
  - Builds a text summary (`buildAgencySummary`) and writes it to:
    - `public.ai_memory_items` (type `agency_brain_summary`)
    - `public.ai_documents` as `doc_type='ai_artifact'` (title “Agency brain summary”)
    - plus chunks/embeddings (if `OPENAI_API_KEY` is configured; can fail hard depending on `AI_EMBEDDING_FAIL_HARD`).
- `supabase/functions/_shared/brain-documents.ts`
  - Converts approved `brain_documents` to markdown and ingests them as `doc_type='brain_document'` into RAG.
  - Important: deletion is scoped by `agency_id` + `metadata->>module` before re-inserting.

### UI entry points (what the user sees)
- Agency creation wizard (legacy/static): `src/pages/CreateAgencyStub.tsx`
  - Creates `agency_brains` via `ai-brains-agency`.
  - Calls `ai-brain-ingest` (scope `agency`) and writes an agency brain summary into RAG.
  - Auto-seeds Default Brain Pack v1 in background (`autoSeedDefaultBrainPackV1InBackground`), which creates `brain_documents` core modules (and ingests them once approved).
- AI Setup modules UI: `/agency/ai-setup` (`src/pages/agency/AISetup.tsx`)
  - This UI is the modular brain system (`brain_documents`).

### What Agency Brain is used for today
- The monolithic `agency_brains.brain_json` is a “profile record” used by onboarding flows and admin guided setup logic.
- Strategy generation does **not** directly read `agency_brains.brain_json` as its primary memory source.
- Strategy generation retrieves *agency memory* primarily via RAG (`match_ai_embeddings`) including `doc_type='brain_document'` for approved modules and whatever other agency doc types exist.

### Current gaps / confusion drivers
- Two parallel systems exist:
  - `agency_brains.brain_json` (monolithic)
  - `brain_documents` (modular, versioned, approved, RAG-ingested)
- The product/UI often treats “Agency Brain” as one concept, but the code currently has multiple sources of truth.

---

## Target design (how we want it to work)

### Source of truth (clear rule)
1) **Authoritative editable brain = `brain_documents`** (modular docs).
2) `agency_brains.brain_json` becomes either:
   - a derived snapshot for fast reads/UI and guided onboarding state, or
   - a legacy artifact to deprecate.

### Required invariants
- Any AI output must be explainable in terms of the memory sources:
  - “Which approved brain modules were used?”
  - “Which RAG chunks were cited?”
- Approved `brain_documents` must always be ingested into RAG (or show explicit “not ingested” error state).

### Recommended pipeline (event-oriented)
- When a module transitions to `approved`:
  - server triggers ingestion of that module into RAG (or the UI calls a safe ingestion endpoint).
- The Strategy pipeline uses:
  - Client brain (usable gate)
  - Agency brain modules (approved + ingested)
  - Any client/agency memory items

### Migration strategy (avoid a big-bang rewrite)
- Short-term: treat `agency_brains` as onboarding/guided-setup state only; treat `brain_documents` as “AI Setup modules”.
- Medium-term: converge by generating/maintaining a derived `agency_brains.brain_json` from approved `brain_documents` (one-way sync), then stop writing it from multiple places.

---

## “What to check” when Agency Brain seems broken
- `agency_brains` row exists? (created by `ai-brains-agency`).
- `brain_documents` approved rows exist? (core modules + any others).
- For each approved module, do we have `ai_documents(doc_type='brain_document', metadata.module=...)`?
- Is `OPENAI_API_KEY` configured? If missing, ingestion/generation will error.


# 11 — Client Brain: Current Truth + Target Design

## Why this file exists
This audit explains:
- How “Client Brain” is stored and validated today.
- How it becomes “usable” (the gate that controls strategy generation).
- What we want the system to do when the brain is incomplete.

---

## Current truth (how it works today)

### Data model
- `public.client_brains` created in `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql`.
  - Key fields: `agency_id`, `client_id`, `version`, `status`, `locked`, `brain_json`, `confidence`, timestamps.
- `client_brains.usable` added in `supabase/migrations/20251224090000_brain_spine_v1.sql`.
  - This is the primary boolean used as a hard gate in the strategy pipeline.
- Tenant-safe status RPC:
  - `public.get_client_brain_status(p_client_id uuid)` in `supabase/migrations/20251224121500_get_client_brain_status_rpc.sql`.
  - Used by UI to show missing fields, status, and usability.

### Backend entry points
- `supabase/functions/ai-brains-client/index.ts`
  - `action=create|update|lock` against `client_brains` using service role + JWT + membership checks.
  - Used by onboarding flows to create the initial version and update it.
- `supabase/functions/ai-brain-ingest/index.ts` with `scope=client`
  - Maps onboarding “raw responses” into a canonical client brain structure via:
    - `supabase/functions/_shared/client-brain-mapping.ts` (`mapV3AnswersToClientBrain`)
  - Evaluates readiness via:
    - `supabase/functions/_shared/brain-quality.ts` (`evaluateClientBrainForStrategy`)
  - Writes back:
    - `client_brains.brain_json` (canonical shape)
    - `client_brains.usable` (boolean)
    - `client_brains.status` (e.g. `usable` or `draft`)
  - Also produces a “Client brain summary” memory artifact:
    - `public.ai_memory_items` (type `client_brain_summary`)
    - `public.ai_documents` as `doc_type='ai_artifact'` (title “Client brain summary”)
    - plus chunking/embedding (if `OPENAI_API_KEY` exists)

### UI entry points
- Client onboarding V4:
  - `src/components/onboarding-v4/OnboardingContext.tsx` calls:
    - `ai-brains-client` (create/update)
    - `ai-brain-ingest` (scope client)
- Client onboarding V5:
  - `src/components/onboarding-v5/OnboardingV5Wizard.tsx` calls:
    - `ai-brains-client` (create/update)
    - `ai-brain-ingest` (scope client)

### The usability gate (what blocks strategy)
- The gate logic lives in `supabase/functions/_shared/brain-quality.ts`.
- Required fields include:
  - brand name, offer list, audience problems, pillars, goals, and at least one of banned claims/taboo topics.
- If the gate fails, strategy generation returns `unknown=true` + `missing_fields` + `questions` (instead of generating).

---

## Target design (how we want it to work)

### Source of truth (clear rule)
- `client_brains.brain_json` in canonical shape is the “Client Brain”.
- `client_brains.usable` is derived from `brain_json` and must never be manually toggled in UI.

### UX behavior when the brain is incomplete
- Any “Generate strategy” action must:
  - explain what’s missing (the same `missing_fields` the backend returns)
  - offer a one-click route back to the exact onboarding section/field(s)

### Recommended alignment work
- V4 and V5 onboarding should converge on a single “raw responses” contract for ingestion.
- Strategy generation should cite which brain sections were used (even if also using RAG).

---

## Troubleshooting checklist
- `client_brains` row exists? (created by `ai-brains-client`).
- `client_brains.usable=true`? (set by `ai-brain-ingest` after mapping + gate evaluation).
- `get_client_brain_status(...)` returns missing fields? If yes, strategy will be blocked until fixed.
- `OPENAI_API_KEY` configured? If missing, ingestion or strategy generation will return `MISSING_API_KEY`.


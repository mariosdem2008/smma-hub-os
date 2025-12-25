# CODEX Phase 1 — V3 → Ingest → Gate Data Flow (Evidence)

## 1) V3 UI saves answers

- UI component: `src/components/ai/AiOnboardingV3Guided.tsx`
  - Writes onboarding session answers:
    - Table: `client_onboarding_sessions`
    - Field: `client_onboarding_sessions.answers_json`
    - Code: `supabase.from("client_onboarding_sessions").update({ answers_json: updatedAnswers }).eq("id", sessionId)`
  - Writes brain “raw responses”:
    - Edge function: `supabase/functions/ai-brains-client/index.ts`
    - Action: `action: "update"`
    - Payload: `brain_json: { raw_responses: updatedAnswers }`
    - Code: `supabase.functions.invoke("ai-brains-client", { body: { action: "update", ... } })`

## 2) Lock triggers ingest

- UI lock action: `src/components/ai/AiOnboardingV3Guided.tsx` → `handleLock()`
  1) Lock brain row:
     - Edge function: `supabase/functions/ai-brains-client/index.ts`
     - Action: `action: "lock"`
     - DB update: `client_brains.status = "locked"`, `client_brains.locked = true`
  2) Run ingest:
     - Edge function: `supabase/functions/ai-brain-ingest/index.ts`
     - Body: `{ scope: "client", agency_id, client_id, raw_responses: answers }`
     - Ingest builds canonical `client_brains.brain_json` and updates:
       - `client_brains.brain_json`
       - `client_brains.status` (draft/usable)
       - `client_brains.usable` (boolean)

## 3) Ingest maps V3 answers → canonical brain_json fields

- Mapping code: `supabase/functions/ai-brain-ingest/index.ts` (V3 mapping section)
- Key mappings (V3 answers → brain_json):
  - `answers.brand` → `brain_json.brand_basics.name`
  - `answers.website` → `brain_json.brand_basics.website`
  - `answers.platforms[]` → `brain_json.brand_basics.socials[]`
  - `answers.tone[]` → `brain_json.brand_basics.tone` (joined string)
  - `answers.differentiators[]` → `brain_json.brand_basics.differentiators[]`
  - `answers.offers[]` → `brain_json.offer_details.products_services[]`
  - `answers.audience[]` → `brain_json.audience.problems[]` (and `audience.demographics[]`)
  - `answers.goals[]` → `brain_json.goals[]`
  - `answers.kpis[]` → `brain_json.metrics[]`
  - `answers.constraints[]` → `brain_json.constraints.banned_claims[]` (and/or `constraints.taboo_topics[]`)
  - `answers.pillars[]` → `brain_json.pillars[]` (array of `{ name, examples[] }`)

## 4) Gate reads “usable + missing fields”

- UI gate: `src/pages/ClientDetail.tsx` (blocks when `!gateStatus?.usable`)
- Data fetch: `src/data/index.ts` → `getClientBrainStatus()`
  - Calls `db.rpc("get_client_brain_status", { p_client_id })`
- Server-side missing-fields computation:
  - RPC definition: `supabase/migrations/20251224121500_get_client_brain_status_rpc.sql`
  - Returns: `usable`, `missing_fields[]`, `missing_fields_count`, `status`, `locked`, `version`, `updated_at`
  - `usable` is the stored `client_brains.usable` column (added in `supabase/migrations/20251224090000_brain_spine_v1.sql`)


# CODEX P0 Findings — Client Gate “Missing fields: 2”

## Where the gate UI is rendered

- Gate UI: `src/pages/ClientDetail.tsx` (blocks when `!gateStatus?.usable`, shows `Missing fields: {missingCount}`).
- Gate data fetch: `src/data/index.ts` → `getClientBrainStatus()` → `db.rpc("get_client_brain_status", { p_client_id })`.

## Where “missing fields” are computed (source of truth)

- Server-side RPC: `supabase/migrations/20251224121500_get_client_brain_status_rpc.sql` (`public.get_client_brain_status`).
  - It reads the latest `public.client_brains` row for `p_client_id` and computes `missing_fields` by inspecting `client_brains.brain_json`.
  - Exact required keys appended into `missing_fields`:
    - `brand_basics.name`
    - `offer_details.products_services`
    - `audience.problems`
    - `pillars`
    - `goals`
    - `constraints.banned_claims_or_taboo_topics` (missing when BOTH `constraints.banned_claims` and `constraints.taboo_topics` are empty arrays)

## Matching “brain usable” validator used during ingest

- Quality gate logic: `supabase/functions/_shared/brain-quality.ts` → `evaluateClientBrainForStrategy()`.
  - `REQUIRED_FIELDS`: `brand_basics.name`, `offer_details.products_services`, `audience.problems`, `pillars`, `goals`
  - `REQUIRED_GROUPS`: `constraints.banned_claims_or_taboo_topics` satisfied by either `constraints.banned_claims` OR `constraints.taboo_topics`

## The two missing field keys causing the bug

The app message “Missing fields: 2” corresponds to the RPC returning:

1) `pillars`  
2) `constraints.banned_claims_or_taboo_topics`

Evidence for why these two are missing after “V3 + Lock”:

- **`pillars` can be empty** because onboarding treats pillars as optional:
  - `src/components/ai/AiOnboardingV3Guided.tsx`: `OPTIONAL_STEPS` includes `"pillars"` (so users can lock without ever answering it).
  - `supabase/functions/ai-onboarding-guide/index.ts`: `canLock()` does not require `answers.pillars`.
  - `supabase/functions/ai-brain-ingest/index.ts`: `pillars` is built from `rawResponses.pillars` → empty when the step is skipped.

- **`constraints.banned_claims_or_taboo_topics` can be missing** when the user selects no constraints:
  - `supabase/functions/ai-onboarding-guide/index.ts`: `validateStep("constraints_approvals")` requires `approval_cadence` but treats constraints as optional.
  - Pre-fix ingest mapping behavior is visible in `git diff -- supabase/functions/ai-brain-ingest/index.ts`:
    - `constraints.banned_claims: splitToList(rawResponses.constraints)` (empty when no constraints chosen)
    - `constraints.taboo_topics: splitToList(rawResponses.final_notes)` (V3 does not provide `final_notes`)
  - This makes BOTH arrays empty → RPC appends `constraints.banned_claims_or_taboo_topics`.

## Current brain_json shape expected by the gate

The RPC and quality gate both expect canonical fields in `client_brains.brain_json`:

- `brand_basics.name` (string)
- `offer_details.products_services` (array)
- `audience.problems` (array)
- `pillars` (array)
- `goals` (array)
- `constraints.banned_claims` (array) OR `constraints.taboo_topics` (array)


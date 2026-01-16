# Default Brain Pack v1 — Edge + Automation Audit

## Finished (what exists and is wired)

- Endpoint allowlist guard (default-on endpoints): `supabase/functions/_shared/endpoint-guard.ts:1`.
  - Includes `ai-seed-default-brain-pack`: `supabase/functions/_shared/endpoint-guard.ts:6`.
  - Includes `ai-seed-default-brain-pack-admin`: `supabase/functions/_shared/endpoint-guard.ts:7`.
- User-facing seed endpoint (member-triggered)
  - Requires Authorization: `supabase/functions/ai-seed-default-brain-pack/index.ts:33`.
  - Resolves user from token: `supabase/functions/ai-seed-default-brain-pack/index.ts:43`.
  - Checks membership + role (owner/admin): `supabase/functions/ai-seed-default-brain-pack/index.ts:52` and `supabase/functions/ai-seed-default-brain-pack/index.ts:77`.
  - Mode switch:
    - Seed/repair default: `supabase/functions/ai-seed-default-brain-pack/index.ts:103`.
    - Ingest-only retry: `supabase/functions/ai-seed-default-brain-pack/index.ts:104`.
  - Runs seed/repair/ingest-only + approve/ingest: `supabase/functions/ai-seed-default-brain-pack/index.ts:116`.
  - Writes stage-structured `ai_usage_logs`: `supabase/functions/ai-seed-default-brain-pack/index.ts:82`.
- Admin backfill endpoint (cron-gated)
  - Cron secret check: `supabase/functions/ai-seed-default-brain-pack-admin/index.ts:38` using `verifyCronSecret`: `supabase/functions/_shared/cron.ts:1`.
  - Dry-run eligibility: `supabase/functions/ai-seed-default-brain-pack-admin/index.ts:58`.
  - Picks an acting admin user: `supabase/functions/ai-seed-default-brain-pack-admin/index.ts:53`.
- Background auto-seed during onboarding
  - Called after onboarding completes: `src/pages/CreateAgencyStub.tsx:243`.
  - Retries up to 3 attempts: `src/lib/brain/autoSeedDefaultBrainPackV1.ts:34`.

## Unfinished / Risks

- **Retry + partial failures need visible UX**
  - Ingest failures can still occur (embedding provider errors, etc.) but are now detectable via the ingestion health banner:
    - UI banner: `src/pages/agency/BrainLayerDetail.tsx:415`.
    - Retry ingest (ingest-only): `src/pages/agency/BrainLayerDetail.tsx:214`.
- **Retry + idempotency behavior can hide partial failures**
  - Auto-seed retries are silent unless final failure: `src/lib/brain/autoSeedDefaultBrainPackV1.ts:45`.
  - CreateAgencyStub only toasts on failure or “failed_ids present”: `src/pages/CreateAgencyStub.tsx:246` and `src/pages/CreateAgencyStub.tsx:253`.
  - Layer detail shows an alert for ingestion failure: `src/pages/agency/BrainLayerDetail.tsx:434`, but overview does not: `src/pages/agency/AgencyBrain.tsx:141`.

## Backfill tooling

- Script queries eligible agencies: `scripts/backfill-default-brain-pack.mjs:50`.
- Script rate-limits and calls admin endpoint with `x-cron-secret`: `scripts/backfill-default-brain-pack.mjs:65`.
- Candidate list RPC: `supabase/migrations/20260111100000_list_agencies_with_zero_brain_documents.sql:1`.

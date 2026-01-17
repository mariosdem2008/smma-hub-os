# Default Brain Pack v1 — Edge + Automation Audit (post AI Setup redesign)

## Finished (what exists and is wired)

- Endpoint allowlist guard: `supabase/functions/_shared/endpoint-guard.ts`
  - Includes `ai-seed-default-brain-pack` and `ai-seed-default-brain-pack-admin`.
- User-facing seed endpoint (member-triggered, owner/admin gated)
  - Auth + membership checks: `supabase/functions/ai-seed-default-brain-pack/index.ts`
  - Mode switch:
    - `seed_or_repair` (default) → creates/repairs defaults then approves+ingests
    - `ingest_only` → re-ingests approved defaults only
- Admin backfill endpoint (cron-gated): `supabase/functions/ai-seed-default-brain-pack-admin/index.ts`
- Background auto-seed during onboarding: `src/lib/brain/autoSeedDefaultBrainPackV1.ts` (called from `src/pages/CreateAgencyStub.tsx`)

## Current UI Entry Points (frontend-only)

- Quick Setup banner (seed/repair): `src/components/ai-setup/QuickSetup/QuickSetupBanner.tsx`
- Retry Processing on error state (ingest-only): `src/pages/agency/ModuleDetail.tsx`
- Ingestion health detection: `src/hooks/useDefaultBrainPackIngestionHealth.ts`

## Remaining Risks / Follow-ups

- Partial ingest failures can still occur (embedding provider issues, dimension mismatch, missing keys).
  - Now visible because ingestion health drives display status (“Needs Attention”) on overview + detail pages.
- Auto-seed retries are still mostly silent (only final failure surfaces via toast).
  - Confirm logs in `ai_usage_logs.metadata.stage` are sufficient for support workflows.

## Backfill tooling

- Script queries eligible agencies: `scripts/backfill-default-brain-pack.mjs`
- Script rate-limits and calls admin endpoint with `x-cron-secret`: `scripts/backfill-default-brain-pack.mjs`
- Candidate list RPC: `supabase/migrations/20260111100000_list_agencies_with_zero_brain_documents.sql`


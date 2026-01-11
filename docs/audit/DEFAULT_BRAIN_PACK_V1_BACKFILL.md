# Default Brain Pack v1 — Backfill (Agencies With 0 Brain Docs)

## Goal

Seed Default Brain Pack v1 for every agency that currently has **0** rows in `public.brain_documents`, in a safe, manual, idempotent way with rate limiting and a dry-run mode.

## Safety properties

- **Idempotent:** seeding is skipped when any `brain_documents` already exist for the agency (enforced by `seed_default_brain_pack_v1`).
- **Targets only empty agencies:** candidate list comes from `public.list_agencies_with_zero_brain_documents(...)`.
- **Manual trigger only:** nothing runs automatically; you manually run the script.
- **Rate-limited:** defaults to **5 agencies/minute** (`12s` delay between agencies) to avoid embedding spikes.

## Components

### 1) Listing RPC (candidates)

Migration:
- `supabase/migrations/20260111100000_list_agencies_with_zero_brain_documents.sql:1`

RPC:
- `public.list_agencies_with_zero_brain_documents(p_limit int, p_offset int) -> (agency_id uuid)`

### 2) Admin-only per-agency seeding endpoint

Edge function:
- `supabase/functions/ai-seed-default-brain-pack-admin/index.ts:1`

Security:
- Requires `x-cron-secret` matching `CRON_SECRET` (server-side) via `verifyCronSecret`: `supabase/functions/ai-seed-default-brain-pack-admin/index.ts:38`

Logic:
- Resolves an acting user (owner/admin preferred) for `seed_default_brain_pack_v1` + approvals: `supabase/functions/ai-seed-default-brain-pack-admin/index.ts:61`
- Calls the existing shared pipeline `seedApproveAndIngestDefaultBrainPackV1` (no logic duplication): `supabase/functions/ai-seed-default-brain-pack-admin/index.ts:93`

### 3) Manual backfill script (batch runner)

Script:
- `scripts/backfill-default-brain-pack.mjs:1`

## How to run

Required env vars:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (used only by the script to call RPC + count agencies)
- `CRON_SECRET` (used to call the admin seeding endpoint)

### Dry run (no writes)

Print agencies eligible for backfill:
- `node scripts/backfill-default-brain-pack.mjs --dry-run`

### Backfill (rate-limited)

Defaults to 5 agencies/minute:
- `node scripts/backfill-default-brain-pack.mjs`

Custom rate limit and maximum attempts:
- `node scripts/backfill-default-brain-pack.mjs --per-minute 5 --limit 50`

## Expected output

The script prints:
- total agencies
- per-agency status lines (`[seeded]`, `[skipped]`, `[error]`, or `[dry-run]`)
- a final progress summary (`eligible`, `attempted`, `seeded`, `skipped`, `errors`)

## Verification

After running the backfill for an agency, verify with:
- `scripts/verify-default-brain-pack.mjs` (counts for `brain_documents`, `ai_documents`, `ai_embeddings`)
- `docs/audit/DEFAULT_BRAIN_PACK_V1_VERIFICATION.md` (SQL + UI checklist)


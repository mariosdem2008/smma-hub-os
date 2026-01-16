# Default Brain Pack v1 — Auto-seed on Agency Onboarding Completion

## Goal

Automatically create (seed + approve + ingest) Default Brain Pack v1 for newly-created agencies at the end of agency onboarding, without requiring the user to visit Agency Brain and click the CTA.

## Where auto-seeding is triggered

Agency onboarding completion happens in `CreateAgencyStub.handleFinish()`:

- Completion handler: `src/pages/CreateAgencyStub.tsx:206`
- After agency brain is updated + locked + ingested, the Default Brain Pack auto-seed is fired in the background (non-blocking): `src/pages/CreateAgencyStub.tsx:242`

## Fire-and-forget + retries (non-blocking UX)

The auto-seed call is intentionally not awaited; onboarding completion navigates to dashboard immediately.

- Background helper: `src/lib/brain/autoSeedDefaultBrainPackV1.ts:37`
- Retry behavior (defaults): `maxAttempts=3`, delays `[0, 1500, 5000]`: `src/lib/brain/autoSeedDefaultBrainPackV1.ts:39`
- The edge function invoked is `ai-seed-default-brain-pack`: `src/lib/brain/autoSeedDefaultBrainPackV1.ts:18`

## Safety / keys

No service role keys are used client-side. The client calls the edge function using the authenticated user session via the normal Supabase client:

- Client invocation: `src/lib/brain/autoSeedDefaultBrainPackV1.ts:18`
- The edge function itself uses the service role key server-side (never exposed to the browser): `supabase/functions/ai-seed-default-brain-pack/index.ts:36`

## Idempotency constraint (no seeding if docs already exist)

The edge function calls the RPC seed pipeline which returns 0 rows if the agency already has any `brain_documents`. That guarantees “seed only when empty”.

See baseline/RPC docs:
- `docs/audit/DEFAULT_BRAIN_PACK_V1_RPC.md`
- `docs/audit/DEFAULT_BRAIN_PACK_V1_EDGE_FUNCTION.md`

## Failure handling UX

If the background call cannot be completed (after retries), onboarding completion still succeeds; the user sees a non-blocking toast indicating defaults can be created later:

- Toast on failure: `src/pages/CreateAgencyStub.tsx:247`
- Console error for debugging: `src/pages/CreateAgencyStub.tsx:258`

If the pack is created but AI indexing fails (`seeded:true` and `ingested:false`), a toast warns the user they can retry from Agency Brain:

- Toast on partial failure: `src/pages/CreateAgencyStub.tsx:255`

## Logging (visibility)

Every call to `ai-seed-default-brain-pack` writes an `ai_usage_logs` row summarizing the outcome:

- Insert location: `supabase/functions/ai-seed-default-brain-pack/index.ts:93`
- Payload includes `endpoint="ai-seed-default-brain-pack"` and `model="default_brain_pack_v1:..."`: `supabase/functions/ai-seed-default-brain-pack/index.ts:101`

## Test coverage

One test verifies the auto-seed call is attempted when agency onboarding completes:

- `src/pages/__tests__/create-agency-flow.test.tsx:125`


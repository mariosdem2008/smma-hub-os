# Default Brain Pack v1 — Backend/DB Audit

## Finished

- **Brain documents schema + uniqueness**
  - Module enum: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:10`.
  - Status enum: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:23`.
  - `brain_documents` table: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:39`.
  - “Only one approved per module per agency” index: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:73`.
- **RLS baseline**
  - Read for members: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:102`.
  - Insert/update require admin/owner: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:113` and `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:125`.

## Default Pack v1 Seed RPC (`public.seed_default_brain_pack_v1`)

- Atomicity + advisory lock: `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql:36`.
- Enforces exactly 3 docs in payload: `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql:32`.
- Permission enforcement (admin/owner only): `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql:47`.
- Idempotency rule (“if any brain_documents exist, return”): `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql:58`.

## Default Pack v1 Repair RPC (`public.repair_default_brain_pack_v1`)

- Atomicity + advisory lock: `supabase/migrations/20260116210000_repair_default_brain_pack_v1_rpc.sql:41`.
- Enforces exactly 3 docs in payload (but inserts only missing defaults): `supabase/migrations/20260116210000_repair_default_brain_pack_v1_rpc.sql:36`.
- Permission enforcement (admin/owner only): `supabase/migrations/20260116210000_repair_default_brain_pack_v1_rpc.sql:51`.
- Missing-module logic (skips existing modules, inserts only missing): `supabase/migrations/20260116210000_repair_default_brain_pack_v1_rpc.sql:62`.

## Unfinished / Risks

- **Execute privileges mismatch risk (service role vs authenticated)**
  - RPC is granted to `authenticated` only: `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql:132`.
  - Edge functions call it using the service role key: `supabase/functions/ai-seed-default-brain-pack/index.ts:38`.
  - Added explicit grant for certainty: `supabase/migrations/20260116193000_seed_default_brain_pack_v1_grant_service_role.sql:4`.
  - Verify:
    - SQL: `select has_function_privilege('service_role', 'public.seed_default_brain_pack_v1(uuid, uuid, jsonb)', 'execute');`
  - Repair RPC grants execute to `service_role`: `supabase/migrations/20260116210000_repair_default_brain_pack_v1_rpc.sql:156`.
- **Duplicate migration file for brain_documents (potential drift / confusing history)**
  - Both exist: `supabase/migrations/20251228120000_brain_documents_and_calibration_state.sql:39` and `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:39`.
  - UNKNOWN which one was applied in production (depends on migration history). Verify:
    - SQL: `select * from supabase_migrations.schema_migrations order by version;`

## Potential duplication / consistency issues

- Seed RPC idempotency is “any doc exists” (intentionally prevents duplicates): `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql:58`.
- Repair RPC is the remediation path for partial agencies (inserts missing defaults only): `supabase/migrations/20260116210000_repair_default_brain_pack_v1_rpc.sql:8`.

## ai_usage_logs observability fields

- Added `ai_usage_logs.user_id` and `ai_usage_logs.metadata` for stage-structured logging:
  - `supabase/migrations/20260116210500_ai_usage_logs_metadata.sql:3`.
- Edge uses stage values in `metadata.stage` (no document content logged):
  - `supabase/functions/_shared/default-brain-pack-usage-log.ts:47`.

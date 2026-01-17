# Default Brain Pack v1 — Backend/DB Audit (post AI Setup redesign)

## Finished

- **Brain documents schema + uniqueness**
  - Module enum: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql`
  - Status enum: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql`
  - `brain_documents` table: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql`
  - “Only one approved per module per agency” index: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql`

- **RLS baseline**
  - Read for members: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql`
  - Insert/update require admin/owner: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql`

## Default Pack v1 Seed RPC (`public.seed_default_brain_pack_v1`)

- Atomicity + advisory lock: `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql`
- Enforces exactly 3 docs in payload: `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql`
- Permission enforcement (admin/owner only): `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql`
- Idempotency rule (“if any brain_documents exist, return”): `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql`

## Default Pack v1 Repair RPC (`public.repair_default_brain_pack_v1`)

- Atomicity + advisory lock: `supabase/migrations/20260116210000_repair_default_brain_pack_v1_rpc.sql`
- Inserts only missing defaults: `supabase/migrations/20260116210000_repair_default_brain_pack_v1_rpc.sql`
- Verify execute privileges:
  - SQL: `select has_function_privilege('service_role', 'public.repair_default_brain_pack_v1(uuid, uuid, jsonb)', 'execute');`

## UI implications (for auditing correctness)

- Non-admin members can read `brain_documents`, but cannot insert/update/approve by policy.
- The redesigned AI Setup UI mirrors this by disabling actions for non-admins:
  - `src/pages/agency/AISetup.tsx`
  - `src/pages/agency/ModuleDetail.tsx`

## Unfinished / Risks

- **Duplicate migration file for brain_documents (potential drift / confusing history)**
  - Both exist:
    - `supabase/migrations/20251228120000_brain_documents_and_calibration_state.sql`
    - `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql`
  - Verify actual applied history:
    - SQL: `select * from supabase_migrations.schema_migrations order by version;`

## ai_usage_logs observability fields

- Stage-structured logging uses `ai_usage_logs.metadata.stage`:
  - Writer: `supabase/functions/_shared/default-brain-pack-usage-log.ts`
  - Verify columns exist:
    - SQL: `select column_name from information_schema.columns where table_schema='public' and table_name='ai_usage_logs' and column_name in ('user_id','metadata');`


# 09 — Infrastructure: Env, Secrets, Deployment (Current Truth)

## Glossary (shared terms)
- **Supabase project**: referenced by `project_id` in `supabase/config.toml` (evidence: `supabase/config.toml:1`).
- **Edge functions**: Deno handlers under `supabase/functions/*` (evidence: `README.md:53`).
- **verify_jwt**: Supabase platform setting controlling whether JWT is verified before invoking a function handler (evidence: `supabase/config.toml:4`).
- **service role**: privileged Supabase key used by many functions via `SUPABASE_SERVICE_ROLE_KEY` (RLS bypass by design) (evidence: `supabase/functions/_shared/env.ts:8`).
- **Cron secret**: header `x-cron-secret` compared against env `CRON_SECRET` for scheduled/privileged endpoints (evidence: `supabase/functions/_shared/cron.ts:6`).

## Purpose
Document how the repo runs locally and how it is intended to deploy today: which env vars exist (frontend vs edge), where secrets are expected to live, which functions rely on `verify_jwt` vs manual auth, and what can break production quickly.

---

## Data model (tables + key columns + RLS status)
Even “infra” behaviors touch DB objects that function as operational source-of-truth:

### Logging / ops
- `public.ai_usage_logs`
  - Key columns: `created_at`, `endpoint`, `unknown`, `metadata` (evidence: `supabase/migrations/20251224090000_brain_spine_v1.sql:32`).
  - RLS: enabled (evidence: `supabase/migrations/20251224090000_brain_spine_v1.sql:30`).
- `public.ai_runs`
  - RLS: UNKNOWN in this audit (migration not located here).
  - How to verify: `select relrowsecurity from pg_class where relname='ai_runs';` and inspect `pg_policies`.

### Authorization boundary used by service-role functions
- `public.agency_members`
  - Frequently queried by edge functions using service role before performing privileged work (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:58`).
  - RLS/policies: not re-audited here; verify in DB.

---

## UI entry points (routes + components)
Infrastructure config is exercised through normal app bootstrapping and runtime calls:
- Supabase client uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (evidence: `src/integrations/supabase/client.ts:5`).
- Vite scripts define how the app builds/tests locally (evidence: `package.json:7`, `package.json:8`, `package.json:10`, `package.json:11`).

---

## Backend/API entry points (edge + deployment surface)
### Frontend env (Vite)
- `.env.local.example` documents local Supabase URL and publishable key (evidence: `.env.local.example:17`, `.env.local.example:18`).
- The same file documents a local `supabase/functions/.env` secrets file for edge function secrets in dev (evidence: `.env.local.example:29`).

### Supabase function config
- `supabase/config.toml` defines per-function `verify_jwt` settings (evidence: `supabase/config.toml:4`).
- At least one entry shows `verify_jwt=false` (platform will not enforce JWT) (evidence: `supabase/config.toml:22`).

### Per-function config example
- `ai-strategy-generate` folder sets `verify_jwt=false` (evidence: `supabase/functions/ai-strategy-generate/config.toml:1`).

### Shared env loader for functions
- `_shared/env.ts` reads `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` from Deno env (evidence: `supabase/functions/_shared/env.ts:7`).
- It infers local/prod based on env `ENV` and whether `SUPABASE_URL` is localhost (evidence: `supabase/functions/_shared/env.ts:14`, `supabase/functions/_shared/env.ts:17`).

### Cron security
- Cron guard compares `x-cron-secret` header against env `CRON_SECRET` (evidence: `supabase/functions/_shared/cron.ts:5`).
- Repo docs contain cron setup guidance (evidence: `README.md:59`).

---

## Control flow diagram (local run + deploy) in text
### Local run
Step 1 -> Install deps: `npm install` (evidence: `README.md:13`).

Step 2 -> Copy env examples:
- `.env.local.example` -> `.env.local` (evidence: `README.md:14`).
- `.env.example` -> `.env` (evidence: `README.md:14`).

Step 3 -> Optional local Supabase: `supabase start` and set `VITE_SUPABASE_URL` from the local output (evidence: `README.md:15`, `.env.local.example:5`).

Step 4 -> Run dev: `npm run dev` (evidence: `README.md:16`, `package.json:7`).

### Deploy
Step 5 -> Push migrations: `supabase db push` (evidence: `docs/status/DEPLOY_CHECKLIST.md:6`).

Step 6 -> Deploy functions: `supabase functions deploy <name>` (evidence: `docs/status/HANDOFF_TO_CODEX.md:377`).

Step 7 -> Configure secrets in Supabase dashboard for production (repo docs explicitly call this out for `OPENAI_API_KEY`) (evidence: `docs/status/HANDOFF_TO_CODEX.md:400`).

---

## AI behavior (RAG? chunking? embeddings? prompts? retrieval?)
Infra-relevant AI behaviors are mostly “what secrets/config are required”:
- `OPENAI_API_KEY` is read by strategy generation for embeddings (evidence: `supabase/functions/ai-strategy-generate/index.ts:231`).
- `EMBEDDING_MODEL_ID` default used is `text-embedding-3-small` (evidence: `supabase/functions/ai-strategy-generate/index.ts:257`).
- `STRATEGY_MODEL_ID` default used is `gpt-4o-mini` (evidence: `supabase/functions/ai-strategy-generate/index.ts:414`).
- Retrieval boundary depends on `match_ai_embeddings` privileges and filters (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:11`).

---

## “Source of truth” (what decides status)
- Platform JWT verification: `supabase/config.toml` `verify_jwt` entries (evidence: `supabase/config.toml:4`).
- Cron access: `x-cron-secret` compared to `CRON_SECRET` (evidence: `supabase/functions/_shared/cron.ts:6`).
- Service-role bypass: use of `SUPABASE_SERVICE_ROLE_KEY` inside handlers (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:39`).

---

## Cross-tenant risks + isolation enforcement
### Isolation enforcement (where it exists)
- Example enforcement: `ai-seed-default-brain-pack` uses service role but checks membership before continuing (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:58`).

### Risk areas to verify
- Any function with `verify_jwt=false` is callable without platform JWT enforcement; handler correctness becomes the isolation boundary (evidence: `supabase/config.toml:22`).
- `match_ai_embeddings` privilege drift across “drop/recreate function” migrations is a potential cross-tenant risk until verified in deployed DB (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:3`).

---

## Failure modes (top 5) + how they surface
1) Missing frontend env -> Supabase client throws during init (evidence: `src/integrations/supabase/client.ts:8`).
2) Missing function secrets -> edge returns 500 with `MISSING_API_KEY` in several handlers (evidence: `supabase/functions/ai-strategy-generate/index.ts:231`).
3) Misconfigured `verify_jwt` -> endpoint unexpectedly accepts unauthenticated calls, or unexpectedly rejects (depends on platform settings) (evidence: `supabase/config.toml:22`).
4) Cron secret missing/incorrect -> scheduled endpoints return unauthorized/forbidden (evidence: `supabase/functions/_shared/cron.ts:5`).
5) RPC privilege drift -> strategy/retrieval errors at runtime (“permission denied”) (evidence: `supabase/migrations/20260108143000_strategy_snapshot_rpc.sql:182`).

---

## Environment variables (what exists today, and where used)
This section lists env vars that are demonstrably read by the repo today.

### Frontend (Vite) env vars
- `VITE_SUPABASE_URL` (evidence: `src/integrations/supabase/client.ts:5`).
- `VITE_SUPABASE_ANON_KEY` (or fallback `VITE_SUPABASE_PUBLISHABLE_KEY`) (evidence: `src/integrations/supabase/client.ts:6`).
- `VITE_PUBLIC_URL` (documented in `.env.local.example`) (evidence: `.env.local.example:10`).

### Edge (Supabase functions) env vars
- Supabase credentials (shared loader):
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (evidence: `supabase/functions/_shared/env.ts:7`).
- AI keys/models:
  - `OPENAI_API_KEY` used for embeddings in strategy generation (evidence: `supabase/functions/ai-strategy-generate/index.ts:231`).
  - `OPENAI_API_KEY` used for embeddings in brain ingest flows (evidence: `supabase/functions/ai-brain-ingest/index.ts:238`).
- Cron:
  - `CRON_SECRET` for cron-gated endpoints (evidence: `supabase/functions/_shared/cron.ts:5`).
- Client portal auth:
  - `CLIENT_PORTAL_JWT_SECRET` used to validate client JWTs (evidence: `supabase/functions/list-conversations/index.ts:28`).
- Meta integration:
  - `META_APP_ID` and `META_APP_SECRET` (evidence: `supabase/functions/refresh-meta-tokens/index.ts:22`).
- Email:
  - `RESEND_API_KEY` (evidence: `supabase/functions/send-approval-notification/index.ts:5`).

### Local dev docs for secrets
- `.env.local.example` instructs creating `supabase/functions/.env` for edge function secrets locally (evidence: `.env.local.example:29`).

---

## Service role grants (drift risk surface)
There are at least two “service_role access” mechanisms in this repo:

### Explicit SQL grant file (not a migration)
- `supabase/sql/grant_service_role.sql` grants schema usage and `agency_members` DML to `service_role` (evidence: `supabase/sql/grant_service_role.sql:4`, `supabase/sql/grant_service_role.sql:7`).
- Whether this file is applied in your environment is **UNKNOWN** from repo evidence alone.
  - How to verify (DB): `select has_table_privilege('service_role','public.agency_members','select');`

### Migration-level grants for specific RPCs
- Seed RPC grants `service_role` execute in a dedicated migration (evidence: `supabase/migrations/20260111140000_seed_default_brain_pack_v1_grant_service_role.sql:3`).
- Repair RPC grants `service_role` execute inline (evidence: `supabase/migrations/20260116210000_repair_default_brain_pack_v1_rpc.sql:156`).

---

## `verify_jwt` reality check (platform vs handler auth)
### What the platform enforces
- If `verify_jwt=true`, Supabase verifies JWT before invoking the handler (evidence: `supabase/config.toml:4`).
- If `verify_jwt=false`, handler code must enforce auth itself (evidence: `supabase/config.toml:22`).

### What handlers typically do in this repo
- Many handlers create a server client with `SUPABASE_SERVICE_ROLE_KEY` and then check membership/role explicitly in tables like `agency_members` (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:39`, `supabase/functions/ai-seed-default-brain-pack/index.ts:72`).

### Verification command (full inventory)
```sh
rg -n "verify_jwt\\s*=\\s*(true|false)" supabase/config.toml supabase/functions/**/config.toml
```

---

## Storage buckets (brain documents upload surface)
- Migration `20260117160000_brain_documents_storage_bucket.sql` configures bucket `brain-documents` and adds storage RLS policies referencing `bucket_id = 'brain-documents'` (evidence: `supabase/migrations/20260117160000_brain_documents_storage_bucket.sql:5`, `supabase/migrations/20260117160000_brain_documents_storage_bucket.sql:18`).
- UI uploads store files under `${agencyId}/${module}/...` paths inside that bucket (evidence: `src/hooks/useBrainDocumentUpload.ts:40`).

---

## What can break prod easily (based on current repo)
1) **Unset secrets in Supabase dashboard** (AI keys, cron secret, email keys) -> hard failures (e.g. `MISSING_API_KEY`) or “unknown” behavior depending on endpoint and `failHard` policy (evidence: `supabase/functions/ai-strategy-generate/index.ts:231`, `supabase/functions/_shared/cron.ts:5`).
2) **Privilege drift for `match_ai_embeddings`** after signature changes -> retrieval breaks or (worse) becomes callable by non-service roles (UNKNOWN until verified in DB) (evidence: `supabase/migrations/20260108134500_match_ai_embeddings_filters.sql:3`).
3) **Function auth mismatch** (`verify_jwt=false` + missing membership checks) -> accidental unauthenticated service-role endpoint (audit per function) (evidence: `supabase/config.toml:22`, `supabase/functions/_shared/env.ts:8`).
4) **Missing storage bucket/policies** -> AI Setup upload/analysis pipeline fails or behaves inconsistently (evidence: `supabase/migrations/20260117160000_brain_documents_storage_bucket.sql:5`).
5) **Skipped function deploy** -> DB migrations exist but code not deployed (or vice versa) (evidence: `docs/status/DEPLOY_CHECKLIST.md:12`).

---

## Production parity notes (local vs remote)
### Docker prerequisite for local Supabase introspection
- Repo docs call out that `supabase status` and `supabase db diff` can fail locally when Docker is not running (evidence: `docs/claude/repo_map.md:551`).
- A separate audit doc reiterates that local verification may be blocked without Docker (evidence: `docs/ai/baseline_audit.md:159`).

### Recommended parity commands (what to run, not guaranteed to work locally)
```sh
supabase status
supabase db diff
```

If these fail locally, verify remote state via SQL directly (example queries are in the verification section below) (evidence: `docs/ai/baseline_audit.md:12`).

---

## Verification checklist (commands + SQL)
### Repo commands (required by request)
- `npm test`
- `npm run lint`
- `npx tsc -p tsconfig.json --noEmit`
- `npm run build`

### Local infra checks
```sh
# Confirm local Supabase URL is documented
rg -n "VITE_SUPABASE_URL" .env.local.example
```

```sh
# Inventory function JWT settings
rg -n "verify_jwt\\s*=\\s*(true|false)" supabase/config.toml supabase/functions/**/config.toml
```

### SQL checks (RLS + privileges)
```sql
-- Spot-check RLS enabled
select relname, relrowsecurity
from pg_class
where relname in ('ai_usage_logs','ai_documents','ai_document_chunks','ai_embeddings','brain_documents');
```

```sql
-- Verify match_ai_embeddings privileges (signature may differ; adjust in your DB)
select
  has_function_privilege('service_role', 'public.match_ai_embeddings(uuid, vector(1536), uuid, int, text[], text[], float8)', 'execute') as service_exec,
  has_function_privilege('authenticated', 'public.match_ai_embeddings(uuid, vector(1536), uuid, int, text[], text[], float8)', 'execute') as authed_exec,
  has_function_privilege('anon', 'public.match_ai_embeddings(uuid, vector(1536), uuid, int, text[], text[], float8)', 'execute') as anon_exec;
```

```sql
-- Recent usage logs for infra-sensitive endpoints
select created_at, endpoint, unknown, metadata
from public.ai_usage_logs
where endpoint in ('ai-strategy-generate','ai-seed-default-brain-pack')
order by created_at desc
limit 20;
```

```sql
-- Storage bucket existence (brain documents upload surface)
select id, name, public
from storage.buckets
where id = 'brain-documents';
```

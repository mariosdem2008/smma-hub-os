# Default Brain Pack v1 — Postgres RPC (Seed Draft Docs)

Purpose: seed the “Default Brain Pack v1” as **draft** `brain_documents` (+ `brain_document_versions`) for an agency, **only if the agency currently has 0 brain_documents total**.

## Migration

- RPC is created in `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql:1`.

## Signature

```sql
public.seed_default_brain_pack_v1(
  p_agency_id uuid,
  p_user_id uuid,
  p_docs jsonb
)
returns table (document_id uuid, module text)
```

## Behavior (No Guess)

- Idempotent guard: if any row exists in `public.brain_documents` for `p_agency_id`, the function returns **0 rows** and inserts nothing.
- Atomic: uses a per-agency `pg_advisory_xact_lock(...)` inside the function, and all inserts occur within the same RPC call.
- Enforces exact doc count: `jsonb_array_length(p_docs) <> 3` raises an exception.
- Inserts **draft** documents (`status='draft'`) with `version=1`.
- Inserts matching version history rows in `public.brain_document_versions` with `version=1` and the same `content_json`.
- Returns the inserted `document_id` + `module` for each inserted doc.

## Expected `p_docs` JSON shape

`p_docs` is a JSON array of exactly 3 objects:

```json
[
  { "module": "bootstrap", "title": "Bootstrap Profile (Default Brain Pack v1)", "content_json": { } },
  { "module": "rep_policy", "title": "Rep Policy (Default Brain Pack v1)", "content_json": { } },
  { "module": "quality_bar", "title": "Quality Bar (Default Brain Pack v1)", "content_json": { } }
]
```

Notes:
- `module` is cast to `public.brain_module` inside the RPC.
- `source` is optional; if omitted, defaults to `'onboarding'` in the RPC.

## Example call

```sql
select *
from public.seed_default_brain_pack_v1(
  p_agency_id := '00000000-0000-0000-0000-000000000000',
  p_user_id := auth.uid(),
  p_docs := '[
    {"module":"bootstrap","title":"Bootstrap Profile (Default Brain Pack v1)","content_json":{}},
    {"module":"rep_policy","title":"Rep Policy (Default Brain Pack v1)","content_json":{}},
    {"module":"quality_bar","title":"Quality Bar (Default Brain Pack v1)","content_json":{}}
  ]'::jsonb
);
```


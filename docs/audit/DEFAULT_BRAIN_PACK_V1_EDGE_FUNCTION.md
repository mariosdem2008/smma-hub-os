# Default Brain Pack v1 — Edge Function (Seed + Approve + RAG Ingest)

Goal: seed Default Brain Pack v1 for an agency **once**, then auto-approve and ingest into RAG so `ai-strategy-generate` can retrieve `doc_type='brain_document'` context.

## Endpoint

- Function: `supabase/functions/ai-seed-default-brain-pack/index.ts:1`
- Name: `ai-seed-default-brain-pack`
- Method: `POST`

## Request contract

Body is optional:

```json
{ "agency_id": "uuid-optional" }
```

If `agency_id` is omitted, the function will infer it only when the caller has exactly one `agency_members` row. If the caller belongs to multiple agencies, it returns `400` and requires `agency_id`.

## Response contract

```json
{
  "seeded": true,
  "document_ids": ["uuid", "uuid", "uuid"],
  "approved": true,
  "ingested": true,
  "errors": []
}
```

Notes:
- If the agency already has **any** `brain_documents`, the seed RPC returns 0 rows and the edge function responds with `seeded:false` and does nothing else.
- If approval/ingestion fails for any doc, the function returns `seeded:true` and includes `errors[]`, and sets `approved:false` and/or `ingested:false` accordingly.

## Security model

- The caller must present a valid `Authorization: Bearer <jwt>` header.
- Membership is checked before seeding via `agency_members` in `supabase/functions/ai-seed-default-brain-pack/index.ts:55`.
- The seed RPC also checks admin/owner membership in `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql:1`.

## Idempotency + atomic seed

- The seed is atomic and idempotent via `public.seed_default_brain_pack_v1(...)` (RPC) in `supabase/migrations/20260110120000_seed_default_brain_pack_v1_rpc.sql:1`.
- The edge function calls that RPC and uses “0 returned rows” as the idempotent no-op signal.

## Personalization source of truth

- Templates are rendered from `src/brain/defaultPackV1.ts:1` via `renderDefaultBrainPackV1(...)`.
- Agency fields come from `agencies.name`, `agencies.website`, `agencies.niche` queried inside `supabase/functions/_shared/seed-default-brain-pack.ts:45`.

## Approval + ingestion flow

- Approval helper: `approveBrainDocument(...)` from `supabase/functions/_shared/brain-documents.ts:317`
- Ingestion helper: `ingestBrainDocumentForRag(...)` from `supabase/functions/_shared/brain-documents.ts:618`
- Orchestration: `seedApproveAndIngestDefaultBrainPackV1(...)` in `supabase/functions/_shared/seed-default-brain-pack.ts:54`

## Tests

- Core handler behavior is covered with a mocked Supabase client in `supabase/functions/_shared/__tests__/seed-default-brain-pack.test.ts:1`.


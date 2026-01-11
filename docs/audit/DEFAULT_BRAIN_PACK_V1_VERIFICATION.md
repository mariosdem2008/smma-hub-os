# Default Brain Pack v1 — Verification Checklist

## Script (PASS/FAIL with counts)

Run:
- `node scripts/verify-default-brain-pack.mjs --agency-id <AGENCY_UUID>`
- Optional smoke test (requires `CRON_SECRET` + `--client-id <CLIENT_UUID>`): `node scripts/verify-default-brain-pack.mjs --agency-id <AGENCY_UUID> --client-id <CLIENT_UUID> --smoke`

Required env vars:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional env vars:
- `TEST_AGENCY_ID` (used if `--agency-id` omitted)
- `TEST_CLIENT_ID` (used if `--client-id` omitted)
- `CRON_SECRET` (required for `--smoke`)

What it prints:
- `brain_documents` count for the agency
- `ai_documents` count where `doc_type='brain_document'`
- `ai_document_chunks` count for those `ai_documents`
- `ai_embeddings` count for those `ai_documents` with `doc_type='brain_document'`
- `OVERALL: PASS|FAIL`

## SQL queries (7)

Replace `:agency_id` and `:client_id`.

1) Brain docs exist (agency-wide)
```sql
select count(*) as brain_documents
from public.brain_documents
where agency_id = :agency_id;
```

2) Default pack modules present + status
```sql
select module, status, count(*) as docs
from public.brain_documents
where agency_id = :agency_id
group by module, status
order by module, status;
```

3) Versions exist (should be 3 docs × 1 version initially)
```sql
select count(*) as brain_document_versions
from public.brain_document_versions v
join public.brain_documents d on d.id = v.document_id
where d.agency_id = :agency_id;
```

4) RAG docs exist for brain docs
```sql
select count(*) as ai_documents_brain_document
from public.ai_documents
where agency_id = :agency_id
  and doc_type = 'brain_document';
```

5) Chunk count for brain docs
```sql
select count(*) as ai_document_chunks_brain_document
from public.ai_document_chunks c
join public.ai_documents d on d.id = c.document_id
where d.agency_id = :agency_id
  and d.doc_type = 'brain_document';
```

6) Embedding count for brain docs
```sql
select count(*) as ai_embeddings_brain_document
from public.ai_embeddings e
join public.ai_documents d on d.id = e.document_id
where d.agency_id = :agency_id
  and d.doc_type = 'brain_document'
  and e.doc_type = 'brain_document';
```

7) RAG retrieval returns brain docs (sanity)
```sql
select doc_type, document_id, chunk_id, score
from public.match_ai_embeddings(
  :agency_id,
  (select embedding from public.ai_embeddings where agency_id = :agency_id and doc_type = 'brain_document' limit 1),
  null,
  5,
  array['brain_document']
);
```

## UI steps (5)

1) Create a brand-new agency and complete agency onboarding.
2) Confirm the agency is redirected to dashboard successfully (onboarding completion must not block).
3) Navigate to `Agency Brain` → open any layer (e.g. `Rep Policy`).
4) Confirm you see real docs (not examples) for the default pack modules (`bootstrap`, `rep_policy`, `quality_bar`) and that they are approved.
5) Trigger strategy generation for any client in that agency (or run the script smoke test); confirm the output includes citations and at least one citation has `doc_type='brain_document'`.

## Failure modes (3) + expected behavior

1) **Seed skipped** (agency already has any `brain_documents`)
   - Expected: edge function returns `seeded:false`; UI CTA is hidden; onboarding auto-seed does nothing.

2) **Seeded but ingestion failed** (`seeded:true` and `ingested:false`)
   - Expected: docs exist in `brain_documents`, but `ai_documents/ai_embeddings` may be missing/partial; UI shows a warning and the onboarding flow shows a non-blocking toast indicating AI indexing failed.

3) **AI generation not configured** (missing `OPENAI_API_KEY` in the function environment)
   - Expected: `ai-strategy-generate` returns `unknown:true` with `missing_fields` including `embedding_api_key`; Default Brain Pack docs still exist and can be verified via SQL/script counts.


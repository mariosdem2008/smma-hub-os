# SQL Smoke Tests (Brain Spine v1)

Run these in Supabase SQL editor after migrations.

1) Verify core tables exist:
```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('agency_brains','client_brains','ai_memory_items','ai_usage_logs','ai_documents','ai_embeddings');
```

2) Verify `client_brains.usable` column:
```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'client_brains'
  and column_name = 'usable';
```

3) Verify `strategy_draft` doc_type accepted:
```sql
insert into public.ai_documents (agency_id, doc_type, title, content, source)
select id, 'strategy_draft', 'Smoke Test', 'test content', '{"source_type":"smoke_test","source_ref":"sql"}'::jsonb
from public.agencies
limit 1;
```

4) Verify match_ai_embeddings returns rows for an agency:
```sql
select *
from public.match_ai_embeddings(
  (select id from public.agencies limit 1),
  null,
  array_fill(0.01::float8, array[1536])::vector,
  2,
  null
);
```

5) Verify ai_usage_logs insert:
```sql
insert into public.ai_usage_logs (agency_id, endpoint, model, tokens_estimate)
select id, 'sql_smoke_test', 'test', 1
from public.agencies
limit 1;
```

## Remote Verification (pending)
TODO: Run Q1/Q2/Q3 in Supabase SQL editor. CLI lacks a remote query command and no DB URL is configured locally.

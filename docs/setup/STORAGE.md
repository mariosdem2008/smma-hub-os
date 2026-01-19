# Storage Setup

## `brain-documents` bucket

AI Setup file uploads require the `brain-documents` storage bucket and its policies. The repo includes a migration for this; if migrations/setup aren’t applied, uploads will fail.

1. Apply migrations: `supabase db push`
2. Verify in Supabase Dashboard → Storage → `brain-documents`

If you need to create the bucket manually:

```sql
insert into storage.buckets (id, name, public)
values ('brain-documents', 'brain-documents', false)
on conflict (id) do nothing;
```


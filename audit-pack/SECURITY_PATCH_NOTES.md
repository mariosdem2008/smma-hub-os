# SECURITY PATCH NOTES

## Locked-down cron / privileged functions
All functions below require header `x-cron-secret` matching `CRON_SECRET`:
- `publish-scheduled-posts`
- `refresh-meta-tokens`
- `sync-social-metrics`
- `generate-approval-reminders`
- `sync-meta-ads`

Evidence: supabase/functions/_shared/cron.ts:1-16, supabase/functions/publish-scheduled-posts/index.ts:1-25, supabase/functions/refresh-meta-tokens/index.ts:1-23, supabase/functions/sync-social-metrics/index.ts:1-23, supabase/functions/generate-approval-reminders/index.ts:1-19, supabase/functions/sync-meta-ads/index.ts:1-27

## Required header
- Header: `x-cron-secret`
- Value: `CRON_SECRET` stored in Supabase/deployment secrets (evidence: supabase/functions/_shared/cron.ts:1-16)

## Local tests (401 vs 200)
401 without header:
```sh
curl -i https://YOUR_PROJECT_REF.supabase.co/functions/v1/publish-scheduled-posts
```

200 with header:
```sh
curl -i -H "x-cron-secret: $CRON_SECRET" https://YOUR_PROJECT_REF.supabase.co/functions/v1/publish-scheduled-posts
```

## RLS verification snippet (clients)
```sql
-- Expect rows for admin/manager
select id, agency_id, name
from public.clients
where agency_id in (
  select agency_id from public.agency_members
  where user_id = auth.uid()
    and role in ('owner','admin','manager')
);
```

Evidence for policy location: supabase/migrations/20251222090000_restore_client_member_access.sql:1-22

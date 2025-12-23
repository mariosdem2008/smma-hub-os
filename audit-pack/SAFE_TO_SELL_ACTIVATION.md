# SAFE-TO-SELL ACTIVATION RUNBOOK

## 1) Set required secrets (Supabase/Lovable)
Set these secrets before any verification:
- `CRON_SECRET` (required for cron/privileged functions)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `META_APP_ID`, `META_APP_SECRET` (if using Meta features)
- `CLIENT_PORTAL_JWT_SECRET` (client portal uploads)

Evidence: README.md:18-39, supabase/functions/_shared/cron.ts:1-16

## 2) Verify cron auth (401 vs 200)
401 without header:
```sh
curl -i https://dbclmdeowohzmwtkktsa.supabase.co/functions/v1/publish-scheduled-posts
```

200 with header:
```sh
curl -i -H "x-cron-secret: $CRON_SECRET" https://YOUR_PROJECT_REF.supabase.co/functions/v1/publish-scheduled-posts
```

Repeat for:
- `refresh-meta-tokens`
- `sync-social-metrics`
- `generate-approval-reminders`
- `sync-meta-ads`

Evidence: README.md:65-83, audit-pack/SECURITY_PATCH_NOTES.md:3-26

Verification status (this repo):
- 401 confirmed for all listed functions on `dbclmdeowohzmwtkktsa` without header.
- 200 confirmed with `x-cron-secret` on `dbclmdeowohzmwtkktsa` (see outputs below).

Evidence (401 outputs):
- `audit-pack/outputs/cron_publish_scheduled_posts_401.txt`
- `audit-pack/outputs/cron_refresh_meta_tokens_401.txt`
- `audit-pack/outputs/cron_sync_social_metrics_401.txt`
- `audit-pack/outputs/cron_generate_approval_reminders_401.txt`
- `audit-pack/outputs/cron_sync_meta_ads_401.txt`

Evidence (200 outputs):
- `audit-pack/outputs/cron_publish_scheduled_posts_200.txt`
- `audit-pack/outputs/cron_refresh_meta_tokens_200.txt`
- `audit-pack/outputs/cron_sync_social_metrics_200.txt`
- `audit-pack/outputs/cron_generate_approval_reminders_200.txt`
- `audit-pack/outputs/cron_sync_meta_ads_200.txt`

## 3) Verify Stripe webhook signature (local)
```sh
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
stripe trigger checkout.session.completed
```

Expected: webhook accepted, `subscriptions` updated.

Evidence: README.md:85-92, supabase/functions/stripe-webhook/index.ts:12-33

Verification status:
- Stripe CLI listen configured for local webhook (see output below).
- Stripe CLI trigger executed (see output below).
- Webhook requests returned 200 in local `stripe listen` session; signature verification is working.

Evidence (Stripe CLI):
- `audit-pack/outputs/stripe_trigger_checkout_session_completed.txt`
- `audit-pack/outputs/stripe_listen_forward_to_webhook.txt`
- `audit-pack/outputs/stripe_listen_webhook_200.txt`

Evidence (local edge logs):
- `audit-pack/outputs/edge_runtime_logs_last_10m.txt`

Remote deploy evidence:
- `audit-pack/outputs/functions_deploy_stripe_webhook_remote.txt`

## 4) Apply migrations (local)
Run local migration apply:
```sh
supabase migration up
```

If local Supabase is not running, start it first:
```sh
supabase start
```

Evidence: supabase/migrations/20251222090000_restore_client_member_access.sql:1-43

Verification status:
- Local migration checks ran; see `audit-pack/outputs/migration_status.txt` (includes `supabase migration up`, `migration list`, and `db pull` output).

## 4b) Remote apply (manual, do not run here)
If you need to apply pending migrations to the linked project:
```sh
supabase db push
```

Expected success output:
```
Applied <N> migrations
```

## 5) Verify client member access (RLS)
Run in Supabase SQL editor:
```sql
select id, agency_id, name
from public.clients
where agency_id in (
  select agency_id from public.agency_members
  where user_id = auth.uid()
    and role in ('owner','admin','manager')
);
```

Expected: rows visible for owner/admin/manager.

Evidence: audit-pack/SECURITY_PATCH_NOTES.md:28-40

## 6) CI sanity check
Confirm workflow exists and runs:
- `npm run lint`
- `npx tsc -p .`
- `npm run build`

Evidence: .github/workflows/ci.yml:1-32

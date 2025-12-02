# Supabase Cron Configuration for SMMAHUB

This document describes how to configure Supabase pg_cron to automatically execute edge functions on a schedule.

## Required Cron Jobs

### 1. publish-scheduled-posts (Every 5 minutes)

Automatically publishes scheduled social media content when `scheduled_for` time arrives.

```sql
-- Run in Supabase SQL Editor
SELECT cron.schedule(
  'publish-scheduled-posts-every-5-min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/publish-scheduled-posts',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

**Replace:**
- `YOUR_PROJECT_REF` with your Supabase project reference ID
- `YOUR_ANON_KEY` with your Supabase anon/public key

### 2. refresh-meta-tokens (Every 12 hours)

Refreshes Meta (Facebook/Instagram) OAuth access tokens to prevent expiry.

```sql
-- Run in Supabase SQL Editor
SELECT cron.schedule(
  'refresh-meta-tokens-every-12-hours',
  '0 */12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/refresh-meta-tokens',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

### 3. sync-social-metrics (Every 6 hours)

Syncs social media analytics (post metrics and profile stats) from Instagram, Facebook, and LinkedIn.

```sql
-- Run in Supabase SQL Editor
SELECT cron.schedule(
  'sync-social-metrics-every-6-hours',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-social-metrics',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

### 4. generate-approval-reminders (Daily at 9 AM)

Creates notifications for projects stuck in `client_review` stage for more than 48 hours.

```sql
-- Run in Supabase SQL Editor
SELECT cron.schedule(
  'generate-approval-reminders-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/generate-approval-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

### 5. sync-meta-ads (Daily at 6 AM)

Fetches campaign and insights data from Meta Marketing API for all connected ad accounts.

```sql
-- Run in Supabase SQL Editor
SELECT cron.schedule(
  'sync-meta-ads-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-meta-ads',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

## How to Enable pg_cron and pg_net

1. Go to your Supabase Dashboard → Database → Extensions
2. Enable `pg_cron` extension
3. Enable `pg_net` extension

## Viewing Cron Jobs

```sql
-- List all scheduled cron jobs
SELECT * FROM cron.job;
```

## Removing Cron Jobs

```sql
-- Remove a cron job by name
SELECT cron.unschedule('publish-scheduled-posts-every-5-min');
SELECT cron.unschedule('refresh-meta-tokens-every-12-hours');
SELECT cron.unschedule('sync-social-metrics-every-6-hours');
```

## Monitoring Cron Execution

Check edge function logs in Supabase Dashboard → Edge Functions → Logs to see cron execution results.

Check `post_logs`, `token_refresh_logs`, and `metrics_sync_logs` tables for detailed execution history.

## Cron Schedule Format

Format: `minute hour day month weekday`

Examples:
- `*/5 * * * *` - Every 5 minutes
- `0 */12 * * *` - Every 12 hours
- `0 0 * * *` - Daily at midnight
- `0 9 * * 1` - Every Monday at 9 AM

## Troubleshooting

- If cron doesn't run, ensure `pg_cron` and `pg_net` extensions are enabled
- Verify your edge function URL and anon key are correct
- Check Supabase logs for execution errors
- Ensure your functions are deployed and active

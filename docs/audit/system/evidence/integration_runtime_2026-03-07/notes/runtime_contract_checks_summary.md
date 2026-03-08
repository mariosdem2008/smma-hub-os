# Integration Runtime Contract Checks

Started: 2026-03-07T07:42:01.189Z
Ended: 2026-03-07T07:42:19.036Z
Supabase host: dbclmdeowohzmwtkktsa.supabase.co
Cron secret present: no
Pass: 7/7

| Case | Method | Path | Expected | Actual | OK |
|---|---|---|---|---:|---|
| checkout_unauthorized | POST | /functions/v1/create-checkout | 401 | 401 | yes |
| stripe_webhook_missing_signature | POST | /functions/v1/stripe-webhook | 400 | 400 | yes |
| social_oauth_missing_auth | POST | /functions/v1/social-oauth | 401 | 401 | yes |
| social_oauth_callback_missing_code_state | GET | /functions/v1/social-oauth-callback | 200 | 200 | yes |
| cron_publish_without_secret | POST | /functions/v1/publish-scheduled-posts | 401 | 401 | yes |
| cron_refresh_without_secret | POST | /functions/v1/refresh-meta-tokens | 401 | 401 | yes |
| cron_sync_metrics_without_secret | POST | /functions/v1/sync-social-metrics | 401 | 401 | yes |
# Integration Function Ownership Registry (2026-03-07)

Total functions: 60

| Function | Class | Owner | In Config | Frontend Invoked |
|---|---|---|---|---|
| add-client-user-to-conversation | auth_messaging_backend | Auth & Comms | yes | no |
| ai-agency-admin-chat | frontend_invoked | AI Platform | no | yes |
| ai-answer-quality-check | internal_backend | AI Platform | no | no |
| ai-ask | internal_backend | AI Platform | no | no |
| ai-assistant | frontend_invoked | AI Platform | no | yes |
| ai-brain-analyze | internal_backend | AI Platform | no | no |
| ai-brain-document-approve | frontend_invoked | AI Platform | no | yes |
| ai-brain-ingest | internal_backend | AI Platform | no | no |
| ai-brains-agency | internal_backend | AI Platform | no | no |
| ai-brains-client | internal_backend | AI Platform | no | no |
| ai-default-brain-pack-ingestion-health | frontend_invoked | AI Platform | yes | yes |
| ai-documents-ingest | frontend_invoked | AI Platform | no | yes |
| ai-ingestion-source-register | internal_backend | AI Platform | no | no |
| ai-job-worker | internal_backend | AI Platform | no | no |
| ai-memory-approve | internal_backend | AI Platform | no | no |
| ai-onboarding | frontend_invoked | AI Platform | no | yes |
| ai-onboarding-guide | internal_backend | AI Platform | no | no |
| ai-onboarding-scan | frontend_invoked | AI Platform | no | yes |
| ai-onboarding-suggest | frontend_invoked | AI Platform | no | yes |
| ai-rep-chat | frontend_invoked | AI Platform | no | yes |
| ai-retrieve-context | internal_backend | AI Platform | no | no |
| ai-seed-default-brain-pack | frontend_invoked | AI Platform | no | yes |
| ai-seed-default-brain-pack-admin | internal_backend | AI Platform | no | no |
| ai-strategy-generate | frontend_invoked | AI Platform | no | yes |
| ai-strategy-tools | internal_backend | AI Platform | no | no |
| check-subscription | frontend_invoked | Billing | yes | yes |
| client-auth-forgot-password | auth_messaging_backend | Auth & Comms | yes | no |
| client-auth-login | auth_messaging_backend | Auth & Comms | yes | no |
| client-auth-logout | auth_messaging_backend | Auth & Comms | yes | no |
| client-auth-reset-password | auth_messaging_backend | Auth & Comms | yes | no |
| client-auth-signup | auth_messaging_backend | Auth & Comms | yes | no |
| client-auth-validate-invite | auth_messaging_backend | Auth & Comms | yes | no |
| client-refresh-token | internal_backend | Platform | yes | no |
| create-checkout | frontend_invoked | Billing | yes | yes |
| create-conversation | auth_messaging_backend | Auth & Comms | yes | no |
| customer-portal | frontend_invoked | Billing | yes | yes |
| email-sequence-dispatcher | cron_scheduled | Auth & Comms | yes | no |
| generate-ai-content | frontend_invoked | Platform | yes | yes |
| generate-approval-reminders | cron_scheduled | Auth & Comms | yes | no |
| generate-brand-guidelines-pdf | frontend_invoked | Platform | no | yes |
| generate-monthly-report | frontend_invoked | Ops & Reporting | yes | yes |
| integration-runtime-probe | probe_test | Platform | no | no |
| list-conversations | auth_messaging_backend | Auth & Comms | yes | no |
| list-messages | auth_messaging_backend | Auth & Comms | yes | no |
| mark-message-read | auth_messaging_backend | Auth & Comms | yes | no |
| notify-assigned-editor | frontend_invoked | Auth & Comms | yes | yes |
| publish-scheduled-posts | cron_scheduled | Platform | yes | no |
| refresh-meta-tokens | cron_scheduled | Integrations | yes | no |
| send-approval-notification | frontend_invoked | Auth & Comms | yes | yes |
| send-message | auth_messaging_backend | Auth & Comms | yes | no |
| send-portal-invite | frontend_invoked | Auth & Comms | yes | yes |
| send-team-invite | frontend_invoked | Auth & Comms | yes | yes |
| send-waitlist-email | frontend_invoked | Auth & Comms | yes | yes |
| social-oauth | frontend_invoked | Integrations | yes | yes |
| social-oauth-callback | webhook_callback | Integrations | yes | no |
| stripe-webhook | webhook_callback | Billing | yes | no |
| stripe-webhook-probe | probe_test | Billing | no | no |
| sync-meta-ads | frontend_invoked | Integrations | yes | yes |
| sync-social-metrics | frontend_invoked | Integrations | yes | yes |
| upload-file | internal_backend | Ops & Reporting | yes | no |

## Closure Rules
1. `frontend_invoked`: must stay implemented and contract-tested.
2. `cron_scheduled` and `webhook_callback`: must stay in `supabase/config.toml` with explicit `verify_jwt` contract.
3. `probe_test`: keep only for staged validation; disable in production runbook when not needed.
4. `internal_backend` or `auth_messaging_backend`: retain with owner accountability and remove only with dependency proof.

# Integration Inventory Classification (2026-03-07)

## Summary
- Frontend invoke coverage is complete (`missing_function_dirs_for_invokes.txt` = none).
- Remaining scope is classification/governance for backend-only and config-implicit functions.

## Class A: Frontend-Invoked (Primary Product Paths)
- Source: `queries/invoked_functions.txt`
- Count: `25`
- Action: Keep; covered by invoke->dir contract tests.

## Class B: Backend-Only Expected (Do Not Remove)
- Auth callback/webhook/cron/worker or internal orchestration surfaces.
- Examples:
  - `social-oauth-callback`
  - `stripe-webhook`
  - `client-auth-*`
  - `create-conversation`, `list-conversations`, `list-messages`, `send-message`, `mark-message-read`
  - `ai-job-worker`
  - `generate-approval-reminders`, `publish-scheduled-posts`, `refresh-meta-tokens`, `email-sequence-dispatcher`
- Action: Keep; assign explicit owner and SLA in final registry.

## Class C: Probe/Test-Only (Operational)
- `integration-runtime-probe`
- `stripe-webhook-probe`
- Action: Keep with explicit `ops/test-only` tag and deployment policy.

## Class D: Needs Explicit Ownership Review (No Immediate Runtime Break)
- In `dir_but_not_in_config.txt` and/or not directly invoked by frontend but not clearly cron/webhook/probe.
- Examples:
  - `ai-answer-quality-check`
  - `ai-ask`
  - `ai-brains-agency`
  - `ai-brains-client`
  - `ai-ingestion-source-register`
  - `ai-memory-approve`
  - `ai-strategy-tools`
- Action: Mark owner and usage path; if no active usage path exists, mark as candidate deprecation.

## Closure Criteria for WF-INTEGRATION-INVENTORY-HARDENING
1. Every function mapped to one class: `frontend-invoked`, `backend-only`, `probe/test-only`, or `candidate-deprecation`.
2. Every backend-only function has owner + trigger source (`cron`, `webhook`, `internal edge`, `manual ops`).
3. Every config-implicit function is either:
   - added to `supabase/config.toml` explicitly, or
   - documented as intentional implicit default.

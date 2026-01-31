## Test Plan

### Phase 0
- Create a new client via UI path; verify a baseline `client_brains` row exists immediately.
- Call `ai-strategy-generate` for a brand-new client:
  - expect HTTP 200 `unknown=true`, `code=CLIENT_BRAIN_MISSING` (or `BRAIN_INCOMPLETE` once baseline exists), and a deep link to onboarding.
- Verify that after onboarding + ingest, the gate passes and strategy generates normally.

### Phase 1
- Completing onboarding enqueues the correct jobs and they are deduped.
- Ingest job produces canonical `brain_json` and updates `usable`.
- Seed strategy job generates only when gates pass.

### Phase 2
- Schema validation (or intentional schema v2 upgrade path) aligns with mapping output.

### Phase 3
- Signals create proposals; proposals apply to new brain versions; risky fields require approval.

### Phase 4
- Every endpoint uses router; missing context consistently returns unknown.

# Agentic Load Test Plan (Phase 1 Stub)

Purpose:
- Validate p95 latency <= 2.5s under load and confirm workflow success >= 95%.

Inputs:
- Target endpoints: ai-ask, ai-assistant, ai-strategy-generate, ai-retrieve-context
- Dataset: `tests/evals/agentic_golden.template.jsonl` (placeholder)

Metrics:
- p95 end-to-end latency
- success rate
- schema validity
- 0 cross-tenant leaks

Tool:
- Use `scripts/perf/http_load_test.ts` (no dependencies).
- Run against a staging target with explicit auth headers; do not use production credentials in local shells.

Suggested schedule (baseline):
- Warmup: 25 requests
- Requests: 2000
- Concurrency: 25
- Timeout: 15s

Example (staging):
```bash
AI_EVALS_ENABLED=true \
LOADTEST_URL="https://YOUR_PROJECT_REF.supabase.co/functions/v1/ai-ask" \
LOADTEST_METHOD="POST" \
LOADTEST_HEADERS_JSON='{"Authorization":"Bearer YOUR_USER_JWT"}' \
LOADTEST_BODY_JSON='{"query":"Hello","client_id":"CLIENT_UUID"}' \
LOADTEST_REQUESTS=2000 \
LOADTEST_CONCURRENCY=25 \
LOADTEST_TIMEOUT_MS=15000 \
LOADTEST_EXPECT_P95_MS=2500 \
LOADTEST_EXPECT_SUCCESS_RATE=0.95 \
node scripts/perf/http_load_test.ts
```

Getting a user JWT (staging):
- Option A (browser DevTools):
  - Log into the app in your browser.
  - Open DevTools -> Application -> Local Storage -> your site.
  - Find the key like `sb-<project-ref>-auth-token` and copy `access_token`.
- Option B (browser console):
  - Run: `JSON.parse(localStorage.getItem('sb-<project-ref>-auth-token')).access_token`
  - Replace `<project-ref>` with your Supabase project ref (example: `dbclmdeowohzmwtkktsa`).
- Option C (in-app console):
  - If you have access to the Supabase client in the console: `await supabase.auth.getSession()` then copy `data.session.access_token`.

Ramp schedule:
- Phase A: concurrency=5, requests=200 (sanity)
- Phase B: concurrency=25, requests=2000 (target)
- Phase C: concurrency=50, requests=5000 (stress; expect possible throttling)

Evidence:
- `tests/perf/results/2026-02-01_ai-rep-chat_p95.json`

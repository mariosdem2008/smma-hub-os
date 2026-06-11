# Codex Build Brief: Automated E2E Happy-Path Harness

Build a reusable, scriptable end-to-end harness that proves the core SMMAHUB loop works against the live Supabase, with NO paid AI keys and NO UI driving — pure data/RPC assertions via the service role. The founder runs it (Codex's sandbox can't reach the network); your job is to write it correctly and self-containedly.

## Why
The mandate's success bar: "a real agency can sign up, configure their brain, onboard a client, and receive a real strategy-to-execution pipeline." We have `scripts/qa-seed.mjs` (creates agency+owner+client+usable brain) and have manually verified the strategy→execution bridge creates work. Turn that manual verification into a repeatable assertion harness.

## Build `scripts/e2e-happy-path.mjs` (Node, ESM)
Inputs via env (same as qa-seed): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`.

Run these stages in order, asserting each, printing `[PASS]/[FAIL]` per assertion and a final `N/M passed`, exit non-zero on any fail. Each created entity must be cleaned up at the end (or namespaced so re-runs don't collide). **Reuse `qa-seed.mjs`'s logic** (import or replicate) for seeding.

1. **Tenant**: create confirmed owner + agency + owner membership + `ai_onboarding_status=complete`. Assert the agency dashboard gate would pass (onboarding complete row exists).
2. **Client + brain**: create a client; set its `client_brains` row `usable=true` with a realistic brain. Assert `get_client_brain_status` RPC returns `usable=true`.
3. **Strategy row + bridge**: insert a `strategies` row; call `persist_strategy_execution_bridge` with a realistic 2-item plan + 1 brief. Assert the RPC returns `ok=true` with `plan_items_upserted=2`, `content_briefs_upserted=1`, `calendar_entries_upserted=2`.
4. **Work created**: query and assert — `content_plan_items` (2, status `planned`), `content_briefs` (1), `projects` (2, linked by `strategy_id`), `scheduled_posts` (2, status **`draft`** — autopublish safety: must NOT be `pending`).
5. **Idempotency**: call `persist_strategy_execution_bridge` again with the same plan; assert NO duplicate `content_plan_items`/`scheduled_posts` (counts unchanged).
6. **Blocker scan**: invoke `ai-blocker-scan` (POST, owner session token via password grant, body `{client_id}`) ; assert HTTP 200 and a `client_blockers` row exists for the client with a `delivery_state`.
7. **Agency pulse**: invoke `ai-agency-pulse` (owner session, body `{agency_id}`); assert HTTP 200, `summary.clients_total>=1`, and the response shape (`attention` array, `summary`).
8. **Isolation spot-check**: assert the publishable/anon key is DENIED on `content_plan_items` and `client_blockers` (expect 401/permission denied).
9. **Cleanup**: delete the created agency (cascades) / or all created rows; verify gone. Make the script safe to run repeatedly.

## Rules
- No paid AI providers/keys. Do NOT invoke `ai-strategy-generate` (it would hit the paid model) — the bridge RPC path is the deterministic substitute, which is the point.
- Self-contained, dependency-light (use global `fetch`, `crypto.randomUUID`). Clear console output. Idempotent/cleanup-safe.
- Add an npm script `"e2e:happy"` in package.json.
- Do NOT touch app/src/edge code — this is a test harness only. Do NOT run it yourself (no network); the founder runs it.

## Acceptance criteria
- `node scripts/e2e-happy-path.mjs` (run by founder) executes all stages, prints per-assertion PASS/FAIL, exits 0 only if all pass, and cleans up.
- Asserts the autopublish-safety invariant (scheduled_posts=draft) and the bridge idempotency invariant explicitly.

## Deliverables
Print `CODEX E2E SUMMARY` with the file created, the stages/assertions covered, the env it needs, and the exact command the founder runs.

Build it now.

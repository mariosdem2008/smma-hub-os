# Codex Build Brief: Agency Pulse — Agent Orchestration / Next-Best-Action Surface

Tie the governed agent team into ONE prioritized "what needs your attention now" surface for the agency owner. This is the vision's orchestration layer: "the system knows what is ready, blocked, pending approval, and what should happen next, and surfaces it to the right person." It makes the agents already built (grading, blocker-detection, reporting, strategy) visible and actionable in the operator's daily flow. The technical founder reviews and tests with local models / `scripts/qa-seed.mjs`.

## Absolute rules
- **No paid AI providers / production keys.** This layer is **deterministic aggregation** of signals the agents already persist — it needs NO model. Any optional "daily briefing" phrasing goes through `ai.run`, local-only by default, and is never required.
- Agency-scoped isolation everywhere. New migration (if any) AFTER 20260610131500. Idempotent. Match existing style. `npm run build` + `npx vitest run` green. Keep the design system + ErrorBoundary intact; respect the Button `asChild` single-child rule.
- **Reuse, do NOT duplicate.** The dashboard already has an "Action queue" / "Items at risk" area. EXTEND it into the unified attention queue rather than building a new page. Reuse: `client_blockers` + `ai-blocker-scan` (blocker-detection.ts), `ai_gradings` (answer-grading.ts), strategy state, `social_*`/reports tables. SEARCH FIRST.

## What to build

### 1. Shared aggregator — `supabase/functions/_shared/agency-pulse.ts` (pure, unit-testable)
`buildAgencyPulse({ clients, blockerSnapshots, gradings, strategyStates, reportStates, now })` →
```
{
  summary: { clients_total, on_track, at_risk, blocked },
  attention: [{
    client_id, client_name,
    signal_type: "blocker"|"flagged_content"|"strategy_missing"|"strategy_stale"|"approval_stalled"|"report_due",
    severity: "high"|"med"|"low",
    title, detail,
    responsible_agent: "grading"|"blocker"|"strategy"|"reporting",
    owner: "agency"|"client"|"owner",
    recommended_action, deep_link
  }],
  counts_by_type, counts_by_owner
}
```
Aggregation rules (deterministic):
- **blocker** — from each client's latest `client_blockers` snapshot (top blocker per client, severity carried).
- **flagged_content** — from recent `ai_gradings` rows with `accepted=false` or hard_violations (needs human review).
- **strategy_missing** — onboarding complete but no approved strategy.
- **strategy_stale** — approved strategy older than a threshold (e.g. >45 days) with no refresh.
- **approval_stalled** — already surfaced by blockers; dedupe so it isn't double-counted.
- **report_due** — no monthly report generated for the current period for an active client.
Sort by severity then recency. Cap per-client to the top signal to avoid noise. Fully unit-tested (empty agency → empty attention + all-zero summary; mixed agency → correct counts + ordering + dedup).

### 2. Edge function `ai-agency-pulse/index.ts`
- Auth + agency membership. Loads active clients; for each, ensures a fresh-enough `client_blockers` snapshot (invoke/refresh the blocker scan if stale, capped/paged), then reads gradings/strategy/report state. Calls the aggregator.
- Optional local-LLM "daily briefing" sentence (gated, off by default).
- Persist the pulse snapshot to `agency_pulse` (agency_id, summary jsonb, attention jsonb, counts jsonb, generated_at; agency-scoped RLS, anon denied; unique-per-agency upsert) OR compute on-read if cheaper — pick the lower-complexity option and document why. Register in config.toml (verify_jwt=true) + endpoint allowlist.

### 3. Surface in the existing dashboard (reuse, don't rebuild)
- Hook `src/hooks/useAgencyPulse.ts`.
- Replace/augment the existing dashboard "Action queue" with the unified attention queue: top N items across clients, each showing client, severity, the responsible agent, the recommended action, owner, and a deep link. Keep the summary tiles (on_track/at_risk/blocked) wired to real pulse data. Designed loading/empty/error states (use shared `EmptyState`). No new route.

## Acceptance criteria
- Aggregator works with NO AI provider configured (prove in unit tests): a seeded agency with one blocked client + one flagged grading + one strategy-missing client yields the right attention items, types, owners, and summary counts; an all-clear agency yields empty attention + `on_track` counts.
- `agency_pulse` (if persisted): agency-scoped RLS, anon denied; migration applies via `--dry-run` (do NOT push; founder pushes).
- Dashboard shows the unified queue from real data; no duplicate parallel at-risk logic; existing tiles wired to pulse.
- `npm run build` + `npx vitest run` green.

## Deliverables
Print `CODEX PULSE SUMMARY` with files changed/created, the schema (if any), persist-vs-on-read decision + why, which existing dashboard logic you replaced, test results, and a founder review checklist (incl. how to verify with `scripts/qa-seed.mjs` + a seeded blocked client).

Build it now. Deterministic aggregation, governed, no paid keys.

# Codex Build Brief: Blocker Detection Agent

Build the governed agent that answers, for each client: **what is blocking delivery right now, who must act, and what the next action is.** This serves a core vision pillar ("the system knows what is ready, blocked, pending approval, and what should happen next") and the locked Tier-2 ICP's #1 pain ("blockers discovered too late"). The technical founder reviews and tests with a local model.

## Absolute rules
- **No paid AI providers / production keys.** The agent must be **deterministic-first**: nearly all blockers are detectable from existing state with NO model. Any optional LLM layer (prioritization narrative / suggested wording) MUST go through `ai.run` and only run against a local model by default (mirror the pattern in `supabase/functions/_shared/answer-grading.ts`: `localJudgeConfigured()` gate). The whole agent must work with no AI provider configured.
- Multi-tenant isolation: agency-scoped everywhere. New migration timestamp AFTER 20260610130000. Idempotent. Match existing code style. `npm run build` + `npx vitest run` green.
- **Do NOT duplicate existing logic.** The dashboard already computes "Items at risk", "Approval bottleneck", "Overdue risk" and there are `client_enrichment_queue`, `client_execution_tasks`, `get_client_brain_status`, and operations-setup signals. SEARCH FIRST (`src/`, `supabase/functions`, `supabase/migrations`) and EXTEND/centralize the existing signals into one blocker model rather than inventing a parallel one. Reuse the design system + shared `EmptyState`; respect the Button `asChild` single-child rule.

## What to build

### 1. Shared deterministic detector — `supabase/functions/_shared/blocker-detection.ts` (pure, unit-testable)
`detectClientBlockers({ brainStatus, enrichmentQueue, executionTasks, operationsSetup, projects, strategyState, now })` → 
```
{
  delivery_state: "on_track" | "at_risk" | "blocked",
  blockers: [{
    code, severity: "high"|"med"|"low", title, detail,
    owner: "agency"|"client"|"owner",
    recommended_next_action: string,
    deep_link: string,
    signal_source: string
  }],
  counts: { high: number, med: number, blocked: number }
}
```
Detect at minimum: incomplete client brain (missing required fields → blocks strategy), open enrichment-queue items, overdue/blocked execution tasks, stalled approvals (projects in `client_review` beyond an SLA threshold, e.g. >48h), missing approver/primary contact or platform access in operations setup, pipeline stalls (a project stuck in one stage beyond a threshold), and no approved strategy when onboarding is complete. Owner routing: brain/approval gaps owned by client; execution/pipeline owned by agency; activation/setup owned by owner. Pure function, deterministic, fully unit-tested (edge cases: empty inputs, all-clear, SLA boundaries).

### 2. Edge function `ai-blocker-scan/index.ts`
- Auth + agency membership. Input `client_id` (and an agency-wide mode that scans all active clients for the dashboard, capped/paged).
- Load the signals (reuse existing queries/RPCs: `get_client_brain_status`, `client_enrichment_queue`, `client_execution_tasks`, operations setup, projects/pipeline). Call the shared detector.
- Optional local-LLM pass (gated, off by default) to tighten the recommended_next_action wording — never required.
- Persist a snapshot to a new `client_blockers` table (agency_id, client_id, delivery_state, blockers jsonb, counts jsonb, scanned_at; agency-scoped RLS, anon denied) — upsert latest per client.
- Register in `supabase/config.toml` (verify_jwt = true) and the endpoint allowlist if one applies.

### 3. UI surfacing (reuse, don't rebuild)
- A hook `src/hooks/useClientBlockers.ts` (and an agency-wide variant) reading the latest snapshot / invoking the scan.
- Surface in the EXISTING dashboard "Action queue" / "Items at risk" area and the client workspace header/right-rail — show top blockers with owner + next action + deep link. Do not create a new page; plug into existing surfaces. Keep loading/empty/error states designed.

## Acceptance criteria
- Deterministic detector works with NO AI provider configured (prove in unit tests): a client with missing brain fields + a 3-day-old client_review project + an overdue task yields the right blockers, owners, and `delivery_state="blocked"`; an all-clear client yields `on_track` with zero blockers.
- New `client_blockers` table: agency-scoped RLS, anon denied; migration applies via `--dry-run` (do NOT push; founder pushes).
- Dashboard/client surfaces show real blockers from the snapshot; no duplicate parallel at-risk logic — existing signals are centralized through the new detector where reasonable.
- `npm run build` + `npx vitest run` green.

## Deliverables
Print `CODEX BLOCKER SUMMARY` with files changed/created, the new schema, which existing signals you centralized vs left alone, test results, and a founder review checklist (routes + how to verify each blocker type, incl. a local seed if helpful).

Build it now. Deterministic-first, governed, no paid keys.

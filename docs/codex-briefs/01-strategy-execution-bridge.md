# Codex Build Brief: Strategy → Execution Bridge

You are a senior engineer on SMMAHUB, a governed AI operating system for social media marketing agencies (React 18 + TS + Vite SPA, Supabase Postgres + RLS + Deno edge functions). Implement the feature below to production quality. The technical founder will review your diff and test it.

## Absolute rules
- **Never use paid AI providers or production API keys for any test you run.** Local testing uses Ollama via the harness in `.env.local-ai` + `scripts/local-ai-smoke.ts` (model `qwen2.5-coder:1.5b`, OpenAI-compatible at `http://localhost:11434/v1`). The provider already honors `OPENAI_BASE_URL`.
- Preserve multi-tenant isolation: every new table is RLS-scoped by `agency_id`; every query is agency/client scoped. Put isolation in the DB + API layers, not just UI.
- Match existing code style and the V2 strategy architecture already in `supabase/functions/ai-strategy-generate/index.ts` and `src/lib/strategy/`.
- Write a new migration (timestamp AFTER 20260610120000) — never edit applied migrations.
- Idempotent everywhere: re-running strategy generation must not duplicate plans/tasks/calendar entries (use deterministic dedupe keys).

## Current state (verified by audit — read these to confirm)
- `ai-strategy-generate/index.ts` runs readiness→diagnosis→recommendation→plan, then `create_strategy_snapshot` RPC persists `strategies`, `strategy_modules`, `strategy_tasks`, `strategy_decisions` (see `supabase/migrations/20260108143000_strategy_snapshot_rpc.sql`), then `finalizePublishedStrategySideEffects` calls `refresh_client_enrichment_queue` + `refresh_client_execution_tasks`.
- The `weekly_plan` module holds ONLY the current week (a 3-item production checklist). **There is NO 90-day content plan and NO calendar entries are created from strategy.**
- `strategy_tasks` (Strategy OS, surfaced by `src/hooks/useStrategyTasks.ts` / right-rail TasksTab) and `client_execution_tasks` (operational, from enrichment queue) are two disconnected systems.
- The content calendar UI (`src/components/client-tabs/CalendarTab.tsx`) reads `posts` (or its scheduling table — confirm the exact table/columns the calendar + `publish-scheduled-posts` use).

## What to build

### 1. 90-day content plan generation
When a strategy is published, generate a structured ~12-week content plan grounded in the strategy's pillars + campaign_plan + channel_adaptations modules. Each plan item: week index, date window, pillar id, channel, content type, working title/hook, CTA (drawn only from approved cta styles), and status `planned`. Persist to a new `content_plan_items` table (RLS by agency_id, FK client_id + strategy_id). Coverage must respect pillar coverage percentages. Deterministic generation is acceptable (reuse the V2 deterministic builder pattern in `buildDeterministicStrategyOutputFromV2`); if you call an LLM, it must go through the existing `ai.run` router so local-model testing works.

### 2. Categorized content briefs
For a sensible subset of plan items (e.g. the first 2–3 weeks), generate content briefs (angle, key message, proof to use, format spec, do/don't from rules_constraints) into a `content_briefs` table or the existing brief structure if one already fits — search first; do not duplicate an existing table.

### 3. Calendar entries
Convert near-term plan items into real entries in whatever table the existing CalendarTab + `publish-scheduled-posts` consume, in `draft`/`planned` status (NOT auto-published), linked back to `strategy_id` and `content_plan_item_id`. They must appear in the existing CalendarTab with no UI change required, and never trigger autopublish.

### 4. Approval-gated work creation
Today work is created immediately on generation. Change it so: strategy generation creates the plan/briefs/calendar entries in a **pending/draft** state, and the heavy execution-task creation (`refresh_client_execution_tasks`) fires only after the strategy (or its modules) is **approved** in the UI. Wire the existing module/strategy approval action (`src/components/strategy-os/modules/ModuleHeader.tsx` approve handler + its hook) to trigger materialization of approved work. Tentative/rejected strategies must not flood the operational task list.

### 5. Unify task visibility
Give the user one coherent view: either (a) make `strategy_tasks` and `client_execution_tasks` reconcile through a shared status, or (b) surface both in one tasks panel with clear source labels. Pick the lower-risk option, document the choice in a comment, and keep both hooks working.

## Acceptance criteria
- New migration applies cleanly (`supabase db push --dry-run --linked` shows it; do NOT push — the founder pushes after review).
- `npm run build` passes; `npx vitest run` for any touched `src/lib/strategy` tests passes; add unit tests for the plan generator (pure function: strategy modules → 90-day plan, covering pillar coverage + dedupe).
- New tables have RLS policies denying cross-agency and anon access (follow the pattern in recent migrations).
- Re-running generation twice for the same client produces no duplicate plan items/calendar entries.
- Deterministic path works with NO AI provider configured at all (so it never blocks on keys).

## Deliverables
- Summary of files changed/created with line ranges.
- The new table schemas + why.
- Test output.
- Any decision points where you chose between approaches, with reasoning.
- A short "founder review checklist" of things to manually verify.

Do the work now. Run your tests with the local harness only.

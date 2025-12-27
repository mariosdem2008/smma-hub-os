# Phase 1 Implementation Notes

## Tasks completed
- AI-001: Atomic budget operations module (pricing, budgets helpers, RPC migration)
- AI-002: ai-ask budget enforcement + atomic increment fix
- AI-003: Budget enforcement integration tests (including concurrency)
- AI-004: generate-ai-content canonical logging (ai_usage_logs + ai_runs) with dual-write
- AI-005: Runtime model logging from provider response in router

## Files changed
- docs/ai/spec_gaps.md
- src/ai/budgets.ts
- src/ai/budgets.test.ts
- src/ai/pricing.ts
- src/ai/providers/openai.ts
- src/ai/providers/types.ts
- src/ai/router.ts
- supabase/functions/_shared/budgets.ts
- supabase/functions/ai-ask/index.ts
- supabase/functions/generate-ai-content/index.ts
- supabase/migrations/20251227090000_ai_budget_atomic_ops.sql
- tests/integration/ai/budget-enforcement.test.ts

## Behavior changes
- ai-ask now reserves estimated budget before model execution and reconciles to actual cost after execution using an atomic RPC.
- ai-ask writes ai_runs with runtime model, tokens, and cost; token estimation uses chars/3 when provider usage is missing.
- generate-ai-content writes to ai_usage_logs and ai_runs while keeping legacy ai_history/ai_generation_usage writes (dual-write).
- generate-ai-content increments ai_budgets when a budget row exists (non-enforcing).
- Router logging uses provider-reported model when available; OpenAI provider returns runtime model metadata.

## How to test
- npm run test
- npm run lint
- npx tsc -p .
- npm run build

## Rollout notes + kill-switch plan
- No new feature flags were added in Phase 1.
- Budget enforcement now relies on ai_budget_apply_delta RPC for atomic checks/updates.

Rollback migration note:
- To rollback atomic budget behavior, drop or replace the ai_budget_apply_delta RPC and revert ai-ask to the prior budget update flow.
